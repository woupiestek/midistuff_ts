import { Parser } from "./src/nwc/parser.ts";
import { Processor } from "./src/nwc/processor.ts";

const processor = new Processor(
  new Parser(await Deno.readTextFile(Deno.args[0])),
);
console.log(processor.staves());
