import { assert } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Element, Elements } from "./xml.ts";

type NWCLine = {
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
    result.push({ tag, values });
  }
  return result;
}

const ALTSTR = "vbn#x";
const HEADER = '<?xml version="1.0" encoding="UTF-8"?>'; //<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "https://raw.githubusercontent.com/w3c/musicxml/refs/tags/v4.0/schema/partwise.dtd">';

class MusicXML {
  readonly chord: Element;
  readonly rest: Element;
  readonly timeMod: Element;
  readonly tie: { start: Element; stop: Element };
  readonly tied: { start: Element; stop: Element };
  readonly dot: Element;
  readonly barlines: Record<string, Element>;
  readonly startSustain: Element;
  readonly stopSustain: Element;
  readonly dynamics: Record<string, Element>;
  readonly staccato: Element;
  readonly tenuto: Element;
  readonly accent: Element;

  constructor(private xml = new Elements()) {
    this.chord = xml.create("chord");
    this.rest = xml.create("rest");
    this.timeMod = xml.create(
      "time-modification",
      undefined,
      xml.create("actual-notes", undefined, "3"),
      xml.create("normal-notes", undefined, "2"),
    );
    this.tie = {
      start: xml.create("tie", { type: "start" }),
      stop: xml.create("tie", { type: "stop" }),
    };
    this.tied = {
      start: xml.create("tied", { type: "start" }),
      stop: xml.create("tied", { type: "stop" }),
    };
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
    this.startSustain = this.#direction(
      xml.create("pedal", { type: "start" }),
    );
    this.stopSustain = this.#direction(
      xml.create("pedal", { type: "stop" }),
    );
    this.dynamics = Object.fromEntries(
      ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"].map((
        d,
      ) => [
        d,
        this.#direction(xml.create("dynamics", undefined, xml.create(d))),
      ]),
    );
    this.staccato = xml.create("staccato");
    this.tenuto = xml.create("tenuto");
    this.accent = xml.create("accent");
  }

  wedge(type: string) {
    return this.#cache["wedge" + type] = this.#direction(
      this.xml.create("wedge", { type }),
    );
  }

  clef(type: string, octaveChange: number): Element {
    const key = type + octaveChange;
    if (this.#cache[key]) return this.#cache[key];
    const elements = [];
    switch (type) {
      case "Bass":
        elements.push(this.xml.create("sign", undefined, "F"));
        break;
      case "Alto":
        elements.push(this.xml.create("sign", undefined, "C"));
        break;
      case "Tenor":
        elements.push(
          this.xml.create("sign", undefined, "C"),
          this.xml.create("line", undefined, "4"),
        );
        break;
      case "Treble":
        elements.push(this.xml.create("sign", undefined, "G"));
        break;
      default:
        throw new Error("Unknown Clef Type");
    }
    if (octaveChange) {
      elements.push(this.xml.create("clef-octave-change", undefined, "octave"));
    }
    return this.#cache[key] = this.create(
      "clef",
      undefined,
      ...elements,
    );
  }

  #direction(type: Element) {
    return this.create(
      "direction",
      undefined,
      this.xml.create("direction-type", undefined, type),
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

  note(...elements: (Element | null)[]): Element {
    return this.create("note", undefined, ...elements);
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

  metronome(
    tempo: number,
    base: string = "Quarter",
  ): Element {
    const [type, dotted] = base.split(" ");
    return this.#cache["M" + tempo + base] ||= this.#direction(
      this.create(
        "metronome",
        undefined,
        this.xml.create("beat-unit", undefined, type.toLowerCase()),
        dotted ? this.xml.create("beat-unit-dot") : null,
        this.xml.create("per-minute", undefined, tempo.toString()),
      ),
    );
  }

  time(n: string, d: string): Element {
    return this.#cache["T" + n + "/" + d] ||= this.xml.create(
      "time",
      undefined,
      this.xml.create("beats", undefined, n),
      this.xml.create("beat-type", undefined, d),
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
  #tone = 34;
  #signature = [...N7];
  #altersByTone = [...N7];
  #backup: Set<number> = new Set();

  visit(line: NWCLine) {
    switch (line.tag) {
      case "AddStaff":
        this.#signature = [...N7];
        this.#altersByTone = [...N7];
        break;
      case "Clef":
        this.#tone = CLEF_TONE.get(line.values.Type[0]) ?? 34;
        if (!line.values.OctaveShift) break;
        switch (line.values.OctaveShift[0]) {
          case "Octave Up":
            this.#tone += 7;
            break;
          case "Octave Down":
            this.#tone -= 7;
            break;
          default:
            break;
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
      case "Rest":
      case "Chord":
      case "RestChord":
        if (line.values.Pos2) {
          for (const pos of line.values.Pos2) this.#pitch(pos);
          this.#backup.add(this.#groups.length);
          this.#groups.push(this.#tones.length);
        }
        if (line.values.Pos) {
          for (const pos of line.values.Pos) this.#pitch(pos);
        }
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
    const tone = +pos.substring(+altered, pos.length - +startTie) + this.#tone;
    const index = this.#tones.length;
    const stopTie = this.#open.get(tone);

    if (stopTie) this.#stopTie.add(index);

    if (altered) {
      this.#altersByTone[tone % 7] = pos[0];
      this.#alters.push(pos[0]);
    } else if (stopTie) this.#alters.push(stopTie);
    else {
      this.#alters.push(this.#altersByTone[tone % 7]);
    }

    if (startTie) {
      this.#open.set(tone, this.#alters[index]);
      this.#startTie.add(index);
    } else this.#open.delete(tone);
    this.#tones.push(tone);
  }

  // a group is a set of simultaneous notes of equal duration
  notes(group: number): number[] {
    const from = group && this.#groups[group - 1];
    const to = this.#groups[group];
    return Array.from({ length: to - from }, (_, i) => i + from);
  }

  pitch(note: number, xml: MusicXML): Element {
    return xml.pitch(this.#tones[note], this.#alters[note]);
  }

  ties(note: number): ("start" | "stop")[] {
    const ties: ("start" | "stop")[] = [];
    if (this.#stopTie.has(note)) ties.push("stop");
    if (this.#startTie.has(note)) ties.push("start");
    return ties;
  }

  backup(group: number): boolean {
    return this.#backup.has(group);
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
  #parts: Set<number> = new Set();
  #clefs: Map<number, string> = new Map();
  #clefOctaveChanges: Map<number, number> = new Map();
  #keys: Map<number, number> = new Map();
  #times: Map<number, string> = new Map();
  #startSustain: Set<number> = new Set();
  #stopSustain: Set<number> = new Set();
  #dynamics: Map<number, string> = new Map();
  #tempo: Map<number, number> = new Map();
  #tempoBase: Map<number, string> = new Map();

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
      case "Chord":
      case "RestChord":
        if (line.values.Dur2) {
          this.#duration(line.values.Dur2);
        }
        this.#duration(line.values.Dur);
        break;
      case "Clef":
        this.#clefs.set(this.#durations.length, line.values.Type[0]);
        if (!line.values.OctaveShift) break;
        switch (line.values.OctaveShift[0]) {
          case "Octave Up":
            this.#clefOctaveChanges.set(this.#durations.length, 1);
            break;
          case "Octave Down":
            this.#clefOctaveChanges.set(this.#durations.length, -1);
            break;
          default:
            break;
        }
        break;
      case "Key": {
        let fifths = 0;
        for (const x of line.values.Signature) {
          if (x[1] === "#") fifths++;
          else fifths--;
        }
        this.#keys.set(this.#durations.length, fifths);
        break;
      }
      case "TimeSig":
        this.#times.set(this.#durations.length, line.values.Signature[0]);
        break;
      case "SustainPedal":
        if (line.values.Status?.[0] === "Released") {
          this.#stopSustain.add(this.#durations.length);
        } else {
          this.#startSustain.add(this.#durations.length);
        }
        break;
      case "Dynamic":
      case "DynamicVariance":
        this.#dynamic(this.#durations.length, line.values.Style[0]);
        break;
      case "Tempo":
        this.#tempo.set(this.#durations.length, +line.values.Tempo[0]);
        if (line.values.Base) {
          this.#tempoBase.set(this.#durations.length, line.values.Base[0]);
        }
        break;
      default:
        break;
    }
  }

  #wedged: boolean = false;
  #wedge: Map<number, string> = new Map();

  #dynamic(length: number, arg1: string) {
    if (this.#wedged) {
      this.#wedge.set(length, "stop");
      this.#wedged = false;
    }
    switch (arg1) {
      case "Sforzando":
        this.#dynamics.set(length, "sfz");
        break;
      case "Rinforzando":
        this.#dynamics.set(length, "rfz");
        break;
      case "Crescendo":
        this.#wedge.set(length, "crescendo");
        this.#wedged = true;
        break;
      case "Decrescendo":
      case "Diminuendo":
        this.#wedge.set(length, "diminuendo");
        this.#wedged = true;
        break;
      default:
        this.#dynamics.set(length, arg1);
        break;
    }
  }

  #staccato: Set<number> = new Set();
  #tenuto: Set<number> = new Set();
  #accent: Set<number> = new Set();
  #slurred: boolean = false;
  #startSlur: Set<number> = new Set();
  #stopSlur: Set<number> = new Set();
  #grace: Set<number> = new Set();
  #triplet: Map<number, string> = new Map();
  #gcd = FRACTION;
  #dots: Map<number, number> = new Map();

  #duration(dur: string[]) {
    const index = this.#durations.length;
    let duration = FRACTION;
    let slurred = false;
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
          slurred = true;
          break;
        case "Grace":
          this.#grace.add(index);
          break;
        default:
          break;
      }
    }
    if (slurred !== this.#slurred) {
      if (slurred) {
        this.#startSlur.add(index);
      } else {
        this.#stopSlur.add(index);
      }
      this.#slurred = slurred;
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
    if (key !== undefined) content.push(xml.key(key));
    const time = this.#times.get(i);
    if (time === "Common") {
      content.push(xml.time("4", "4"));
    } else if (time === "AllaBreve") {
      content.push(xml.time("2", "2"));
    } else if (time) {
      const [beats, beatType] = time.split("/");
      content.push(xml.time(beats, beatType));
    }
    const clef = this.#clefs.get(i);
    if (clef) content.push(xml.clef(clef, this.#clefOctaveChanges.get(i) ?? 0));
    if (content.length === 0) return null;
    return xml.create("attributes", undefined, ...content);
  }

  notes(
    measure: number,
    positions: Positions,
    xml: MusicXML,
  ): (Element | null)[] {
    const result: (Element | null)[] = [];
    const to = this.#measure[measure + 1] ?? this.#durations.length;
    for (let i = this.#measure[measure]; i < to; i++) {
      result.push(this.#attributes(i, xml));
      this.#directions(i, result, xml);
      const duration = xml.create(
        "duration",
        undefined,
        (this.#durations[i] / this.#gcd).toString(),
      );
      const type = xml.type(this.#types[i]);
      const timeMod = this.#triplet.has(i) ? xml.timeMod : null;
      const dots = Array.from(
        { length: this.#dots.get(i) ?? 0 },
        () => xml.dot,
      );
      const grace = this.#grace.has(i) ? xml.create("grace") : null;
      const notes = positions.notes(i);
      if (notes.length === 0) {
        result.push(xml.note(xml.rest, duration, type, ...dots, timeMod));
        continue;
      }
      const notations: Element[] = [];
      this.#articulations(i, xml, notations);
      if (this.#startSlur.has(i)) {
        notations.push(xml.create("slur", { type: "start" }));
      }
      if (this.#stopSlur.has(i)) {
        notations.push(xml.create("slur", { type: "stop" }));
      }
      for (let j = 0; j < notes.length; j++) {
        const ties = positions.ties(notes[j]);
        notations.push(
          ...ties.map((it) => xml.tied[it]),
        );
        result.push(
          xml.note(
            grace,
            j ? xml.chord : null, // no chord element in the first note
            positions.pitch(notes[j], xml),
            duration,
            ...ties.map((it) => xml.tie[it]),
            xml.create("voice", undefined, positions.backup(i) ? "2" : "1"),
            type,
            ...dots,
            timeMod,
            notations.length > 0
              ? xml.create(
                "notations",
                undefined,
                ...notations,
              )
              : null,
          ),
        );
      }
      if (positions.backup(i)) {
        result.push(xml.create("backup", undefined, duration));
      }
    }
    return result;
  }

  #articulations(i: number, xml: MusicXML, notations: Element[]) {
    const articulations = [];
    if (this.#staccato.has(i)) articulations.push(xml.staccato);
    if (this.#tenuto.has(i)) articulations.push(xml.tenuto);
    if (this.#accent.has(i)) articulations.push(xml.accent);
    if (articulations.length > 0) {
      notations.push(
        xml.create("articulations", undefined, ...articulations),
      );
    }
  }

  #directions(i: number, result: (Element | null)[], xml: MusicXML) {
    const tempo = this.#tempo.get(i);
    if (tempo) result.push(xml.metronome(tempo, this.#tempoBase.get(i)));
    if (this.#stopSustain.has(i)) result.push(xml.stopSustain);
    if (this.#startSustain.has(i)) result.push(xml.startSustain);
    const dynamic = this.#dynamics.get(i);
    if (dynamic) result.push(xml.dynamics[dynamic]);
    const wedge = this.#wedge.get(i);
    if (wedge) {
      result.push(xml.wedge(wedge));
    }
  }
}

const CLOSING_BARS = new Set([
  "SectionClose",
  "MasterRepeatClose",
  "LocalRepeatClose",
]);

class Bars {
  #staves: number[] = [];
  #measures = -1;
  #barStyles: Map<number, string> = new Map();
  #endingBar: string = "SectionClose";

  visit(line: NWCLine) {
    switch (line.tag) {
      case "AddStaff":
        if (this.#measures) {
          this.#barStyles.set(this.#measures, this.#endingBar);
        }
        this.#measures++;
        this.#staves.push(this.#measures);
        break;
      case "StaffProperties":
        if (line.values.EndingBar) {
          this.#endingBar = line.values.EndingBar[0].replaceAll(" ", "");
        }
        break;
      case "Bar":
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

  visitEnd() {
    this.#barStyles.set(this.#measures, this.#endingBar);
    this.#staves.push(this.#measures + 1);
  }

  measures(
    staff: number,
    durations: Durations,
    positions: Positions,
    xml: MusicXML,
  ): Element[] {
    const result: Element[] = [];
    for (
      let i = this.#staves[staff], to = this.#staves[staff + 1], number = 0;
      i < to;
      i++
    ) {
      const notes = durations.notes(i, positions, xml);
      if (notes.length === 0) continue;
      // be careful with measure numbers
      number++;
      const barStyle = this.#barStyles.get(i);
      const closingBar = barStyle && CLOSING_BARS.has(barStyle);
      result.push(
        xml.create(
          "measure",
          { number: number.toString() },
          barStyle && !closingBar ? xml.barlines[barStyle] : null,
          ...notes,
          closingBar ? xml.barlines[barStyle] : null,
        ),
      );
    }
    return result;
  }
}

class Staves {
  #names: string[] = [];
  #ids: { id: string }[] = [];
  visit(line: NWCLine) {
    switch (line.tag) {
      case "AddStaff":
        this.#names.push(line.values.Name[0].slice(1, -1));
        this.#ids.push({ id: `P${this.#names.length}` });
        break;
      default:
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
      xml.create("part-list", undefined, ...scoreParts),
      ...parts,
    );
  }
}

export class Transformer {
  #positions: Positions;
  #durations: Durations;
  #bars: Bars;
  #staves: Staves;

  constructor() {
    this.#positions = new Positions();
    this.#durations = new Durations();
    this.#bars = new Bars();
    this.#staves = new Staves();
  }

  transform(source: string): string {
    const lines = scan(source);
    for (const line of lines) {
      this.#positions.visit(line);
      this.#durations.visit(line);
      this.#bars.visit(line);
      this.#staves.visit(line);
    }
    this.#bars.visitEnd();
    const xml = new MusicXML();
    return xml.stringify(
      this.#staves.parts(this.#bars, this.#durations, this.#positions, xml),
    );
  }
}
