import { MidiPlanner } from "./midi3.ts";
import {
  MessageType,
  MetaType,
  MidiEvent,
  MidiFile,
  Track,
} from "./midiTypes.ts";
import { AST } from "./parser3.ts";

export class Filer {
  static PPWN = 384;
  file: MidiFile;
  time: number;
  constructor(ast: AST) {
    const planner = new MidiPlanner(ast);
    this.time = planner.time * Filer.PPWN;
    this.file = Filer.#process(planner);
  }

  static #differentiate(t: { time: number; event: MidiEvent }[]): Track {
    const track: Track = [];
    let lastTime = 0;
    for (const { time, event } of t) {
      track.push({ wait: (Filer.PPWN * (time - lastTime)) | 0, event });
      lastTime = time;
    }
    return track;
  }

  static #process(planner: MidiPlanner): MidiFile {
    const track0: { time: number; event: MidiEvent }[] = [];
    const track1: { time: number; event: MidiEvent }[] = [];
    for (const message of planner.messages) {
      if (message.event === null) continue;
      if (message.event.type === MessageType.meta) {
        track0.push(message);
      } else {
        track1.push(message);
      }
    }
    const EOT: { time: number; event: MidiEvent } = {
      time: planner.time,
      event: {
        type: MessageType.meta,
        metaType: MetaType.endOfTrack,
      },
    };
    track0.push(EOT);
    track1.push(EOT);
    return {
      format: 1,
      timing: {
        type: "metrical",
        ppqn: Filer.PPWN / 4,
      },
      tracks: [this.#differentiate(track0), this.#differentiate(track1)],
    };
  }
}
