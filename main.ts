import { Scanner } from "./src/midiFileScanner.ts";
import { transform1 } from "./src/transformations.ts";

if (Deno.args.length === 0) {
  console.error("Usage: main [path]\n");
  Deno.exit(64);
}

const data = await Deno.readFile(Deno.args[0]);
const scanner = new Scanner(data);

console.log(transform1(scanner.file()));
