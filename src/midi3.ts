import { MessageType, MetaType, MidiEvent } from "./midiTypes.ts";
import { AST, Node, NodeType, Options } from "./parser3.ts";
import { Token } from "./scanner3.ts";

enum Op {
  PROGRAM,
  TEMPO,
  VELOCITY,
}

const CLASSES = new Map();
for (let i = 0; i < 128; i++) {
  CLASSES.set(`program_${i}`, [Op.PROGRAM, i]);
}
const TEMPO: [string, number][] = [
  ["grave", 32],
  ["largo", 53],
  ["adagio", 56],
  ["lento", 80],
  ["andante", 82],
  ["moderato", 114],
  ["allegro", 138],
  ["vivace", 166],
  ["presto", 184],
];
// beats per minute, but midi expect the tempo to be in milliseconds per quarter note
// so as long as the quarter note has the beat (not yet configurable) this is alright
TEMPO.forEach(([key, bpm]) => CLASSES.set(key, [Op.TEMPO, (6e7 / bpm) | 0]));
["pppp", "ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "ffff"].forEach(
  (k, i) => CLASSES.set(k, [Op.VELOCITY, 1 + 14 * i]),
);

class Params {
  constructor(
    readonly channel: number = 0,
    readonly duration: number = 0.25,
    readonly key: number = 0,
    readonly velocity: number = 71,
  ) {}

  pitch(degree: number): number {
    return Math.floor((425 + 12 * degree + this.key) / 7);
  }
}

export class MidiPlanner {
  #messages: { time: number; event: MidiEvent }[] = [];
  #time = 0;
  #programs: (number | undefined)[] = Array(16);
  #sections: { mark: string; node: Node; params?: Params }[];
  constructor(ast: AST) {
    this.#sections = ast.sections;
    this.#interpret(ast.main, new Params());
    this.#messages.sort((x, y) => x.time - y.time);
  }

  get messages() {
    return this.#messages;
  }

  get time() {
    return this.#time;
  }

  #getChannel(program: number): number {
    let free = 16;
    for (let i = 15; i >= 0; i--) {
      if (i === 10) continue;
      if (this.#programs[i] === program) {
        return i;
      }
      if (this.#programs[i] === undefined) {
        free = i;
      }
    }
    if (free === 16) throw new Error("out of channels");
    this.#programs[free] = program;
    this.#emit({ type: MessageType.programChange, channel: free, program });
    return free;
  }

  #emit(event: MidiEvent) {
    this.#messages.push({
      time: this.#time,
      event,
    });
  }

  #combine(params: Params, options?: Options): Params {
    if (options === undefined) return params;
    let channel = params.channel;
    let velocity = params.velocity;
    if (options.classes !== undefined) {
      for (const c of options.classes) {
        const op = CLASSES.get(c);
        if (op === undefined) continue;
        switch (op[0]) {
          case Op.VELOCITY:
            velocity = op[1];
            break;
          case Op.PROGRAM:
            channel = this.#getChannel(op[1]);
            break;
          case Op.TEMPO:
            this.#emit({
              type: MessageType.meta,
              metaType: MetaType.tempo,
              value: op[1],
            });
            break;
        }
      }
    }
    return new Params(
      channel,
      MidiPlanner.#duration(options, params.duration),
      options.key || params.key,
      velocity,
    );
  }

  static #duration(options: Options, duration: number): number {
    return options.durationNumerator && options.durationDenominator
      ? options.durationNumerator / options.durationDenominator
      : duration;
  }

  #interpret(node: Node, params: Params) {
    switch (node.type) {
      case NodeType.ERROR:
        console.error(`Error at ${Token.stringify(node.token)}`, node.error);
        return;
      case NodeType.INSERT:
        {
          const section = this.#sections[node.index];
          if (!section.params) {
            section.params = params;
          }
          this.#interpret(section.node, section.params);
        }
        return;
      case NodeType.JOIN: {
        const _params = this.#combine(params, node.options);
        const start = this.#time;
        let end = start;
        for (const child of node.children) {
          this.#time = start;
          this.#interpret(child, _params);
          if (this.#time > end) {
            end = this.#time;
          }
        }
        this.#time = end;
        return;
      }
      case NodeType.NOTE: {
        const _params = this.#combine(params, node.options);
        const pitch = _params.pitch(node.degree) + node.accident;
        this.#emit({
          type: MessageType.noteOn,
          channel: _params.channel,
          note: pitch,
          velocity: _params.velocity,
        });
        this.#time += _params.duration;
        this.#emit({
          type: MessageType.noteOff,
          channel: _params.channel,
          note: pitch,
          velocity: _params.velocity,
        });
        return;
      }
      case NodeType.REST:
        this.#time += node.options
          ? MidiPlanner.#duration(node.options, params.duration)
          : params.duration;
        return;
      case NodeType.SEQUENCE: {
        const _params = this.#combine(params, node.options);
        for (const child of node.children) {
          this.#interpret(child, _params);
        }
        return;
      }
    }
  }
}
