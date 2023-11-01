import { MidiEvent, MidiFile, Timing, Track } from "./midiTypes.ts";

export type Bytes = number | Bytes[];

export function flatten(_in: Bytes, out: number[] = []) {
  if (typeof _in === "number") {
    out.push(_in);
  } else {
    for (const b of _in) {
      flatten(b, out);
    }
  }
  return out;
}

export function serializeFile(file: MidiFile): Bytes {
  return [
    serializeHeader(file.format, file.tracks.length, file.timing),
    file.tracks.map(serializeTrack),
  ];
}

export function serializeHeader(
  format: 0 | 1 | 2,
  numberOfTracks: number,
  timing: Timing
): Bytes {
  const bytes = [
    77,
    84,
    104,
    100,
    0,
    0,
    0,
    6,
    0,
    format,
    serializeFixedLengthNumber(numberOfTracks, 2),
  ];
  switch (timing.type) {
    case "metrical":
      bytes.push(serializeFixedLengthNumber(timing.ppqn, 2));
      break;
    case "timecode":
      bytes.push(0x80 - timing.fps);
      bytes.push(timing.subdivisions);
      break;
  }
  return bytes;
}

export function serializeTrack(track: Track): Bytes {
  const bytes: number[] = [];
  for (const { wait, event } of track) {
    flatten(serializeVariableLengthNumber(wait), bytes);
    flatten(serializeEvent(event), bytes);
  }
  return [77, 84, 114, 107, serializeFixedLengthNumber(bytes.length, 4), bytes];
}

export function serializeEvent(event: MidiEvent): Bytes {
  switch (event.type) {
    case "note_off":
      return [0x80 + event.channel, event.note, event.velocity];
    case "note_on":
      return [0x90 + event.channel, event.note, event.velocity];
    case "polyphonic_pressure":
      return [0xa0 + event.channel, event.note, event.pressure];
    case "controller":
      return [0xb0 + event.channel, event.controller, event.value];
    case "program_change":
      return [0xc0 + event.channel, event.program];
    case "channel_pressure":
      return [0xd0 + event.channel, event.pressure];
    case "pitch_bend":
      // todo: check!
      return [
        0xe0 + event.channel,
        0x7f & event.value,
        (event.value >> 7) + 0x40,
      ];
    case "sequence_number":
      return [0xff, 0, 2, serializeFixedLengthNumber(event.value, 2)];
    // to be continued
    case "text":
      return [0xff, 1, serializeText(event.value)];
    case "copyright":
      return [0xff, 2, serializeText(event.value)];
    case "sequence_name":
      return [0xff, 3, serializeText(event.value)];
    case "instrument_name":
      return [0xff, 4, serializeText(event.value)];
    case "lyrics":
      return [0xff, 5, serializeText(event.value)];
    case "marker":
      return [0xff, 6, serializeText(event.value)];
    case "cue_point":
      return [0xff, 7, serializeText(event.value)];
    case "program_name":
      return [0xff, 8, serializeText(event.value)];
    case "device_name":
      return [0xff, 9, serializeText(event.value)];
    case "midi_channel_prefix":
      return [0xff, 0x20, 1, event.value];
    case "midi_port":
      return [0xff, 0x21, 1, event.value];
    case "end_of_track":
      return [0xff, 0x2f, 0];
    case "tempo":
      return [0xff, 0x51, 3, serializeFixedLengthNumber(event.value, 3)];
    case "smpte_offset":
      return [
        0xff,
        0x54,
        5,
        event.hour,
        event.minute,
        event.second,
        event.frame,
        event.centiframe,
      ];
    case "time_signature":
      return [
        0xff,
        0x58,
        4,
        event.numerator,
        Math.log2(event.denominator),
        event.clocks,
        event.quarterIn32nds,
      ];
    case "key_signature":
      return [0xff, 0x59, 2, event.sharps & 0xff, event.major ? 0 : 1];
    default: // ignore the rest
      return [];
  }
}

export function serializeFixedLengthNumber(value: number, length: number): Bytes {
  const result = [];
  for (let i = length - 1; i >= 0; i--) {
    result[i] = 0xff & value;
    value >>= 8;
  }
  return result;
}

export function serializeVariableLengthNumber(value: number): Bytes {
  const result = [];
  do {
    result.push(value & 0x7f);
    value >>= 7;
  } while (value > 0);
  result.reverse();
  for (let i = 0; i < result.length - 1; i++) {
    result[i] += 0x80;
  }
  return result;
}

const encoder = new TextEncoder();
export function serializeText(value: string): Bytes {
  const text = encoder.encode(value);
  return [serializeVariableLengthNumber(text.length), ...text];
}
