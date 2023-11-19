import { Printer } from "./src/midiFilePrinter.ts";
import { Scanner } from "./src/midiFileScanner.ts";
import { transform1 } from "./src/transformations.ts";
import { midi } from "https://deno.land/x/deno_midi/mod.ts";

if (Deno.args.length < 1) {
  console.error("Usage: main [path]\n");
  Deno.exit(64);
}

const data = await Deno.readFile(Deno.args[0]);
const scanner = new Scanner(data);
const file = scanner.file();
const messages = transform1(file);
const midi_out = new midi.Output();
midi_out.openPort(0);

const RATE = 23;
for (const { realTime, message } of messages) {
  setTimeout(
    () => midi_out.sendMessage(message),
    (Math.floor((realTime * RATE) / 1000) * 1000) / RATE,
  );
}

const printer = new Printer();
printer.file(file);
const data2 = new Uint8Array(printer.pop());
new Scanner(data2).file();
await Deno.writeFile("test.mid", data2);
