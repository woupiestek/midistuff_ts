export type TextEventType =
  | "text"
  | "copyright"
  | "sequence_name"
  | "instrument_name"
  | "lyrics"
  | "marker"
  | "cue_point"
  | "program_name"
  | "device_name";

export type MidiEventType =
  | "note_off"
  | "note_on"
  | "polyphonic_pressure"
  | "controller"
  | "program_change"
  | "channel_pressure"
  | "pitch_bend"
  | "sequence_number"
  | TextEventType
  | "sys_ex"
  | "escape"
  | "midi_channel_prefix"
  | "midi_port"
  | "end_of_track"
  | "tempo"
  | "smpte_offset"
  | "time_signature"
  | "key_signature"
  | "meta";

export type MidiEvent =
  | {
    type: "note_off" | "note_on";
    channel: number;
    note: number;
    velocity: number;
  }
  | {
    type: "polyphonic_pressure";
    channel: number;
    note: number;
    pressure: number;
  }
  | { type: "controller"; channel: number; controller: number; value: number }
  | { type: "program_change"; channel: number; program: number }
  | { type: "channel_pressure"; channel: number; pressure: number }
  | { type: "pitch_bend"; channel: number; value: number }
  | {
    type:
      | "sequence_number"
      | "midi_channel_prefix"
      | "midi_port"
      | "tempo"
      | "meta";
    value: number;
  }
  | {
    type: TextEventType;
    value: string;
  }
  | { type: "end_of_track" | "sys_ex" | "escape" }
  | {
    type: "smpte_offset";
    hour: number;
    minute: number;
    second: number;
    frame: number;
    centiframe: number;
  }
  | {
    type: "time_signature";
    numerator: number;
    denominator: number;
    clocks: number;
    quarterIn32nds: number;
  }
  | { type: "key_signature"; sharps: number; major: boolean }
  | { type: "meta"; subtype: number };

export type Timing =
  | {
    type: "metrical";
    ppqn: number;
  }
  | { type: "timecode"; fps: number; subdivisions: number };

export type Track = {
  wait: number;
  event: MidiEvent;
}[];

export type MidiFile = {
  format: 0 | 1 | 2;
  timing: Timing;
  tracks: Track[];
};
