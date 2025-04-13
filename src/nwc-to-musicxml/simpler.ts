import { Element, Elements } from "./xml.ts";

type NWCLine = {
  number: number;
  tag: string;
  values: Record<string, string[]>;
};

export function scan(source: string): NWCLine[] {
  const lines = source.split("\n").map((line) => line.trim()).filter((line) =>
    line.length > 0
  );
  const result = [];
  for (let number = 0, len = lines.length; number < len; number++) {
    const line = lines[number];
    const columns = line.split("|");
    if (columns[0] !== "") continue;
    const tag = columns[1].trim();
    const values = Object.fromEntries(
      columns.slice(2).map((value) => {
        const [k, v] = value.split(":");
        return [k, v.split(",")];
      }),
    );
    result.push({ number, tag, values });
  }
  return result;
}

 class Positions {
  constructor(readonly xml: Elements) {}

  #pitchElements: Record<string, Element> = {};
  #pitches: Element[] = [];
  #chords: number[] = [];
  #lines: number[] = [];

  #offset = 34;
  #signature = [0, 0, 0, 0, 0, 0, 0];
  #alterations = [0, 0, 0, 0, 0, 0, 0];

  static #clefStep: { [_: string]: number } = {
    Bass: 22,
    Treble: 34,
    Alto: 28,
    Tenor: 26,
  };

  static #alters: { [_: string]: number } = {
    x: 2,
    "#": 1,
    n: 0,
    b: -1,
    v: -2,
  };

  get pitches() {
    return this.#pitches;
  }

  visit(line: NWCLine) {
    switch (line.tag) {
      case "AddStaff":
        this.#signature = [0, 0, 0, 0, 0, 0, 0];
        this.#alterations = [0, 0, 0, 0, 0, 0, 0];
        break;
      case "Clef":
        this.#offset = Positions.#clefStep[line.tag] ?? 34;
        for(const shift of line.values.OctaveShift) {
          switch (shift) {
            case "Octave Up":
              this.#offset += 7;
              break;
            case "Octave Down":
              this.#offset -= 7;
              break;
            default:
              break;
          }
        }
        break;
      case "Key":
        for (const x of line.values.Signature) {
          this.#signature["CDEFGAB".indexOf(x[0])] =
            { "#": 1, "b": -1 }[x[1]] ?? 0;
        }
        break;
      case "Bar":
        this.#alterations = [...this.#signature];
        break;
      case "Note":
        this.#lines.push(line.number);
        this.#chords.push(this.#pitches.length);
        for (const pos in line.values.Pos) {
          this.#pitch(pos);
        }
        break;
      case "Rest":
        this.#lines.push(line.number);
        this.#chords.push(this.#pitches.length);
        // encode as empty chord
        break;
      case "Chord":
        this.#lines.push(line.number);
        if (line.values.Pos2) {
          this.#chords.push(this.#pitches.length);
          for (const pos in line.values.Pos2) {
            this.#pitch(pos);
          }
        }
        this.#chords.push(this.#pitches.length);
        for (const pos in line.values.Pos) {
          this.#pitch(pos);
        }
        break;
      default:
        break;
    }
  }

  #open: Set<number> = new Set();
  #tieStart: Set<number> = new Set();
  #tieEnd: Set<number> = new Set();

  #pitch(pos: string) {
    let from = 0;
    let alter = Positions.#alters[pos[0]];
    if (alter !== undefined) {
      from++;
    }
    const tied = "^" === pos[pos.length - 1];
    const offset = +pos.substring(from, pos.length - +tied) + this.#offset;

    const index = this.#pitches.length;
    if (this.#open.has(offset)) {
      this.#tieEnd.add(index);
    }
    if (tied) {
      this.#open.add(offset);
      this.#tieStart.add(index);
    } else {
      this.#open.delete(offset);
    }

    if (alter === undefined) {
      alter = this.#alterations[offset % 7];
    } else {
      this.#alterations[offset % 7] = alter;
    }
    const key = ["bb", "b", "n", "#", "x"][alter + 2] + offset;
    const octave = (offset / 7) | 0;
    const step = "CDEFGAB"[offset % 7];

    this.#pitches.push(
      this.#pitchElements[key] ||= this.xml.create(
        "pitch",
        undefined,
        this.xml.create("alter", undefined, alter.toString()),
        this.xml.create("octave", undefined, octave.toString()),
        this.xml.create("step", undefined, step),
      ),
    );
  }
}

function gcd(a: number, b: number): number {
  for (;;) {
    if (!b) return a;
    a = a % b;
    if (!a) return b;
    b = b % a;
  }
}

