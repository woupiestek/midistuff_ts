import { Pyth } from "../pythagorean.ts";
import { mod, Ratio } from "../util.ts";
import { Parser, Row, Value } from "./parser.ts";

type Pitch = { tone: Pyth; tie: boolean };

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
  #key = 0;

  #current: Row;

  constructor(private parser: Parser) {
    this.#current = parser.next();
    this.#header();
    while (this.#current.class === "AddStaff") {
      this.#staff();
    }
  }

  get staves() {
    if (this.#chords.length > 0) {
      this.#staves.push(untie(this.#chords));
      this.#chords.length = 0;
    }
    return this.#staves;
  }

  #header() {
    while (
      ["Editor", "Font", "PgMargins", "PgSetup", "SongInfo"].includes(
        this.#current.class,
      ) &&
      !this.parser.done()
    ) {
      this.#current = this.parser.next();
    }
  }

  #staff() {
    // todo: capture data
    for (;;) {
      this.#current = this.parser.next();
      if (
        !["StaffInstrument", "StaffProperties"].includes(this.#current.class)
      ) {
        break;
      }
    }
    this.#chords.length = 0;
    while (!this.parser.done() && this.#current.class !== "AddStaff") {
      this.#row();
      this.#current = this.parser.next();
    }
    this.#staves.push(untie(this.#chords));
  }

  #row() {
    switch (this.#current.class) {
      case "Bar":
        this.#accidentals = Array.from(this.#signature);
        // reset temporary alterations...
        break;
      case "Chord": {
        // Dur, Pos, Opts
        // todo: Opts
        this.#add(
          duration(this.#current.fields.Dur),
          this.#positions(this.#current.fields.Pos),
        );
        break;
      }
      case "Clef":
        switch (this.#current.fields.Type[0]) {
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
        if (!this.#current.fields.OctaveShift) break;
        switch (this.#current.fields.OctaveShift[0]) {
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
      case "Key":
        this.#key = 0;
        // todo: actually capture the key and use it
        for (const s of this.#current.fields.Signature) {
          const i = "CDEFGAB".indexOf(s[0]);
          this.#signature[i] = { "#": 1, b: -1 }[s[1]] || 0;
          // count sharps and flats to determine.
          // this has a rounding effect on the customer signatures.
          this.#key += this.#signature[i];
          // todo: grouping notes by shared key.
        }

        // two things: compute that key &
        // group notes together under the signature
        // Noteworthy allows used defined signatures, even allowing combinations of flats and sharps.
        // what is the best fitting regular signature?

        this.#accidentals = Array.from(this.#signature);
        break;
      case "Note": {
        // Dur, Pos, Opts
        // todo: Opts
        this.#add(
          duration(this.#current.fields.Dur),
          this.#positions(this.#current.fields.Pos),
        );
        break;
      }
      case "Rest": {
        // Dur, Pos, Opts
        this.#add(duration(this.#current.fields.Dur), []);
        break;
      }
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
        throw new Error(`class ${this.#current.class} not supported`);
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
    const tone = Pyth.fromPitch(0, degree, alter);
    return { tone, tie };
  }
}

function duration(Dur: Value[]) {
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

// note or rest actually: that is why tone is optional
type Note = { tone?: Pyth; duration: Ratio };
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
  const closed: { start: Ratio; tone: Pyth; stop: Ratio }[] = [];
  const open: { start: Ratio; tone: Pyth; stop: undefined }[] = [];
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
      const o = take(open, ({ tone }) => tone.equals(pitch.tone)) || {
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
      const vs: { start: Ratio; tone?: Pyth; stop: Ratio }[][] = [];
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
