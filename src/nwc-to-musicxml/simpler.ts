import { assert } from "https://deno.land/std@0.178.0/testing/asserts.ts";
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

const ALTSTR = "vbn#x";

class MusicXML {
  readonly chord: Element;
  readonly rest: Element;

  constructor(private xml = new Elements()) {
    this.chord = xml.create("chord");
    this.rest = xml.create("rest");
  }

  #pitchElements: Record<string, Element> = {};

  pitch(tone: number, alter: string): Element {
    const key = alter + tone;
    const octave = ((tone / 7) | 0).toString();
    const step = "CDEFGAB"[tone % 7];
    const a = ALTSTR.indexOf(alter) - 2;
    if (a) {
      return this.#pitchElements[key] ||= this.xml.create(
        "pitch",
        undefined,
        this.xml.create("step", undefined, step),
        this.xml.create("alter", undefined, a.toString()),
        this.xml.create("octave", undefined, octave),
      );
    }
    return this.#pitchElements[key] ||= this.xml.create(
      "pitch",
      undefined,
      this.xml.create("step", undefined, step),
      this.xml.create("octave", undefined, octave),
    );
  }

  #typeMap: Record<string, Element> = {};
  type(dur: string): Element {
    return this.#typeMap[dur] ||= this.xml.create("type", undefined, dur);
  }

  note(...Elements: Element[]): Element {
    return this.xml.create("note", undefined, ...Elements);
  }

  measure(
    number: number,
    ...elements: Element[]
  ): Element {
    return this.xml.create(
      "measure",
      { number: number.toString() },
      ...elements,
    );
  }

  create(
    name: string,
    attributes?: Record<string, string>,
    ...Elements: (Element | string)[]
  ): Element {
    return this.xml.create(name, attributes, ...Elements);
  }

  stringify(element: Element): string {
    return this.xml.stringify(element);
  }
}

const N7 = "nnnnnnn";

const CLEF_TONE = new Map([
  ["Bass", 22],
  ["Treble", 34],
  ["Alto", 28],
  ["Tenor", 26],
]);

class Positions {
  #alters: string[] = [];
  #tones: number[] = [];
  #groups: number[] = [];
  #lines: number[] = [];

  #tone = 34;
  #signature = [...N7];
  #altersByTone = [...N7];

  visit(line: NWCLine) {
    switch (line.tag) {
      case "AddStaff":
        this.#signature = [...N7];
        this.#altersByTone = [...N7];
        break;
      case "Clef":
        this.#tone = CLEF_TONE.get(line.values.Type[0]) ?? 34;
        if (!line.values.OctaveShift) break;
        for (const shift of line.values.OctaveShift) {
          switch (shift) {
            case "Octave Up":
              this.#tone += 7;
              break;
            case "Octave Down":
              this.#tone -= 7;
              break;
            default:
              break;
          }
        }
        break;
      case "Key":
        this.#signature = [...N7];
        this.#altersByTone = [...N7];
        for (const x of line.values.Signature) {
          const index = "CDEFGAB".indexOf(x[0]);
          this.#signature[index] = this.#altersByTone[index] = x[1];
        }
        break;
      case "Bar":
        this.#altersByTone = [...this.#signature];
        break;
      case "Note":
        for (const pos of line.values.Pos) {
          this.#pitch(pos);
        }
        this.#lines.push(line.number);
        this.#groups.push(this.#tones.length);
        break;
      case "Rest":
        // encode as empty chord
        this.#lines.push(line.number);
        this.#groups.push(this.#tones.length);
        break;
      case "Chord":
        if (line.values.Pos2) {
          for (const pos of line.values.Pos2) {
            this.#pitch(pos);
          }
          this.#lines.push(line.number);
          this.#groups.push(this.#tones.length);
        }
        for (const pos of line.values.Pos) {
          this.#pitch(pos);
        }
        this.#lines.push(line.number);
        this.#groups.push(this.#tones.length);
        break;
      default:
        break;
    }
  }

  #open: Set<number> = new Set();
  #tieStart: Set<number> = new Set();
  #tieEnd: Set<number> = new Set();

  #pitch(pos: string) {
    const altered = ALTSTR.includes(pos[0]);
    const tied = pos[pos.length - 1] === "^";
    const tone = +pos.substring(+altered, pos.length - +tied) +
      this.#tone;

    const index = this.#tones.length;
    if (this.#open.has(tone)) {
      this.#tieEnd.add(index);
    }
    if (tied) {
      this.#open.add(tone);
      this.#tieStart.add(index);
    } else {
      this.#open.delete(tone);
    }

