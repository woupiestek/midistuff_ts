import { assert } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Element } from "./xml.ts";
import { MusicXML } from "./musicxml.ts";

type NWCLine = {
  tag: string;
  values: Record<string, string[]>;
};

export function scan(source: string): NWCLine[] {
  const lines = source.split("\n").map((line) => line.trim()).filter((line) =>
    line.length > 0
  );
  const result = [];
  for (const line of lines) {
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

  visit(line: NWCLine): boolean {
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
        return false;
    }
    return true;
  }

  #open: Map<number, string> = new Map();
  #startTie: Set<number> = new Set();
  #stopTie: Set<number> = new Set();
  // track explicit accidentals
  #altered: Map<number, string> = new Map();

  // this is what musicians must do in their heads while reading sheet music
  #pitch(pos: string) {
    const altered = ALTSTR.includes(pos[0]);
    const startTie = pos[pos.length - 1] === "^";
    const tone = +pos.substring(+altered, pos.length - +startTie) + this.#tone;
    const index = this.#tones.length;
    const stopTie = this.#open.get(tone);

    if (stopTie) this.#stopTie.add(index);

    if (altered) {
      this.#altered.set(index, pos[0]);
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

  accidental(note: number, xml: MusicXML): Element | null {
    const alter = this.#altered.get(note);
    if (!alter) return null;
    return xml.accidental(alter);
  }

  backup(group: number): boolean {
    return this.#backup.has(group);
  }
}

const PER_WHOLE = 768;
const PER_QUARTER = 192;

class Durations {
  #measure: number[] = [];
  #durations: number[] = [];
  #types: string[] = [];
  #startSustain: Set<number> = new Set();
  #stopSustain: Set<number> = new Set();
  #dynamics: Map<number, string> = new Map();
  #tempo: Map<number, number> = new Map();
  #tempoBase: Map<number, string> = new Map();

  visit(line: NWCLine): boolean {
    switch (line.tag) {
      case "AddStaff":
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
        return false;
    }
    return true;
  }

  visitEnd() {
    this.#measure.push(this.#durations.length);
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
  #triplet: Set<number> = new Set();
  #dotted: Set<number> = new Set();
  #doubleDotted: Set<number> = new Set();

  #duration(dur: string[]) {
    const index = this.#durations.length;
    let duration = PER_WHOLE;
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
          this.#dotted.add(index);
          break;
        case "DblDotted":
          duration *= 7 / 4;
          this.#doubleDotted.add(index);
          break;
        case "Triplet=First":
        case "Triplet=End":
        case "Triplet":
          duration *= 2 / 3;
          this.#triplet.add(index);
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
          console.error("Unused duration", s);
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
    this.#durations.push(duration);
    assert(this.#types.length === this.#durations.length);
  }

  notes(
    measure: number,
    staff: number,
    positions: Positions,
    xml: MusicXML,
  ): (Element | null)[] {
    const result: (Element | null)[] = [];
    const to = this.#measure[measure + 1];
    for (let i = this.#measure[measure]; i < to; i++) {
      this.#directions(i, staff, result, xml);
      const type = xml.type(this.#types[i]);
      const timeMod = this.#triplet.has(i) ? xml.timeMod : null;
      const dots = this.#doubleDotted.has(i)
        ? [xml.dot, xml.dot]
        : this.#dotted.has(i)
        ? [xml.dot]
        : [];
      const notes = positions.notes(i);
      if (notes.length === 0) {
        result.push(
          xml.note(
            xml.rest,
            xml.duration(this.#durations[i]),
            xml.voice(
              positions.backup(i) ? staff.toString() + "'" : staff.toString(),
            ),
            type,
            ...dots,
            timeMod,
            xml.staff(staff),
          ),
        );
      } else {
        const grace = this.#grace.has(i) ? xml.create("grace") : null;
        const notations: Element[] = [];
        this.#articulations(i, xml, notations);
        if (this.#stopSlur.has(i)) {
          notations.push(xml.create("slur", { type: "stop" }));
        }
        if (this.#startSlur.has(i)) {
          notations.push(xml.create("slur", { type: "start" }));
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
              xml.duration(this.#durations[i]),
              ...ties.map((it) => xml.tie[it]),
              xml.voice(
                positions.backup(i) ? staff.toString() + "'" : staff.toString(),
              ),
              type,
              ...dots,
              positions.accidental(notes[j], xml),
              timeMod,
              xml.staff(staff),
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
      }
      if (this.#stopSustain.has(i + 1)) result.push(xml.stopSustain(staff));
      if (positions.backup(i)) {
        result.push(xml.backup(this.#durations[i]));
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

  #directions(
    i: number,
    staff: number,
    result: (Element | null)[],
    xml: MusicXML,
  ) {
    const tempo = this.#tempo.get(i);
    if (tempo) result.push(xml.metronome(tempo, this.#tempoBase.get(i), staff));
    if (this.#startSustain.has(i)) result.push(xml.startSustain(staff));
    const dynamic = this.#dynamics.get(i);
    if (dynamic) result.push(xml.direction(xml.dynamics[dynamic], staff));
    const wedge = this.#wedge.get(i);
    if (wedge) result.push(xml.wedge(wedge, staff));
  }
}

class Bars {
  #staves: number[] = [];
  #measures = -1;
  #barStyles: Map<number, string> = new Map();
  #endings: Map<number, string[]> = new Map();
  #endingBar: string = "SectionClose";

  #times: Map<number, string> = new Map();
  #clefs: Map<number, string> = new Map();
  #clefOctaveChanges: Map<number, number> = new Map();
  #keys: Map<number, number> = new Map();

  visit(line: NWCLine): boolean {
    switch (line.tag) {
      case "AddStaff":
        this.#measures++;
        this.#staves.push(this.#measures);
        if (this.#measures > 1) {
          this.#barStyles.set(this.#measures, this.#endingBar);
        }
        break;
      case "StaffProperties":
        if (line.values.EndingBar) {
          this.#endingBar = line.values.EndingBar[0].replaceAll(" ", "");
        }
        break;
      case "Bar":
        this.#measures++;
        if (line.values.Style) {
          this.#barStyles.set(this.#measures, line.values.Style[0]);
        }
        break;
      case "Ending":
        this.#endings.set(this.#measures, line.values.Endings);
        break;
      case "TimeSig":
        switch (line.values.Signature[0]) {
          case "Common":
            this.#times.set(this.#measures, "4/4");
            break;
          case "AllaBreve":
            this.#times.set(this.#measures, "2/2");
            break;
          default:
            this.#times.set(this.#measures, line.values.Signature[0]);
            break;
        }
        break;
      case "Clef":
        this.#clefs.set(this.#measures, line.values.Type[0]);
        if (!line.values.OctaveShift) break;
        switch (line.values.OctaveShift[0]) {
          case "Octave Up":
            this.#clefOctaveChanges.set(this.#measures, 1);
            break;
          case "Octave Down":
            this.#clefOctaveChanges.set(this.#measures, -1);
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
        this.#keys.set(this.#measures, fifths);
        break;
      }
      default:
        return false;
    }
    return true;
  }

  visitEnd() {
    this.#measures++;
    this.#staves.push(this.#measures);
    this.#barStyles.set(this.#measures, this.#endingBar);
  }

  single(
    staff: number,
    durations: Durations,
    positions: Positions,
    xml: MusicXML,
  ): Element[] {
    const result: Element[] = [];
    for (
      let i = this.#staves[staff],
        to = this.#staves[staff + 1],
        number = 0;
      i < to;
      i++
    ) {
      const notes = durations.notes(i, 1, positions, xml);
      if (notes.length === 0) continue;
      // be careful with measure numbers
      number++;
      const endings = this.#endings.get(i);
      result.push(
        xml.create(
          "measure",
          { number: number.toString() },
          xml.leftBarline(this.#barStyles.get(i), endings),
          this.#attributes(xml, i),
          ...notes,
          xml.rightBarline(this.#barStyles.get(i + 1), endings),
        ),
      );
    }
    return result;
  }

  double(
    staff: number,
    durations: Durations,
    positions: Positions,
    xml: MusicXML,
  ): Element[] {
    const result: Element[] = [];
    const offset = this.#staves[staff + 1] - this.#staves[staff];
    assert(
      this.#staves[staff + 2] === this.#staves[staff + 1] + offset,
      `Problem: unequal numbers of measures in staves ${staff} and ${
        staff + 1
      }.`,
    );
    let backup = xml.backup(PER_WHOLE);
    for (
      let i = this.#staves[staff],
        to = this.#staves[staff + 1],
        number = 0;
      i < to;
      i++
    ) {
      const time = this.#times.get(i) || this.#times.get(i + offset);
      if (time) {
        const [n, d] = time.split("/");
        backup = xml.backup(PER_WHOLE * +n / +d);
      }
      const notes = durations.notes(i, 1, positions, xml);
      notes.push(backup);
      notes.push(...durations.notes(i + offset, 2, positions, xml));
      // mind the backup!
      if (notes.length === 1) continue;
      // be careful with measure numbers
      number++;
      const endings = this.#endings.get(i) || this.#endings.get(i + offset);
      result.push(
        xml.create(
          "measure",
          { number: number.toString() },
          xml.leftBarline(
            this.#barStyles.get(i) || this.#barStyles.get(i + offset),
            endings,
          ),
          this.#attributes(xml, i, i + offset),
          ...notes,
          xml.rightBarline(
            this.#barStyles.get(i + 1) || this.#barStyles.get(i + offset + 1),
            endings,
          ),
        ),
      );
    }
    return result;
  }

  #attributes(xml: MusicXML, i: number, j?: number) {
    const content: (Element)[] = [];
    if (this.#staves.includes(i)) {
      content.push(
        xml.create(
          "divisions",
          undefined,
          PER_QUARTER.toString(),
        ),
      );
    }
    const key = this.#keys.get(i) || (j && this.#keys.get(j));
    if (key !== undefined) content.push(xml.key(key));
    const time = this.#times.get(i) || (j && this.#times.get(j));
    if (time) {
      const [beats, beatType] = time.split("/");
      content.push(xml.time(beats, beatType));
    }
    if (j && this.#staves.includes(i)) {
      content.push(
        xml.create(
          "staves",
          undefined,
          "2",
        ),
      );
    }
    // two staves, two clefs!
    const clef1 = this.#clefs.get(i);
    if (clef1) {
      content.push(xml.clef(clef1, this.#clefOctaveChanges.get(i) ?? 0, 1));
    }
    if (j) {
      const clef2 = this.#clefs.get(j);
      if (clef2) {
        content.push(xml.clef(clef2, this.#clefOctaveChanges.get(j) ?? 0, 2));
      }
    }
    if (content.length === 0) return null;
    return xml.create("attributes", undefined, ...content);
  }
}

class Staves {
  #names: string[] = [];
  #double: Set<number> = new Set();
  visit(line: NWCLine): boolean {
    switch (line.tag) {
      case "AddStaff":
        this.#names.push(line.values.Name[0].slice(1, -1));
        break;
      case "StaffProperties":
        if (
          line.values.WithNextStaff?.[0] === "Brace"
        ) {
          this.#double.add(this.#names.length - 1);
        }
        break;
      default:
        return false;
    }
    return true;
  }

  parts(
    bars: Bars,
    durations: Durations,
    positions: Positions,
    xml: MusicXML,
  ): Element {
    const scoreParts = [];
    const parts = [];
    let id = 0;
    for (let i = 0; i < this.#names.length; i++) {
      const attributes = { id: `P${++id}` };
      scoreParts.push(
        xml.create(
          "score-part",
          attributes,
          xml.create("part-name", undefined, this.#names[i]),
        ),
      );
      let measures;
      if (this.#double.has(i)) {
        measures = bars.double(i, durations, positions, xml);
        i++;
      } else {
        measures = bars.single(i, durations, positions, xml);
      }
      parts.push(
        xml.create(
          "part",
          attributes,
          ...measures,
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
      let visited = false;
      // no short-circuiting here
      if (this.#positions.visit(line)) visited = true;
      if (this.#bars.visit(line)) visited = true;
      if (this.#staves.visit(line)) visited = true;
      if (this.#durations.visit(line)) visited = true;
      if (!visited) {
        console.warn("Unused line", line);
      }
    }
    this.#bars.visitEnd();
    this.#durations.visitEnd();
    const xml = new MusicXML();
    return xml.stringify(
      this.#staves.parts(this.#bars, this.#durations, this.#positions, xml),
    );
  }
}
