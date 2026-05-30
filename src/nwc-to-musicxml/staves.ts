import { create, Element } from "./xml.ts";
import { countLessThan, NWCLines } from "./scanner.ts";

// noteworthy can layer staffs, musicxml cannot
// moreover, the notion of a part is different.
// the layer property is a mystery...

export class Staves {
  firstNWCStaffByPart: number[] = [];
  #names: string[] = [];
  #midiPrograms: number[] = [];
  #songInfo: Map<string, string> = new Map();
  // a part may have a second staff, which must be kept track of
  seconds: Set<number> = new Set();

  visit(
    { values, lineNumbersByTag }: NWCLines,
    visited: Set<number>,
  ): void {
    if (lineNumbersByTag.SongInfo) {
      for (const lineNumber of lineNumbersByTag.SongInfo) {
        for (const [k, v] of Object.entries(values[lineNumber])) {
          this.#songInfo.set(k, v[0]);
        }
        visited.add(lineNumber);
      }
    }

    if(lineNumbersByTag.StaffInstrument) {
    // still not picked up by musescore, alas
    for (const lineNumber of lineNumbersByTag.StaffInstrument) {
      if (values[lineNumber].Patch) {
        const staffIndex = countLessThan(lineNumber, lineNumbersByTag.AddStaff);
        this.#midiPrograms[staffIndex] = +values[lineNumber].Patch[0] +
          1;
          visited.add(lineNumber);
      }
    }}

    this.#names = lineNumbersByTag.AddStaff.map((lineNumber) =>
      values[lineNumber].Name[0].slice(1, -1)
    );
    lineNumbersByTag.AddStaff.forEach((lineNumber) => visited.add(lineNumber));

    const merge: Set<number> = new Set();
    for (const lineNumber of lineNumbersByTag.StaffProperties) {
      if (values[lineNumber].WithNextStaff) {
        const withNextStaff = new Set(values[lineNumber].WithNextStaff);
        if (withNextStaff.has("Brace")) {
          const nextStaffIndex =
            countLessThan(lineNumber, lineNumbersByTag.AddStaff) + 1;
          merge.add(nextStaffIndex);
          if (!withNextStaff.has("Layer")) {
            this.seconds.add(
              nextStaffIndex,
            );
          }
          visited.add(lineNumber);
        }
      }
    }
    this.firstNWCStaffByPart = this.#names.map((_, i) => i).filter((i) =>
      !merge.has(i)
    );
    // add one past the end for easier calculations later
    this.firstNWCStaffByPart.push(this.#names.length);
  }

  allParts(
    allMeasures: Element[][],
  ): Element {
    const scoreParts = [];
    const parts = [];
    for (let id = 1; id < this.firstNWCStaffByPart.length; id++) {
      const attributes = { id: `P${id}` };
      const from = this.firstNWCStaffByPart[id - 1];
      const to = this.firstNWCStaffByPart[id];
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

    const songInfo: Element[] = [];
    const identification = create("identification");
    const rights: string[] = [];
    for (const [k, v] of this.#songInfo) {
      switch (k) {
        case "Title":
          songInfo.push(
            create(
              "work",
              undefined,
              create("work-title", undefined, JSON.parse(v)),
            ),
          );
          break;
        case "Author":
        case "Lyricist":
          identification.addElement(
            create("creator", { type: k.toLowerCase() }, JSON.parse(v)),
          );
          break;
        case "Copyright1":
        case "Copyright2":
          rights.push(JSON.parse(v));
          break;
        default:
          console.warn("song data ignored:", k, v);
      }
    }
    if (rights.length) {
      identification.addElement(create("rights", undefined, rights.join("\n")));
    }
    songInfo.push(identification);
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