const FRACTION = 768;

 class Durations {
  #durations: number[] = [];
  #types: Element[] = [];
  #lines: number[] = [];

  constructor(readonly xml: Elements) {}

  #typeMap: Record<string, Element> = {};
  #pushType(dur: string) {
    this.#types.push(
      this.#typeMap[dur] ||= this.xml.create(
        "type",
        undefined,
        dur,
      ),
    );
  }

  #poly: Set<number> = new Set();

  visit(line: NWCLine) {
    switch (line.tag) {
      case "Note":
      case "Rest":
        this.#lines.push(line.number);
        this.#duration(line.number, line.values.Dur);
        break;
      case "Chord":
        this.#lines.push(line.number);
        if (line.values.Dur2) {
          this.#duration(line.number, line.values.Dur2);
          // indicate that following chord overlaps
          this.#poly.add(this.#durations.length);
        }
        this.#duration(line.number, line.values.Dur);
        break;
      default:
        break;
    }
  }

  #staccato: Set<number> = new Set();
  #tenuto: Set<number> = new Set();
  #accent: Set<number> = new Set();
  #slur: Set<number> = new Set();
  #grace: Set<number> = new Set();
  #triplet: Map<number, string> = new Map();
  #gcd = FRACTION;
  #dots: Map<number, number> = new Map();

  #duration(index: number, dur: string[]) {
    let duration = FRACTION;
    for (const s of dur) {
      switch (s) {
        case "16th":
          duration /= 16;
          this.#pushType("16th");
          break;
        case "32nd":
          duration /= 32;
          this.#pushType("32nd");
          break;
        case "64th":
          duration /= 64;
          this.#pushType("64th");
          break;
        case "8th":
          duration /= 8;
          this.#pushType("eighth");
          break;
        case "4th":
          duration /= 4;
          this.#pushType("quarter");
          break;
        case "Whole":
          this.#pushType("whole");
          break;
        case "Half":
          duration /= 2;
          this.#pushType("half");
          break;
        case "Dotted":
          duration *= 3 / 2;
          this.#dots.set(index, 1);
          break;
        case "DblDotted":
          duration *= 7 / 4;
          this.#dots.set(index, 2);
          break;
        case "Triplet=First":
          duration *= 2 / 3;
          this.#triplet.set(index, "First");
          break;
        case "Triplet=End":
          duration *= 2 / 3;
          this.#triplet.set(index, "End");
          break;
        case "Triplet":
          duration *= 2 / 3;
          this.#triplet.set(index, "");
          break;
        case "Staccato":
          this.#staccato.add(index);
          break;
        case "Tenuto":
          this.#tenuto.add(index);
          break;
        case "Accent":
          this.#accent.add(index);
          break;
        case "Slur":
          this.#slur.add(index);
          break;
        case "Grace":
          this.#grace.add(index);
          break;
        default:
          break;
      }
      this.#gcd = gcd(this.#gcd, duration);
      this.#durations.push(duration);
    }
  }
}

 class Options {
  visit(line: NWCLine) {
    switch (line.tag) {
      case "Chord":
      case "Note":
        if (line.values.Opts) {
          this.#options(line.number, line.values.Opts);
        }
        break;
    }
  }

  #beam: Map<number, string> = new Map();

  #options(index: number, opts: string[]) {
    for (const opt of opts) {
      switch (opt) {
        case "Beam=First":
          this.#beam.set(index, "First");
          break;
        case "Beam=End":
          this.#beam.set(index, "End");
          break;
        case "Beam":
          this.#beam.set(index, "");
          break;
        default:
          break;
      }
    }
  }
}

class Bars {
  #lines: number[] = [];
  visit(line: NWCLine) {
    if (line.tag === "Bar") {
      this.#lines.push(line.number);
    }
  }
}

 class Staffs {
  #lines: number[] = [];
  #names: string[] = [];
  visit(line: NWCLine) {
    if (line.tag === "AddStaff") {
      this.#lines.push(line.number);
      this.#names.push(line.values.Name[0]);
    }
  }
}

export class Transformer {
  #positions: Positions;
  #durations: Durations;
  #options: Options;
  #bars: Bars;
  #staffs: Staffs;

  constructor(xml: Elements) {
    this.#positions = new Positions(xml);
    this.#durations = new Durations(xml);
    this.#options = new Options();
    this.#bars = new Bars();
    this.#staffs = new Staffs();
  }

  visit(line: NWCLine) {
    this.#positions.visit(line);
    this.#durations.visit(line);
    this.#options.visit(line);
    this.#bars.visit(line);
    this.#staffs.visit(line);
  }

}