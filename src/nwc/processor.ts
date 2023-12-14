import { AST, Dict, Node, NodeType, Options } from "../parser3.ts";
import { Pyth } from "../pythagorean.ts";
import { mod, Ratio } from "../util.ts";
import { Parser, Row, Value } from "./parser.ts";

type Pitch = { tone: Pyth; tie: boolean };

type Event = {
  time: Ratio;
  offset?: number;
  key?: number;
  signature?: string;
  dynamic?: string;
  pedal?: boolean;
};
type TempoEvent = { time: Ratio; bpm: string };

// note or rest actually: that is why tone is optional
type Note = { tone?: Pyth; duration: Ratio };
// a sequence of notes
type Voice = { notes: Note[] };
type Phrase = { duration: Ratio; voices: Voice[]; events: Event[] };
type Staff = { phrases: Phrase[] };
export class Processor {
  #offset = 6; // for treble clef
  #signature: number[] = [0, 0, 0, 0, 0, 0, 0];
  #accidentals: number[] = [0, 0, 0, 0, 0, 0, 0];
  #key = 0;

  #current: Row;

  constructor(private parser: Parser) {
    this.#current = parser.next();
  }

  staves(): { tempo: TempoEvent[]; staves: Staff[] } {
    this.#header();
    const staves: Staff[] = [];
    while (this.#current.class === "AddStaff") {
      this.#offset = 6; // for treble clef
      this.#signature = [0, 0, 0, 0, 0, 0, 0];
      this.#accidentals = [0, 0, 0, 0, 0, 0, 0];
      this.#key = 0;
      staves.push(this.#staff());
    }
    return {
      tempo: this.#tempo,
      staves,
    };
  }

  #header() {
    while (
      ["Editor", "Font", "PgMargins", "PgSetup", "SongInfo"].includes(
        this.#current.class,
      )
    ) {
      this.#advance();
    }
  }

  #time = Ratio.ZERO;

  #staff(): Staff {
    for (;;) {
      this.#current = this.parser.next();
      if (
        !["StaffInstrument", "StaffProperties"].includes(this.#current.class)
      ) {
        break;
      }
    }
    this.#time = Ratio.ZERO;
    const phrases: Phrase[] = [];
    while (!this.parser.done() && this.#current.class !== "AddStaff") {
      phrases.push(this.#phrase());
    }
    return {
      phrases,
    };
  }

  #tempo: TempoEvent[] = [];

  #advance() {
    if (!this.parser.done()) {
      this.#current = this.parser.next();
    }
  }

