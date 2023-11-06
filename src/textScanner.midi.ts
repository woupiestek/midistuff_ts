import { midi } from "https://deno.land/x/deno_midi@v0.1.1/mod.ts";
import { messages, TextScanner } from "./textScanner.ts";

const SCORE = "\\f c3;.2 d3;.4 e3;.4 c3;.4 r.2 c3;.2 d3;.4 e3;.4 c3;.4 r.2 " +
  "e3;.2 f3;.4 g3;.8 r.2 e3;.2 f3;.4 g3;.8 r.2 " +
  "g3;.2 a3;.1 g3;.2 f3;.1 e3;.4 c3;.4 r.2 g3;.2 a3;.1 g3;.2 f3;.1 e3;.4 c3;.4 r.2 " +
  "c3;.2 g2;.4 c3;.8 r.2 c3;.2 g2;.4 c3;.8 r.2 ";

const textEncoder = new TextEncoder();

const scanner = new TextScanner(textEncoder.encode(SCORE));
const tokens = [];
while (!scanner.done()) {
  tokens.push(scanner.next());
}

const midi_out = new midi.Output();
midi_out.openPort(0);
for (const { realTime, message } of messages(tokens)) {
  setTimeout(() => midi_out.sendMessage(message), realTime);
}
