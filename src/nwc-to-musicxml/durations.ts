import { assert } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { create, Element } from "./xml.ts";
import { Elements, MusicXML } from "./musicxml.ts";
import { NWCLines } from "./scanner.ts";

export const PER_WHOLE = 768;

export class Durations {
  #measure: number[] = [];
  #durations: number[] = [];
  #types: string[] = [];
  #staffOffsets: number[] = [];

  #directionTypes: Element[][] = [];
  // special directions that must occur at a different place.
  #stopSustain: Set<number> = new Set();
  #backup: Set<number> = new Set();

  #pushDirection(type: Element) {
    (this.#directionTypes[this.#durations.length] ??= []).push(type);
  }

  visit({ tags, values }: NWCLines, visited: Set<number>): void {
    const startSustain = create("pedal", { type: "start" });
    for (let i = 0; i < tags.length; i++) {
      switch (tags[i]) {
        case "AddStaff":
          // this.#currentStaff++;
          this.#staffOffsets.push(this.#durations.length);
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
            this.#backup.add(this.#durations.length);
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
            this.#pushDirection(startSustain);
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

  #notationsX: number[] = [];
  #notationsY: string[] = [];

  #addNotation(style: string) {
    this.#notationsX.push(this.#durations.length);
    this.#notationsY.push(style);
  }

  #addWord(word: string) {
    this.#pushDirection(create("words", undefined, word));
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
    // which ones change.
    secondStaves: Set<number>,
    elements: Elements,
    xml: MusicXML,
  ): Element[][] {
    const staff1 = create("staff", undefined, "1");
    const staff2 = create("staff", undefined, "2");
    const staves = this.#staffOffsets.flatMap((offset, index, offsets) =>
      Array.from({
        length: (offsets[index + 1] ?? this.#durations.length) - offset,
      }, () => secondStaves.has(index) ? staff2 : staff1)
    );

    // start with putting in most directions
    const byDuration: Element[][] = this.#durations.map((_, i) =>
      (this.#directionTypes[i] ?? []).map((type) =>
        xml.direction(type, staves[i])
      )
    );
    // then the notes
    this.#notes(staves, xml, elements).forEach((ns, i) =>
      byDuration[i].push(...ns)
    );
    // then the stop sustain direction
    const stopSustain = create("pedal", { type: "stop" });
    this.#stopSustain.forEach((i) =>
      byDuration[i - 1].push(xml.direction(stopSustain, staves[i - 1]))
    );
    // then the back up instruction, which tells musicxml to set the next note sooner, in case the chord contained two simultaneous durations.
    this.#backup.forEach((i) =>
      byDuration[i].push(xml.backup(this.#durations[i]))
    );
    return this.#measure.map((m, i, a) => byDuration.slice(m, a[i + 1]).flat());
  }

  #notes(
    staves: Element[],
    xml: MusicXML,
    elements: Elements,
  ): Element[][] {
    const voices = Array((this.#staffOffsets.length) * 2).keys().map((k) =>
      create("voice", undefined, `${k + 1}`)
    ).toArray();

    const byIndex = this.#staffOffsets.flatMap((offset, index, offsets) =>
      Array.from({
        length: (offsets[index + 1] ?? this.#durations.length) - offset,
      }, (_) => 2 * index)
    );
    this.#backup.forEach((i) => byIndex[i]++);

    const notationContent = this.#notationContent();
    const notes: Element[][] = [];
    for (let i = 0; i < this.#durations.length; i++) {
      notes[i] = [];
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
        notes[i].push(xml.note(
          MusicXML.rest,
          duration,
          voices[byIndex[i]],
          type,
          ...dots,
          timeMod,
          staves[i],
        ));
        continue;
      }
      const grace = this.#grace.has(i) ? create("grace") : null;
      const shared = notationContent[i] ?? [];
      for (let note = from; note < to; note++) {
        const notations = [
          ...shared,
          elements.positions.stopTieds.get(note) ?? null,
          elements.positions.startTieds.get(note) ?? null,
        ].filter((it) => it != null);
        notes[i].push(xml.note(
          grace,
          note > from ? MusicXML.chord : null, // no chord element in the first note
          elements.positions.pitches[note],
          duration,
          elements.positions.startTieds.has(note) ? MusicXML.tie.start : null,
          elements.positions.stopTieds.has(note) ? MusicXML.tie.stop : null,
          voices[byIndex[i]],
          type,
          ...dots,
          elements.positions.accidentals.get(note) ?? null,
          timeMod,
          this.#stems.get(i) ?? null,
          staves[i],
          notations.length > 0
            ? create(
              "notations",
              undefined,
              ...notations,
            )
            : null,
          ...elements.lyrics[note],
        ));
      }
    }
    return notes;
  }

  #notationContent(): { [_: number]: Element[] } {
    const fermata = create("fermata");
    const atriculations = new Map([
      ["Accent", create("accent")],
      ["Breath Mark", create("breath-mark", undefined, "comma")],
      ["Caesura", create("caesura")],
      ["Staccato", create("staccato")],
      ["Tenuto", create("tenuto")],
    ]);

    const artix: { [_: number]: Element[] } = {};
    const frm: Set<number> = new Set();
    for (let i = 0; i < this.#notationsX.length; i++) {
      const style = this.#notationsY[i];
      if (style === "Fermata") {
        frm.add(this.#notationsX[i]);
        continue;
      }
      const element = atriculations.get(style);
      if (element) {
        (artix[this.#notationsX[i]] ||= []).push(element);
      }
    }

    const notations: { [_: number]: Element[] } = {};
    for (const [k, v] of Object.entries(artix)) {
      (notations[+k] ||= []).push(create("articulations", undefined, ...v));
    }
    frm.forEach((i) => (notations[i] ||= []).push(fermata));
    let slurNumber = 1;
    const slur: {
      [_: string]: { [_: number]: Element };
    } = { stop: {}, start: {}, continue: {} };
    this.#slurTypes.forEach((slurType, i) => {
      (notations[i] ||= []).push(
        slur[slurType][slurNumber] ??= create("slur", {
          type: slurType,
          number: slurNumber.toString(),
        }),
      );
      if (slurType === "stop") {
        slurNumber %= 16;
        slurNumber += 1;
      }
    });
    return notations;
  }
}
