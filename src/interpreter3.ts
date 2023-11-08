import { MessageType } from "./midiTypes.ts";
import { AST, Node, NodeType } from "./parser3.ts";
import { Token } from "./scanner3.ts";

export class Interpreter {
  #messages: { realTime: number; message: number[] }[] = [];
  #time = 0;
  #key = 0;
  #tempo = 2000; // ms per whole note. bpm works with beats...
  #velocity = 64;
  #programs: (number | undefined)[] = Array(16);
  #channel = 0;
  #sections: { mark: string; node: Node }[];
  constructor(ast: AST) {
    this.#sections = ast.sections;
    this.#interpret(ast.main);
    this.#messages.sort((x, y) => x.realTime - y.realTime);
  }

  get messages() {
    return this.#messages;
  }

  #pitch(degree: number): number {
    return Math.floor((425 + 12 * degree + this.#key) / 7);
  }

  #diffTime(wholeNotes: number): number {
    return this.#tempo * wholeNotes;
  }

  #setProgram(program: number): number {
    const channel = this.#channel;
    let free = 16;
    for (let i = 15; i >= 0; i--) {
      if (i === 10) continue;
      if (this.#programs[i] === program) {
        this.#channel = i;
        return channel;
      }
      if (this.#programs[i] === undefined) {
        free = i;
      }
    }
    if (free === 16) throw new Error("out of channels");
    this.#programs[free] = program;
    this.#channel = free;
    this.#emit(MessageType.programChange, program);
    return channel;
  }

  #unsetProgram(program: number, channel: number) {
    this.#channel = channel;
    for (let i = 15; i >= 0; i--) {
      if (i === 10) continue;
      if (this.#programs[i] === program) {
        this.#programs[i] = undefined;
        return;
      }
    }
  }

  #emit(type: MessageType, ...args: number[]) {
    this.#messages.push({
      realTime: this.#time | 0,
      message: [(type << 4) | this.#channel, ...args],
    });
  }

  #interpret(node: Node) {
    while (node) {
      switch (node.type) {
        case NodeType.DYN:
          this.#velocity = node.value;
          node = node.next;
          continue;
        case NodeType.ERROR:
          console.error(`Error at ${Token.stringify(node.token)}`, node.error);
          return;
        case NodeType.INSERT:
          node = this.#sections[node.index].node;
          continue;
        case NodeType.JOIN: {
          const start = this.#time;
          let end = start;
          for (const child of node.children) {
            this.#time = start;
            this.#interpret(child);
            if (this.#time > end) {
              end = this.#time;
            }
          }
          this.#time = end;
          return;
        }
        case NodeType.KEY:
          this.#key = node.value;
          node = node.next;
          continue;
        case NodeType.NOTE: {
          const pitch = this.#pitch(node.degree) + node.accident;
          this.#emit(MessageType.noteOn, pitch, this.#velocity);
          this.#time += this.#diffTime(node.duration);
          this.#emit(MessageType.noteOff, pitch, this.#velocity);
          return;
        }
        case NodeType.PROGRAM: {
          const channel = this.#setProgram(node.value);
          this.#interpret(node.next);
          this.#unsetProgram(node.value, channel);
          return;
        }
        case NodeType.REST:
          node.duration; // in whole notes
          this.#time += this.#diffTime(node.duration);
          return;
        case NodeType.SEQUENCE:
          for (const child of node.children) {
            this.#interpret(child);
          }
          return;
        case NodeType.TEMPO:
          this.#tempo = node.value;
          node = node.next;
          continue;
      }
    }
  }
}
