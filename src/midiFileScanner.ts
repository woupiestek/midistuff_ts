import {
  MessageType,
  MetaType,
  MidiEvent,
  MidiFile,
  Timing,
  Track,
} from "./midiTypes.ts";

export class Scanner {
  start = 0;
  current = 0;
  constructor(readonly source: Uint8Array) {}

  done() {
    return this.current >= this.source.length;
  }

  top() {
    if (this.done()) throw new Error("Out of input");
    return this.source[this.current];
  }

  pop() {
    if (this.done()) throw new Error("Out of input");
    return this.source[this.current++];
  }

  consume(code: number) {
    if (this.pop() !== code) {
      throw new Error(
        `expected ${code}, found ${
          this.source[this.current]
        } at ${this.current}`,
      );
    }
  }

  file(): MidiFile {
    const { timing, numberOfTracks, format } = this.header();
    const tracks: Track[] = [];
    for (let i = 0; i < numberOfTracks; i++) {
      tracks[i] = this.track();
    }
    if (!this.done()) {
      throw new Error("Unexpected data in file");
    }
    return { timing, format, tracks };
  }

  static #MThd6 = [77, 84, 104, 100, 0, 0, 0, 6];
  header(): { format: 0 | 1 | 2; numberOfTracks: number; timing: Timing } {
    for (const c of Scanner.#MThd6) {
      this.consume(c);
    }
    return {
      format: this.format(),
      numberOfTracks: this.fixedLengthNumber(2),
      timing: this.timing(),
    };
  }

  format(): 0 | 1 | 2 {
    const format = this.fixedLengthNumber(2);
    switch (format) {
      case 0:
      case 1:
      case 2:
        return format;
      default:
        throw new Error(`Unknown midi file format ${format}`);
    }
  }

  timing(): Timing {
    if ((this.top() & 0x80) === 0) {
      return { type: "metrical", ppqn: this.fixedLengthNumber(2) };
    } else {
      return {
        type: "timecode",
        fps: 0x80 - this.pop(),
        subdivisions: this.pop(),
      };
    }
  }

  static #MTrk = [77, 84, 114, 107];
  track(): Track {
    for (const c of Scanner.#MTrk) {
      this.consume(c);
    }
    const stop = this.current + this.fixedLengthNumber(4) + 4;
    const result = [];
    while (this.current < stop) {
      const wait = this.variableLengthNumber();
      const event = this.event();
      result.push({ wait, event });
    }
    this.current = stop;
    return result;
  }

  fixedLengthNumber(size: number): number {
    if (this.source.length < this.current + size) {
      throw new Error("expected 4 more bytes");
    }
    let value = 0;
    for (let i = 0; i < size; i++) {
      value = (value << 8) + this.pop();
    }
    return value;
  }

  variableLengthNumber(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const v = this.pop();
      value = (value << 7) + (v & 0x7f);
      if ((v & 0x80) === 0) {
        return value;
      }
    }
    throw new Error("more than 4 bytes in a variable length number");
  }

  event(): MidiEvent {
    const byte = this.pop();

    if (byte < 0x80) {
      throw new Error(`invalid status byte ${byte} at ${this.current - 1}`);
    }

    if (byte < 0xf0) {
      const channel = byte & 0xf;
      const type = byte >> 4;
      switch (type) {
        case MessageType.noteOff:
        case MessageType.noteOn:
          return { type, channel, note: this.pop(), velocity: this.pop() };
        case MessageType.polyphonicPressure:
          return { type, channel, note: this.pop(), pressure: this.pop() };
        case MessageType.controller:
          return { type, channel, controller: this.pop(), value: this.pop() };
        case MessageType.programChange:
          return { type, channel, program: this.pop() };
        case MessageType.channelPressure:
          return { type, channel, pressure: this.pop() };
        case MessageType.pitchBend: {
          const lsb = this.pop();
          if (lsb >= 0x80) throw new Error("Unexpected lsb in pitch bend");
          const msb = this.pop();
          if (msb >= 0x80) throw new Error("Unexpected msb in pitch bend");
          return { type, channel, value: (msb << 7) + lsb - 0x2000 };
        }
      }
    }

    switch (byte) {
      case 0xf0: {
        // due to side effects, inlining changes what this does.
        const l = this.variableLengthNumber();
        this.current += l;
        return null;
      }
      case 0xf7: {
        const l = this.variableLengthNumber();
        this.current += l;
        return null;
      }
      case 0xff: {
        return this.metaData();
      }
    }

    throw new Error(`unsupported status byte ${byte} at ${this.current - 1}`);
  }

  metaData(): MidiEvent {
    const type = MessageType.meta;
    const metaType = this.pop();

    if (metaType >= 1 && metaType <= 0xf) {
      return { type, metaType, value: this.text() };
    }
    switch (metaType) {
      case MetaType.sequenceNumber:
        this.consume(2);
        return { type, metaType, value: this.fixedLengthNumber(2) };

      case MetaType.midiChannelPrefix:
        this.consume(1);
        return { type, metaType, value: this.pop() };
      case MetaType.midiPort:
        this.consume(1);
        return { type, metaType, value: this.pop() };

      case MetaType.endOfTrack:
        this.consume(0);
        return { type, metaType };

      case MetaType.tempo:
        this.consume(3);
        return { type, metaType, value: this.fixedLengthNumber(3) };

      case MetaType.smpteOffset:
        this.consume(5);
        return {
          type,
          metaType,
          hour: this.pop(),
          minute: this.pop(),
          second: this.pop(),
          frame: this.pop(),
          centiframe: this.pop(),
        };

      case MetaType.timeSignature:
        this.consume(4);
        return {
          type,
          metaType,
          numerator: this.pop(),
          denominator: 1 << this.pop(),
          // midi is weird
          clocks: this.pop(),
          quarterIn32nds: this.pop(),
        };

      case MetaType.keySignature: {
        this.consume(2);
        const sharps = this.pop();
        return {
          type,
          metaType,
          sharps: sharps < 0x80 ? sharps : 0x80 - sharps,
          major: this.pop() === 0,
        };
      }
    }

    // lacking specs, must ignore
    const l = this.variableLengthNumber();
    this.current += l;
    return null;
  }

  static #decoder = new TextDecoder();
  text(): string {
    const l = this.variableLengthNumber();
    const result = Scanner.#decoder.decode(
      this.source.slice(this.current, this.current + l),
    );
    this.current += l;
    return result;
  }
}
