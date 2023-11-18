import { MessageType, MidiEvent } from "./midiTypes.ts";
import { AST, Dict } from "./parser3.ts";
import { Note, Transformer } from "./transformer.ts";

const config: Record<string, Dict> = {};
for (let i = 0; i < 128; i++) {
  config[`program_${i}`] = { program: i };
}
["pppp", "ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "ffff"].forEach(
  (k, i) => (config[k] = { velocity: 1 + 14 * i }),
);

export class MidiPlanner {
  #transformer = new Transformer(config);
  #messages: { time: number; event: MidiEvent }[] = [];
  // #time = 0;
  #programs: (number | undefined)[] = Array(16);
  // #sections: { mark: string; node: Node; params?: Params }[];
  bpm = 120;
  time = 0;
  constructor(ast: AST) {
    const bpm = ast.metadata.bpm;
    if (typeof bpm === "number") {
      this.bpm = bpm;
    }
    for (const note of this.#transformer.transform(ast)) {
      this.#note(note);
    }
    this.#messages.sort((x, y) => x.time - y.time);
  }

  #note(_note: Note) {
    let velocity = _note.attributes.velocity; //||71;
    if (typeof velocity !== "number") {
      velocity = 71;
    }
    const note = Math.floor((425 + 12 * _note.pitch.step) / 7) +
      _note.pitch.alter;
    const program = _note.attributes.program;
    const channel = typeof program === "number" ? this.#getChannel(program) : 0;
    this.#messages.push({
      time: _note.start.value,
      event: { type: MessageType.noteOn, channel, note, velocity },
    });
    const time = _note.stop.value;
    this.#messages.push({
      time,
      event: { type: MessageType.noteOff, channel, note, velocity },
    });
    if (time > this.time) {
      this.time = time;
    }
  }

  get messages() {
    return this.#messages;
  }

  #getChannel(program: number): number {
    let free = 16;
    for (let i = 15; i >= 0; i--) {
      if (i === 10 || i === 11) continue;
      if (this.#programs[i] === program) {
        return i;
      }
      if (this.#programs[i] === undefined) {
        free = i;
      }
    }
    if (free === 16) throw new Error("out of channels");
    this.#programs[free] = program;
    this.#messages.push({
      time: 0,
      event: { type: MessageType.programChange, channel: free, program },
    });
    return free;
  }
}
