import { PER_WHOLE } from "./durations.ts";
import { MusicXML } from "./musicxml.ts";
import { NWCLines } from "./scanner.ts";
import { create, Element } from "./xml.ts";

export class Bars {
  staves: number[] = [];
  #measure = -1;
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
          this.#measure++;
          this.staves.push(this.#measure);
          if (this.#measure > 1) {
            this.#barStyles.set(this.#measure, this.#endingBar);
          }
          break;
        case "StaffProperties":
          if (values[i].EndingBar) {
            this.#endingBar = values[i].EndingBar[0].replaceAll(" ", "");
          }
          break;
        case "Bar":
          this.#measure++;
          if (values[i].Style) {
            this.#barStyles.set(this.#measure, values[i].Style[0]);
          }
          break;
        case "Ending":
          this.#endings.set(this.#measure, values[i].Endings);
          break;
        case "TimeSig":
          switch (values[i].Signature[0]) {
            case "Common":
              this.#times.set(this.#measure, "4/4");
              break;
            case "AllaBreve":
              this.#times.set(this.#measure, "2/2");
              break;
            default:
              this.#times.set(this.#measure, values[i].Signature[0]);
              break;
          }
          break;
        case "Clef":
          this.#clefs.set(this.#measure, values[i].Type[0]);
          if (!values[i].OctaveShift) break;
          switch (values[i].OctaveShift[0]) {
            case "Octave Up":
              this.#clefOctaveChanges.set(this.#measure, 1);
              break;
            case "Octave Down":
              this.#clefOctaveChanges.set(this.#measure, -1);
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
          this.#keys.set(this.#measure, fifths);
          break;
        }
        default:
          continue;
      }
      visited.add(i);
    }
  }

  visitEnd() {
    this.#measure++;
    this.staves.push(this.#measure);
    this.#barStyles.set(this.#measure, this.#endingBar);
  }

  // this is here to deal with the issue that the data in a musicxml measure may be spread out in the nwc file
  multiple(
    parts: number[],
    secondStaves: Set<number>,
    allNotes: Element[][],
    xml: MusicXML,
  ): Element[][] {
    const allAttributes = this.#allAttributes(parts, secondStaves, xml);

    // notes per part per measure
    const groupedNotes: Element[][][] = parts.map(() => []);
    const endings: Map<number, string[]>[] = [];
    const leftBarstyles: Map<number, string>[] = [];
    const rightBarstyles: Map<number, string>[] = [];
    // only keep measures with notes in the end
    // something that noteworthy does.
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
          if (allNotes[measure].length) {
            gns[m].push(...allNotes[measure], backup);
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

      for (
        let measure = 0, number = 1;
        measure < groupedNotes[part].length;
        measure++
      ) {
        if (!keep.has(measure)) continue;
        number++;
        result[part].push(
          create(
            "measure",
            { number: number.toString() },
            xml.leftBarline(
              leftBarstyles[part].get(measure),
              endings[part].get(measure),
            ),
            allAttributes[part][measure] ?? null,
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
  ): { [_: number]: Element }[] {
    // part, measure, cumulative array of attributes
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

    // from k to part & measure?
    const X = parts.map((s) => this.staves[s]).flatMap((m, i, a) =>
      Array.from({ length: (a[i + 1] ?? this.#measure) - m }, () => i)
    );
    let length = 0;
    const Y = this.staves.flatMap((m, i) => {
      const l = (this.staves[i + 1] ?? this.#measure) - m;
      if (l > length) length = l;
      return Array(l).keys().toArray();
    });
    // by part & measure?
    const attrs: { [_: number]: Element }[] = Array.from(
      { length: parts.length - 1 },
      () => ({ 0: create("attributes", undefined, divisions) }),
    );

    function add(element: Element, k: number) {
      (attrs[X[k]][Y[k]] ??= create("attributes")).addElement(element);
    }

    this.#keys.forEach((key, k) => add(xml.key(key), k));
    this.#times.forEach((time, k) => {
      const [beats, beatType] = time.split("/");
      add(xml.time(beats, beatType), k);
    });
    const staves = this.staves.flatMap((offset, index, offsets) =>
      Array.from({
        length: (offsets[index + 1] ?? this.#measure) - offset,
      }, () => secondStaves.has(index) ? 2 : 1)
    );
    this.#clefs.forEach((clef, k) =>
      add(
        xml.clef(clef, this.#clefOctaveChanges.get(k) ?? 0, staves[k]),
        k,
      )
    );
    // for all parts that have two staves
    parts.slice(1).forEach((s, X) => {
      if (secondStaves.has(s - 1)) {
        for (let Y = 0; Y < length; Y++) {
          (attrs[X][Y] ??= create("attributes")).addElement(twoStaves);
        }
      }
    });

    return attrs;
  }
}
