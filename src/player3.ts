import { midi } from "https://deno.land/x/deno_midi@v0.1.1/mod.ts";
import { Interpreter } from "./interpreter3.ts";
import { Parser } from "./parser3.ts";

if (Deno.args.length < 1) {
  console.error("Usage: main [path]\n");
  Deno.exit(64);
}

const data = await Deno.readFile(Deno.args[0]);
const { messages, realTime } = new Interpreter(new Parser(data).parse());
const midi_out = new midi.Output();
midi_out.openPort(0);
for (const { realTime, message } of messages) {
  setTimeout(
    () => midi_out.sendMessage(message),
    Math.floor(realTime),
  );
}
setTimeout(
  () => console.log("done"),
  Math.floor(realTime) + 250,
);
