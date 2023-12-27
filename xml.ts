import { stringify } from "https://deno.land/x/xml/mod.ts";
import { XMLPrinter } from "./src/xmlPrinter.ts";
import { Parser } from "./src/parser3.ts";

const sample = `key 1 "allegro" "f" _/8[
  A = {[
    4 1 5 6 1 5 4 {0+ 3} {0 5} _/4 3 _5/8 3
    5 1 6 7 2 6 5 {2- 4} {1 6} _/4 4 _5/8 4
    4 1 5 6 1 5 4 2 4 _/4 2 _5/8 2]
    [_ {-3 -1} -2 -6 -1 0 -6 -1 -2 {-3 -6}
    _ {-4 0} -3 -6 -2 -1 -6 -2 -3 {-4 -6}
    _ {-3 -1} -2 -7 -1 0 -7 -1 -2 {-7+ -3}]
  }
  {
    [3 1 4 5 0+ 4 3 {0+ 2} _/2 {0 1} _/2 {0 3}]
    [-2 -6 -1 0 -5 -1 -2 -5+ _/2 {-4 -2} _/2 {-6 -2+}]
  }
  A
  {
    [3 1 4 5 1 4 3 1 _ {1 4}]
    [-2 -6 -1 0 -5 -1 -2 -4 _ {-3 -1}]
  }
],
{ "bpm" = 140 }`;

const ast = new Parser(sample).parse();

const printer = new XMLPrinter();
console.log(stringify(printer.transform(ast)));
