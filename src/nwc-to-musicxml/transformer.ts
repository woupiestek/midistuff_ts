import { MusicXML } from "./musicxml2.ts";
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
    for (const line of lines) {
      if (TECHNICAL_TAGS.has(line.tag)) continue;
      let visited = false;
      // no short-circuiting here
      if (this.#positions.visit(line)) visited = true;
      if (this.#bars.visit(line)) visited = true;
      if (this.#staves.visit(line)) visited = true;
      if (this.#durations.visit(line)) visited = true;
      if (this.#lyrics.visit(line)) visited = true;
      if (!visited) {
        console.warn("Unused line", line);
      }
    }
    this.#bars.visitEnd();
    this.#durations.visitEnd();
    const xml = new MusicXML();
    return xml.stringify(
      this.#staves.parts(
        this.#bars,
        this.#durations,
        this.#positions,
        this.#lyrics,
        xml,
      ),
    );
  }
}
