import { mod, Ratio } from "../util.ts";
import { Row, Value } from "./parser.ts";

type Pitch = { tone: number; tie: boolean };
const TONES = [0, 2, 4, 5, 7, 9, 11];

type Chord = {
  duration: Ratio;
  pitches: Pitch[];
};
export class Processor {
  #offset = 6; // for treble clef
  #signature: number[] = [0, 0, 0, 0, 0, 0, 0];
  #accidentals: number[] = [0, 0, 0, 0, 0, 0, 0];
  #chords: Chord[] = [];
  #staves: Staff[] = [];

  get staves() {
    if (this.#chords.length > 0) {
      this.#staves.push(untie(this.#chords));
      this.#chords.length = 0;
    }
    return this.#staves;
  }

  push(row: Row) {
    switch (row.class) {
      case "AddStaff":
        if (this.#chords.length > 0) {
          this.#staves.push(untie(this.#chords));
          this.#chords.length = 0;
        }
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

        // two things: compute that key &
        // group notes together under the signature
        // Noteworthy allows used defined signatures, even allowing combinations of flats and sharps.
        // what is the best fitting regular signature?

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

  #add(duration: Ratio, pitches: Pitch[]) {
    this.#chords.push({ duration, pitches });
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
    const tone = 60 + Math.floor(degree / 7) * 12 + TONES[index] + alter;
    return { tone, tie };
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

// note or rest actually: that is why tone is optional
type Note = { tone?: number; duration: Ratio };
// a sequence of notes
type Voice = { notes: Note[] };
// parallel sequences over a short time
type Phrase = { voices: Voice[] };
// a sequence of phrases
type Staff = { phrases: Phrase[] };

function take<A>(array: A[], condition: (_: A) => boolean): A | undefined {
  const a = array.pop();
  if (a === undefined || condition(a)) return a;
  for (let i = 0; i < array.length; i++) {
    if (condition(array[i])) {
      const b = array[i];
      array[i] = a;
      return b;
    }
  }
  return undefined;
}

export function untie(chords: Chord[]): Staff {
  const phrases: Phrase[] = [];
  const closed: { start: Ratio; tone: number; stop: Ratio }[] = [];
  const open: { start: Ratio; tone: number; stop: undefined }[] = [];
  let max = 0;
  let time = Ratio.int(0);
  let phraseStart = Ratio.int(0);
  for (let i = 0; i < chords.length; i++) {
    const chord = chords[i];
    if (max < chord.pitches.length) {
      max = chord.pitches.length;
    }
    const stop = time.plus(chord.duration);
    // plan: just collect notes until all are closed,
    // then do something else.
    for (const pitch of chord.pitches) {
      const o = take(open, ({ tone }) => tone === pitch.tone) || {
        start: time,
        tone: pitch.tone,
        stop: undefined,
      };
      if (pitch.tie) {
        open.push(o);
      } else {
        closed.push({ ...o, stop });
      }
    }
    if (open.length === 0) {
      closed.sort((a, b) => a.start.compare(b.start));
      // set up expected number of voices
      const vs: { start: Ratio; tone?: number; stop: Ratio }[][] = [];
      for (let i = 0; i < max; i++) {
        vs[i] = [];
      }
      // greedy algorithm for placing notes:
      // just pick the first voice where it fits
      // there should be enough space, but perhaps the voice leading would be bad
      // or something combinatorial could go off.
      a: for (let i = 0; i < closed.length; i++) {
        const x = closed[i];
        for (const v of vs) {
          const s = v.length === 0 ? phraseStart : v[v.length - 1].stop;
          const c = s.compare(x.start);
          if (c > 0) continue;
          if (c < 0) {
            // insert rest
            v.push({ start: s, stop: x.start });
          }
          v.push(x);
          continue a;
        }
        // sanity check
        throw new Error(`Failed to place ${JSON.stringify(x)}`);
      }
      const voices: Voice[] = [];
      for (const v of vs) {
        const notes: Note[] = [];
        for (const n of v) {
          notes.push({ tone: n.tone, duration: n.stop.minus(n.start) });
        }
        voices.push({ notes });
      }
      phrases.push({ voices });
      // set these values for the next 'phrase'
      phraseStart = stop;
      closed.length = 0;
    }
    time = stop;
  }
  return { phrases };
}
