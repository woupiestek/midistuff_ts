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

  file() {
    const header = this.header();
    const tracks = [];
    for(let i = 0; i<header.numberOfTracks; i++){
      tracks[i]=this.track();
    }
    if(!this.done()){
      throw new Error('Unexpected data in file');
    }
    return {
      timing: header.timing,
      formate: header.format,
      tracks
    }
  }

  static #MThd6 = [77, 84, 104, 100, 0, 0, 0, 6];
  header() {
    for (const c of Scanner.#MThd6) {
      this.consume(c);
    }
    const result = {
      format: this.fixedLengthNumber(2),
      numberOfTracks: this.fixedLengthNumber(2),
      timing: {},
    };
    if ((this.top() & 0x80) === 0) {
      result.timing = { type: "metrical", ppqn: this.fixedLengthNumber(2) };
    } else {
      result.timing = {
        type: "timecode",
        fps: 0x80 - this.pop(),
        subdivisions: this.pop(),
      };
    }
    return result;
  }

  static #MTrk = [77, 84, 114, 107];
  track() {
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

  static #type = [
    "note_off",
    "note_on",
    "polyphonic_pressure",
    "controller",
    "program_change",
    "channel_pressure",
    "pitch_bend",
  ];

  static #meta: Record<number, string> = {
    0: "sequence_number",
    1: "text",
    2: "copy_right",
    3: "sequence_name",
    4: "instrument name",
    5: "lyrics",
    6: "marker",
    7: "cue_point",
    8: "program_name",
    9: "device_name",
    0x20: "midi_channel_prefix",
    0x21: "midi_port",
    0x2f: "end_of_track",
    0x51: "tempo",
    0x54: "smpte_offset",
    0x58: "time_signature",
    0x59: "key_signature",
    0x7f: "sequencer specific",
  };
  event() {
    const byte = this.pop();

    if (byte < 0x80) {
      throw new Error(`invalid status byte ${byte} at ${this.current - 1}`);
    }

    if (byte < 0xf0) {
      const channel = byte & 0xf;
      const type = Scanner.#type[(byte >> 4) & 0x7];
      switch (type) {
        case "note_on":
        case "note_off":
          return { type, channel, note: this.pop(), velocity: this.pop() };
        case "polyphonic_pressure":
          return { type, channel, note: this.pop(), pressure: this.pop() };
        case "controller":
          return { type, channel, controller: this.pop(), value: this.pop() };
        case "program_change":
          return { type, channel, program: this.pop() };
        case "channel_pressure":
          return { type, channel, pressure: this.pop() };
        case "pitch_bend": {
          const lsb = this.pop();
          if (lsb >= 0x80) throw new Error("Unexpected lsb in pitch bend");
          const msb = this.pop();
          if (msb >= 0x80) throw new Error("Unexpected msb in pitch bend");
          return { type, channel, bend: (msb << 7) + lsb - 0x2000 };
        }
      }
    }

    switch (byte) {
      case 0xf0: {
        // due to side effects, inlining changes what this does.
        const l = this.variableLengthNumber();
        this.current += l;
        return { type: "sys_ex" };
      }
      case 0xf7: {
        const l = this.variableLengthNumber();
        this.current += l;
        return { type: "escape" };
      }
      case 0xff: {
        return this.metaData();
      }
    }

    throw new Error(`unsupported status byte ${byte} at ${this.current - 1}`);
  }

  metaData() {
    const subtype = this.pop();
    const type = Scanner.#meta[subtype] || `meta_${subtype}`;
    if (subtype >= 1 && subtype <= 9) {
      return { type, value: this.text() };
    }
    switch (subtype) {
      case 0:
        this.consume(2);
        return { type, value: this.fixedLengthNumber(2) };

      case 0x20:
      case 0x21:
        this.consume(1);
        return { type, value: this.pop() };

      case 0x2f:
        this.consume(0);
        return { type };

      case 0x51:
        this.consume(3);
        return { type, value: this.fixedLengthNumber(3) };

      case 0x54:
        this.consume(5);
        return {
          type,
          hour: this.pop(),
          minute: this.pop(),
          second: this.pop(),
          frame: this.pop(),
          centiframe: this.pop(),
        };

      case 0x58:
        this.consume(4);
        return {
          type,
          numerator: this.pop(),
          denominator: 1 << this.pop(),
          // midi is weird
          clocks: this.pop(),
          quarterIn32nds: this.pop(),
        };

      case 0x59: {
        this.consume(2);
        const sharps = this.pop();
        return {
          type,
          sharps: sharps < 0x80 ? sharps : 0x80 - sharps,
          major: this.pop() === 0,
        };
      }
    }

    // lacking specs, must ignore
    const l = this.variableLengthNumber();
    this.current += l;
    return { type };
  }

  #decoder = new TextDecoder();
  text(): string {
    const l = this.variableLengthNumber();
    const result = this.#decoder.decode(
      this.source.slice(this.current, this.current + l),
    );
    this.current += l;
    return result;
  }
}
