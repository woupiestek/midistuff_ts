import { Scanner } from "./src/midiFileReader.ts";

if (Deno.args.length === 0) {
  console.error("Usage: main [path]\n");
  Deno.exit(64);
}

const data = await Deno.readFile(Deno.args[0]);
const scanner = new Scanner(data);

console.log(scanner.file());
