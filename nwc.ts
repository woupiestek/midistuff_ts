import { Parser } from "./src/nwc/parser.ts";
import { Processor } from "./src/nwc/processor.ts";
import { Scanner } from "./src/nwc/scanner.ts";
import { unique } from "./src/util.ts";

const { output } = new Parser(await Deno.readTextFile(Deno.args[0]));

const klz = [];
const pos = [];
const dur = [];

for (const row of output) {
  klz.push(row.class);
  if (row.fields.Pos) pos.push(...row.fields.Pos);
  if (row.fields.Dur) dur.push(row.fields.Dur.join(","));
}

console.log(klz.sort().filter(unique));
console.log(pos.sort().filter(unique));
console.log(dur.sort().filter(unique));

const processor = new Processor();
output.forEach((it) => processor.push(it));
console.log(processor.output);
// console.log(new Scanner(await Deno.readTextFile(Deno.args[0])).next());
