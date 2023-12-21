import { MessageType, MidiEvent } from "./midiTypes.ts";
import { AST } from "./parser3.ts";
import { Event, Note, Transformer } from "./transformer.ts";

const config: Record<string, [string, number]> = {};
for (let i = 0; i < 128; i++) {
  config[`program_${i}`] = ["program", i];
}
["pppp", "ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "ffff"].forEach(
  (k, i) => (config[k] = ["velocity", 1 + 14 * i]),
);

export class MidiPlanner {
  #transformer = new Transformer();
  #messages: { time: number; event: MidiEvent }[] = [];
  #programs: (number | undefined)[] = Array(16);
  bpm = 120;
  time = 0;
  constructor(ast: AST) {
    const bpm = ast.metadata.bpm;
    if (typeof bpm === "number") {
      this.bpm = bpm;
    }
    for (const item of this.#transformer.transform(ast)) {
      switch (item.type) {
        case "event":
          this.#event(item);
          break;
        case "note":
          this.#note(item);
          break;
      }
    }
    this.#messages.sort((x, y) => x.time - y.time);
  }

  #channel = 0;
  #velocity = 71;

  #event(_event: Event) {
    switch (_event.value) {
      case "sustain down":
        this.#messages.push({
          time: _event.time.value,
          event: {
            type: MessageType.controller,
            channel: this.#channel,
            controller: 0x40,
            value: 0xff,
          },
        });
        return;
      case "sustain up":
        this.#messages.push({
          time: _event.time.value,
          event: {
            type: MessageType.controller,
            channel: this.#channel,
            controller: 0x40,
            value: 0,
          },
        });
        return;
      default:
        break;
    }

    const pair = config[_event.value];
    if (!pair) return;
    switch (pair[0]) {
      case "program":
        this.#channel = this.#getChannel(pair[1]);
        return;
      case "velocity":
        this.#velocity = pair[1];
        return;
    }
  }

  #note(_note: Note) {
    const channel = this.#channel;
    const note = _note.pyth.toMidi() + 60;
    const velocity = this.#velocity;
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
