import { midi } from "https://deno.land/x/deno_midi@v0.1.1/mod.ts";
import { MIDI } from "./midi4.ts";
import { Parser } from "./parser4.ts";

if (Deno.args.length < 1) {
  console.error("Usage: play path");
  Deno.exit(64);
}

const data = await Deno.readTextFile(Deno.args[0]);
const { messages, realTime } = new MIDI(
  new Parser(data).parse(),
);
const midi_out = new midi.Output();
midi_out.openPort(0);
for (const { realTime, message } of messages) {
  setTimeout(() => midi_out.sendMessage(message), Math.floor(realTime));
}
setTimeout(() => console.log("done"), Math.floor(realTime) + 250);
