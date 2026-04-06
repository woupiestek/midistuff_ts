import { assert } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { create, Element } from "./xml.ts";
import { Elements, MusicXML } from "./musicxml.ts";
import { NWCLines } from "./scanner.ts";

export const PER_WHOLE = 768;

export class Durations {
  #measure: number[] = [];
  #durations: number[] = [];
  #types: string[] = [];
  // not yet used
  #currentStaff: number = -1;
  #staff: number[] = [];

  #directionTypes: Element[][] = [];
  // special directions that must occur at a different place.
  #stopSustain: Set<number> = new Set();

  #pushDirection(type: Element) {
    (this.#directionTypes[this.#durations.length] ??= []).push(type);
  }

  visit({ tags, values }: NWCLines, visited: Set<number>): void {
    for (let i = 0; i < tags.length; i++) {
      switch (tags[i]) {
        case "AddStaff":
          this.#currentStaff++;
          // fall through
        case "Bar":
          this.#measure.push(this.#durations.length);
          if (this.#slurred) {
            this.#slurTypes.set(this.#durations.length - 1, "continue");
            this.#slurTypes.set(this.#durations.length, "continue");
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
            // what about insert before?
            this.#stopSustain.add(this.#durations.length);
          } else {
            this.#pushDirection(create("pedal", { type: "start" }));
          }
          break;
        case "Dynamic":
        case "DynamicVariance":
          this.#dynamic(values[i].Style[0]);
          break;
        case "Tempo": {
          const [type, dotted] = (values[i].Base?.[0] ?? "Quarter").split(" ");
          this.#pushDirection(create(
            "metronome",
            undefined,
            create("beat-unit", undefined, type.toLowerCase()),
            dotted ? create("beat-unit-dot") : null,
            create("per-minute", undefined, values[i].Tempo[0]),
          ));
          break;
        }
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

  #addWord(word: string) {
    this.#pushDirection(create("word", undefined, word));
  }

  #wedged: boolean = false;
  #wedgeNumber = 1;

