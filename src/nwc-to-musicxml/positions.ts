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
  #groups: number[] = [];
  #tone = 34;
  #signature = [...N7];
  #altersByTone = [...N7];
  #backup: Set<number> = new Set();

  visit({ tags, values }: NWCLines, visited: Set<number>): void {
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
            this.#backup.add(this.#groups.length);
            this.#groups.push(this.#tones.length);
          }
          if (values[i].Pos) {
            for (const pos of values[i].Pos) this.#pitch(pos);
          }
          this.#groups.push(this.#tones.length);
          break;
        default:
          continue;
      }
      visited.add(i);
    }
  }

  build(): Elements["positions"] {
    return {
      accidentals: this.#accidentals,
      backup: this.#backup,
      groups: this.#groups,
      pitches: this.#pitches(),
      ...this.#ties(),
    };
  }

  #open: (string | null)[] = Array.from({ length: 68 }, () => null);
  #startTie: Set<number> = new Set();
  #stopTie: Set<number> = new Set();
  // explicit accidentals
  #accidentals: Map<number, Element> = new Map();

  // this is what musicians must do in their heads while reading sheet music?
  #pitch(pos: string) {
    const accidentals = Object.fromEntries(
      ["flat-flat", "flat", "natural", "sharp", "double-sharp"].map((
        type,
        i,
      ) => [ALTSTR[i], create("accidental", undefined, type)]),
    );
    const altered = ALTSTR.includes(pos[0]);
    const startTie = pos[pos.length - 1] === "^";
    const tone = +pos.substring(+altered, pos.length - +startTie) + this.#tone;
    const index = this.#tones.length;
    this.#tones.push(tone);
    const stopTie = this.#open[tone];
    if (stopTie) this.#stopTie.add(index);
    if (altered) {
      this.#accidentals.set(index, accidentals[pos[0]]);
      this.#altersByTone[tone % 7] = pos[0];
      this.#alters.push(pos[0]);
    } else if (stopTie) this.#alters.push(stopTie);
    else this.#alters.push(this.#altersByTone[tone % 7]);
    if (startTie) {
      this.#open[tone] = this.#alters[index];
      this.#startTie.add(index);
    } else this.#open[tone] = null;
  }

  #pitches(): Element[] {
    const steps = [..."CDEFGAB"].map((step) => create("step", undefined, step));
    const alters = Object.fromEntries(
      [..."vbn#x"].map((
        alter,
        i,
      ) => [alter, create("alter", undefined, (i - 2).toString())]),
    );
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
        alter === "n" ? null : alters[alter],
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
    this.#startTie.forEach((note) => {
      const number = (this.#tones[note] % 16 + 1).toString();
      startTieds.set(
        note,
        startXmls[number] ??= create("tied", { type: "start", number }),
      );
    });
    const stopXmls: { [_: string]: Element } = {};
    this.#stopTie.forEach((note) => {
      const number = (this.#tones[note] % 16 + 1).toString();
      stopTieds.set(
        note,
        stopXmls[number] ??= create("tied", { type: "stop", number }),
      );
    });
    return { startTieds, stopTieds };
  }
}
