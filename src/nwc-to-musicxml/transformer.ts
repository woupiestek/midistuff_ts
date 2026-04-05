import { MusicXML } from "./musicxml.ts";
import { Lyrics } from "./lyrics.ts";
import { Positions } from "./positions.ts";
import { Durations } from "./durations.ts";
import { NWCLines, scan } from "./scanner.ts";
import { Bars } from "./bars.ts";
import { Staves } from "./staves.ts";

const TECHNICAL_TAGS = new Set([
  "Editor",
  "Font",
  "PgMargins",
  "PgSetup",
  "Spacer",
]);

type Structure = {
  bars: number[][];
  parts: number[];
  secondStaves: Set<number>;
  visited: Set<number>;
};

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

  #structure(nwcLines: NWCLines): Structure {
    const bars: number[][] = [];
    const parts: number[] = [];
    const secondStaves: Set<number> = new Set();
    const visited: Set<number> = new Set();
    for (
      let i = 0, l = nwcLines.tags.length, measure = 0, part = 0, staff = 0;
      i < l;
      i++
    ) {
      switch (nwcLines.tags[i]) {
        case "AddStaff":
          bars[staff++] = [i];
          parts.push(part++);
          break;
        case "StaffProperties": {
          const withNextStaff = new Set(nwcLines.values[i].WithNextStaff);
          if (withNextStaff.has("Brace")) {
            part--;
            if (!withNextStaff.has("Layer")) {
              secondStaves.add(staff);
            }
          }
          break;
        }
        case "Bar":
          bars[staff][measure++] = i;
          break;
        default:
          continue;
      }
      visited.add(i);
    }
    const staffLength = bars.reduce((i, j) => j.length > i ? j.length : i, 0);
    const filler = Array(bars.length).keys().map((k) =>
      k < bars.length ? bars[k + 1][0] : nwcLines.tags.length
    ).toArray();
    bars.forEach((part, i) => {
      while (part.length < staffLength) {
        part.push(filler[i]);
      }
    });
    return { bars, parts, secondStaves, visited };
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
      this.#bars.staves,
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
