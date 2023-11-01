import { MidiEvent, MidiFile, Timing, Track } from "./midiTypes.ts";

export class Printer {
  #bytes: number[] = [];

  pop() {
    const b = this.#bytes;
    this.#bytes = [];
    return b;
  }

  #push(...bytes: number[]) {
    this.#bytes.push(...bytes);
  }

  file(file: MidiFile): void {
    this.header(file.format, file.tracks.length, file.timing);
    for (const track of file.tracks) {
      this.track(track);
    }
  }

  header(format: 0 | 1 | 2, numberOfTracks: number, timing: Timing): void {
    this.#push(77, 84, 104, 100, 0, 0, 0, 6, 0, format);
    this.fixedLengthNumber(numberOfTracks, 2);
    switch (timing.type) {
      case "metrical":
        this.fixedLengthNumber(timing.ppqn, 2);
        break;
      case "timecode":
        this.#push(0x80 - timing.fps);
        this.#push(timing.subdivisions);
        break;
    }
  }

  track(track: Track): void {
    this.#push(77, 84, 114, 107, 0, 0, 0, 0);
    const offset = this.#bytes.length;
    for (const { wait, event } of track) {
      this.variableLengthNumber(wait);
      this.event(event);
    }
    this.fixedLengthNumber(this.#bytes.length - offset, 4, offset - 4);
  }

  event(event: MidiEvent): void {
    switch (event.type) {
      case "note_off":
        this.#push(0x80 + event.channel, event.note, event.velocity);
        break;
      case "note_on":
        this.#push(0x90 + event.channel, event.note, event.velocity);
        break;
      case "polyphonic_pressure":
        this.#push(0xa0 + event.channel, event.note, event.pressure);
        break;
      case "controller":
        this.#push(0xb0 + event.channel, event.controller, event.value);
        break;
      case "program_change":
        this.#push(0xc0 + event.channel, event.program);
        break;
      case "channel_pressure":
        this.#push(0xd0 + event.channel, event.pressure);
        break;
      case "pitch_bend":
        // todo: check!
        this.#push(
          0xe0 + event.channel,
          0x7f & event.value,
          (event.value >> 7) + 0x40,
        );
        break;
      case "sequence_number":
        this.#push(0xff, 0, 2);
        this.fixedLengthNumber(event.value, 2);
        break;
      // to be continued
      case "text":
        this.#push(0xff, 1);
        this.text(event.value);
        break;
      case "copyright":
        this.#push(0xff, 2);
        this.text(event.value);
        break;
      case "sequence_name":
        this.#push(0xff, 3);
        this.text(event.value);
        break;
      case "instrument_name":
        this.#push(0xff, 4);
        this.text(event.value);
        break;
      case "lyrics":
        this.#push(0xff, 5);
        this.text(event.value);
        break;
      case "marker":
        this.#push(0xff, 6);
        this.text(event.value);
        break;
      case "cue_point":
        this.#push(0xff, 7);
        this.text(event.value);
        break;
      case "program_name":
        this.#push(0xff, 8);
        this.text(event.value);
        break;
      case "device_name":
        this.#push(0xff, 9);
        this.text(event.value);
        break;
      case "midi_channel_prefix":
        this.#push(0xff, 0x20, 1, event.value);
        break;
      case "midi_port":
        this.#push(0xff, 0x21, 1, event.value);
        break;
      case "end_of_track":
        this.#push(0xff, 0x2f, 0);
        break;
      case "tempo":
        this.#push(0xff, 0x51, 3);
        this.fixedLengthNumber(event.value, 3);
        break;
      case "smpte_offset":
        this.#push(
          0xff,
          0x54,
          5,
          event.hour,
          event.minute,
          event.second,
          event.frame,
          event.centiframe,
        );
        break;
      case "time_signature":
        this.#push(
          0xff,
          0x58,
          4,
          event.numerator,
          Math.log2(event.denominator),
          event.clocks,
          event.quarterIn32nds,
        );
        break;
      case "key_signature":
        this.#push(0xff, 0x59, 2, event.sharps & 0xff, event.major ? 0 : 1);
        break;
      default: // ignore the rest
        break;
    }
  }

  fixedLengthNumber(
    value: number,
    length: number,
    offset = this.#bytes.length,
  ): void {
    for (let i = length - 1; i >= 0; i--) {
      this.#bytes[offset + i] = 0xff & value;
      value >>= 8;
    }
  }

  variableLengthNumber(value: number): void {
    const result = [];
    do {
      result.push(value & 0x7f);
      value >>= 7;
    } while (value > 0);
    while (result.length > 1) {
      this.#bytes.push(0x80 + (result.pop() || 0));
    }
    this.#bytes.push(result.pop() || 0);
  }

  static #encoder = new TextEncoder();
  text(value: string): void {
    const text = Printer.#encoder.encode(value);
    this.variableLengthNumber(text.length);
    for (const byte of text) {
      this.#bytes.push(byte);
    }
  }
}
