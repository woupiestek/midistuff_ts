import { MessageType, MetaType, MidiFile } from "./midiTypes.ts";

export function transform1({ timing, tracks }: MidiFile) {
  const content = [];

  // put events in one 'track' and count the number of pulses since start.
  for (let track = 0; track < tracks.length; track++) {
    let pulse = 0;
    for (const { wait, event } of tracks[track]) {
      pulse += wait;
      if (event !== null) {
        content.push({
          event,
          pulse,
        });
      }
    }
  }
  content.sort((x, y) => x.pulse - y.pulse);

  if (timing.type === "timecode") {
    // todo: figure out later how this works
    // return { format, timing, content };
    return [];
  }

  const { ppqn } = timing;
  let tempo = 5e5;
  let realTime = 0;
  let pulse = 0;

  const result = [];
  for (const pair of content) {
    const diff = pair.pulse - pulse;
    pulse = pair.pulse;
    realTime += (tempo * diff) / (1000 * ppqn);
    switch (pair.event.type) {
      case MessageType.noteOff:
      case MessageType.noteOn:
        result.push({
          realTime,
          message: [
            (pair.event.type << 4) + pair.event.channel,
            pair.event.note,
            pair.event.velocity,
          ],
        });
        break;
      case MessageType.polyphonicPressure:
        result.push({
          realTime,
          message: [
            (pair.event.type << 4) + pair.event.channel,
            pair.event.note,
            pair.event.pressure,
          ],
        });
        break;
      case MessageType.controller:
        result.push({
          realTime,
          message: [
            (pair.event.type << 4) + pair.event.channel,
            pair.event.controller,
            pair.event.value,
          ],
        });
        break;
      case MessageType.programChange:
        result.push({
          realTime,
          message: [
            (pair.event.type << 4) + pair.event.channel,
            pair.event.program,
          ],
        });
        break;
      case MessageType.channelPressure:
        result.push({
          realTime,
          message: [
            (pair.event.type << 4) + pair.event.channel,
            pair.event.pressure,
          ],
        });
        break;
      case MessageType.pitchBend:
        result.push({
          realTime,
          message: [
            (pair.event.type << 4) + pair.event.channel,
            0x7f & pair.event.value,
            (pair.event.value >> 7) + 0x40,
          ],
        });
        break;
      case MessageType.meta:
        if (pair.event.metaType === MetaType.tempo) {
          tempo = pair.event.value;
        }
    }
  }
  return result;
}
