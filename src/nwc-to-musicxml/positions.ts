import { MusicXML } from "./musicxml2.ts";
import { NWCLine } from "./scanner.ts";
import { Element } from "./xml3.ts";

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