    if (altered) {
      this.#altersByTone[tone % 7] = pos[0];
      this.#alters.push(pos[0]);
    } else {
      this.#alters.push(this.#altersByTone[tone % 7]);
    }
    this.#tones.push(tone);
  }

  pitches(group: number, xml: MusicXML): Element[] {
    const pitches: Element[] = [];
    const l = this.#groups[group];
    for (let i = group && this.#groups[group - 1]; i < l; i++) {
      pitches.push(xml.pitch(this.#tones[i], this.#alters[i]));
    }
    return pitches;
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
  #bar: number[] = [];
  #durations: number[] = [];
  #types: string[] = [];
  #lines: number[] = [];
  #poly: Set<number> = new Set();

  visit(line: NWCLine) {
    switch (line.tag) {
      case "AddStaff":
      case "Bar":
        this.#bar.push(this.#durations.length);
        break;
      case "Note":
      case "Rest":
        this.#lines.push(line.number);
        this.#duration(line.number, line.values.Dur);
        break;
      case "Chord":
        this.#lines.push(line.number);
        if (line.values.Dur2) {
          this.#duration(line.number, line.values.Dur2);
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
          this.#types.push("16th");
          break;
        case "32nd":
          duration /= 32;
          this.#types.push("32nd");
          break;
        case "64th":
          duration /= 64;
          this.#types.push("64th");
          break;
        case "8th":
          duration /= 8;
          this.#types.push("eighth");
          break;
        case "4th":
          duration /= 4;
          this.#types.push("quarter");
          break;
        case "Whole":
          this.#types.push("whole");
          break;
        case "Half":
          duration /= 2;
          this.#types.push("half");
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
    }
    this.#gcd = gcd(this.#gcd, duration);
    this.#durations.push(duration);
    assert(this.#types.length === this.#durations.length);
  }

  // todo: process all the other collected data
  notes(bar: number, positions: Positions, xml: MusicXML): Element[] {
    const result: Element[] = [];
    const to = this.#bar[bar + 1] ?? this.#durations.length;
    for (let i = this.#bar[bar]; i < to; i++) {
      const duration = xml.create(
        "duration",
        undefined,
        (this.#durations[i] / this.#gcd).toString(),
      );
      const type = xml.type(this.#types[i]);
      const pitches = positions.pitches(i, xml);
      if (pitches.length === 0) {
        result.push(
          xml.note(
            xml.rest,
            duration,
            type,
          ),
        );
        continue;
      }
      if (this.#poly.has(i)) {
        result.push(xml.note(
          pitches[0],
          xml.chord, // indicate that this is part of the previous chord
          duration,
          type,
        ));
      } else {
        result.push(xml.note(
          pitches[0],
          duration, // start new chord
          type,
        ));
      }
      for (let j = 1; j < pitches.length; j++) {
        const chorded = xml.note(
          pitches[j],
          xml.chord,
          duration,
          type,
        );
        result.push(chorded);
        console.info("chorded", xml.stringify(chorded));
      }
    }
    return result;
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
  #staff: number[] = [];
  #count = 0;
  visit(line: NWCLine) {
    switch (line.tag) {
      case "AddStaff":
        this.#lines.push(line.number);
        this.#staff.push(this.#count);
        this.#count++;
        break;
      case "Bar":
        this.#lines.push(line.number);
        this.#count++;
        break;
      default:
        break;
    }
  }

  measures(
    staff: number,
    durations: Durations,
    positions: Positions,
    xml: MusicXML,
  ): Element[] {
    const result: Element[] = [];
    const from = this.#staff[staff];
    const to = this.#staff[staff + 1] ?? this.#count;
    for (let i = from; i < to; i++) {
      result.push(
        xml.create(
          "measure",
          { number: (i + 1 - from).toString() },
          ...durations.notes(i, positions, xml),
        ),
      );
    }
    return result;
  }
}

class Staffs {
  #names: string[] = [];
  #ids: { id: string }[] = [];
  visit(line: NWCLine) {
    switch (line.tag) {
      case "AddStaff":
        this.#names.push(line.values.Name[0].slice(1, -1));
        this.#ids.push({ id: `P${this.#names.length}` });
        break;
    }
  }
  parts(
    bars: Bars,
    durations: Durations,
    positions: Positions,
    xml: MusicXML,
  ): Element {
    const scoreParts = [];
    const parts = [];
    for (let i = 0; i < this.#names.length; i++) {
      scoreParts.push(
        xml.create(
          "score-part",
          this.#ids[i],
          xml.create("part-name", undefined, this.#names[i]),
        ),
      );
      parts.push(
        xml.create(
          "part",
          this.#ids[i],
          ...bars.measures(i, durations, positions, xml),
        ),
      );
    }

    return xml.create(
      "score-partwise",
      { version: "4.0" },
      xml.create(
        "part-list",
        undefined,
        ...scoreParts,
      ),
      ...parts,
    );
  }
}

export class Transformer {
  #positions: Positions;
  #durations: Durations;
  #options: Options;
  #bars: Bars;
  #staffs: Staffs;

  constructor() {
    this.#positions = new Positions();
    this.#durations = new Durations();
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

  transform(source: string): string {
    const lines = scan(source);
    for (const line of lines) {
      this.visit(line);
    }
    const xml = new MusicXML();
    return xml.stringify(this.#staffs.parts(
      this.#bars,
      this.#durations,
      this.#positions,
      xml,
    ));
  }
}
