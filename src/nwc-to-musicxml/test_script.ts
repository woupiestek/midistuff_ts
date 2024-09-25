import { Parser } from "./parser.ts";
import { Scanner } from "./scanner.ts";
import { transform } from "./transformer.ts";

const source = await Deno.readTextFile("samples\\2008-8-24!.nwctxt");
try {
  transform(source);
} catch (e) {
  console.error("Something went wrong", e);
}
