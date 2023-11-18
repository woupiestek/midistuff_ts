import { AST, Node, NodeType, Options, Value } from "./parser3.ts";
import { Note } from "./transformer.ts";
import { mod, Ratio } from "./util.ts";

export class Params {
  __duration?: string[];
  constructor(readonly options: Options, readonly parent?: Params) {}

  get key(): number {
    if (!this.options.key) {
      this.options.key = this.parent?.key || 0;
    }
    return this.options.key;
  }

  get duration(): string[] {
    if (!this.__duration) {
      if (this.options.duration) {
        this.__duration = Lilyponder.duration(
          this.options.duration.numerator,
          this.options.duration.denominator,
        );
      } else if (this.parent) {
        this.__duration = this.parent.duration;
      } else this.__duration = ["4"];

      if (this.__duration instanceof Ratio) {
        throw new Error("what the fuck happened here!?");
      }
    }
    return this.__duration;
  }

  with(options?: Options) {
    if (!options) return this;
    return new Params(options, this);
  }
}

export class Lilyponder {
  static STEPS = "cdefgab";
  static ALTER: number[] = [5, 3, 1, 6, 4, 2, 0];
  static pitch(key: number, degree: number, accident: number): string {
    const index = mod(degree, 7); //degree < 0 ? 6 - ((-degree - 1) % 7) : degree % 7;
    const name = [Lilyponder.STEPS[index]];
    const alter = accident + Math.floor((key + Lilyponder.ALTER[index]) / 7);
    if (alter > 0) for (let i = 0; i < alter; i++) name.push("is");
    if (alter < 0) for (let i = 0; i < -alter; i++) name.push("es");
    const octave = Math.floor(degree / 7);
    if (octave < -1) for (let i = 0; i < 1 - octave; i++) name.push(",");
    if (octave > -1) for (let i = 0; i < 1 + octave; i++) name.push("'");
    return name.join("");
  }

  static duration(n: number, d: number): string[] {
    const result = [];
    let tie = "";
    let dots = "";
    while (n > 0) {
      switch (n & 3) {
        case 1:
          result.push(`${d}${dots}${tie}`);
          dots = "";
          tie = "~";
          break;
        case 3:
          dots += ".";
          break;
        default:
          break;
      }
      n >>= 1;
      d >>= 1;
    }
    return result.reverse();
  }

  #node(node: Node, params: Params): string[] {
    switch (node.type) {
      case NodeType.ERROR:
        return [`'${node.error.message}'!`];
      case NodeType.INSERT: {
        const section = this.#sections[node.index];
        if (!section.params) {
          section.params = params;
        }
        return this.#node(section.node, section.params);
      }
      case NodeType.NOTE: {
        const _params = params.with(node.options);
        const pitch = Lilyponder.pitch(_params.key, node.degree, node.accident);
        return _params.duration.map((d) => pitch + d);
      }
      case NodeType.REST: {
        const _params = params.with(node.options);
        return _params.duration.map((d) => "r" + d);
      }
      case NodeType.SEQUENCE: {
        const _params = params.with(node.options);
        const result = ["{"];
        for (const child of node.children) {
          result.push(...this.#node(child, _params));
        }
        result.push("}");
        return result;
      }
      case NodeType.SET: {
        const _params = params.with(node.options);
        const result = ["<<"];
        for (const child of node.children) {
          result.push(...this.#node(child, _params));
        }
        result.push(">>");
        return result;
      }
    }
  }

  #sections: { node: Node; mark: string; params?: Params }[] = [];
  stringify(ast: AST): string {
    this.#sections = ast.sections;
    return this.#node(ast.main, new Params({})).join(" ");
  }
}

export class FourFourSplitter {
  #chunks: string[] = [];

  set(from: Ratio, to: Ratio) {
    this.#chunks.length = 0;
    const f = Math.floor(from.value);
    const t = Math.ceil(to.value);
    for (let i = f; i < t; i++) {
      this.#segment(from, to, i, i + 1);
    }
  }

  *get() {
    for (const c of this.#chunks) {
      yield c;
    }
  }

  #segment(from: Ratio, to: Ratio, f: number, t: number) {
    if (!from.moreThan(f)) {
      if (!to.lessThan(t)) {
        this.#chunks.push(`${1 / (t - f)}`);
        return;
      }
      this.#end(f, to);
      return;
    }
    if (!to.lessThan(t)) {
      this.#start(from, t);
      return;
    }

    // undotted syncopation (special case)
    if (
      from.value === 0.25 * f + 0.75 * t &&
      to.value === 0.25 * f + 0.75 * t
    ) {
      this.#start(from, 0.25 * f + 0.75 * t);
      this.#chunks.push((2 / (t - f)).toString());
      this.#end(0.75 * f + 0.25 * t, to);
      return;
    }

    const m = (t + f) / 2;
    if (from.lessThan(m)) {
      this.#segment(from, to, f, m);
    }
    if (to.moreThan(m)) {
      this.#segment(from, to, m, t);
    }
  }

