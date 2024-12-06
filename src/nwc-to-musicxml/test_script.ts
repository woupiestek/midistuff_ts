// import { Parser } from "./parser.ts";
// import { Scanner } from "./scanner.ts";
import { Transformed } from "./transformer.ts";

const source = await Deno.readTextFile("samples\\2008-8-24!.nwctxt");
try {
  const transformed = new Transformed(source);
  const pitch = new Set(
    transformed.data.flatMap(({ pitch }) =>
      pitch ? (pitch instanceof Array ? pitch : [pitch]) : []
    ),
  );
  console.log(pitch);
} catch (e) {
  console.error("Something went wrong", e);
}
