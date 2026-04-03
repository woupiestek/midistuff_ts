import { PER_WHOLE } from "./durations.ts";
import { MusicXML } from "./musicxml.ts";
import { NWCLines } from "./scanner.ts";
import { create, Element } from "./xml.ts";

export class Bars {
  staves: number[] = [];
  #measures = -1;
  #barStyles: Map<number, string> = new Map();
  #endings: Map<number, string[]> = new Map();
  #endingBar: string = "SectionClose";

  #times: Map<number, string> = new Map();
  #clefs: Map<number, string> = new Map();
  #clefOctaveChanges: Map<number, number> = new Map();
  #keys: Map<number, number> = new Map();

  visit({ tags, values }: NWCLines, visited: Set<number>): void {
    for (let i = 0; i < tags.length; i++) {
      switch (tags[i]) {
        case "AddStaff":
          this.#measures++;
          this.staves.push(this.#measures);
          if (this.#measures > 1) {
            this.#barStyles.set(this.#measures, this.#endingBar);
          }
          break;
        case "StaffProperties":
          if (values[i].EndingBar) {
            this.#endingBar = values[i].EndingBar[0].replaceAll(" ", "");
          }
          break;
        case "Bar":
          this.#measures++;
          if (values[i].Style) {
            this.#barStyles.set(this.#measures, values[i].Style[0]);
          }
          break;
        case "Ending":
          this.#endings.set(this.#measures, values[i].Endings);
          break;
        case "TimeSig":
          switch (values[i].Signature[0]) {
            case "Common":
              this.#times.set(this.#measures, "4/4");
              break;
            case "AllaBreve":
              this.#times.set(this.#measures, "2/2");
              break;
            default:
              this.#times.set(this.#measures, values[i].Signature[0]);
              break;
          }
          break;
        case "Clef":
          this.#clefs.set(this.#measures, values[i].Type[0]);
          if (!values[i].OctaveShift) break;
          switch (values[i].OctaveShift[0]) {
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
          for (const x of values[i].Signature) {
            if (x[1] === "#") fifths++;
            else fifths--;
          }
          this.#keys.set(this.#measures, fifths);
          break;
        }
        default:
          continue;
      }
      visited.add(i);
    }
  }

  visitEnd() {
    this.#measures++;
    this.staves.push(this.#measures);
    this.#barStyles.set(this.#measures, this.#endingBar);
  }

  // this is here to deal with the issue that the data in a musicxml measure may be spread out in the nwc file
  multiple(
    parts: number[],
    secondStaves: Set<number>,
    allNotes: (Element | null)[][],
    xml: MusicXML,
  ): Element[][] {
    const allAttributes = this.#allAttributes(parts, secondStaves, xml);

    // notes per part per measure
    const groupedNotes: Element[][][] = parts.map(() => []);
    const endings: Map<number, string[]>[] = [];
    const leftBarstyles: Map<number, string>[] = [];
    const rightBarstyles: Map<number, string>[] = [];
    // only keep measures with notes in the end
    // soemthing that noteworthy does.
    const keep = new Set<number>();

    for (let part = 0; part < parts.length - 1; part++) {
      const gns: Element[][] = [];
      const es = new Map<number, string[]>();
      const lbss = new Map<number, string>();
      const rbss = new Map<number, string>();
      for (let staff = parts[part]; staff < parts[part + 1]; staff++) {
        let backup = xml.backup(PER_WHOLE);
        for (
          let measure = this.staves[staff];
          measure < this.staves[staff + 1];
          measure++
        ) {
          const time = this.#times.get(measure);
          if (time) {
            const [n, d] = time.split("/");
            backup = xml.backup(PER_WHOLE * +n / +d);
            // break;
          }
          const m = measure - this.staves[staff];
          gns[m] ||= [];
          const notesM: Element[] = allNotes[measure].filter((it) =>
            it !== null
          );
          if (notesM.length) {
            gns[m].push(...notesM, backup);
            keep.add(m);
          }

          const ending = this.#endings.get(measure);
          if (ending) {
            es.set(m, ending);
          }
          const leftBarstyle = this.#barStyles.get(measure);
          if (leftBarstyle) {
            lbss.set(m, leftBarstyle);
          }
          const rightBarstyle = this.#barStyles.get(measure + 1);
          if (rightBarstyle) {
            rbss.set(m, rightBarstyle);
          }
        }
      }

      gns.forEach((measure) => measure.pop());
      groupedNotes[part] = gns;
      endings[part] = es;
      leftBarstyles[part] = lbss;
      rightBarstyles[part] = rbss;
    }

    const result: Element[][] = [];
    for (let part = 0; part < parts.length - 1; part++) {
      result[part] = [];
      for (let measure = 0; measure < groupedNotes[part].length; measure++) {
        if (!keep.has(measure)) continue;
        result[part].push(
          create(
            "measure",
            { number: measure.toString() },
            xml.leftBarline(
              leftBarstyles[part].get(measure),
              endings[part].get(measure),
            ),
            allAttributes[part].get(measure) ?? null,
            ...groupedNotes[part][measure],
            xml.rightBarline(
              rightBarstyles[part].get(measure),
              endings[part].get(measure),
            ),
          ),
        );
      }
    }
    return result;
  }

  #allAttributes(
    parts: number[],
    secondStaves: Set<number>,
    xml: MusicXML,
  ): Map<number, Element>[] {
    // part, measure, cumulative array of attributes
    const result: Map<number, Element>[] = parts.map(() => new Map());
    const twoStaves = create(
      "staves",
      undefined,
      "2",
    );
    const divisions = create(
      "divisions",
      undefined,
      (PER_WHOLE / 4).toString(),
    );
    for (let part = 0; part < parts.length - 1; part++) {
      for (let j = parts[part]; j < parts[part + 1]; j++) {
        // secondStaves.has(j)
        const staff = secondStaves.has(j) ? 2 : 1;
        for (let k = this.staves[j]; k < this.staves[j + 1]; k++) {
          const measure = k - this.staves[j];
          // take note
          const attrs: Element[] = [];
          if (measure === 0) attrs.push(divisions);
          const key = this.#keys.get(k);
          if (key !== undefined) attrs.push(xml.key(key));
          const time = this.#times.get(k);
          if (time) {
            const [beats, beatType] = time.split("/");
            attrs.push(xml.time(beats, beatType));
          }
          const clef = this.#clefs.get(k);
          if (clef) {
            attrs.push(
              xml.clef(clef, this.#clefOctaveChanges.get(k) ?? 0, staff),
            );
          }
          if (staff === 2) {
            attrs.push(twoStaves);
          }
          if (attrs.length) {
            result[part].set(
              measure,
              create("attributes", undefined, ...attrs),
            );
          }
        }
      }
    }
    return result;
  }
}
