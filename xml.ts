import { parse } from "https://deno.land/x/xml/mod.ts";

if (Deno.args.length < 1) {
  console.error("Usage: main [path]\n");
  Deno.exit(64);
}

const x = await Deno.readTextFile(Deno.args[0]);
console.log(parse(x));
