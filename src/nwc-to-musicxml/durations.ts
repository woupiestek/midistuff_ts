import { assert } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { create, Element } from "./xml.ts";
import { Positions } from "./positions.ts";
import { Elements, MusicXML } from "./musicxml.ts";
import { NWCLines } from "./scanner.ts";

export const PER_WHOLE = 768;

export class Durations {
  #measure: number[] = [];
  #durations: number[] = [];
  #types: string[] = [];
  #startSustain: Set<number> = new Set();
  #stopSustain: Set<number> = new Set();
  #dynamics: Map<number, string> = new Map();
  #tempo: Map<number, number> = new Map();
  #tempoBase: Map<number, string> = new Map();

  visit({ tags, values }: NWCLines, visited: Set<number>): void {
    for (let i = 0; i < tags.length; i++) {
      switch (tags[i]) {
        case "AddStaff":
        case "Bar":
          this.#measure.push(this.#durations.length);
          if (this.#slurred) {
            this.#continueSlur.set(
              this.#durations.length - 1,
              this.#slurNumber,
            );
            this.#continueSlur.set(this.#durations.length, this.#slurNumber);
          }
          break;
        case "Note":
        case "Rest":
        case "Chord":
        case "RestChord":
          if (values[i].Dur2) {
            this.#duration(values[i].Dur2);
          }
          this.#options(values[i].Opts);
          this.#duration(values[i].Dur);
          break;
        case "SustainPedal":
          if (values[i].Status?.[0] === "Released") {
            this.#stopSustain.add(this.#durations.length);
          } else {
            this.#startSustain.add(this.#durations.length);
          }
          break;
        case "Dynamic":
        case "DynamicVariance":
          this.#dynamic(this.#durations.length, values[i].Style[0]);
          break;
        case "Tempo":
          this.#tempo.set(this.#durations.length, +values[i].Tempo[0]);
          if (values[i].Base) {
            this.#tempoBase.set(this.#durations.length, values[i].Base[0]);
          }
          break;
        case "TempoVariance": {
          const style = values[i].Style[0];
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
          this.#addWord(values[i].Style[0].toLowerCase());
          break;
        default:
          continue;
      }
      visited.add(i);
    }
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
  #stems: Map<number, string> = new Map();

  #options(opts?: string[]) {
    if (!opts) return;
    if (opts.includes("Stem=Up")) this.#stems.set(this.#durations.length, "up");
    if (opts.includes("Stem=Down")) {
      this.#stems.set(this.#durations.length, "down");
    }
  }

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

  allNotes(
    staffOffsets: number[],
    secondStaves: Set<number>,
    positions: Positions,
    elements: Elements,
    xml: MusicXML,
  ): (Element | null)[][] {
    const staff1 = create("staff", undefined, "1");
    const staff2 = create("staff", undefined, "2");
    let measure = 0;
    let staff = 1;
    const result: (Element | null)[][] = this.#measure.map(() => []);
    let voice = staff.toString();
    let voice1 = create("voice", undefined, voice);
    let voice2 = create("voice", undefined, voice + "'");
    for (let i = 0, l = this.#durations.length; i < l; i++) {
      while (this.#measure[measure + 1] <= i) {
        measure++;
      }
      while (staffOffsets[staff] <= measure) {
        staff++;
        voice = staff.toString();
        voice1 = create("voice", undefined, voice);
        voice2 = create("voice", undefined, voice + "'");
      }
      this.#forDuration(
        i,
        secondStaves.has(staff - 1) ? staff2 : staff1,
        result[measure],
        xml,
        positions.notes(i),
        positions.backup.has(i) ? voice2 : voice1,
        elements,
      );
      if (positions.backup.has(i)) {
        result[measure].push(xml.backup(this.#durations[i]));
      }
    }
    return result;
  }

  #forDuration(
    i: number,
    staff: Element,
    result: (Element | null)[],
    xml: MusicXML,
    notes: number[],
    voice: Element,
    elements: Elements,
  ) {
    this.#directions(i, staff, result, xml);
    const type = xml.type(this.#types[i]);
    const timeMod = this.#triplet.has(i) ? xml.timeMod : null;
    const dots = this.#doubleDotted.has(i)
      ? [xml.dot, xml.dot]
      : this.#dotted.has(i)
      ? [xml.dot]
      : [];
    const duration = xml.duration(this.#durations[i]);
    if (notes.length === 0) {
      result.push(
        xml.note(
          xml.rest,
          duration,
          voice,
          type,
          ...dots,
          timeMod,
          staff,
        ),
      );
    } else {
      const grace = this.#grace.has(i) ? create("grace") : null;
      const notationContent: (Element | null)[] = this.#notationContent(
        i,
        xml,
      );
      const sv = this.#stems.get(i);
      const stem = sv ? xml.stem(sv) : null;
      for (let j = 0; j < notes.length; j++) {
        const note = notes[j];
        const notations = [
          ...notationContent,
          elements.stopTieds.get(note) ?? null,
          elements.startTieds.get(note) ?? null,
        ];
        result.push(
          xml.note(
            grace,
            j ? xml.chord : null, // no chord element in the first note
            elements.pitches[note],
            duration,
            elements.startTieds.has(note) ? xml.tie.start : null,
            elements.stopTieds.has(note) ? xml.tie.stop : null,
            voice,
            type,
            ...dots,
            elements.accidentals.get(note) ?? null,
            timeMod,
            stem,
            staff,
            notations.length > 0
              ? create(
                "notations",
                undefined,
                ...notations,
              )
              : null,
            ...elements.lyrics[note],
          ),
        );
      }
    }
    if (this.#stopSustain.has(i + 1)) result.push(xml.stopSustain(staff));
  }

  #notationContent(i: number, xml: MusicXML) {
    const notations: Element[] = [];
    if (this.#notations[i]) {
      const articulations: Element[] = [...this.#notations[i]]
        .map((it) => xml.atriculations.get(it))
        .filter((it) => it !== undefined);
      if (articulations.length > 0) {
        notations.push(
          create("articulations", undefined, ...articulations),
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
    staff: Element,
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
          create("words", undefined, word),
          staff,
        ));
      }
    }
  }
}