  #start(from: Ratio, t: number) {
    this.#chunks.push(
      ...FourFourSplitter.#duration(
        (t * from.denominator - from.numerator) | 0,
        from.denominator,
      ),
    );
  }

  #end(f: number, to: Ratio) {
    this.#chunks.push(
      ...FourFourSplitter.#duration(
        (to.numerator - f * to.denominator) | 0,
        to.denominator,
      ).reverse(),
    );
  }

  static #duration(n: number, d: number): string[] {
    const result = [];
    let dots = "";
    while (n > 0) {
      switch (n & 3) {
        case 1:
          result.push(`${d}${dots}`);
          dots = "";
          break;
        case 3:
          dots += ".";
          break;
        default:
          break;
      }
      n >>= 1;
      d >>= 1;
    }
    return result;
  }
}

export type Placeholder = {
  pitch: string;
  duration: string[];
  voice?: Value;
  from: Ratio;
  to: Ratio;
};
export class Lilyponder2 {
  #fourFourSplitter = new FourFourSplitter();
  #buffer: Placeholder[] = [];

  #note(note: Note) {
    const from = note.start;
    const to = note.stop;
    this.#fourFourSplitter.set(from, to);
    const duration = [...this.#fourFourSplitter.get()];
    const voice = note.attributes.get("voice");
    this.#buffer.push({ pitch: this.#pitch(note), duration, voice, from, to });
  }

  #pitch(note: Note) {
    let pitch = "cdefgab"[mod(note.pitch.step, 7)];
    if (note.pitch.alter < 0) {
      for (let i = note.pitch.alter; i < 0; i++) {
        pitch += "es";
      }
    }
    if (note.pitch.alter > 0) {
      for (let i = 0; i < note.pitch.alter; i++) {
        pitch += "is";
      }
    }
    return pitch;
  }

  push(notes: Note[]) {
    this.#buffer.length = 0;
    for (const note of notes) {
      this.#note(note);
    }
  }

  pop(): Placeholder[] {
    return Array.from(this.#buffer);
  }

  #voices: Value[] = [];
  #vi(value: Value) {
    const i = this.#voices.indexOf(value);
    if (i === -1) {
      this.#voices.push(value);
      return this.#voices.length - 1;
    }
    return i;
  }

  // some invariant to preserve: none of the existing chords may overlap.
  #chords: Chord[][][] = [];

  add(notes: Note[]) {
    for (const note of notes) {
      const voice = note.attributes.get("voice");
      if (voice === undefined) return false;
      const vi = this.#vi(voice);
      const bar = note.start.value | 0;
      this.#add(vi, bar, note);
    }
  }

  /* could be much more efficient by ordering and binary searching based on time,
   * a smarter data structure etc.
   * that adds overhead for what are presumably small sets of notes.
   */
  #addTo(
    start: Ratio,
    stop: Ratio,
    pitch: string,
    tied: boolean,
    chords: Chord[],
  ) {
    const uncovered: { start: Ratio; stop: Ratio; tied: boolean }[] = [
      { start, stop, tied },
    ];
    // avoid adding to a collection while looping through it
    const newChords: Chord[] = [];
    for (const chord of chords) {
      // short cut
      if (uncovered.length === 0) {
        break;
      }
      let task: { start: Ratio; stop: Ratio; tied: boolean } | undefined =
        undefined;
      for (let i = 0; i < uncovered.length; i++) {
        const { start, stop } = uncovered[i];
        if (start.less(chord.stop) && chord.start.less(stop)) {
          // this can not happen more than once, as neither the todo
          // nor the chords can overlap
          [task] = uncovered.splice(i, 1);
          break;
        }
      }
      if (task === undefined) {
        // no overlap, no manipulation
        continue;
      }
      const b = start.compare(chord.start);
      if (b < 0) { // note starts earlier, so its tsart remains uncovered
        uncovered.push({ start, stop: chord.start, tied: true });
      } else if (b > 0) {
        // chord start earlier, so split it up.
        newChords.push({
          start: chord.start,
          stop: start,
          parts: [...chord.parts],
        });
        chord.start = start;
      }
      const c = stop.compare(chord.stop);
      if (c < 0) {
        // chord stops later, so split it up.
        newChords.push({
          start: start,
          stop: chord.start,
          parts: [...chord.parts],
        });
        chord.stop = stop;
      } else if (c > 0) {
        // note stops later, keep track of the uncovered part.
        uncovered.push({ start: chord.stop, stop, tied });
        tied = true;
        stop = chord.stop;
      }
      chord.parts.push({ pitch, tied });
    }
    chords.push(...newChords);
    // not covered by existing chords
    for (const { start, stop, tied } of uncovered) {
      chords.push({ start, stop, parts: [{ pitch, tied }] });
    }
  }

  #add(vi: number, bar: number, note0: Note) {
    const tied = note0.stop.moreThan(bar + 1);
    if (tied) {
      const m = Ratio.int(bar + 1);
      this.#add(vi, bar + 1, { ...note0, start: m });
      note0.stop = m;
    }
    if (!this.#chords[vi]) {
      this.#chords[vi] = [];
    }
    // not changing
    const pitch = this.#pitch(note0);
    if (!this.#chords[vi][bar]) {
      // early exit?
      this.#chords[vi][bar] = [];
    }
    this.#addTo(note0.start, note0.stop, pitch, tied, this.#chords[vi][bar]);
  }
}
type Chord = {
  start: Ratio;
  stop: Ratio;
  parts: { pitch: string; tied: boolean }[];
};
