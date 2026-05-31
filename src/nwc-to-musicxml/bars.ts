import { PER_WHOLE } from "./durations.ts";
import { MusicXML } from "./musicxml.ts";
import { countLessThan, NWCLines } from "./scanner.ts";
import { create, Element } from "./xml.ts";

export class Bars {
  firstMeasureForNWCStaff: number[] = [0];
  #measureCount = 0;
  #barStyles: Map<number, string> = new Map();
  #endings: Map<number, string[]> = new Map();

  #times: Map<number, string> = new Map();
  #clefs: Map<number, string> = new Map();
  #clefOctaveChanges: Map<number, number> = new Map();
  #keys: Map<number, number> = new Map();

  // warning: NWC does not put bar lines at the ends of the staves,
  // so counting Bars is not enough to know where measures start and end.
  // below an implicit Bar is therefore added between each staff.
  visit(
    { values, lineNumbersByTag }: NWCLines,
    visited: Set<number>,
  ): void {
    const { AddStaff, Bar } = lineNumbersByTag;
    if (!AddStaff || !Bar) {
      return;
    }
    this.firstMeasureForNWCStaff = lineNumbersByTag.AddStaff.map(
      (lineNumber, staffNumber) => {
        visited.add(lineNumber);
        return countLessThan(lineNumber, Bar) + staffNumber;
      },
    );
    this.#measureCount = AddStaff.length + Bar.length;
    this.firstMeasureForNWCStaff.push(this.#measureCount);

    for (let i = 0; i < Bar.length; i++) {
      const lineNumber = Bar[i];
      const style = values[lineNumber].Style;
      if (style) {
        const staff = countLessThan(lineNumber, AddStaff);
        this.#barStyles.set(staff + i, style[0]);
      }
      visited.add(lineNumber);
    }

    if (lineNumbersByTag.Ending) {
      for (const lineNumber of lineNumbersByTag.Ending) {
        const measure = countLessThan(lineNumber, AddStaff) +
          countLessThan(lineNumber, Bar) - 1;
        this.#endings.set(measure, values[lineNumber].Endings);
        visited.add(lineNumber);
      }
    }

    if (lineNumbersByTag.Clef) {
      for (const lineNumber of lineNumbersByTag.Clef) {
        const measure = countLessThan(lineNumber, AddStaff) +
          countLessThan(lineNumber, Bar) - 1;
        this.#clefs.set(measure, values[lineNumber].Type[0]);
        if (values[lineNumber].OctaveShift) {
          switch (values[lineNumber].OctaveShift[0]) {
            case "Octave Up":
              this.#clefOctaveChanges.set(measure, 1);
              break;
            case "Octave Down":
              this.#clefOctaveChanges.set(measure, -1);
              break;
            default:
              break;
          }
        }
        visited.add(lineNumber);
      }
    }

    if (lineNumbersByTag.TimeSig) {
      for (const lineNumber of lineNumbersByTag.TimeSig) {
        const measure = countLessThan(lineNumber, AddStaff) +
          countLessThan(lineNumber, Bar) - 1;
        switch (values[lineNumber].Signature[0]) {
          case "Common":
            this.#times.set(measure, "4/4");
            break;
          case "AllaBreve":
            this.#times.set(measure, "2/2");
            break;
          default:
            this.#times.set(measure, values[lineNumber].Signature[0]);
            break;
        }
        visited.add(lineNumber);
      }
    }

    if (lineNumbersByTag.Key) {
      for (const lineNumber of lineNumbersByTag.Key) {
        const measure = countLessThan(lineNumber, AddStaff) +
          countLessThan(lineNumber, Bar) - 1;
        let fifths = 0;
        for (const x of values[lineNumber].Signature) {
          if (x[1] === "#") fifths++;
          else fifths--;
        }
        this.#keys.set(measure, fifths);
        visited.add(lineNumber);
      }
    }

    for (let i = 1; i < this.firstMeasureForNWCStaff.length; i++) {
      const measure = this.firstMeasureForNWCStaff[i];
      this.#barStyles.set(measure, "SectionClose");
    }

    if (lineNumbersByTag.StaffProperties) {
      for (const lineNumber of lineNumbersByTag.StaffProperties) {
        if (values[lineNumber].EndingBar) {
          const endingBar = values[lineNumber].EndingBar[0].replaceAll(" ", "");
          const staff = countLessThan(lineNumber, lineNumbersByTag.AddStaff);
          this.#barStyles.set(
            this.firstMeasureForNWCStaff[staff + 1],
            endingBar,
          );
          visited.add(lineNumber);
        }
      }
    }
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
          let measure = this.firstMeasureForNWCStaff[staff];
          measure < this.firstMeasureForNWCStaff[staff + 1];
          measure++
        ) {
          const time = this.#times.get(measure);
          if (time) {
            const [n, d] = time.split("/");
            backup = xml.backup(PER_WHOLE * +n / +d);
            // break;
          }
          const m = measure - this.firstMeasureForNWCStaff[staff];
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
    const X = parts.map((s) => this.firstMeasureForNWCStaff[s]).flatMap((
      m,
      i,
      a,
    ) => Array.from({ length: (a[i + 1] ?? this.#measureCount) - m }, () => i));
    let length = 0;
    const Y = this.firstMeasureForNWCStaff.flatMap((m, i) => {
      const l = (this.firstMeasureForNWCStaff[i + 1] ?? this.#measureCount) - m;
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
    const staves = this.firstMeasureForNWCStaff.flatMap((
      offset,
      index,
      offsets,
    ) =>
      Array.from({
        length: (offsets[index + 1] ?? this.#measureCount) - offset,
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

  ticksPerMeasure(): number[] {
    const result: number[] = [];
    let numerator = 4;
    let denominator = 4;
    for (let measure = 0; measure < this.#measureCount; measure++) {
      const time = this.#times.get(measure);
      if (time) {
        const [n, d] = time.split("/");
        numerator = +n;
        denominator = +d;
      }
      result[measure] = PER_WHOLE * numerator / denominator;
    }
    return result;
  }
}
