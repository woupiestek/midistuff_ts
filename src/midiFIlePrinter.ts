function serializeEvent(event) {
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
        0x7f & event.bent,
        (event.bent >> 7) + 0x40,
      ];
    case "sequence_number":
      return [0xff, 0, 2, ...serializeFixedLengthNumber(event.value, 2)];
    // to be continued
    case "text":
      return [0xff, 1, ...serializeText(event.value)];
    case "copyright":
      return [0xff, 2, ...serializeText(event.value)];
    case "sequence_name":
      return [0xff, 3, ...serializeText(event.value)];
    case "instrument_name":
      return [0xff, 4, ...serializeText(event.value)];
    case "lyrics":
      return [0xff, 5, ...serializeText(event.value)];
    case "marker":
      return [0xff, 6, ...serializeText(event.value)];
    case "cue_point":
      return [0xff, 7, ...serializeText(event.value)];
    case "program_name":
      return [0xff, 8, ...serializeText(event.value)];
    case "device_name":
      return [0xff, 9, ...serializeText(event.value)];
    case "midi_channel_prefix":
      return [0xff, 0x20, 1, event.value];
    case "midi_port":
      return [0xff, 0x21, 1, event.value];
    case "end_of_track":
      return [0xff, 0x2f, 0];
    case "tempo":
      return [0xff, 0x51, 3, ...serializeFixedLengthNumber(event.value, 3)];
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
  }
}

function serializeFixedLengthNumber(value: number, length: number) {
  const result = [];
  for (let i = length - 1; i >= 0; i--) {
    result[i] = 0xff & value;
    value >> 8;
  }
  return result;
}

function serializeVariableLengthNumber(value: number) {
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
function serializeText(value: string) {
  const text = encoder.encode(value);
  return [serializeVariableLengthNumber(text.length), ...text];
}
