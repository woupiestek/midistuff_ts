import { create, Element } from "./xml.ts";
import { Elements, MusicXML } from "./musicxml.ts";
import { countLessThan, NWCLines } from "./scanner.ts";

// greatest number of subdivision of the whole note that nwc supports AFAICT: 256*3, where the 3 comes from triplets.
// the format is flexible enough to support other tuplets by messing with the tempo an by leaving
export const PER_WHOLE = 768;

// a duration can support any number of notes
export class Durations {
  #AddStaff: number[] = [];
  // this is the duration array.
  #durations: number[] = [];
  // this determines which pictures will be used for notes and rests
  #types: string[] = [];

  #lines: number[] = [];

  #AddMeasure: number[] = [];

  // backup after this duration: used for chords with notes of different lengths, or a note and a short rest.
  // also records: next durations line is the same
  #backup: Set<number> = new Set();

  #directionsByLine: Element[][] = [];
  #pushDirection(line: number, type: Element) {
    (this.#directionsByLine[line] ??= []).push(type);
  }

  #numberOfLines = 0;

  visit(
    nwcLines: NWCLines,
    visited: Set<number>,
  ): void {
    const { values, lineNumbersByTag } = nwcLines;
    this.#numberOfLines = values.length;
    this.#AddStaff = lineNumbersByTag.AddStaff ?? [];
    this.#AddMeasure = [lineNumbersByTag.AddStaff, lineNumbersByTag.Bar].filter(
      (it) => it,
    ).flat().sort((a, b) => a - b);

    // some lines must be doubled.
    const lines = [
      lineNumbersByTag.Chord,
      lineNumbersByTag.Note,
      lineNumbersByTag.Rest,
      lineNumbersByTag.RestChord,
    ].filter((it) => it).flat().sort((a, b) => a - b);

    for (const line of lines) {
      if (values[line].Dur2) {
        this.#backup.add(this.#durations.length);
        this.#duration(values[line].Dur2);
        this.#lines.push(line);
      }
      this.#options(this.#durations.length, values[line].Opts);
      this.#duration(values[line].Dur);
      this.#lines.push(line);
      visited.add(line);
    }

    if (lineNumbersByTag.TempoVariance) {
      for (const i of lineNumbersByTag.TempoVariance) {
        const style = values[i].Style[0];
        switch (style) {
          case "Breath Mark":
            // makes more sense, but why does it work!?
            this.#addNotation(countLessThan(i, this.#lines) - 1, style);
            break;
          case "Caesura":
          case "Fermata":
            this.#addNotation(countLessThan(i, this.#lines), style);
            break;
          default:
            this.#addWord(i, style.toLowerCase());
            break;
        }
      }
    }

    // create the slur types
    for (let i = 0; i < this.#durations.length; i++) {
      if (i > 0 && this.#slurredDuration.has(i - 1)) {
        // stop breaking up slurs.
        // actually, do this without backup!
        if (this.#backup.has(i)) {
          this.#slurredDuration.add(i);
          continue;
        }
        if (!this.#slurredDuration.has(i)) {
          this.#slurTypes.set(i, "stop");
        }
      } else if (this.#slurredDuration.has(i)) {
        this.#slurTypes.set(i, "start");
      }
    }

    if (lineNumbersByTag.Bar) {
      for (const line of lineNumbersByTag.Bar) {
        const i = countLessThan(line, this.#lines);
        if (
          this.#slurredDuration.has(i) && i > 0 &&
          this.#slurredDuration.has(i - 1)
        ) {
          this.#slurTypes.set(i, "continue");
          this.#slurTypes.set(i - 1, "continue");
        }
      }
    }

    if (lineNumbersByTag.SustainPedal) {
      const startSustain = create("pedal", { type: "start" });
      const stopSustain = create("pedal", { type: "stop" });
      for (const line of lineNumbersByTag.SustainPedal) {
        this.#pushDirection(
          line,
          values[line].Status?.[0] === "Released" ? stopSustain : startSustain,
        );
        visited.add(line);
      }
    }

