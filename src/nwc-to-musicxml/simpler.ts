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

  #open: (string | null)[] = Array.from({ length: 68 }, () => null);
  #startTie: Map<number, string> = new Map();
  #stopTie: Map<number, string> = new Map();
  // track explicit accidentals
  #altered: Map<number, string> = new Map();

  // this is what musicians must do in their heads while reading sheet music
  #pitch(pos: string) {
    const altered = ALTSTR.includes(pos[0]);
    const startTie = pos[pos.length - 1] === "^";
    const tone = +pos.substring(+altered, pos.length - +startTie) + this.#tone;
    const index = this.#tones.length;
    const stopTie = this.#open[tone];

    if (stopTie) this.#stopTie.set(index, (tone % 16 + 1).toString());

    if (altered) {
      this.#altered.set(index, pos[0]);
      this.#altersByTone[tone % 7] = pos[0];
      this.#alters.push(pos[0]);
    } else if (stopTie) this.#alters.push(stopTie);
    else this.#alters.push(this.#altersByTone[tone % 7]);

    if (startTie) {
      this.#open[tone] = this.#alters[index];
      this.#startTie.set(index, (tone % 16 + 1).toString());
    } else this.#open[tone] = null;
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

  ties(note: number): ({ type: "start" | "stop"; number: string })[] {
    const ties: ({ type: "start" | "stop"; number: string })[] = [];
    const stopTie = this.#stopTie.get(note);
    if (stopTie) {
      ties.push({ type: "stop", number: stopTie.toString() });
    }
    const startTie = this.#startTie.get(note);
    if (startTie) {
      ties.push({ type: "start", number: startTie.toString() });
    }
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
        if (this.#slurred) {
          this.#continueSlur.set(this.#durations.length - 1, this.#slurNumber);
          this.#continueSlur.set(this.#durations.length, this.#slurNumber);
        }
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
      case "TempoVariance": {
        const style = line.values.Style[0];
        switch (style) {
          case "Breath Mark":
          case "Caesura":
          case "Fermata":
            this.#addNotation(style);
            break;
          default:
            this.#addWord(style.toLowerCase());
            break;
        }
        break;
      }
      case "PerformanceStyle":
        this.#addWord(line.values.Style[0].toLowerCase());
        break;
      default:
        return false;
    }
    return true;
  }

  visitEnd() {
    this.#measure.push(this.#durations.length);
  }

  #notations: { [_: number]: Set<string> } = {};

  #addNotation(style: string) {
    (this.#notations[this.#durations.length] ||= new Set()).add(style);
  }

  #words: { [_: number]: Set<string> } = {};

  #addWord(word: string) {
    (this.#words[this.#durations.length] ||= new Set()).add(word);
  }

  #wedged: boolean = false;
  #wedge: Map<number, { type: string; number: string }> = new Map();
  #wedgeNumber = 1;

  #dynamic(length: number, arg1: string) {
    if (this.#wedged) {
      this.#wedge.set(length, {
        type: "stop",
        number: this.#wedgeNumber.toString(),
      });
      this.#wedgeNumber = this.#wedgeNumber % 16 + 1;
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
        this.#wedge.set(length, {
          type: "crescendo",
          number: this.#wedgeNumber.toString(),
        });
        this.#wedged = true;
        break;
      case "Decrescendo":
      case "Diminuendo":
        this.#wedge.set(length, {
          type: "diminuendo",
          number: this.#wedgeNumber.toString(),
        });
        this.#wedged = true;
        break;
      default:
        this.#dynamics.set(length, arg1);
        break;
    }
  }

  #slurred: boolean = false;
  #startSlur: Map<number, number> = new Map();
  #continueSlur: Map<number, number> = new Map();
  #stopSlur: Map<number, number> = new Map();
  #slurNumber: number = 16;
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
        case "Accent":
        case "Staccato":
        case "Tenuto":
          this.#addNotation(s);
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
        this.#slurNumber = this.#slurNumber % 16 + 1;
        this.#startSlur.set(index, ++this.#slurNumber);
      } else {
        this.#stopSlur.set(index, this.#slurNumber);
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
        const notationContent: (Element | null)[] = this.#notationContent(
          i,
          xml,
        );
        for (let j = 0; j < notes.length; j++) {
          const ties = positions.ties(notes[j]);
          const notations = [
            ...notationContent,
            ...ties.map((it) => xml.tied(it)),
          ];
          result.push(
            xml.note(
              grace,
              j ? xml.chord : null, // no chord element in the first note
              positions.pitch(notes[j], xml),
              xml.duration(this.#durations[i]),
              ...ties.map((it) => xml.tie[it.type]),
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

  #notationContent(i: number, xml: MusicXML) {
    const notations: Element[] = [];
    if (this.#notations[i]) {
      const articulations: Element[] = [...this.#notations[i]]
        .map((it) => xml.atriculations.get(it))
        .filter((it) => it !== undefined);
      if (articulations.length > 0) {
        notations.push(
          xml.create("articulations", undefined, ...articulations),
        );
      }
      if (this.#notations[i].has("Fermata")) {
        notations.push(xml.fermata);
      }
    }
    if (this.#stopSlur.has(i)) {
      notations.push(xml.slur("stop", this.#stopSlur.get(i) ?? 0));
    } else if (this.#startSlur.has(i)) {
      notations.push(xml.slur("start", this.#startSlur.get(i) ?? 0));
    } else if (this.#continueSlur.has(i)) {
      notations.push(xml.slur("continue", this.#continueSlur.get(i) ?? 0));
    }
    return notations;
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
    const words = this.#words[i];
    if (words) {
      for (const word of words) {
        result.push(xml.direction(
          xml.create("words", undefined, word),
          staff,
        ));
      }
    }
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

  multiple(
    from: number,
    to: number,
    durations: Durations,
    positions: Positions,
    xml: MusicXML,
  ) {
    const offsets = this.#staves.slice(from, to);
    const length = this.#staves[from + 1] - this.#staves[from];
    for (let j = from + 1; j < to; j++) {
      const l2 = this.#staves[j + 1] - this.#staves[j];
      assert(
        length === l2,
        `combined staves must have the same length ${length} !== ${l2}`,
      );
    }
    let backup = xml.backup(PER_WHOLE);
    const result: Element[] = [];
    for (let i = 0; i < length; i++) {
      for (const j of offsets) {
        const time = this.#times.get(i + j);
        if (time) {
          const [n, d] = time.split("/");
          backup = xml.backup(PER_WHOLE * +n / +d);
          break;
        }
      }

      const notes = durations.notes(i + offsets[0], 1, positions, xml);
      for (let j = 1; j < length; j++) {
        notes.push(backup);
        notes.push(...durations.notes(i + offsets[j], j + 1, positions, xml));
      }
      // mind the backups!
      if (notes.length === length - 1) continue;
      let endings, leftBarstyle, rightBarstyle;
      for (const j of offsets) {
        endings ||= this.#endings.get(i + j);
        leftBarstyle ||= this.#barStyles.get(i + j);
        rightBarstyle ||= this.#barStyles.get(i + j + 1);
        if (endings && leftBarstyle && rightBarstyle) break;
      }
      result.push(
        xml.create(
          "measure",
          { number: (i + 1).toString() },
          xml.leftBarline(
            leftBarstyle,
            endings,
          ),
          this.#attributes2(xml, i, offsets),
          ...notes,
          xml.rightBarline(
            rightBarstyle,
            endings,
          ),
        ),
      );
    }
    return result;
  }

  #attributes2(xml: MusicXML, i: number, offsets: number[]) {
    const content: (Element)[] = [];
    if (i === 0) {
      content.push(
        xml.create(
          "divisions",
          undefined,
          PER_QUARTER.toString(),
        ),
      );
    }

    let key, time;
    const clefs = [];

    for (let k = 0, l = offsets.length; k < l; k++) {
      const j = i + offsets[k];
      key ||= this.#keys.get(j);
      time ||= this.#times.get(j);
      const clef = this.#clefs.get(j);
      if (clef) {
        clefs.push(xml.clef(clef, this.#clefOctaveChanges.get(j) ?? 0, k + 1));
      }
    }
    if (key !== undefined) content.push(xml.key(key));
    if (time) {
      const [beats, beatType] = time.split("/");
      content.push(xml.time(beats, beatType));
    }
    if (offsets.length > 1) {
      // todo: is it really more than 2?
      content.push(
        xml.create(
          "staves",
          undefined,
          offsets.length.toString(),
        ),
      );
    }
    // if th number of staves is not correct, is the number of clefs?
    content.push(...clefs);
    if (content.length === 0) return null;
    return xml.create("attributes", undefined, ...content);
  }
}

class Staves {
  #parts: number[] = [];
  #names: string[] = [];
  #midiPrograms: number[] = [];
  // #double: Set<number> = new Set();
  #merge = false;
  #songInfo: Map<string, string> = new Map();
  visit(line: NWCLine): boolean {
    switch (line.tag) {
      case "AddStaff":
        if (!this.#merge) {
          this.#parts.push(this.#names.length);
        } else {
          this.#merge = false;
        }
        this.#names.push(line.values.Name[0].slice(1, -1));
        break;
      case "StaffProperties": {
        const withNextStaff = new Set(line.values.WithNextStaff);
        if (
          withNextStaff.has("Brace") || withNextStaff.has("Layer")
        ) {
          this.#merge = true;
        }
        break;
      }
      case "StaffInstrument":
        if (line.values.Patch) {
          this.#midiPrograms[this.#names.length - 1] = +line.values.Patch[0] +
            1;
        }
        break;

      case "SongInfo":
        for (const [k, v] of Object.entries(line.values)) {
          this.#songInfo.set(k, v[0]);
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
    for (let id = 1; id <= this.#parts.length; id++) {
      const attributes = { id: `P${id}` };
      const from = this.#parts[id - 1];
      const to = this.#parts[id] ?? this.#names.length;
      const program = this.#midiPrograms.slice(from, to).find((it) =>
        it !== undefined
      );
      scoreParts.push(
        xml.create(
          "score-part",
          attributes,
          xml.create(
            "part-name",
            undefined,
            this.#names.slice(from, to).join(", "),
          ),
          program
            ? xml.create(
              "midi-instrument",
              undefined,
              xml.create(
                "midi-program",
                undefined,
                program.toString(),
              ),
            )
            : null,
        ),
      );
      parts.push(
        xml.create(
          "part",
          attributes,
          ...bars.multiple(from, to, durations, positions, xml),
        ),
      );
    }

    const songInfo: (Element)[] = [];
    const identification: (Element)[] = [];
    for (const [k, v] of this.#songInfo) {
      switch (k) {
        case "Title":
          songInfo.push(
            xml.create(
              "work",
              undefined,
              xml.create("work-title", undefined, v),
            ),
          );
          break;
        case "Author":
        case "Lyricist":
          identification.push(
            xml.create("creator", { type: k.toLowerCase() }, v),
          );
          break;
        case "Copyright1":
        case "Copyright2":
          identification.push(xml.create("rights", undefined, v));
          break;
        default:
          console.warn("song data ignored:", k, v);
      }
    }
    songInfo.push(xml.create("identification", undefined, ...identification));
    return xml.create(
      "score-partwise",
      { version: "4.0" },
      ...songInfo,
      xml.create("part-list", undefined, ...scoreParts),
      ...parts,
    );
  }
}

const TECHNICAL_TAGS = new Set([
  "Editor",
  "Font",
  "PgMargins",
  "PgSetup",
]);
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
      if (TECHNICAL_TAGS.has(line.tag)) continue;
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
