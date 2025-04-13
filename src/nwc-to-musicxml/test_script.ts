import { scan } from "./simpler.ts";
import { Transformed } from "./transformer.ts";

const source = await Deno.readTextFile("samples\\2008-8-24!.nwctxt");
try {
  await Deno.writeTextFile(
    ".\\target\\scan.json",
    JSON.stringify(scan(source), null, 2),
  );
  await Deno.writeTextFile(
    ".\\target\\test.xml",
    new Transformed(source).toXML(),
  );
} catch (e) {
  console.error("Something went wrong", e);
}
