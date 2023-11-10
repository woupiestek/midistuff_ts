import { MessageType } from "./midiTypes.ts";
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
CLASSES.set("grave", [Op.TEMPO, 7500]);
CLASSES.set("largo", [Op.TEMPO, 4528]);
CLASSES.set("adagio", [Op.TEMPO, 4286]);
CLASSES.set("lento", [Op.TEMPO, 3000]);
CLASSES.set("andante", [Op.TEMPO, 2927]);
CLASSES.set("moderato", [Op.TEMPO, 2105]);
CLASSES.set("allegro", [Op.TEMPO, 1739]);
CLASSES.set("vivace", [Op.TEMPO, 1447]);
CLASSES.set("grave", [Op.TEMPO, 1304]);
["pppp", "ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "ffff"].forEach(
  (k, i) => CLASSES.set(k, [Op.VELOCITY, 1 + 14 * i]),
);

class Params {
  constructor(
    readonly channel: number = 0,
    readonly duration: number = 0.25,
    readonly key: number = 0,
    readonly tempo: number = 2000,
    readonly velocity: number = 71,
  ) {}

  pitch(degree: number): number {
    return Math.floor((425 + 12 * degree + this.key) / 7);
  }

  diffTime(): number {
    return this.tempo * this.duration;
  }

  status(type: MessageType, channel = this.channel) {
    return (type << 4) | channel;
  }
}

export class Interpreter {
  #messages: { realTime: number; message: number[] }[] = [];
  #time = 0;
  #programs: (number | undefined)[] = Array(16);
  #sections: { mark: string; node: Node; params?: Params }[];
  constructor(ast: AST) {
    this.#sections = ast.sections;
    this.#interpret(ast.main, new Params());
    this.#messages.sort((x, y) => x.realTime - y.realTime);
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
    this.#emit((MessageType.programChange << 4) | free, program);
    return free;
  }

  #emit(...message: number[]) {
    this.#messages.push({
      realTime: this.#time | 0,
      message,
    });
  }

  #combine(params: Params, options?: Options): Params {
    if (options === undefined) return params;
    let channel = params.channel;
    let velocity = params.velocity;
    let tempo = params.tempo;
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
            tempo = op[1];
            break;
        }
      }
    }
    return new Params(
      channel,
      options.duration || params.duration,
      options.key || params.key,
      tempo,
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
        this.#emit(_params.status(MessageType.noteOn), pitch, _params.velocity);
        this.#time += _params.diffTime();
        this.#emit(
          _params.status(MessageType.noteOff),
          pitch,
          _params.velocity,
        );
        return;
      }
      case NodeType.REST:
        this.#time += this.#combine(params, node.options).diffTime();
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
