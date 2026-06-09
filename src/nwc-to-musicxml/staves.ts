import { create, Element } from "./xml.ts";
import { countLessThan, NWCLines } from "./scanner.ts";
import { GM_INSTRUMENTS } from "./instruments.ts";

// noteworthy can layer staffs, musicxml cannot
// moreover, the notion of a part is different.
// the layer property is a mystery...

export class Staves {
  firstNWCStaffByPart: number[] = [];
  #names: string[] = [];
  #midi: {
    channels: number[];
    volumes: number[];
    pans: number[];
    programs: number[];
    names: string[];
  } = { channels: [], volumes: [], pans: [], programs: [], names: [] };
  #songInfo: Map<string, string> = new Map();
  // a part may have a second staff, which must be kept track of
  seconds: Set<number> = new Set();

  visit(
    nwcLines: NWCLines,
    visited: Set<number>,
  ): void {
    const { values, lineNumbersByTag } = nwcLines;

    if (lineNumbersByTag.SongInfo) {
      for (const lineNumber of lineNumbersByTag.SongInfo) {
        for (const [k, v] of Object.entries(values[lineNumber])) {
          this.#songInfo.set(k, v[0]);
        }
        visited.add(lineNumber);
      }
    }

    this.#names = lineNumbersByTag.AddStaff.map((lineNumber) =>
      values[lineNumber].Name[0].slice(1, -1)
    );
    lineNumbersByTag.AddStaff.forEach((lineNumber) => visited.add(lineNumber));

    const merge: Set<number> = new Set();
    for (const lineNumber of lineNumbersByTag.StaffProperties) {
      if (values[lineNumber].WithNextStaff) {
        const withNextStaff = new Set(values[lineNumber].WithNextStaff);
        if (withNextStaff.has("Brace")) {
          const nextStaffIndex = countLessThan(
            lineNumber,
            lineNumbersByTag.AddStaff,
          );
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
    this.#vistsMidi(nwcLines, visited);
  }

  #vistsMidi({ values, lineNumbersByTag }: NWCLines, visited: Set<number>) {
    const length = lineNumbersByTag.AddStaff.length;
    const parts: number[] = Array.from(lineNumbersByTag.AddStaff, () => 0);
    for (let i = 0; i < length - 1; i++) {
      const line = lineNumbersByTag.StaffProperties[2 * i];
      parts[i + 1] = parts[i] + +!values[line].WithNextStaff?.includes("Brace");
      visited.add(line);
    }

    for (let i = 0; i < length; i++) {
      const line1 = lineNumbersByTag.StaffProperties[2 * i + 1];
      visited.add(line1);
      const properties = values[line1];
      const channel = +properties.Channel?.[0];
      if (!Number.isNaN(channel)) this.#midi.channels[parts[i]] = channel;
      const volume = +properties.Volume?.[0];
      if (!Number.isNaN(volume)) {
        this.#midi.volumes[parts[i]] = Math.round(((volume + 1) / 128) * 100);
      }
      const stereoPan = +properties.StereoPan?.[0];
      if (!Number.isNaN(stereoPan)) {
        this.#midi.pans[parts[i]] = Math.round(180 * (stereoPan / 64 - 1));
      }

      const line2 = lineNumbersByTag.StaffInstrument[i];
      visited.add(line2);
      const instrument = values[line2];
      const patch = +instrument.Patch?.[0];
      if (!Number.isNaN(patch)) this.#midi.programs[parts[i]] = patch + 1;
      const name = instrument.Name?.[0];
      if (name) {
        const m = this.#midi.names[parts[i]];
        const n = name.substring(1, name.length - 1);
        this.#midi.names[parts[i]] = m && m !== n
          ? m + "," +
            n
          : n;
      }
    }
  }

  #MIDI_KEYS = ["midi-channel", "midi-name", "midi-program", "volume", "pan"];

  allParts(
    allMeasures: Element[][],
  ): Element {
    const scoreParts = [];
    const parts = [];
    for (let id = 1; id < this.firstNWCStaffByPart.length; id++) {
      const attributes = { id: `P${id}` };
      const from = this.firstNWCStaffByPart[id - 1];
      const to = this.firstNWCStaffByPart[id];

      const scoreInstrument: Element | null = this.#midi.programs[id - 1]
        ? create(
          "score-instrument",
          undefined,
          create(
            "instrument-name",
            undefined,
            GM_INSTRUMENTS.name[this.#midi.programs[id - 1] - 1],
          ),
          create(
            "instrument-sound",
            undefined,
            GM_INSTRUMENTS.instrumentSound[this.#midi.programs[id - 1] - 1],
          ),
        )
        : null;

      const midiInstrument: Element[] = [
        this.#midi.channels[id - 1],
        this.#midi.names[id - 1],
        this.#midi.programs[id - 1],
        this.#midi.volumes[id - 1],
        this.#midi.pans[id - 1],
      ].map((value, i) =>
        value === undefined
          ? null
          : create(this.#MIDI_KEYS[i], undefined, value.toString())
      ).filter((it) => it != null);

      scoreParts.push(
        create(
          "score-part",
          attributes,
          create(
            "part-name",
            undefined,
            this.#names.slice(from, to).join(", "),
          ),
          scoreInstrument,
          midiInstrument.length
            ? create(
              "midi-instrument",
              undefined,
              ...midiInstrument,
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
