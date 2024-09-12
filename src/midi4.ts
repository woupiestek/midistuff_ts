import { MessageType } from "./midiTypes.ts";
import { NodeType, ParseResult } from "./parser4.ts";
import { Ratio } from "./util.ts";

const config: Record<string, [string, number]> = {};
for (let i = 0; i < 128; i++) {
  config[`program_${i}`] = ["program", i];
}
["pppp", "ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "ffff"].forEach(
  (k, i) => (config[k] = ["velocity", 1 + 14 * i]),
);

function pitch(key: number, degree: number, alter: number) {
  const w = Math.floor((5 * degree + 5 + key) / 7);
  const h = Math.floor((2 * degree + 1 - key) / 7);
  return 60 + 2 * w + h + alter;
}

class Transformer {
  // perhaps these should be stacks...
  channel = 0;
  velocity = 71;
  programs: number[] = [];
  time = Ratio.ZERO;
  msPerBeat = Ratio.int(2000);

  constructor(readonly source: ParseResult, readonly target: MIDI) {
    const bpm = source.metadata?.bpm;
    if (typeof bpm === "number") {
      this.msPerBeat = new Ratio(2.4e5, bpm);
    }
    this.#node(0);
    target.realTime = this.#realTime();
  }

  #realTime() {
    return this.time.times(this.msPerBeat).value;
  }

  #event(id: number) {
    switch (this.source.data.events[id]) {
      case "sustain down":
        this.target.push(this.#realTime(), [
          MessageType.controller * 16 + this.channel,
          0x40,
          0xff,
        ]);
        return;
      case "sustain up":
        this.target.push(this.#realTime(), [
          MessageType.controller * 16 + this.channel,
          0x40,
          0,
        ]);
        return;
    }
    const [x, y] = config[this.source.data.events[id]] || [];
    // add sustain
    switch (x) {
      case "velocity":
        this.velocity = y;
        return;
      case "program": {
        this.channel = this.programs.indexOf(y);
        if (this.channel === -1) {
          // todo: check against of 10, 11, or > 15
          this.channel += this.programs.push(y);
        }
        this.target.push(this.#realTime(), [
          MessageType.programChange * 16 + this.channel,
          y,
        ]);
        return;
      }
    }
  }

  #node(index: number) {
    const node = this.source.data.nodes[index];
    switch (NodeType.base(node.type)) {
      case NodeType.ARRAY: {
        const length = NodeType.length(node.type);
        for (let i = 0; i < length; i++) {
          this.#node(this.source.data.indices[node.id + i]);
        }
        break;
      }
      case NodeType.EVENT:
        this.#event(node.id);
        break;
      case NodeType.NOTE: {
        const tone = this.source.data.notes[node.id];
        const _pitch = pitch(
          node.key,
          tone.degree,
          tone.accident,
        );
        this.target.push(
          this.#realTime(),
          [
            MessageType.noteOn * 16 +
            this.channel,
            _pitch,
            this.velocity,
          ],
        );
        this.time = this.time.plus(node.duration);
        this.target.push(
          this.#realTime(),
          [
            MessageType.noteOff * 16 +
            this.channel,
            _pitch,
            this.velocity,
          ],
        );
        break;
      }
      case NodeType.REST: {
        this.time = this.time.plus(node.duration);
        break;
      }
      case NodeType.SET: {
        const start = this.time;
        const channel = this.channel;
        const velocity = this.velocity;
        let stop = start;
        const length = NodeType.length(node.type);
        for (let i = 0; i < length; i++) {
          this.#node(this.source.data.indices[node.id + i]);
          if (stop.less(this.time)) {
            stop = this.time;
          }
          this.time = start;
          this.channel = channel;
          this.velocity = velocity;
        }
        this.time = stop;
        break;
      }
    }
  }
}

export class MIDI {
  messages: { realTime: number; message: number[] }[] = [];
  realTime: number = 0;
  push(realTime: number, message: number[]) {
    this.messages.push({ realTime, message });
  }
  constructor(source: ParseResult) {
    new Transformer(source, this);
  }
}
