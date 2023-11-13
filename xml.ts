import { stringify } from "https://deno.land/x/xml/mod.ts";
import { XMLPrinter } from "./src/xmlPrinter.ts";

const printer = new XMLPrinter();

console.log(stringify(printer.pop()));
