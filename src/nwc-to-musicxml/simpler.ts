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
const HEADER = '<?xml version="1.0" encoding="UTF-8"?>'; //<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "https://raw.githubusercontent.com/w3c/musicxml/refs/tags/v4.0/schema/partwise.dtd">';

class MusicXML {
  readonly chord: Element;
  readonly rest: Element;
  readonly clefs: Record<string, Element>;
  readonly timeMod: Element;
  readonly startTie: Element;
  readonly stopTie: Element;
  readonly dot: Element;
  readonly barlines: Record<string, Element>;
  readonly startSustain: Element;
  readonly stopSustain: Element;

  constructor(private xml = new Elements()) {
    this.chord = xml.create("chord");
    this.rest = xml.create("rest");
    const c = xml.create("sign", undefined, "C");
    this.clefs = {
      Bass: xml.create("clef", undefined, xml.create("sign", undefined, "F")),
      Alto: xml.create("clef", undefined, c),
      Tenor: xml.create(
        "clef",
        undefined,
        c,
        xml.create("line", undefined, "4"),
      ),
      Treble: xml.create("clef", undefined, xml.create("sign", undefined, "G")),
    };
    this.timeMod = xml.create(
      "time-modification",
      undefined,
      xml.create("actual-notes", undefined, "3"),
      xml.create("normal-notes", undefined, "2"),
    );
    this.startTie = xml.create("tie", { type: "start" });
    this.stopTie = xml.create("tie", { type: "stop" });
    this.dot = xml.create("dot");

    this.barlines = {
      Double: xml.create(
        "barline",
        { position: "left" },
        xml.create("bar-style", undefined, "double"),
      ),
      SectionOpen: xml.create(
        "barline",
        { position: "left" },
        xml.create("bar-style", undefined, "heavy-light"),
      ),
      SectionClose: xml.create(
        "barline",
        { position: "right" },
        xml.create("bar-style", undefined, "light-heavy"),
      ),
      MasterRepeatOpen: xml.create(
        "barline",
        { position: "left" },
        xml.create("bar-style", undefined, "heavy-light"),
        xml.create("repeat", { direction: "forward" }),
      ),
      MasterRepeatClose: xml.create(
        "barline",
        { position: "right" },
        xml.create("bar-style", undefined, "light-heavy"),
        xml.create("repeat", { direction: "backward" }),
      ),
      LocalRepeatOpen: xml.create(
        "barline",
        { position: "left" },
        xml.create("bar-style", undefined, "light-light"),
        xml.create("repeat", { direction: "forward" }),
      ),
      LocalRepeatClose: xml.create(
        "barline",
        { position: "right" },
        xml.create("bar-style", undefined, "light-light"),
        xml.create("repeat", { direction: "backward" }),
      ),
    };
    this.startSustain = xml.create(
      "direction",
      undefined,
      xml.create(
        "direction-type",
        undefined,
        xml.create("pedal", { type: "start" }),
      ),
    );
    this.stopSustain = xml.create(
      "direction",
      undefined,
      xml.create(
        "direction-type",
        undefined,
        xml.create("pedal", { type: "stop" }),
      ),
    );
  }

