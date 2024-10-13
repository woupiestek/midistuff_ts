import { Parser } from "./parser.ts";
import { Scanner } from "./scanner.ts";

type Measure = { number: number; data: any[] };
type Part = { id: string; name: string; measures: Measure[] };

export function transform(source: string) {
  const scanner = new Scanner(source);
  const nwc = new Parser(scanner).result();
  let part: Part = { id: "", name: "", measures: [] };
  let measure: Measure = { number: 1, data: [] };
  const parts = [];
  for (const line of nwc.middle) {
    switch (scanner.getName(line.tag.from + 1)) {
      // case "SongInfo":
      case "AddStaff": {
        let name = "";
        for (const column of line.columns) {
          switch (scanner.getName(column.tag.from + 1)) {
            case "Name":
              name = scanner.getString(column.values[0].from + 2);
          }
        }
        part.measures.push(measure);
        parts.push(part);
        part = { id: `P${parts.length}`, name, measures: [] };
        measure = { number: 1, data: [] };
        continue;
      }
      // case "StaffProperties":
      // case "StaffInstrument":
      case "Clef": {
        const sign = scanner.getName(line.columns[0].values[0].from + 1);
        const shift = line.columns[1] &&
          scanner.getName(line.columns[1].values[0].from + 1);
        measure.data.push({ type: "clef", sign, shift });
        continue;
      }
      case "Key": {
        const signature = line.columns[0].values.map((it) =>
          scanner.getKeyPart(it.from + 1)
        );
        const tonic = line.columns[1] &&
          scanner.getKeyPart(line.columns[1].values[0].from + 1);
        measure.data.push({ type: "key", signature, tonic });
        continue;
      }
      // case "TimeSig":
      // case "Tempo":
      // case "Dynamic":
      case "Rest": {
        let dur: string[] = [];
        for (const column of line.columns) {
          switch (scanner.getName(column.tag.from + 1)) {
            case "Dur": // todo: triplets
              dur = column.values.map((it) => scanner.getName(it.from + 1));
          }
        }
        measure.data.push({ type: "rest", dur });
        break;
      }
      case "Chord": {
        let dur: string[] = [];
        let pos: string[] = [];
        for (const column of line.columns) {
          switch (scanner.getName(column.tag.from + 1)) {
            case "Dur": // todo: triplets
              dur = column.values.map((it) => scanner.getName(it.from + 1));
              break;
            case "Pos":
              pos = column.values.map((it) => scanner.getPos(it.from + 1));
              break;
          }
        }
        measure.data.push({ type: "chord", dur, pos });
        break;
      }
      case "Bar": {
        part.measures.push(measure);
        measure = { number: part.measures.length + 1, data: [] };
        continue;
      }
      case "Note": {
        let dur: string[] = [];
        let pos = "";
        for (const column of line.columns) {
          switch (scanner.getName(column.tag.from + 1)) {
            case "Dur": // todo: triplets
              dur = column.values.map((it) => scanner.getName(it.from + 1));
              break;
            case "Pos":
              pos = scanner.getPos(column.values[0].from + 1);
              break;
          }
        }
        measure.data.push({ type: "note", dur, pos });
        break;
      }
      // case "SustainPedal":
      default:
        continue;
    }
  }
  if (part) {
    part.measures.push(measure);
    parts.push(part);
  }
  parts.shift();
  console.log(JSON.stringify(parts));
}
