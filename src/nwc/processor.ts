import { Ratio } from "../util.ts";
import { Row, Value } from "./parser.ts";

export class Processor {
  #clef = 4; // F, expressed as offset
  #key = 0; //
  #staff = 0;
  output: { staff: number; duration: Ratio }[] = [];

  push(row: Row) {
    switch (row.class) {
      case "AddStaff":
        this.#staff++;
        break;
      case "Bar":
        break;
      case "Chord": {
        // Dur, Pos, Opts
        const duration = this.#duration(row.fields.Dur);
        // todo
        this.output.push({ staff: this.#staff, duration });
        break;
      }
      case "Clef":
      case "Dynamic":
      case "Editor":
      case "Font":
      case "Key":
        break;
      case "Note": {
        // Dur, Pos, Opts
        const duration = this.#duration(row.fields.Dur);
        // todo
        this.output.push({ staff: this.#staff, duration });
        break;
      }
      case "PgMargins":
      case "PgSetup":
        break;
      case "Rest": {
        // Dur, Pos, Opts
        const duration = this.#duration(row.fields.Dur);
        // todo
        this.output.push({ staff: this.#staff, duration });
        break;
      }
      case "SongInfo":
      case "StaffInstrument":
      case "StaffProperties":
      case "SustainPedal":
      case "Tempo":
      case "TimeSig":
        // todo
        break;
      default:
        throw new Error(`class ${row.class} not supported`);
    }
  }

  #duration(Dur: Value[]) {
    let duration = Ratio.int(0);
    switch (Dur[0]) {
      case "4th":
        duration = new Ratio(1, 4);
        break;
      case "8th":
        duration = new Ratio(1, 8);
        break;
      case "Half":
        duration = new Ratio(1, 2);
        break;
      case "Whole":
        duration = Ratio.int(1);
        break;
    }
    // interesting to see what pops up after
    for (let i = 1; i < Dur.length; i++) {
      if (typeof Dur[i] === "string") {
        switch (Dur[i]) {
          case "Dotted":
            duration = duration.times(new Ratio(3, 2));
            break;
          case "DblDotted":
            duration = duration.times(new Ratio(7, 4));
            break;
          case "Triplet":
            duration = duration.times(new Ratio(2, 3));
            break;
          default:
            console.log("not processed", Dur[i]);
        }
      } else if (Dur[i] instanceof Array && Dur[i][0] === "Triplet") {
        duration = duration.times(new Ratio(2, 3));
      } else {
        console.log("not processed", Dur[i]);
      }
    }
    return duration;
  }
}
