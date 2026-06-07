import { MusicXML } from "./musicxml.ts";
import { Lyrics } from "./lyrics.ts";
import { Positions } from "./positions.ts";
import { Durations } from "./durations.ts";
import { scan } from "./scanner.ts";
import { Bars } from "./bars.ts";
import { Staves } from "./staves.ts";

const TECHNICAL_TAGS = [
  "Editor",
  "Font",
  "PgMargins",
  "PgSetup",
  "Spacer",
];

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
    const length = lines.values.length;
    const visited: Set<number> = new Set(
      TECHNICAL_TAGS.flatMap((tag) => lines.lineNumbersByTag[tag]),
    );
    lines.skipped.forEach((it) => visited.add(it));
    this.#staves.visit(lines, visited);
    this.#bars.visit(lines, visited);
    this.#durations.visit(lines, visited);
    this.#lyrics.visit(lines, visited);
    this.#positions.visit(lines, visited);
    const notVisited = new Set(
      Array(length).keys().filter((i) => !visited.has(i)),
    );
    if (notVisited.size) {
      console.warn("Unused lines:", ...notVisited.values().map((i) => i + 1));
    }
    const xml = new MusicXML();
    const allNotes = this.#durations.allNotes(
      this.#staves.seconds,
      {
        positions: this.#positions.build(),
        lyrics: this.#lyrics.elements,
      },
      xml,
      this.#bars.ticksPerMeasure(),
    );
    const allMeasures = this.#bars.multiple(
      this.#staves.firstNWCStaffByPart,
      this.#staves.seconds,
      allNotes,
      xml,
    );
    return xml.stringify(this.#staves.allParts(allMeasures));
  }
}
