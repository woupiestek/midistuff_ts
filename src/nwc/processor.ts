import { mod, Ratio } from "../util.ts";
import { Row, Value } from "./parser.ts";

type Pitch = { degree: number; alter: number; tie: boolean };
type Chord = {
  staff: number;
  duration: Ratio;
  pitches: Pitch[];
};
export class Processor {
  #offset = 6; // for treble clef
  #signature: number[] = [0, 0, 0, 0, 0, 0, 0];
  #accidentals: number[] = [0, 0, 0, 0, 0, 0, 0];
  #staff = 0;
  output: Chord[] = [];

  push(row: Row) {
    switch (row.class) {
      case "AddStaff":
        this.#staff++;
        break;
      case "Bar":
        this.#accidentals = Array.from(this.#signature);
        // reset temporary alterations...
        break;
      case "Chord": {
        // Dur, Pos, Opts
        const duration = this.#duration(row.fields.Dur);
        const pitches = this.#positions(row.fields.Pos);
        // todo
        this.#add(duration, pitches);
        break;
      }
      case "Clef":
        switch (row.fields.Type[0]) {
          case "Bass":
            this.#offset = -6;
            break;
          case "Treble":
            this.#offset = 6;
            break;
          case "Alto":
            this.#offset = 0;
            break;
          case "Tenor":
            this.#offset = -2;
            break;
          default:
            break;
        }
        if (!row.fields.OctaveShift) break;
        switch (row.fields.OctaveShift[0]) {
          case "Octave Up":
            this.#offset += 7;
            break;
          case "Octave Down":
            this.#offset -= 7;
            break;
          default:
            break;
        }
        break;
      case "Dynamic":
        // todo
        break;
      case "Editor":
        break;
      case "Font":
        break;
      case "Key":
        // todo: actually capture the key and use it
        for (const s of row.fields.Signature) {
          const i = { A: 5, B: 6, C: 0, D: 1, E: 2, F: 3, G: 4 }[s[0]] || 7;
          this.#signature[i] = { "#": 1, b: -1 }[s[1]] || 0;
        }
        this.#accidentals = Array.from(this.#signature);
        break;
      case "Note": {
        // Dur, Pos, Opts
        const duration = this.#duration(row.fields.Dur);
        const pitches = this.#positions(row.fields.Pos);
        // todo
        this.#add(duration, pitches);
        break;
      }
      case "PgMargins":
        break;
      case "PgSetup":
        break;
      case "Rest": {
        // Dur, Pos, Opts
        const duration = this.#duration(row.fields.Dur);
        this.#add(duration, []);
        break;
      }
      case "SongInfo":
        break;
      case "StaffInstrument":
        // todo;
        break;
      case "StaffProperties":
        // maybe;
        break;
      case "SustainPedal":
        // todo;
        break;
      case "Tempo":
        // todo;
        break;
      case "TimeSig":
        // todo
        break;
      default:
        throw new Error(`class ${row.class} not supported`);
    }
  }

  #last: Chord | undefined = undefined;

  #add(duration: Ratio, pitches: Pitch[]) {
    if (
      this.#last !== undefined &&
      this.#last.staff === this.#staff &&
      this.#last.pitches.length === pitches.length &&
      this.#last.pitches.every(
        ({ degree, alter }, i) =>
          pitches[i].degree === degree && pitches[i].alter === alter,
      )
    ) {
      this.#last.duration = this.#last.duration.plus(duration);
      this.#last.pitches = pitches;
      for (let i = 0; i < pitches.length; i++) {
        if (!pitches[i].tie) {
          this.#last = undefined;
          return;
        }
      }
      return;
    }

    const x = { staff: this.#staff, duration, pitches };
    this.output.push(x);
    if (pitches.every(({ tie }) => tie)) {
      this.#last = x;
    } else {
      this.#last = undefined;
    }
    return;
  }

  #positions(Pos: Value[]): Pitch[] {
    const pitches: Pitch[] = [];
    for (const pos of Pos) {
      const pitch = this.#position(pos);
      if (pitch) {
        pitches.push(pitch);
      }
    }
    return pitches;
  }

  #position(Pos: Value): Pitch | undefined {
    if (Pos instanceof Array) {
      console.warn(`Problems with position ${Pos}`);
      return undefined;
    }
    let i = 0;
    let alter = {
      x: 2,
      "#": 1,
      n: 0,
      b: -1,
      v: -2,
    }[Pos[i]];
    if (alter !== undefined) i++;
    let sign = 1;
    if (Pos[i] === "-") {
      sign = -1;
      i++;
    }
    let value = 0;
    while ("0" <= Pos[i] && Pos[i] <= "9") {
      value = value * 10 + Pos.charCodeAt(i) - 48;
      i++;
    }
    const degree = sign * value + this.#offset;
    const index = mod(degree, 7);
    if (alter === undefined) {
      alter = this.#accidentals[index];
    } else {
      this.#accidentals[index] = alter;
    }
    const tie = Pos[i] === "^";
    if (tie) i++;
    if (i !== Pos.length) {
      console.warn(`Problems with position ${Pos}`);
    }
    return { degree, alter, tie };
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
