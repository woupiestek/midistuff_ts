import { MusicXML } from "./musicxml.ts";
import { NWCLine } from "./scanner.ts";
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
    stopTies: Map<number, Element>;
    startTies: Map<number, Element>;
    stopTieds: Map<number, Element>;
    startTieds: Map<number, Element>;
  } {
    const startTieds: Map<number, Element> = new Map();
    const startTies: Map<number, Element> = new Map();
    const stopTieds: Map<number, Element> = new Map();
    const stopTies: Map<number, Element> = new Map();
    this.#startTie.entries().forEach(([note, number]) => {
      startTies.set(note, xml.tie.start);
      startTieds.set(
        note,
        xml.tied({ type: "start", number: number.toString() }),
      );
    });
    this.#stopTie.entries().forEach(([note, number]) => {
      stopTies.set(note, xml.tie.stop);
      stopTieds.set(
        note,
        xml.tied({ type: "stop", number: number.toString() }),
      );
    });
    return { startTieds, startTies, stopTieds, stopTies };
  }

  accidentals(xml: MusicXML): Map<number, Element> {
    return new Map(
      this.#altered.entries().map((
        [note, alter],
      ) => [note, xml.accidental(alter)]),
    );
  }

  backup(group: number): boolean {
    return this.#backup.has(group);
  }
}