  #dynamics = Object.fromEntries(
    ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "sfz", "rfz"].map((
      d,
    ) => [d, create("dynamics", undefined, create(d))]),
  );

  #dynamic(arg1: string) {
    if (this.#wedged) {
      this.#pushDirection(create("wedge", {
        type: "stop",
        number: this.#wedgeNumber.toString(),
      }));
      this.#wedgeNumber = this.#wedgeNumber % 16 + 1;
      this.#wedged = false;
    }
    switch (arg1) {
      case "Sforzando":
        this.#pushDirection(this.#dynamics.sfz);
        break;
      case "Rinforzando":
        this.#pushDirection(this.#dynamics.rfz);
        break;
      case "Crescendo":
        this.#pushDirection(create("wedge", {
          type: "crescendo",
          number: this.#wedgeNumber.toString(),
        }));
        this.#wedged = true;
        break;
      case "Decrescendo":
      case "Diminuendo":
        this.#pushDirection(create("wedge", {
          type: "diminuendo",
          number: this.#wedgeNumber.toString(),
        }));
        this.#wedged = true;
        break;
      default:
        this.#pushDirection(this.#dynamics[arg1]);
        break;
    }
  }

  #slurred: boolean = false;
  #slurTypes: Map<number, "continue" | "start" | "stop"> = new Map();
  #grace: Set<number> = new Set();
  #triplet: Set<number> = new Set();
  #dotted: Set<number> = new Set();
  #doubleDotted: Set<number> = new Set();
  #stems: Map<number, Element> = new Map();

  #options(opts?: string[]) {
    if (!opts) return;
    if (opts.includes("Stem=Up")) {
      this.#stems.set(this.#durations.length, MusicXML.stem.up);
    }
    if (opts.includes("Stem=Down")) {
      this.#stems.set(this.#durations.length, MusicXML.stem.down);
    }
  }

  #duration(dur: string[]) {
    this.#staff.push(this.#currentStaff);
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
        this.#slurTypes.set(index, "start");
      } else {
        this.#slurTypes.set(index, "stop");
      }
      this.#slurred = slurred;
    }
    this.#durations.push(duration);
    assert(this.#types.length === this.#durations.length);
  }

  allNotes(
    // measures
    staffOffsets: number[],
    // which ones change.
    secondStaves: Set<number>,
    elements: Elements,
    xml: MusicXML,
  ): Element[][] {
    const stopSustain = create("pedal", { type: "stop" });
    const staff1 = create("staff", undefined, "1");
    const staff2 = create("staff", undefined, "2");
    const notationContent = this.#notationContent();
    const result: Element[][] = this.#measure.map(() => []);

    for (let staff = 0; staff < staffOffsets.length; staff++) {
      const voice1 = create("voice", undefined, `${2 * staff + 1}`);
      const voice2 = create("voice", undefined, `${2 * (staff + 1)}`);
      const staffElement = secondStaves.has(staff) ? staff2 : staff1;
      for (
        let m = staffOffsets[staff];
        m < (staffOffsets[staff + 1] ?? this.#measure.length);
        m++
      ) {
        for (
          let i = this.#measure[m];
          i < (this.#measure[m + 1] ?? this.#durations.length);
          i++
        ) {
          for (const directionType of this.#directionTypes[i] ?? []) {
            result[m].push(xml.direction(directionType, staffElement));
          }
          this.#forDuration(
            i,
            staffElement,
            result[m],
            xml,
            elements.positions.backup.has(i) ? voice2 : voice1,
            elements,
            notationContent[i],
          );
          if (this.#stopSustain.has(i + 1)) {
            result[m].push(xml.direction(stopSustain, staffElement));
          }
          if (elements.positions.backup.has(i)) {
            result[m].push(xml.backup(this.#durations[i]));
          }
        }
      }
    }
    return result;
  }

  #forDuration(
    i: number,
    staff: Element,
    result: Element[],
    xml: MusicXML,
    voice: Element,
    elements: Elements,
    notationContent: Element[],
  ) {
    const type = xml.type(this.#types[i]);
    const timeMod = this.#triplet.has(i) ? MusicXML.timeMod : null;
    const dots = this.#doubleDotted.has(i)
      ? [MusicXML.dot, MusicXML.dot]
      : this.#dotted.has(i)
      ? [MusicXML.dot]
      : [];
    const duration = xml.duration(this.#durations[i]);
    const from = i && elements.positions.groups[i - 1];
    const to = elements.positions.groups[i];
    if (to === from) {
      result.push(
        xml.note(
          MusicXML.rest,
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
      for (let note = from; note < to; note++) {
        const notations = [
          ...notationContent,
          elements.positions.stopTieds.get(note) ?? null,
          elements.positions.startTieds.get(note) ?? null,
        ].filter((it) => it != null);
        result.push(
          xml.note(
            grace,
            note > from ? MusicXML.chord : null, // no chord element in the first note
            elements.positions.pitches[note],
            duration,
            elements.positions.startTieds.has(note) ? MusicXML.tie.start : null,
            elements.positions.stopTieds.has(note) ? MusicXML.tie.stop : null,
            voice, // in the middle!
            type,
            ...dots,
            elements.positions.accidentals.get(note) ?? null,
            timeMod,
            this.#stems.get(i) ?? null,
            staff, // in the middle!
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
  }

  #notationContent() {
    const fermata = create("fermata");
    const atriculations = new Map([
      ["Accent", create("accent")],
      ["Breath Mark", create("breath-mark", undefined, "comma")],
      ["Caesura", create("caesura")],
      ["Staccato", create("staccato")],
      ["Tenuto", create("tenuto")],
    ]);
    const slur: {
      stop: { [_: string]: Element };
      start: { [_: string]: Element };
      continue: { [_: string]: Element };
    } = { stop: {}, start: {}, continue: {} };
    const notations: Element[][] = [];
    let slurNumber = 1;
    for (let i = 0; i < this.#durations.length; i++) {
      notations[i] = [];
      if (this.#notations[i]) {
        const articulations: Element[] = [...this.#notations[i]]
          .map((it) => atriculations.get(it))
          .filter((it) => it !== undefined);
        if (articulations.length > 0) {
          notations[i].push(
            create("articulations", undefined, ...articulations),
          );
        }
        if (this.#notations[i].has("Fermata")) {
          notations[i].push(fermata);
        }
      }
      const slurType = this.#slurTypes.get(i);
      if (slurType) {
        notations[i].push(
          slur[slurType][slurNumber] ??= create("slur", {
            type: slurType,
            number: slurNumber.toString(),
          }),
        );
        if (slurType === "stop") {
          slurNumber %= 16;
          slurNumber += 1;
        }
      }
    }
    return notations;
  }
}
