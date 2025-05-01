import { MusicXML } from "./musicxml.ts";
import { NWCLine } from "./scanner.ts";

export class Lyrics {
  #syllables: string[][] = Array.from({ length: 8 }, () => []);
  #starts: Set<number>[] = Array.from({ length: 8 }, () => new Set());
  #stops: Set<number>[] = Array.from({ length: 8 }, () => new Set());

  #noteNumber: number = 0;
  // don't add lyrics to slurred or tied notes
  #continue: boolean = false;

  #lyrics: Map<number, string>[] = Array.from({ length: 8 }, () => new Map());
  #syllabilities: Map<number, string>[] = Array.from(
    { length: 8 },
    () => new Map(),
  );

  // break into syllables and store in reverse order
  // decrement number by 1 as usual.
  #setStaffLyrics(number: number, text: string) {
    const words = text.slice(1, text.length - 1).split(/\s+|\\n/g).filter(
      (it) => it,
    );
    const syllables = this.#syllables[number - 1];
    const starts = this.#starts[number - 1];
    const stops = this.#stops[number - 1];
    for (let word = words.pop(); word !== undefined; word = words.pop()) {
      const _syllables = word.split("-");
      stops.add(syllables.length);
      for (
        let syllable = _syllables.pop();
        syllable !== undefined;
        syllable = _syllables.pop()
      ) {
        syllables.push(syllable);
      }
      starts.add(syllables.length - 1);
    }
  }

  visit(line: NWCLine) {
    switch (line.tag) {
      case "Lyrics":
        for (let i = 0; i < 8; i++) {
          this.#syllables[i].length = 0;
          this.#starts[i].clear();
          this.#stops[i].clear();
        }
        // maybe do somthing with placement?
        // needed at every note, however.
        break;
      case "Lyric1":
        this.#setStaffLyrics(1, line.values.Text[0]);
        break;
      case "Lyric2":
        this.#setStaffLyrics(2, line.values.Text[0]);
        break;
      case "Lyric3":
        this.#setStaffLyrics(3, line.values.Text[0]);
        break;
      case "Lyric4":
        this.#setStaffLyrics(4, line.values.Text[0]);
        break;
      case "Lyric5":
        this.#setStaffLyrics(5, line.values.Text[0]);
        break;
      case "Lyric6":
        this.#setStaffLyrics(6, line.values.Text[0]);
        break;
      case "Lyric7":
        this.#setStaffLyrics(7, line.values.Text[0]);
        break;
      case "Lyric8":
        this.#setStaffLyrics(8, line.values.Text[0]);
        break;
      case "Note":
      case "Chord":
      case "RestChord":
        if (line.values.Pos2) {
          this.#noteNumber += line.values.Pos2.length;
        }
        if (line.values.Pos) {
          // don't add a lyric if this note is slurred or tied to the next
          if (!this.#continue) {
            this.#moveLyrics(this.#noteNumber);
          }
          this.#continue = line.values.Dur.includes("Slur") ||
            line.values.Pos.some((pos) => pos.endsWith("^"));
          this.#noteNumber += line.values.Pos.length;
        }
        break;
      default:
        return false;
    }
    return true;
  }

  static #SYLLABILITIES = ["middle", "begin", "end", "single"];

  #moveLyrics(noteNumer: number) {
    for (let i = 0; i < 8; i++) {
      const syllable = this.#syllables[i].pop();
      if (!syllable) continue;
      this.#lyrics[i].set(noteNumer, syllable);
      const index = this.#syllables[i].length;
      const syllability = Lyrics
        .#SYLLABILITIES[
          +this.#starts[i].has(index) +
          +this.#stops[i].has(index) * 2
        ];
      this.#syllabilities[i].set(noteNumer, syllability);
    }
  }

  get(noteNumber: number, xml: MusicXML) {
    const lyrics = [];
    for (let i = 0; i < 8; i++) {
      const text = this.#lyrics[i].get(noteNumber);
      const syllabic = this.#syllabilities[i].get(noteNumber);
      if (!text || !syllabic) continue;
      lyrics.push(
        xml.create(
          "lyric",
          { number: (i + 1).toString() },
          xml.create("syllabic", undefined, syllabic),
          xml.create("text", undefined, text),
        ),
      );
    }
    return lyrics;
  }
}
