import { readFile } from "node:fs/promises";
import { Parser } from "./parser3.ts";
import { Printer } from "./printer3.ts";
import { Tokens } from "./tokens.ts";

const args = Bun.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: print [path]\n");
  process.exit(64);
}

const data = await readFile(args[0], "utf8");
const printer = new Printer();
console.log(printer.pretty(64, new Parser(new Tokens(data)).parse()));