    if (lineNumbersByTag.Tempo) {
      for (const i of lineNumbersByTag.Tempo) {
        const [type, dotted] = (values[i].Base?.[0] ?? "Quarter").split(" ");
        this.#pushDirection(
          i,
          create(
            "metronome",
            undefined,
            create("beat-unit", undefined, type.toLowerCase()),
            dotted ? create("beat-unit-dot") : null,
            create("per-minute", undefined, values[i].Tempo[0]),
          ),
        );
        visited.add(i);
      }
    }

    if (lineNumbersByTag.PerformanceStyle) {
      for (const i of lineNumbersByTag.PerformanceStyle) {
        this.#addWord(i, values[i].Style[0].toLowerCase());
        visited.add(i);
      }
    }

    this.#visitDynamics(nwcLines, visited);
  }

  #notationsX: number[] = [];
  #notationsY: string[] = [];

  #addNotation(x: number, style: string) {
    this.#notationsX.push(x);
    this.#notationsY.push(style);
  }

  #addWord(line: number, word: string) {
    this.#pushDirection(line, create("words", undefined, word));
  }

  #visitDynamics(nwcLines: NWCLines, visited: Set<number>) {
    if (
      !nwcLines.lineNumbersByTag.Dynamic &&
      !nwcLines.lineNumbersByTag.DynamicVariance
    ) return;

    const dynamics = Object.fromEntries(
      ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "sfz", "rfz"].map((
        d,
      ) => [d, create("dynamics", undefined, create(d))]),
    );
    const lines = [
      nwcLines.lineNumbersByTag.Dynamic,
      nwcLines.lineNumbersByTag.DynamicVariance,
    ]
      .filter((it) => it).flat().sort((a, b) => a - b);
    for (let i = 0, l = lines.length; i < l; i++) {
      const line = lines[i];
      visited.add(line);
      const style = nwcLines.values[line].Style[0];
      switch (style) {
        case "Sforzando":
          this.#pushDirection(line, dynamics.sfz);
          break;
        case "Rinforzando":
          this.#pushDirection(line, dynamics.rfz);
          break;
        case "Crescendo":
          {
            const number = ((i % 16) + 1).toString();
            this.#pushDirection(
              line,
              create("wedge", {
                type: "crescendo",
                number,
              }),
            );
            this.#pushDirection(
              lines[i + 1] ?? this.#numberOfLines,
              create("wedge", {
                type: "stop",
                number,
              }),
            );
          }

          break;
        case "Decrescendo":
        case "Diminuendo":
          {
            const number = ((i % 16) + 1).toString();
            this.#pushDirection(
              line,
              create("wedge", {
                type: "diminuendo",
                number,
              }),
            );
            this.#pushDirection(
              lines[i + 1] ?? this.#numberOfLines,
              create("wedge", {
                type: "stop",
                number,
              }),
            );
          }
          break;
        default:
          this.#pushDirection(line, dynamics[style]);
          break;
      }
    }
  }

  #slurTypes: Map<number, "continue" | "start" | "stop"> = new Map();
  #grace: Set<number> = new Set();
  #triplet: Set<number> = new Set();
  #dotted: Set<number> = new Set();
  #doubleDotted: Set<number> = new Set();
  #stems: Map<number, Element> = new Map();

  #options(index: number, opts?: string[]) {
    if (!opts) return;
    if (opts.includes("Stem=Up")) {
      this.#stems.set(index, MusicXML.stem.up);
    }
    if (opts.includes("Stem=Down")) {
      this.#stems.set(index, MusicXML.stem.down);
    }
  }

  #slurredDuration: Set<number> = new Set();

  #duration(dur: string[]) {
    const index = this.#durations.length;
    this.#durations.push(PER_WHOLE);
    for (const s of dur) {
      switch (s) {
        case "16th":
          this.#durations[index] /= 16;
          this.#types.push("16th");
          break;
        case "32nd":
          this.#durations[index] /= 32;
          this.#types.push("32nd");
          break;
        case "64th":
          this.#durations[index] /= 64;
          this.#types.push("64th");
          break;
        case "8th":
          this.#durations[index] /= 8;
          this.#types.push("eighth");
          break;
        case "4th":
          this.#durations[index] /= 4;
          this.#types.push("quarter");
          break;
        case "Whole":
          this.#types.push("whole");
          break;
        case "Half":
          this.#durations[index] /= 2;
          this.#types.push("half");
          break;
        case "Dotted":
          this.#durations[index] *= 3 / 2;
          this.#dotted.add(index);
          break;
        case "DblDotted":
          this.#durations[index] *= 7 / 4;
          this.#doubleDotted.add(index);
          break;
        case "Triplet=First":
        case "Triplet=End":
        case "Triplet":
          this.#durations[index] *= 2 / 3;
          this.#triplet.add(index);
          break;
        case "Accent":
        case "Staccato":
        case "Tenuto":
          this.#addNotation(index, s);
          break;
        case "Slur":
          this.#slurredDuration.add(index);
          break;
        case "Grace":
          this.#grace.add(index);
          break;
        default:
          console.error("Unused duration", s);
          break;
      }
    }
  }

  allNotes(
    // which ones change.
    secondStaves: Set<number>,
    elements: Elements,
    xml: MusicXML,
    ticksPerMeasure: number[],
  ): Element[][] {
    const staff1 = create("staff", undefined, "1");
    const staff2 = create("staff", undefined, "2");

    // off by one again
    const staffByLine = Array(this.#AddStaff.length + 1).keys().flatMap((
      index,
    ) =>
      Array.from({
        length: (this.#AddStaff[index] ?? this.#numberOfLines) -
          (index && this.#AddStaff[index - 1]),
      }, () => secondStaves.has(index - 1) ? staff2 : staff1)
    ).toArray();

    // start with directions
    const byLine: Element[][] = this.#directionsByLine.map((types, line) =>
      types && types.map((type) => xml.direction(type, staffByLine[line]))
    );

    // then the notes
    this.#notes(staffByLine, xml, elements, ticksPerMeasure, byLine);

    // wanted: arrays of elements by measure.
    // what if we'd just collected by line?
    return this.#AddMeasure.map((line, i, lines) =>
      byLine.slice(
        line,
        lines[i + 1] ?? this.#numberOfLines,
      ).filter((it) => it).flat()
    );
  }

  // by line as well...
  #notes(
    staffByLine: Element[],
    xml: MusicXML,
    elements: Elements,
    ticksPerMeasure: number[],
    byLine: Element[][],
  ) {
    const voices = Array((this.#AddStaff.length) * 2).keys()
      .map((k) => create("voice", undefined, `${k + 1}`)).toArray();
    const firstDurationByStaff = this.#AddStaff.map((line) =>
      countLessThan(line, this.#lines)
    );
    firstDurationByStaff.push(this.#lines.length);
    const byIndex = firstDurationByStaff.flatMap((j, i, a) =>
      Array.from({ length: j - (i && a[i - 1]) }, () => i)
    );
    this.#backup.forEach((i) => byIndex[i]++);

    const notationContent = this.#notationContent();
    for (let i = 0; i < this.#durations.length; i++) {
      const line = this.#lines[i];
      byLine[line] ??= [];
      const type = xml.type(this.#types[i]);
      const timeMod = this.#triplet.has(i) ? MusicXML.timeMod : null;
      const dots = this.#doubleDotted.has(i)
        ? [MusicXML.dot, MusicXML.dot]
        : this.#dotted.has(i)
        ? [MusicXML.dot]
        : [];
      const from = i && elements.positions.groups[i - 1];
      const to = elements.positions.groups[i];
      if (to === from) {
        const measure = countLessThan(line, this.#AddMeasure) - 1;
        const ticks = ticksPerMeasure[measure] ?? PER_WHOLE;
        if (
          this.#durations[i] === PER_WHOLE && ticks < PER_WHOLE
        ) {
          byLine[line].push(
            create(
              "note",
              undefined,
              MusicXML.fullMeasureRest,
              xml.duration(ticks),
              voices[byIndex[i]],
              type,
              ...dots,
              timeMod,
              staffByLine[line],
            ),
          );
          continue;
        }

        byLine[line].push(
          create(
            "note",
            undefined,
            MusicXML.rest,
            xml.duration(this.#durations[i]),
            voices[byIndex[i]],
            type,
            ...dots,
            timeMod,
            staffByLine[line],
          ),
        );
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
        byLine[line].push(
          create(
            "note",
            undefined,
            grace,
            note > from ? MusicXML.chord : null, // no chord element in the first note
            elements.positions.pitches[note],
            xml.duration(this.#durations[i]),
            elements.positions.startTieds.has(note) ? MusicXML.tie.start : null,
            elements.positions.stopTieds.has(note) ? MusicXML.tie.stop : null,
            voices[byIndex[i]],
            type,
            ...dots,
            elements.positions.accidentals.get(note) ?? null,
            timeMod,
            this.#stems.get(i) ?? null,
            staffByLine[line],
            notations.length > 0
              ? create(
                "notations",
                undefined,
                ...notations,
              )
              : null,
            ...elements.lyrics.get(note) ?? [],
          ),
        );
      }
      // same line same time, nwc at least has that.
      if (this.#lines[i + 1] === line) {
        byLine[line].push(xml.backup(this.#durations[i]));
      }
    }
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
