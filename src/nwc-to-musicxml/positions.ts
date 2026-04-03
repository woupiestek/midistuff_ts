import { MusicXML } from "./musicxml.ts";
import { NWCLines } from "./scanner.ts";
import { Element } from "./xml.ts";

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
  backup: Set<number> = new Set();

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
            this.backup.add(this.#groups.length);
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

  #open: (string | null)[] = Array.from({ length: 68 }, () => null);
  #startTie: Set<number> = new Set();
  #stopTie: Set<number> = new Set();
  // track explicit accidentals
  #altered: Map<number, string> = new Map();

  // this is what musicians must do in their heads while reading sheet music?
  #pitch(pos: string) {
    const altered = ALTSTR.includes(pos[0]);
    const startTie = pos[pos.length - 1] === "^";
    const tone = +pos.substring(+altered, pos.length - +startTie) + this.#tone;
    const index = this.#tones.length;
    this.#tones.push(tone);
    const stopTie = this.#open[tone];
    if (stopTie) this.#stopTie.add(index);
    if (altered) {
      this.#altered.set(index, pos[0]);
      this.#altersByTone[tone % 7] = pos[0];
      this.#alters.push(pos[0]);
    } else if (stopTie) this.#alters.push(stopTie);
    else this.#alters.push(this.#altersByTone[tone % 7]);

    if (startTie) {
      this.#open[tone] = this.#alters[index];
      this.#startTie.add(index);
    } else this.#open[tone] = null;
  }

  // a group is a set of simultaneous notes of equal duration
  // this may be asking for a reversal, like
  // give the parent element, and let me add the children...
  notes(group: number): number[] {
    const from = group && this.#groups[group - 1];
    const to = this.#groups[group];
    return Array.from({ length: to - from }, (_, i) => i + from);
  }

  pitches(xml: MusicXML): Element[] {
    return this.#tones.map((t, i) => xml.pitch(t, this.#alters[i]));
  }

  ties(xml: MusicXML): {
    stopTieds: Map<number, Element>;
    startTieds: Map<number, Element>;
  } {
    const startTieds: Map<number, Element> = new Map();
    const stopTieds: Map<number, Element> = new Map();
    this.#startTie.forEach((note) => {
      startTieds.set(
        note,
        xml.tied({
          type: "start",
          number: (this.#tones[note] % 16 + 1).toString(),
        }),
      );
    });
    this.#stopTie.forEach((note) => {
      stopTieds.set(
        note,
        xml.tied({
          type: "stop",
          number: (this.#tones[note] % 16 + 1).toString(),
        }),
      );
    });
    return { startTieds, stopTieds };
  }

  accidentals(xml: MusicXML): Map<number, Element> {
    return new Map(
      this.#altered.entries().map((
        [note, alter],
      ) => [note, xml.accidental(alter)]),
    );
  }
}
