import {
  MessageType,
  MetaType,
  MidiEvent,
  MidiFile,
  Track,
} from "./midiTypes.ts";
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
const LONGA = 2.4e8;
CLASSES.set("grave", [Op.TEMPO, LONGA / 32]);
CLASSES.set("largo", [Op.TEMPO, LONGA / 53]);
CLASSES.set("adagio", [Op.TEMPO, LONGA / 56]);
CLASSES.set("lento", [Op.TEMPO, LONGA / 80]);
CLASSES.set("andante", [Op.TEMPO, LONGA / 82]);
CLASSES.set("moderato", [Op.TEMPO, LONGA / 114]);
CLASSES.set("allegro", [Op.TEMPO, LONGA / 138]);
CLASSES.set("vivace", [Op.TEMPO, LONGA / 166]);
CLASSES.set("presto", [Op.TEMPO, LONGA / 184]);
["pppp", "ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "ffff"].forEach(
  (k, i) => CLASSES.set(k, [Op.VELOCITY, 1 + 14 * i]),
);

class Params {
  static PPWN = 384;

  constructor(
    readonly channel: number = 0,
    readonly duration: number = 0.25,
    readonly key: number = 0,
    readonly velocity: number = 71,
  ) {}

  pitch(degree: number): number {
    return Math.floor((425 + 12 * degree + this.key) / 7);
  }

  diffTime(): number {
    return Params.PPWN * this.duration;
  }
}

export class Filer {
  #track0: { pulse: number; message: MidiEvent }[] = [];
  #track1: { pulse: number; message: MidiEvent }[] = [];
  #pulse = 0;
  #programs: (number | undefined)[] = Array(16);
  #sections: { mark: string; node: Node; params?: Params }[];
  constructor(ast: AST) {
    this.#sections = ast.sections;
    this.#interpret(ast.main, new Params());
    this.#track0.sort((x, y) => x.pulse - y.pulse);
    this.#track1.sort((x, y) => x.pulse - y.pulse);
  }

  #differentiate(t: { pulse: number; message: MidiEvent }[]): Track {
    const track: Track = [];
    let lastPulse = 0;
    for (const { pulse, message } of t) {
      track.push({ wait: (pulse - lastPulse) | 0, event: message });
      lastPulse = pulse;
    }
    track.push({
      wait: (this.#pulse - lastPulse) | 0,
      event: {
        type: MessageType.meta,
        metaType: MetaType.endOfTrack,
      },
    });
    return track;
  }

  get file(): MidiFile {
    return {
      format: 1,
      timing: {
        type: "metrical",
        ppqn: Params.PPWN,
      },
      tracks: [
        this.#differentiate(this.#track0),
        this.#differentiate(this.#track1),
      ],
    };
  }

  get time() {
    return this.#pulse | 0;
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
    this.#track1.push({
      pulse: this.#pulse,
      message: { type: MessageType.programChange, channel: free, program },
    });
    return free;
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
            this.#track0.push({
              pulse: this.#pulse | 0,
              message: {
                type: MessageType.meta,
                metaType: MetaType.tempo,
                value: op[1],
              },
            });
            break;
        }
      }
    }
    return new Params(
      channel,
      options.duration || params.duration,
      options.key || params.key,
      velocity,
    );
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
        const start = this.#pulse;
        let end = start;
        for (const child of node.children) {
          this.#pulse = start;
          this.#interpret(child, _params);
          if (this.#pulse > end) {
            end = this.#pulse;
          }
        }
        this.#pulse = end;
        return;
      }
      case NodeType.NOTE: {
        const _params = this.#combine(params, node.options);
        const pitch = _params.pitch(node.degree) + node.accident;
        this.#track1.push({
          pulse: this.#pulse,
          message: {
            type: MessageType.noteOn,
            channel: _params.channel,
            note: pitch,
            velocity: _params.velocity,
          },
        });
        this.#pulse += _params.diffTime();
        this.#track1.push({
          pulse: this.#pulse,
          message: {
            type: MessageType.noteOff,
            channel: _params.channel,
            note: pitch,
            velocity: _params.velocity,
          },
        });
        return;
      }
      case NodeType.REST:
        this.#pulse += this.#combine(params, node.options).diffTime();
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