  #phrase(): Phrase {
    const closed: { start: Ratio; tone: Pyth; stop: Ratio }[] = [];
    const open: { [_: string]: { start: Ratio; tone: Pyth } } = {};
    const start = this.#time;
    let max = 0;
    let _duration = Ratio.ZERO;
    let pitches: Pitch[] = [];
    const events: Event[] = [];
    let event: Event | null = null; //{time:this.#time};
    for (;;) {
      switch (this.#current.class) {
        case "Bar":
          // reset temporary alterations...
          this.#accidentals = Array.from(this.#signature);
          this.#advance();
          continue;
        case "Chord": {
          // todo: Opts
          _duration = duration(this.#current.fields.Dur);
          pitches = this.#pitches(this.#current.fields.Pos);
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
          if (!this.#current.fields.OctaveShift) {
            this.#advance();
            continue;
          }
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
          if (!event) event = { time: this.#time.minus(start) };
          event.offset = this.#offset;
          this.#advance();
          continue;
        case "Dynamic": {
          const dynamic = this.#current.fields.Style[0];
          if (typeof dynamic === "string") {
            if (!event) event = { time: this.#time.minus(start) };
            event.dynamic = dynamic;
          } else {console.warn(
              "unprocessed dynamic",
              this.#current.fields.Style,
            );}
          this.#advance();
          continue;
        }
        case "Key":
          this.#key = 0;
          for (const s of this.#current.fields.Signature) {
            const i = "CDEFGAB".indexOf(s[0]);
            if (i < 0) continue;
            this.#signature[i] = { "#": 1, b: -1 }[s[1]] || 0;
            // count sharps and flats to determine.
            // this has a rounding effect on the custom signatures.
            this.#key += this.#signature[i];
          }
          this.#accidentals = Array.from(this.#signature);
          if (!event) event = { time: this.#time.minus(start) };
          event.key = this.#key;
          this.#advance();
          continue;
        case "Note": {
          // todo:Opts
          _duration = duration(this.#current.fields.Dur);
          pitches = this.#pitches(this.#current.fields.Pos);
          break;
        }
        case "Rest": {
          // todo:Opts
          _duration = duration(this.#current.fields.Dur);
          pitches = [];
          break;
        }
        case "SustainPedal":
          if (!event) event = { time: this.#time.minus(start) };
          event.pedal = this.#current.fields.Status?.[0] !== "Released";
          this.#advance();
          continue;
        case "Tempo": {
          const bpm = this.#current.fields.Tempo[0];
          if (typeof bpm === "string") {
            this.#tempo.push({ time: this.#time, bpm });
          } else console.warn("unprocessed tempo", this.#current.fields.Tempo);
          this.#advance();
          continue;
        }
        case "TimeSig": {
          const signature = this.#current.fields.Signature[0];
          if (typeof signature === "string") {
            if (!event) event = { time: this.#time.minus(start) };
            event.signature = signature;
          } else {console.warn(
              "unprocessed time signature",
              this.#current.fields.Signature,
            );}
          this.#advance();
          continue;
        }
        default:
          throw new Error(`class ${this.#current.class} not supported`);
      }
      // new chord, rest or note found.
      const stop = this.#time.plus(_duration);
      if (max < pitches.length) max = pitches.length;
      for (const pitch of pitches) {
        const k = pitch.tone.degree;
        const o = open[k] || {
          start: this.#time,
          tone: pitch.tone,
        };
        if (pitch.tie) {
          open[k] = o;
        } else {
          delete open[k];
          closed.push({ ...o, stop });
        }
      }

      this.#time = stop;
      if (event) {
        events.push(event);
        event = null;
      }
      this.#advance();

      if (Object.entries(open).length > 0) continue;
      // all notes closed

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
          const s = v.length === 0 ? start : v[v.length - 1].stop;
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
      if (event) events.push(event);
      return { events, duration: stop.minus(start), voices };
    }
  }

  #pitches(Pos: Value[]): Pitch[] {
    const pitches: Pitch[] = [];
    for (const pos of Pos) {
      const pitch = this.#pitch(pos);
      if (pitch) {
        pitches.push(pitch);
      }
    }
    return pitches;
  }

  #pitch(Pos: Value): Pitch | undefined {
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
  let duration = Ratio.ZERO;
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
      duration = Ratio.ONE;
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
          console.warn("not processed", Dur[i]);
      }
    } else if (Dur[i] instanceof Array && Dur[i][0] === "Triplet") {
      duration = duration.times(new Ratio(2, 3));
    } else {
      console.warn("not processed", Dur[i]);
    }
  }
  return duration;
}

export function fullAST(
  { tempo, staves }: { tempo: TempoEvent[]; staves: Staff[] },
): AST {
  const metadata: Dict = { bpm: 120 };
  const te = tempo.find((te) => !te.time.moreThan(0));
  if (te) {
    // ignore all the other tempos for now
    metadata.bpm = Number.parseInt(te.bpm, 10);
  }

  // stave is sequence of phrases
  // groups according to events...

  // offset?: number;
  // key?: number;
  // signature?: string;
  // dynamic?: string;
  // pedal?: boolean;

  // different treatments again.

  // o boy: duration, key, labels
  // offset becomes label with attachment
  // keys can be moved formward
  // signature becomes label with attachment
  //
  // dynamic becomes label
  // pedal becomes label
  //

  // lets just take it one at the time!?

  // leave out the label first?
  const main: Node = groupDurations(NodeType.SET, staves.map(staffAST));

  return {
    metadata,
    main,
    sections: [],
  };
}

function staffAST({ phrases }: Staff): Node {
  const groups: Node[] = [];
  let key = 0;
  let dynamic: string | null = null;
  for (let i = 0; i < phrases.length;) {
    let pedal = false;
    for (const event of phrases[i].events) {
      if (event.key !== undefined) key = event.key;
      if (event.pedal) pedal = true;
      if (event.dynamic) dynamic = event.dynamic;
    }
    const group: Node[] = [];
    for (;;) {
      group.push(phraseAST(phrases[i], key));
      i++;
      if (i >= phrases.length || phrases[i].events.length > 0) break;
    }
    const labels = [];
    if (pedal) labels.push("pedal");
    if (dynamic) labels.push(dynamic);
    groups.push(groupDurations(
      NodeType.ARRAY,
      group,
      { key, labels: labels.length > 0 ? new Set(labels) : undefined },
    ));
  }
  return groupDurations(NodeType.ARRAY, groups);
}

function phraseAST({ voices, duration }: Phrase, key: number): Node {
  if (voices.length === 0) {
    return Node.rest({ duration });
  }
  return groupDurations(NodeType.SET, voices.map((v) => voiceAST(v, key)));
}

function voiceAST({ notes }: Voice, key: number): Node {
  return groupDurations(NodeType.ARRAY, notes.map((n) => noteAST(n, key)));
}

function noteAST({ tone, duration }: Note, key: number) {
  if (tone) {
    const { degree, alter } = tone.toPitch(key);
    return Node.note(degree, alter as -2 | -1 | 0 | 1 | 2, {
      duration,
    });
  }
  return Node.rest({ duration });
}

function groupDurations(
  type: NodeType.ARRAY | NodeType.SET,
  children: Node[],
  options: Options = {},
): Node {
  if (children.length === 1) {
    const node = children[0];
    if (node.type === NodeType.ERROR || node.type === NodeType.INSERT) {
      return node;
    }
    if (!node.options) {
      node.options = options;
      return node;
    }
    node.options.key = options.key || node.options.key;
    node.options.labels = options.labels || node.options.labels;
    return children[0];
  }

  const durations: { [_: string]: [number, Ratio] } = {};
  const keys: { [_: string]: [number, number] } = {};

  for (const node of children) {
    if (node.type === NodeType.ERROR || node.type === NodeType.INSERT) continue;
    const duration = node.options?.duration;
    if (duration instanceof Ratio) {
      const k = `${duration.numerator}/${duration.denominator}`;
      durations[k] = [1 + (durations[k]?.[0] || 0), duration];
    }
    const key = node.options?.key;
    if (typeof key === "number") {
      const k = `${key}`;
      keys[k] = [1 + (keys[k]?.[0] || 0), key];
    }
  }

  const duration = Object.values(durations).find((it) =>
    it[0] > .5 * children.length
  )?.[1];
  if (duration) options.duration = duration;
  const key = Object.values(keys).find((it) => it[0] > .5 * children.length)
    ?.[1];
  if (key !== undefined) options.key = key;
  options.duration = duration;
  if (duration !== undefined || key !== undefined) {
    for (const n of children) {
      if (n.type === NodeType.ERROR || n.type === NodeType.INSERT) continue;
      if (
        duration && n.options?.duration && n.options?.duration.equals(duration)
      ) {
        n.options.duration = undefined;
      }
      if (key !== undefined && n.options?.key && n.options?.key === key) {
        n.options.key = undefined;
      }
    }
  }
  return { type, children, options };
}
