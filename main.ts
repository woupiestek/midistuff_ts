import { Printer } from "./src/midiFIlePrinter.ts";
import { Scanner } from "./src/midiFileScanner.ts";
// import { transform1 } from "./src/transformations.ts";

if (Deno.args.length < 1) {
  console.error("Usage: main [path]\n");
  Deno.exit(64);
}

const data = await Deno.readFile(Deno.args[0]);
const scanner = new Scanner(data);
const file = scanner.file();
const printer = new Printer();
printer.file(file);
const data2 = new Uint8Array(printer.pop());
const file2 = new Scanner(data2).file();
console.log(file, file2);
await Deno.writeFile("test.mid", data2);
