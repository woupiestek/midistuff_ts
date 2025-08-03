import { create, Element } from "./xml.ts";
import { MusicXML } from "./musicxml.ts";
import { Lyrics } from "./lyrics.ts";
import { Positions } from "./positions.ts";
import { Durations } from "./durations.ts";
import { NWCLine } from "./scanner.ts";
import { Bars } from "./bars.ts";

export class Staves {
  #parts: number[] = [];
  #names: string[] = [];
  #midiPrograms: number[] = [];
  #merge = false;
  #songInfo: Map<string, string> = new Map();
  visit(line: NWCLine): boolean {
    switch (line.tag) {
      case "AddStaff":
        if (!this.#merge) {
          this.#parts.push(this.#names.length);
        } else {
          this.#merge = false;
        }
        this.#names.push(line.values.Name[0].slice(1, -1));
        break;
      case "StaffProperties": {
        const withNextStaff = new Set(line.values.WithNextStaff);
        if (
          withNextStaff.has("Brace") || withNextStaff.has("Layer")
        ) {
          this.#merge = true;
        }
        break;
      }
      case "StaffInstrument":
        if (line.values.Patch) {
          this.#midiPrograms[this.#names.length - 1] = +line.values.Patch[0] +
            1;
        }
        break;

      case "SongInfo":
        for (const [k, v] of Object.entries(line.values)) {
          this.#songInfo.set(k, v[0]);
        }
        break;
      default:
        return false;
    }
    return true;
  }

  parts(
    bars: Bars,
    durations: Durations,
    positions: Positions,
    lyrics: Lyrics,
    xml: MusicXML,
  ): Element {
    const scoreParts = [];
    const parts = [];
    for (let id = 1; id <= this.#parts.length; id++) {
      const attributes = { id: `P${id}` };
      const from = this.#parts[id - 1];
      const to = this.#parts[id] ?? this.#names.length;
      const program = this.#midiPrograms.slice(from, to).find((it) =>
        it !== undefined
      );
      scoreParts.push(
        create(
          "score-part",
          attributes,
          create(
            "part-name",
            undefined,
            this.#names.slice(from, to).join(", "),
          ),
          program
            ? create(
              "midi-instrument",
              undefined,
              create(
                "midi-program",
                undefined,
                program.toString(),
              ),
            )
            : null,
        ),
      );
      parts.push(
        create(
          "part",
          attributes,
          ...bars.multiple(from, to, durations, positions, lyrics, xml),
        ),
      );
    }

    const songInfo: (Element)[] = [];
    const identification: (Element)[] = [];
    for (const [k, v] of this.#songInfo) {
      switch (k) {
        case "Title":
          songInfo.push(
            create(
              "work",
              undefined,
              create("work-title", undefined, v),
            ),
          );
          break;
        case "Author":
        case "Lyricist":
          identification.push(
            create("creator", { type: k.toLowerCase() }, v),
          );
          break;
        case "Copyright1":
        case "Copyright2":
          identification.push(create("rights", undefined, v));
          break;
        default:
          console.warn("song data ignored:", k, v);
      }
    }
    songInfo.push(create("identification", undefined, ...identification));
    return create(
      "score-partwise",
      { version: "4.0" },
      ...songInfo,
      create("part-list", undefined, ...scoreParts),
      ...parts,
    );
  }
}
