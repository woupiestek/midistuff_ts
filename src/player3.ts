import { midi } from "https://deno.land/x/deno_midi@v0.1.1/mod.ts";
import { Interpreter } from "./interpreter3.ts";
import { Parser } from "./parser3.ts";
import { Tokens } from "./tokens.ts";

if (Deno.args.length < 1) {
  console.error("Usage: play path [from] [to]\n");
  Deno.exit(64);
}

const from = Deno.args[1] ? Number.parseInt(Deno.args[1], 10) : 0;
const to = Deno.args[2] ? Number.parseInt(Deno.args[2], 10) : 1000;

const data = await Deno.readTextFile(Deno.args[0]);
const { messages, realTime } = new Interpreter(
  new Parser(new Tokens(data)).parse(),
  from,
  to,
);
const midi_out = new midi.Output();
midi_out.openPort(0);
for (const { realTime, message } of messages) {
  setTimeout(() => midi_out.sendMessage(message), Math.floor(realTime));
}
setTimeout(() => console.log("done"), Math.floor(realTime) + 250);
