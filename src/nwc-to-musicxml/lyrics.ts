import { countLessThan, NWCLines } from "./scanner.ts";
import { create, Element } from "./xml.ts";

export class Lyrics {
  elements: Map<number, Element[]> = new Map();
  #to_xml(text: string, number: number): Element[] {
    const words = text.slice(1, text.length - 1).split(/\s+|\\n/g).filter(
      (it) => it,
    );
    return words.flatMap((word) => {
      const syllables = word.split("-");
      if (syllables.length === 1) {
        return [
          create(
            "lyric",
            { number: number.toString() },
            create("syllabic", undefined, "single"),
            create("text", undefined, syllables[0]),
          ),
        ];
      }
      const syllabilities = Array.from(
        { length: syllables.length },
        () => "middle",
      );
      syllabilities[0] = "begin";
      syllabilities[syllabilities.length - 1] = "end";
      return syllables.map((syllable, i) =>
        create(
          "lyric",
          { number: number.toString() },
          create("syllabic", undefined, syllabilities[i]),
          create("text", undefined, syllable),
        )
      );
    });
  }

  visit(
    { values, lineNumbersByTag }: NWCLines,
    visited: Set<number>,
  ): void {
    const linesWithNotes = [
      lineNumbersByTag.Note,
      lineNumbersByTag.Chord,
      lineNumbersByTag.RestChord,
    ].flatMap((it) => it ?? []).toSorted((a, b) => a - b);
    const firstNoteOnLine: number[] = [0];
    linesWithNotes.forEach((lineNumber, i) => {
      firstNoteOnLine[i + 1] = (values[lineNumber].Pos2?.length ?? 0) +
        (values[lineNumber].Pos?.length ?? 0) +
        firstNoteOnLine[i];
    });
    const continued = new Set(linesWithNotes.filter((lineNumber) => {
      const { Dur, Pos, Pos2 } = values[lineNumber];
      return (Dur && Dur.includes("Slur")) ||
        (Pos && Pos.some((pos) => pos.endsWith("^"))) ||
        (Pos2 && Pos2.some((pos) => pos.endsWith("^")));
    }));
    const indices = linesWithNotes.keys()
      .filter(
        // don't add a lyric if this note is slurred or tied to the previous
        (i) => (i === 0) || !continued.has(linesWithNotes[i - 1]),
      ).toArray();

    const notes: number[] = [];
    const syllables: Element[] = [];

    for (let number = 1; number <= 8; number++) {
      if (!lineNumbersByTag[`Lyric${number}`]) continue;
      for (const lineNumber of lineNumbersByTag[`Lyric${number}`]) {
        const elements = this.#to_xml(values[lineNumber].Text[0], number);
        const offset = countLessThan(
          countLessThan(lineNumber, linesWithNotes),
          indices,
        );
        elements.forEach((element, i) => {
          notes.push(firstNoteOnLine[indices[offset + i]]);
          syllables.push(element);
        });
        visited.add(lineNumber);
      }
    }

    this.elements = new Map(notes.map((note) => [note, []]));
    for (let i = 0; i < notes.length; i++) {
      this.elements.get(notes[i])!.push(syllables[i]);
    }
  }
}
