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
    const key = ["bb", "b", "n", "#", "x"][alter + 2] + offset;
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
    for (const line of scanner.lines()) {
      const typ = scanner.getName(scanner.getLineTag(line) + 1);
      switch (typ) {
        // case "SongInfo":
        case "AddStaff": {
          this.#signature = [0, 0, 0, 0, 0, 0, 0];
          this.#alterations = [0, 0, 0, 0, 0, 0, 0];
          let name = "";
          for (const column of scanner.getColumns(line)) {
            switch (scanner.getName(scanner.getColumnTag(column) + 1)) {
              case "Name":
                name = scanner.getString(scanner.getValues(column)[0] + 2);
            }
          }
          this.partNames.push(name);
          this.partOffset.push(this.measures.length);
          continue;
        }
        // case "StaffProperties":
        // case "StaffInstrument":
        case "Clef": {
          const cols = [...scanner.getColumns(line)];
          const sign = scanner.getName(
            scanner.getValues(cols[0])[0] + 1,
          );
          const shift = cols[1] &&
            scanner.getName(
              scanner.getValues(cols[1])[0] + 1,
            );
          this.types.push(typ);
          this.#offset = Transformed.#clefStep[sign] ?? 34;
          this.data.push({ sign, shift });
          continue;
        }
        case "Key": {
          const cols = [...scanner.getColumns(line)];
          const signature = scanner.getValues(cols[0]).map((
            from,
          ) => scanner.getKeyPart(from + 1));

          this.#signature = [0, 0, 0, 0, 0, 0, 0];
          for (const x of signature) {
            this.#signature["CDEFGAB".indexOf(x[0])] =
              { "#": 1, "b": -1 }[x[1]] ?? 0;
          }
          this.#alterations = [...this.#signature];
          const tonic = cols[1] &&
            scanner.getKeyPart(
              scanner.getValues(cols[1])[0] + 1,
            );
          this.types.push(typ);
          this.data.push({ signature, tonic });
          continue;
        }
        // case "TimeSig":
        // case "Tempo":
        // case "Dynamic":
        case "Rest": {
          let dur: string[] = [];
          for (const column of scanner.getColumns(line)) {
            switch (scanner.getName(scanner.getColumnTag(column) + 1)) {
              case "Dur":
                dur = scanner.getValues(column).map((from) =>
                  scanner.getName(from + 1)
                );
            }
          }
          this.types.push(typ);
          this.data.push({ dur });
          break;
        }
        case "Chord": {
          let dur: string[] = [];
          let pos: string[] = [];
          for (const column of scanner.getColumns(line)) {
            switch (scanner.getName(scanner.getColumnTag(column) + 1)) {
              case "Dur":
                dur = scanner.getValues(column).map((from) =>
                  scanner.getName(from + 1)
                );
                break;
              case "Pos":
                pos = scanner.getValues(column).map((from) =>
                  scanner.getPos(from + 1)
                );
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
          for (const column of scanner.getColumns(line)) {
            switch (scanner.getName(scanner.getColumnTag(column) + 1)) {
              case "Dur":
                dur = scanner.getValues(column).map((from) =>
                  scanner.getName(from + 1)
                );
                break;
              case "Pos":
                pos = scanner.getPos(scanner.getValues(column)[0] + 1);
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
