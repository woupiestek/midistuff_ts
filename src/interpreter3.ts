import { MessageType } from "./midiTypes.ts";
import { AST, Node, NodeType, Operations } from "./parser3.ts";
import { Token } from "./scanner3.ts";

class Params {
  constructor(
    readonly channel: number = 0,
    readonly key: number = 0,
    readonly tempo: number = 2000,
    readonly velocity: number = 64,
  ) {}

  pitch(degree: number): number {
    return Math.floor((425 + 12 * degree + this.key) / 7);
  }

  diffTime(wholeNotes: number): number {
    return this.tempo * wholeNotes;
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

  #combine(params: Params, parameters?: Operations): Params {
    if (parameters === undefined || parameters.size === 0) return params;
    const program = parameters.get("program");
    const dynamic = parameters.get("dyn");
    return new Params(
      program ? this.#getChannel(program) : params.channel,
      parameters.get("key") || params.key,
      parameters.get("tempo") || params.tempo,
      dynamic ? 1 + 14 * dynamic : params.velocity,
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
        const _params = this.#combine(params, node.operations);
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
        const pitch = params.pitch(node.degree) + node.accident;
        this.#emit(
          params.status(MessageType.noteOn),
          pitch,
          params.velocity,
        );
        this.#time += params.diffTime(node.duration);
        this.#emit(
          params.status(MessageType.noteOff),
          pitch,
          params.velocity,
        );
        return;
      }
      case NodeType.REST:
        this.#time += params.diffTime(node.duration);
        return;
      case NodeType.SEQUENCE: {
        const _params = this.#combine(params, node.operations);
        for (const child of node.children) {
          this.#interpret(child, _params);
        }
        return;
      }
    }
  }
}