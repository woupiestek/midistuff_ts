import { Elements } from "./musicxml.ts";
import { NWCLines } from "./scanner.ts";
import { create, Element } from "./xml.ts";

const ALTSTR = "vbn#x";

const N7 = "nnnnnnn";

const CLEF_TONE = new Map([
  ["Bass", 22],
  ["Treble", 34],
  ["Alto", 28],
  ["Tenor", 26],
]);

export class Positions {
  #alters: string[] = [];
  #tones: number[] = [];
  #firstNoteByDuration: number[] = [];
  #tone = 34;
  #signature = [...N7];
  #altersByTone = [...N7];

  #Pos: string[] = [];

  visit(
    { tags, values }: NWCLines,
    visited: Set<number>,
  ): void {
    for (let i = 0; i < tags.length; i++) {
      switch (tags[i]) {
        case "AddStaff":
          this.#signature = [...N7];
          this.#altersByTone = [...N7];
          break;
        case "Clef":
          this.#tone = CLEF_TONE.get(values[i].Type[0]) ?? 34;
          if (!values[i].OctaveShift) break;
          switch (values[i].OctaveShift[0]) {
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
          for (const x of values[i].Signature) {
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
          if (values[i].Pos2) {
            for (const pos of values[i].Pos2) this.#pitch(pos);
            this.#Pos.push(...values[i].Pos2);
            this.#firstNoteByDuration.push(this.#Pos.length);
          }
          if (values[i].Pos) {
            for (const pos of values[i].Pos) this.#pitch(pos);
            this.#Pos.push(...values[i].Pos);
          }
          // this is why rests must be included.
          this.#firstNoteByDuration.push(this.#Pos.length);
          break;
        default:
          continue;
      }
      visited.add(i);
    }
  }

  build(): Elements["positions"] {
    const accidentalElements = Object.fromEntries(
      ["flat-flat", "flat", "natural", "sharp", "double-sharp"].map((
        type,
        i,
      ) => [ALTSTR[i], create("accidental", undefined, type)]),
    );
    const accidentals = new Map<number, Element>();
    this.#Pos.forEach((pos, i) => {
      if (ALTSTR.includes(pos[0])) {
        accidentals.set(i, accidentalElements[pos[0]]);
      }
    });

    return {
      accidentals,
      groups: this.#firstNoteByDuration,
      pitches: this.#pitches(),
      ...this.#ties(),
    };
  }

  #open: (string | null)[] = Array.from({ length: 68 }, () => null);
  // #stopTie: Set<number> = new Set();

  // this is what musicians must do in their heads while reading sheet music?
  #pitch(pos: string) {
    const altered = ALTSTR.includes(pos[0]);
    const startTie = pos[pos.length - 1] === "^";
    const tone = +pos.substring(+altered, pos.length - +startTie) + this.#tone;
    const index = this.#tones.length;
    this.#tones.push(tone);
    const stopTie = this.#open[tone];
    if (altered) {
      this.#altersByTone[tone % 7] = pos[0];
      this.#alters.push(pos[0]);
    } else if (stopTie) this.#alters.push(stopTie);
    else this.#alters.push(this.#altersByTone[tone % 7]);
    if (startTie) {
      this.#open[tone] = this.#alters[index];
    } else this.#open[tone] = null;
  }

  #pitches(): Element[] {
    // this method is only called once
    // so it actually saves memory to allocate these structures on the stack
    // I know that doesn't happen, because typescript does not work that way
    // But it could work that way in rust, or zig or c++ for example

    const steps = [..."CDEFGAB"].map((step) => create("step", undefined, step));

    // technically _ is n, the neutral alteration, but that result in no (null) xml elements
    const alters = new Map([..."vb_#x"].map((
      alter,
      i,
    ) => [alter, create("alter", undefined, (i - 2).toString())]));

    const octaves = Array(10).keys().map((octave) =>
      create("octave", undefined, octave.toString())
    ).toArray();

    const xmls: { [_: string]: Element }[] = [];
    return this.#tones.map((tone, i) => {
      const alter = this.#alters[i];
      xmls[tone] ??= {};
      return xmls[tone][i] ??= create(
        "pitch",
        undefined,
        steps[tone % 7],
        alters.get(alter) ?? null,
        octaves[(tone / 7) | 0],
      );
    });
  }

  #ties(): {
    stopTieds: Map<number, Element>;
    startTieds: Map<number, Element>;
  } {
    const startTieds: Map<number, Element> = new Map();
    const stopTieds: Map<number, Element> = new Map();
    const startXmls: { [_: string]: Element } = {};
    const stopXmls: { [_: string]: Element } = {};

    // no, it is not the case that every tie ends at the next line of nwc,
    // though AFAIK, this is not valid music notation
    // I guess the multiple positions are the reason: if the pos2 notes are tied, then thei may connect to notes several lines down.
    const open: Record<string, string> = {};
    for (let note = 0; note < this.#Pos.length; note++) {
      const pos = this.#Pos[note];
      const altered = ALTSTR.includes(pos[0]);
      const tied = pos[pos.length - 1] === "^";
      const cleanPos = +pos.substring(+altered, pos.length - +tied);

      if (open[cleanPos]) {
        stopTieds.set(
          note,
          stopXmls[cleanPos] ??= create(
            "tied",
            { type: "stop", number: open[cleanPos] },
          ),
        );
        delete open[cleanPos];
      }

      if (!tied) continue;

      open[cleanPos] = ((+cleanPos + 34) % 16 + 1).toString();
      startTieds.set(
        note,
        startXmls[cleanPos] ??= create("tied", {
          type: "start",
          number: open[cleanPos],
        }),
      );
    }
    return { startTieds, stopTieds };
  }
}