  key(fifths: number): Element {
    return this.#cache["K" + fifths] ||= this.xml.create(
      "key",
      undefined,
      this.xml.create("fifths", undefined, fifths.toString()),
    );
  }

  #steps = [..."CDEFGAB"].map((step) =>
    this.xml.create("step", undefined, step)
  );
  #octaves = [..."0123456789"].map((octave) =>
    this.xml.create("octave", undefined, octave)
  );
  #alters = Object.fromEntries(
    [...ALTSTR].map((
      alter,
      i,
    ) => [alter, this.xml.create("alter", undefined, (i - 2).toString())]),
  );

  pitch(tone: number, alter: string): Element {
    return this.#cache[alter + tone] ||= this.create(
      "pitch",
      undefined,
      this.#steps[tone % 7],
      alter === "n" ? null : this.#alters[alter],
      this.#octaves[(tone / 7) | 0],
    );
  }

  type(dur: string): Element {
    return this.#cache["T" + dur] ||= this.xml.create("type", undefined, dur);
  }

  note(...Elements: (Element | null)[]): Element {
    return this.create("note", undefined, ...Elements);
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

  #cache: Record<string, Element> = {};

  duration(duration: string): Element {
    return this.#cache["D" + duration] ||= this.xml.create(
      "duration",
      undefined,
      duration,
    );
  }

  create(
    name: string,
    attributes?: Record<string, string>,
    ...Elements: (Element | string | null)[]
  ): Element {
    return this.xml.create(
      name,
      attributes,
      ...Elements.filter((x) => x !== null),
    );
  }

  stringify(element: Element): string {
    return HEADER + this.xml.stringify(element);
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

  #open: Map<number, string> = new Map();
  #startTie: Set<number> = new Set();
  #stopTie: Set<number> = new Set();

  // this is what musicians must do in their heads while reading sheet music
  #pitch(pos: string) {
    const altered = ALTSTR.includes(pos[0]);
    const startTie = pos[pos.length - 1] === "^";
    const tone = +pos.substring(+altered, pos.length - +startTie) +
      this.#tone;
    const index = this.#tones.length;
    const stopTie = this.#open.get(tone);

    if (stopTie) {
      this.#stopTie.add(index);
    }

    if (altered) {
      this.#altersByTone[tone % 7] = pos[0];
      this.#alters.push(pos[0]);
    } else if (stopTie) {
      this.#alters.push(stopTie);
    } else {
      this.#alters.push(this.#altersByTone[tone % 7]);
    }

    if (startTie) {
      this.#open.set(tone, this.#alters[index]);
      this.#startTie.add(index);
    } else {
      this.#open.delete(tone);
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

  startTie(group: number): Set<number> {
    const from = group && this.#groups[group - 1];
    const to = this.#groups[group];
    return new Set(
      Array.from({ length: to - from }).map((_, i) => i).filter((i) =>
        this.#startTie.has(i + from)
      ),
    );
  }

  stopTie(group: number): Set<number> {
    const from = group && this.#groups[group - 1];
    const to = this.#groups[group];
    return new Set(
      Array.from({ length: to - from }).map((_, i) => i).filter((i) =>
        this.#stopTie.has(i + from)
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
  #measure: number[] = [];
  #durations: number[] = [];
  #types: string[] = [];
  #lines: number[] = [];
  #poly: Set<number> = new Set();
  #parts: Set<number> = new Set();
  #clefs: Map<number, string> = new Map();
  #keys: Map<number, number> = new Map();
  #times: Map<number, string> = new Map();
  #startSustain: Set<number> = new Set();
  #stopSustain: Set<number> = new Set();

  visit(line: NWCLine) {
    switch (line.tag) {
      case "AddStaff":
        this.#measure.push(this.#durations.length);
        this.#parts.add(this.#durations.length);
        break;
      case "Bar":
        this.#measure.push(this.#durations.length);
        break;
      case "Note":
      case "Rest":
        this.#lines.push(line.number);
        this.#duration(line.values.Dur);
        break;
      case "Chord":
        this.#lines.push(line.number);
        if (line.values.Dur2) {
          this.#duration(line.values.Dur2);
          this.#poly.add(this.#durations.length);
        }
        this.#duration(line.values.Dur);
        break;
      case "Clef":
        this.#clefs.set(
          this.#durations.length,
          line.values.Type[0],
        );
        break;
      case "Key": {
        let fifths = 0;
        for (const x of line.values.Signature) {
          if (x[1] === "#") {
            fifths++;
          } else {
            fifths--;
          }
        }
        this.#keys.set(
          this.#durations.length,
          fifths,
        );
        break;
      }
      case "TimeSig":
        this.#times.set(
          this.#durations.length,
          line.values.Signature[0],
        );
        break;
      case "SustainPedal":
        if (line.values.Status?.[0] === "Released") {
          this.#stopSustain.add(this.#durations.length);
        } else {
          this.#startSustain.add(this.#durations.length);
        }
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

  #duration(dur: string[]) {
    const index = this.#durations.length;
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

  #attributes(i: number, xml: MusicXML) {
    const content: (Element)[] = [];
    if (this.#parts.has(i)) {
      content.push(
        xml.create(
          "divisions",
          undefined,
          (FRACTION / 4 / this.#gcd).toString(),
        ),
      );
    }
    const key = this.#keys.get(i);
    if (key !== undefined) {
      content.push(xml.key(key));
    }
    const time = this.#times.get(i);
    if (time === "Common") {
      content.push(
        xml.create(
          "time",
          undefined,
          xml.create("beats", undefined, "4"),
          xml.create("beat-type", undefined, "4"),
        ),
      );
    } else if (time === "AllaBreve") {
      content.push(
        xml.create(
          "time",
          undefined,
          xml.create("beats", undefined, "2"),
          xml.create("beat-type", undefined, "2"),
        ),
      );
    } else if (time) {
      const [beats, beatType] = time.split("/");
      content.push(
        xml.create(
          "time",
          undefined,
          xml.create("beats", undefined, beats),
          xml.create("beat-type", undefined, beatType),
        ),
      );
    }
    const clef = this.#clefs.get(i);
    if (clef) {
      content.push(xml.clefs[clef]);
    }
    if (content.length === 0) return null;
    return xml.create(
      "attributes",
      undefined,
      ...content,
    );
  }

  notes(
    measure: number,
    positions: Positions,
    xml: MusicXML,
  ): (Element | null)[] {
    const result: (Element | null)[] = [];
    const to = this.#measure[measure + 1] ?? this.#durations.length;
    for (let i = this.#measure[measure]; i < to; i++) {
      // three types of element that should stay in proper order...
      result.push(this.#attributes(i, xml));
      // directions
      if (this.#stopSustain.has(i)) {
        result.push(xml.stopSustain);
      }
      if (this.#startSustain.has(i)) {
        result.push(xml.startSustain);
      }
      const duration = xml.create(
        "duration",
        undefined,
        (this.#durations[i] / this.#gcd).toString(),
      );
      const type = xml.type(this.#types[i]);
      const timeMod = this.#triplet.has(i) ? xml.timeMod : null;
      const pitches = positions.pitches(i, xml);
      const dots = Array.from({ length: this.#dots.get(i) ?? 0 }).map(() =>
        xml.dot
      );
      if (pitches.length === 0) {
        result.push(
          xml.note(
            xml.rest,
            duration,
            type,
            ...dots,
            timeMod,
          ),
        );
        continue;
      }
      const stopTie = positions.stopTie(i);
      const startTie = positions.startTie(i);
      result.push(xml.note(
        this.#poly.has(i) ? xml.chord : null,
        pitches[0],
        duration,
        stopTie.has(0) ? xml.stopTie : null,
        startTie.has(0) ? xml.startTie : null,
        type,
        ...dots,
        timeMod,
      ));
      for (let j = 1; j < pitches.length; j++) {
        result.push(xml.note(
          xml.chord,
          pitches[j],
          duration,
          stopTie.has(j) ? xml.stopTie : null,
          startTie.has(j) ? xml.startTie : null,
          type,
          ...dots,
          timeMod,
        ));
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

const CLOSING_BARS = new Set([
  "SectionClose",
  "MasterRepeatClose",
  "LocalRepeatClose",
]);

class Bars {
  #lines: number[] = [];
  #staves: number[] = [];
  #measures = -1;

  #barStyles: Map<number, string> = new Map();

  visit(line: NWCLine) {
    switch (line.tag) {
      case "AddStaff":
        this.#lines.push(line.number);
        this.#measures++;
        this.#staves.push(this.#measures);
        break;
      case "Bar":
        this.#lines.push(line.number);
        this.#measures++;
        if (line.values.Style) {
          const style = line.values.Style[0];
          this.#barStyles.set(this.#measures - +CLOSING_BARS.has(style), style);
        }
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
    const from = this.#staves[staff];
    const to = this.#staves[staff + 1] ?? this.#measures + 1;
    for (let i = from; i < to; i++) {
      const notes = durations.notes(i, positions, xml);
      if (notes.length === 0) continue;
      const barStyle = this.#barStyles.get(i);
      const closingBar = barStyle && CLOSING_BARS.has(barStyle);
      result.push(
        xml.create(
          "measure",
          { number: (i + 1 - from).toString() },
          barStyle && !closingBar ? xml.barlines[barStyle] : null,
          ...notes,
          closingBar ? xml.barlines[barStyle] : null,
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
