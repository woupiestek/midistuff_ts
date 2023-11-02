export type TextEventType =
  | MetaType.text
  | MetaType.copyright
  | MetaType.sequenceName
  | MetaType.instrumentName
  | MetaType.lyrics
  | MetaType.marker
  | MetaType.cuePoint
  | MetaType.programName
  | MetaType.deviceName;

export enum MessageType {
  noteOff = 8,
  noteOn,
  polyphonicPressure,
  controller,
  programChange,
  channelPressure,
  pitchBend,
  meta,
}

export enum MetaType {
  sequenceNumber,
  text,
  copyright,
  sequenceName,
  instrumentName,
  lyrics,
  marker,
  cuePoint,
  programName,
  deviceName,
  midiChannelPrefix = 0x20,
  midiPort,
  endOfTrack = 0x2f,
  tempo = 0x51,
  smpteOffset = 0x54,
  timeSignature = 0x58,
  keySignature,
}

export type MidiEvent =
  | {
    type: MessageType.noteOff | MessageType.noteOn;
    channel: number;
    note: number;
    velocity: number;
  }
  | {
    type: MessageType.polyphonicPressure;
    channel: number;
    note: number;
    pressure: number;
  }
  | {
    type: MessageType.controller;
    channel: number;
    controller: number;
    value: number;
  }
  | { type: MessageType.programChange; channel: number; program: number }
  | { type: MessageType.channelPressure; channel: number; pressure: number }
  | { type: MessageType.pitchBend; channel: number; value: number }
  | MetaEvent
  | null;

export type MetaEvent =
  | {
    type: MessageType.meta;
    metaType:
      | MetaType.sequenceNumber
      | MetaType.midiChannelPrefix
      | MetaType.midiPort
      | MetaType.tempo;
    value: number;
  }
  | {
    type: MessageType.meta;
    metaType: TextEventType;
    value: string;
  }
  | {
    type: MessageType.meta;
    metaType: MetaType.endOfTrack;
  }
  | {
    type: MessageType.meta;
    metaType: MetaType.smpteOffset;
    hour: number;
    minute: number;
    second: number;
    frame: number;
    centiframe: number;
  }
  | {
    type: MessageType.meta;
    metaType: MetaType.timeSignature;
    numerator: number;
    denominator: number;
    clocks: number;
    quarterIn32nds: number;
  }
  | {
    type: MessageType.meta;
    metaType: MetaType.keySignature;
    sharps: number;
    major: boolean;
  };

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
