import { Parser } from "./parser.ts";
import { Scanner } from "./scanner.ts";

const parser = new Parser(
  new Scanner(
    await Deno.readTextFile("samples\\2008-8-24!.nwctxt"),
  ),
);
try {
  console.info(parser.result());
} catch (e) {
  console.error("Something went wrong", parser, e);
}
