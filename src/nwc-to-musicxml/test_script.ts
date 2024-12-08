// import { Parser } from "./parser.ts";
// import { Scanner } from "./scanner.ts";
import { Transformed } from "./transformer.ts";

const source = await Deno.readTextFile("samples\\2008-8-24!.nwctxt");
try {
  const transformed = new Transformed(source);
  const dur = new Set(
    transformed.data.flatMap(({ dur }) =>
      dur ? (dur instanceof Array ? dur : [dur]) : []
    ),
  );
  console.log(dur);
  console.log(transformed);
} catch (e) {
  console.error("Something went wrong", e);
}
