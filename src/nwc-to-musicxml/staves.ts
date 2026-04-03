import { create, Element } from "./xml.ts";
import { NWCLines } from "./scanner.ts";

// noteworthy can layer staffs, musicxml cannot
// moreover, the notion of a part is different.
// the layer property is a mystery...

export class Staves {
  parts: number[] = [];
  #names: string[] = [];
  #midiPrograms: number[] = [];
  #merge = false;
  #songInfo: Map<string, string> = new Map();
  #onSecondStaff = false;
  // a part may have a second staff, which must be kept track of
  seconds: Set<number> = new Set();

  visit({ tags, values }: NWCLines, visited: Set<number>): void {
    for (let i = 0; i < tags.length; i++) {
      switch (tags[i]) {
        case "AddStaff":
          if (this.#merge) {
            this.#merge = false;
            if (this.#onSecondStaff) {
              this.seconds.add(this.#names.length);
            }
          } else {
            this.parts.push(this.#names.length);
            this.#onSecondStaff = false;
          }
          this.#names.push(values[i].Name[0].slice(1, -1));
          break;
        case "StaffProperties": {
          const withNextStaff = new Set(values[i].WithNextStaff);
          if (withNextStaff.has("Brace")) {
            this.#merge = true;
            if (!withNextStaff.has("Layer")) {
              this.#onSecondStaff = true;
            }
          }
          break;
        }
        case "StaffInstrument":
          if (values[i].Patch) {
            this.#midiPrograms[this.#names.length - 1] = +values[i].Patch[0] +
              1;
          }
          break;
        // is this related to staves?
        case "SongInfo":
          for (const [k, v] of Object.entries(values[i])) {
            this.#songInfo.set(k, v[0]);
          }
          break;
        default:
          continue;
      }
      visited.add(i);
    }
  }

  visitEnd() {
    this.parts.push(this.#names.length);
  }

  allParts(
    allMeasures: Element[][],
  ): Element {
    const scoreParts = [];
    const parts = [];
    for (let id = 1; id < this.parts.length; id++) {
      const attributes = { id: `P${id}` };
      const from = this.parts[id - 1];
      const to = this.parts[id];
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
          ...allMeasures[id - 1],
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
      // not really!
      ...songInfo,
      create("part-list", undefined, ...scoreParts),
      ...parts,
    );
  }
}
