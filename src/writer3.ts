import { Filer } from "./filer3.ts";
import { Parser } from "./parser3.ts";
import { Printer } from "./midiFIlePrinter.ts";
if (Deno.args.length < 2) {
  console.error("Usage: writer3 [soruce] [target]\n");
  Deno.exit(64);
}

const printer = new Printer();
printer.file(
  new Filer(new Parser(await Deno.readFile(Deno.args[0])).parse()).file,
);
await Deno.writeFile(Deno.args[1], new Uint8Array(printer.pop()));
