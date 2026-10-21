import { readFile, writeFile } from "node:fs/promises";
import { Filer } from "./filer3.ts";
import { Parser } from "./parser3.ts";
import { Printer } from "./midiFilePrinter.ts";
import { Tokens } from "./tokens.ts";

const args = Bun.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: writer3 [source] [target]\n");
  process.exit(64);
}

const printer = new Printer();
printer.file(
  new Filer(
    new Parser(new Tokens(await readFile(args[0], "utf8"))).parse(),
  ).file,
);
await writeFile(args[1], new Uint8Array(printer.pop()));
