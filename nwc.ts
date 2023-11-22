import { Parser } from "./src/nwc/parser.ts";
import { Scanner } from "./src/nwc/scanner.ts";

console.log(new Parser(await Deno.readTextFile(Deno.args[0])).output);
// console.log(new Scanner(await Deno.readTextFile(Deno.args[0])).next());
