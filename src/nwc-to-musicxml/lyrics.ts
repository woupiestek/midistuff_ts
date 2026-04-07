import { NWCLines } from "./scanner.ts";
import { create, Element } from "./xml.ts";

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

  visit({ tags, values }: NWCLines, visited: Set<number>): void {
    for (let i = 0; i < tags.length; i++) {
      switch (tags[i]) {
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
          this.#setStaffLyrics(1, values[i].Text[0]);
          break;
        case "Lyric2":
          this.#setStaffLyrics(2, values[i].Text[0]);
          break;
        case "Lyric3":
          this.#setStaffLyrics(3, values[i].Text[0]);
          break;
        case "Lyric4":
          this.#setStaffLyrics(4, values[i].Text[0]);
          break;
        case "Lyric5":
          this.#setStaffLyrics(5, values[i].Text[0]);
          break;
        case "Lyric6":
          this.#setStaffLyrics(6, values[i].Text[0]);
          break;
        case "Lyric7":
          this.#setStaffLyrics(7, values[i].Text[0]);
          break;
        case "Lyric8":
          this.#setStaffLyrics(8, values[i].Text[0]);
          break;
        case "Note":
        case "Chord":
        case "RestChord":
          if (values[i].Pos2) {
            this.#noteNumber += values[i].Pos2.length;
          }
          if (values[i].Pos) {
            // don't add a lyric if this note is slurred or tied to the next
            if (!this.#continue) {
              this.#moveLyrics(this.#noteNumber);
            }
            this.#continue = values[i].Dur.includes("Slur") ||
              values[i].Pos.some((pos) => pos.endsWith("^"));
            this.#noteNumber += values[i].Pos.length;
          }
          break;
        default:
          continue;
      }
      visited.add(i);
    }
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

  get() {
    const lyrics: Element[][] = Array.from(
      { length: this.#noteNumber },
      () => [],
    );
    for (let i = 0; i < 8; i++) {
      this.#lyrics[i].forEach((text, noteNumber) => {
        const syllabic = this.#syllabilities[i].get(noteNumber);
        if (!syllabic) return;
        lyrics[noteNumber].push(
          create(
            "lyric",
            { number: (i + 1).toString() },
            create("syllabic", undefined, syllabic),
            create("text", undefined, text),
          ),
        );
      });
    }
    return lyrics;
  }
}
