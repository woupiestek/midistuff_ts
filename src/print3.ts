import { Parser } from "./parser3.ts";
import { Printer } from "./printer3.ts";

if (Deno.args.length < 1) {
  console.error("Usage: print [path]\n");
  Deno.exit(64);
}

const data = await Deno.readFile(Deno.args[0]);
const printer = new Printer();
printer.file(new Parser(data).parse());
console.log(printer.pop());
