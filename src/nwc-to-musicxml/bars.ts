import { assert } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Durations, PER_WHOLE } from "./durations.ts";
import { Lyrics } from "./lyrics.ts";
import { MusicXML } from "./musicxml.ts";
import { Positions } from "./positions.ts";
import { NWCLine } from "./scanner.ts";
import { create, Element } from "./xml.ts";

export class Bars {
  #staves: number[] = [];
  #measures = -1;
  #barStyles: Map<number, string> = new Map();
  #endings: Map<number, string[]> = new Map();
  #endingBar: string = "SectionClose";

  #times: Map<number, string> = new Map();
  #clefs: Map<number, string> = new Map();
  #clefOctaveChanges: Map<number, number> = new Map();
  #keys: Map<number, number> = new Map();

  #layered: Set<number> = new Set();

  visit(line: NWCLine): boolean {
    switch (line.tag) {
      case "AddStaff":
        this.#measures++;
        this.#staves.push(this.#measures);
        if (this.#measures > 1) {
          this.#barStyles.set(this.#measures, this.#endingBar);
        }
        break;
      case "StaffProperties":
        if (line.values.EndingBar) {
          this.#endingBar = line.values.EndingBar[0].replaceAll(" ", "");
        }
        if (new Set(line.values.WithNextStaff).has("Layer")) {
          // technically the next staff
          this.#layered.add(this.#staves.length);
        }
        break;
      case "Bar":
        this.#measures++;
        if (line.values.Style) {
          this.#barStyles.set(this.#measures, line.values.Style[0]);
        }
        break;
      case "Ending":
        this.#endings.set(this.#measures, line.values.Endings);
        break;
      case "TimeSig":
        switch (line.values.Signature[0]) {
          case "Common":
            this.#times.set(this.#measures, "4/4");
            break;
          case "AllaBreve":
            this.#times.set(this.#measures, "2/2");
            break;
          default:
            this.#times.set(this.#measures, line.values.Signature[0]);
            break;
        }
        break;
      case "Clef":
        this.#clefs.set(this.#measures, line.values.Type[0]);
        if (!line.values.OctaveShift) break;
        switch (line.values.OctaveShift[0]) {
          case "Octave Up":
            this.#clefOctaveChanges.set(this.#measures, 1);
            break;
          case "Octave Down":
            this.#clefOctaveChanges.set(this.#measures, -1);
            break;
          default:
            break;
        }
        break;
      case "Key": {
        let fifths = 0;
        for (const x of line.values.Signature) {
          if (x[1] === "#") fifths++;
          else fifths--;
        }
        this.#keys.set(this.#measures, fifths);
        break;
      }
      default:
        return false;
    }
    return true;
  }

  visitEnd() {
    this.#measures++;
    this.#staves.push(this.#measures);
    this.#barStyles.set(this.#measures, this.#endingBar);
  }

  multiple(
    from: number,
    to: number,
    durations: Durations,
    positions: Positions,
    lyrics: Lyrics,
    xml: MusicXML,
  ) {
    const offsets = this.#staves.slice(from, to);
    const length = this.#staves[from + 1] - this.#staves[from];
    const staves: number[] = [];
    for (let i = from, staff = 0; i < to; i++) {
      if (!this.#layered.has(i)) staff++;
      staves.push(staff);
    }

    for (let j = from + 1; j < to; j++) {
      const l2 = this.#staves[j + 1] - this.#staves[j];
      assert(
        length === l2,
        `combined staves must have the same length ${length} !== ${l2}`,
      );
    }
    let backup = xml.backup(PER_WHOLE);
    const result: Element[] = [];
    for (let i = 0, measure = 0; i < length; i++) {
      for (const j of offsets) {
        const time = this.#times.get(i + j);
        if (time) {
          const [n, d] = time.split("/");
          backup = xml.backup(PER_WHOLE * +n / +d);
          break;
        }
      }

      const nested = offsets.map((offset, k) =>
        durations.notes(
          i + offset,
          (k + 1).toString(),
          xml.staff(staves[k]),
          positions,
          lyrics,
          xml,
        )
      ).filter((it) => it.length);
      if (!nested.length) continue;
      measure++;
      nested.forEach((it) => it.push(backup));
      const notes = nested.flat();
      notes.pop();

      let endings, leftBarstyle, rightBarstyle;
      for (const j of offsets) {
        endings ||= this.#endings.get(i + j);
        leftBarstyle ||= this.#barStyles.get(i + j);
        rightBarstyle ||= this.#barStyles.get(i + j + 1);
        if (endings && leftBarstyle && rightBarstyle) break;
      }
      result.push(
        create(
          "measure",
          { number: measure.toString() },
          xml.leftBarline(
            leftBarstyle,
            endings,
          ),
          this.#attributes(xml, i, offsets, staves),
          ...notes,
          xml.rightBarline(
            rightBarstyle,
            endings,
          ),
        ),
      );
    }
    return result;
  }

  #attributes(xml: MusicXML, i: number, offsets: number[], staves: number[]) {
    const content: (Element)[] = [];
    if (i === 0) {
      content.push(
        create(
          "divisions",
          undefined,
          (PER_WHOLE / 4).toString(),
        ),
      );
    }

    let key, time;
    const clefs = new Map();

    for (let k = 0, l = offsets.length; k < l; k++) {
      const j = i + offsets[k];
      key ||= this.#keys.get(j);
      time ||= this.#times.get(j);
      const clef = this.#clefs.get(j);
      if (clef) {
        clefs.set(
          staves[k],
          xml.clef(clef, this.#clefOctaveChanges.get(j) ?? 0, staves[k]),
        );
      }
    }
    if (key !== undefined) content.push(xml.key(key));
    if (time) {
      const [beats, beatType] = time.split("/");
      content.push(xml.time(beats, beatType));
    }
    if (offsets.length > 1) {
      content.push(
        create(
          "staves",
          undefined,
          staves[staves.length - 1].toString(),
        ),
      );
    }
    content.push(...clefs.values());
    if (content.length === 0) return null;
    return create("attributes", undefined, ...content);
  }
}
