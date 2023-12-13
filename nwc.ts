import { Parser } from "./src/nwc/parser.ts";
import { fullAST, Processor } from "./src/nwc/processor.ts";
import { Printer } from "./src/printer3.ts";

const processor = new Processor(
  new Parser(await Deno.readTextFile(Deno.args[0])),
);

const printer = new Printer();
console.log(printer.pretty(64, fullAST(processor.staves())));
