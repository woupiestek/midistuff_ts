export function transform1({ format, timing, tracks }) {
  const content = [];

  for (let track = 0; track < tracks.length; track++) {
    let time = 0;
    for (const { wait, event } of tracks[track]) {
      time += wait;

      if (event.type === "copyright") {
        content.push(event);
        continue;
      }

      if (
        [
          "marker",
          "cue_point",
          "tempo",
          "key_signature",
        ].includes(event.type)
      ) {
        content.push({
          ...event,
          time,
        });
        continue;
      }

      if (
        [
          "sequence_number",
          "sequence_name",
          "device_name",
          "end_of_track",
          "smpte_offset",
        ].includes(event.type)
      ) {
        content.push({
          ...event,
          track,
        });
        continue;
      }

      content.push({
        ...event,
        time,
        track,
      });
    }
  }

  return { format, timing, content };
}
