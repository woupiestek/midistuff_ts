import { midi } from "https://deno.land/x/deno_midi/mod.ts";

console.log(midi.getVersion()); // Should print 6.0.0
const midi_out = new midi.Output();
console.log(midi_out.getPorts());

midi_out.openPort(0);

// Send a note on.
midi_out.sendMessage([0x90, 0x3C, 0x7F]);
// Can also be sent with a helper class for better readability.
midi_out.sendMessage(new midi.NoteOn({ note: 0x3C, velocity: 0x7F }));
// Send a note off after 1 second.
setTimeout(() => {
  midi_out.sendMessage([0x80, 0x3C, 0x2F]);
  midi_out.sendMessage(new midi.NoteOff({ note: 0x3C, velocity: 0x7F }));
}, 1000);

console.log(...Object.keys(midi));