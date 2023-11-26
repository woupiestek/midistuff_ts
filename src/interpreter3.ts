import { MidiPlanner } from "./midi3.ts";
import { MessageType } from "./midiTypes.ts";
import { AST } from "./parser3.ts";

export class Interpreter {
  messages: { realTime: number; message: number[] }[] = [];
  realTime = 0;
  constructor(ast: AST, from: number, to: number) {
    this.#process(new MidiPlanner(ast), from, to);
  }

  #process(planner: MidiPlanner, from: number, to: number) {
    const tempo = 2.4e5 / planner.bpm;
    let lastTime = from;
    let realTime = 0;
    for (const { time, event } of planner.messages) {
      if (time < from) {
        continue;
      }
      if (time > to) break;
      realTime += tempo * (time - lastTime);
      lastTime = time;
      if (event === null || event.type === MessageType.meta) continue;
      const message = [(event.type << 4) | event.channel];
      switch (event.type) {
        case MessageType.noteOff:
        case MessageType.noteOn:
          message.push(event.note, event.velocity);
          break;
        case MessageType.polyphonicPressure:
          message.push(event.note, event.pressure);
          break;
        case MessageType.controller:
          message.push(event.controller, event.value);
          break;
        case MessageType.programChange:
          message.push(event.program);
          break;
        case MessageType.channelPressure:
          message.push(event.pressure);
          break;
        case MessageType.pitchBend:
          // todo: check!
          message.push(0x7f & event.value, (event.value >> 7) + 0x40);
          break;
      }
      this.messages.push({ realTime, message });
    }
    this.realTime = realTime;
  }
}
