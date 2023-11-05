import {
  MessageType,
  MetaEvent,
  MetaType,
  MidiEvent,
  MidiFile,
  Timing,
  Track,
} from "./midiTypes.ts";

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

  #status = 0xff;

  event(event: MidiEvent): void {
    if (event == null) return;
    if (event.type === MessageType.meta) {
      this.metaEvent(event);
      return;
    }
    const status = (event.type << 4) + event.channel;
    if (status !== this.#status) {
      this.#push(status);
      this.#status = status;
    }
    switch (event.type) {
      case MessageType.noteOff:
      case MessageType.noteOn:
        this.#push(event.note, event.velocity);
        break;
      case MessageType.polyphonicPressure:
        this.#push(event.note, event.pressure);
        break;
      case MessageType.controller:
        this.#push(event.controller, event.value);
        break;
      case MessageType.programChange:
        this.#push(event.program);
        break;
      case MessageType.channelPressure:
        this.#push(event.pressure);
        break;
      case MessageType.pitchBend:
        // todo: check!
        this.#push(
          0x7f & event.value,
          (event.value >> 7) + 0x40,
        );
        break;
    }
  }
  metaEvent(event: MetaEvent) {
    this.#status = 0xff;
    this.#push(this.#status, event.metaType);
    switch (event.metaType) {
      case MetaType.sequenceNumber:
        this.#push(2);
        this.fixedLengthNumber(event.value, 2);
        break;
      case MetaType.text:
      case MetaType.copyright:
      case MetaType.sequenceName:
      case MetaType.instrumentName:
      case MetaType.lyrics:
      case MetaType.marker:
      case MetaType.cuePoint:
      case MetaType.programName:
      case MetaType.deviceName:
        this.text(event.value);
        break;
      case MetaType.midiChannelPrefix:
      case MetaType.midiPort:
        this.#push(1, event.value);
        break;
      case MetaType.endOfTrack:
        this.#push(0);
        break;
      case MetaType.tempo:
        this.#push(3);
        this.fixedLengthNumber(event.value, 3);
        break;
      case MetaType.smpteOffset:
        this.#push(
          5,
          event.hour,
          event.minute,
          event.second,
          event.frame,
          event.centiframe,
        );
        break;
      case MetaType.timeSignature:
        this.#push(
          4,
          event.numerator,
          Math.log2(event.denominator),
          event.clocks,
          event.quarterIn32nds,
        );
        break;
      case MetaType.keySignature:
        this.#push(2, event.sharps & 0xff, event.major ? 0 : 1);
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
