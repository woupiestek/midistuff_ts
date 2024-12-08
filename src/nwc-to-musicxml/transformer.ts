import { Parser } from "./parser.ts";
import { Scanner } from "./scanner.ts";

export class Transformed {
  partOffset: number[] = [];
  partNames: string[] = [];
  measures: number[] = [];
  types: string[] = [];
  data: object[] = [];

  #offset = 34;
  #signature = [0, 0, 0, 0, 0, 0, 0];
  #alterations = [0, 0, 0, 0, 0, 0, 0];

  static #clefStep: { [_: string]: number } = {
    Bass: 22,
    Treble: 34,
    Alto: 28,
    Tenor: 26,
  };

  static #alters: { [_: string]: number } = {
    x: 2,
    "#": 1,
    n: 0,
    b: -1,
    v: -2,
  };

  pitches: {
    [_: string]: { octave: number; step: string; alter: number };
  } = {};

  #pitch(pos: string) {
    const tied = pos[pos.length - 1] === "^";
    if (tied) {
      pos = pos.substring(0, pos.length - 1);
    }
    let alter = Transformed.#alters[pos[0]];
    const offset = this.#offset +
      +(alter === undefined ? pos : pos.substring(1));
    if (alter === undefined) {
      alter = this.#alterations[offset % 7];
    } else {
      this.#alterations[offset % 7] = alter;
    }
    const key = offset + ["bb", "b", "", "#", "x"][alter + 2];
    // ouch! boolean field tied
    this.pitches[key] ||= {
      octave: (offset / 7) | 0,
      step: "CDEFGAB"[offset % 7],
      alter,
    };
    return { pitch: key, tied };
  }

  constructor(source: string) {
    const scanner = new Scanner(source);
    const nwc = new Parser(scanner).result();

    for (const line of nwc.middle) {
      const typ = scanner.getName(line.tag.from + 1);
      switch (typ) {
        // case "SongInfo":
        case "AddStaff": {
          this.#signature = [0, 0, 0, 0, 0, 0, 0];
          this.#alterations = [0, 0, 0, 0, 0, 0, 0];
          let name = "";
          for (const column of line.columns) {
            switch (scanner.getName(column.tag.from + 1)) {
              case "Name":
                name = scanner.getString(column.values[0].from + 2);
            }
          }
          this.partNames.push(name);
          this.partOffset.push(this.measures.length);
          continue;
        }
        // case "StaffProperties":
        // case "StaffInstrument":
        case "Clef": {
          const sign = scanner.getName(line.columns[0].values[0].from + 1);
          const shift = line.columns[1] &&
            scanner.getName(line.columns[1].values[0].from + 1);
          this.types.push(typ);
          this.#offset = Transformed.#clefStep[sign] ?? 34;
          this.data.push({ sign, shift });
          continue;
        }
        case "Key": {
          const signature = line.columns[0].values.map((it) =>
            scanner.getKeyPart(it.from + 1)
          );

          this.#signature = [0, 0, 0, 0, 0, 0, 0];
          for (const x of signature) {
            this.#signature["CDEFGAB".indexOf(x[0])] =
              { "#": 1, "b": -1 }[x[1]] ?? 0;
          }
          this.#alterations = [...this.#signature];

          const tonic = line.columns[1] &&
            scanner.getKeyPart(line.columns[1].values[0].from + 1);
          this.types.push(typ);
          this.data.push({ signature, tonic });
          continue;
        }
        // case "TimeSig":
        // case "Tempo":
        // case "Dynamic":
        case "Rest": {
          let dur: string[] = [];
          for (const column of line.columns) {
            switch (scanner.getName(column.tag.from + 1)) {
              case "Dur":
                dur = column.values.map((it) => scanner.getName(it.from + 1));
            }
          }
          this.types.push(typ);
          this.data.push({ dur });
          break;
        }
        case "Chord": {
          let dur: string[] = [];
          let pos: string[] = [];
          for (const column of line.columns) {
            switch (scanner.getName(column.tag.from + 1)) {
              case "Dur":
                dur = column.values.map((it) => scanner.getName(it.from + 1));
                break;
              case "Pos":
                pos = column.values.map((it) => scanner.getPos(it.from + 1));
                break;
            }
          }
          this.types.push(typ);
          this.data.push({ dur, pos, pitch: pos.map((p) => this.#pitch(p)) });
          break;
        }
        case "Bar": {
          this.measures.push(this.data.length);
          this.#alterations = [...this.#signature];
          continue;
        }
        case "Note": {
          let dur: string[] = [];
          let pos = "";
          for (const column of line.columns) {
            switch (scanner.getName(column.tag.from + 1)) {
              case "Dur":
                dur = column.values.map((it) => scanner.getName(it.from + 1));
                break;
              case "Pos":
                pos = scanner.getPos(column.values[0].from + 1);
                break;
            }
          }
          this.types.push(typ);
          this.data.push({
            dur,
            pos,
            pitch: this.#pitch(pos),
          });
          break;
        }
        // case "SustainPedal":
        default:
          continue;
      }
    }
  }
}
