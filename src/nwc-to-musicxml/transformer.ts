import { MusicXML } from "./musicxml.ts";
import { Lyrics } from "./lyrics.ts";
import { Positions } from "./positions.ts";
import { Durations } from "./durations.ts";
import { scan } from "./scanner.ts";
import { Bars } from "./bars.ts";
import { Staves } from "./staves.ts";

const TECHNICAL_TAGS = new Set([
  "Editor",
  "Font",
  "PgMargins",
  "PgSetup",
  "Spacer",
]);

export class Transformer {
  #positions: Positions;
  #durations: Durations;
  #bars: Bars;
  #staves: Staves;
  #lyrics: Lyrics;

  constructor() {
    this.#positions = new Positions();
    this.#durations = new Durations();
    this.#bars = new Bars();
    this.#staves = new Staves();
    this.#lyrics = new Lyrics();
  }

  transform(source: string): string {
    const lines = scan(source);
    const length = lines.tags.length;
    const visited: Set<number> = new Set(
      Array(length).keys().filter((i) => TECHNICAL_TAGS.has(lines.tags[i])),
    );
    lines.tags.forEach((it, ix) => {
      if (TECHNICAL_TAGS.has(it)) visited.add(ix);
    });
    this.#positions.visit(lines, visited);
    this.#bars.visit(lines, visited);
    this.#staves.visit(lines, visited);
    this.#durations.visit(lines, visited);
    this.#lyrics.visit(lines, visited);
    const notVisited = new Set(
      Array(length).keys().filter((i) => !visited.has(i)),
    );
    if (notVisited.size) {
      console.warn("Unused lines:", ...notVisited);
    }

    this.#staves.visitEnd();
    this.#bars.visitEnd();
    this.#durations.visitEnd();
    const xml = new MusicXML();
    const allNotes = this.#durations.allNotes(
      this.#staves.seconds,
      {
        positions: this.#positions.build(),
        lyrics: this.#lyrics.get(),
      },
      xml,
    );
    const allMeasures = this.#bars.multiple(
      this.#staves.parts,
      this.#staves.seconds,
      allNotes,
      xml,
    );
    return xml.stringify(this.#staves.allParts(allMeasures));
  }
}
