import { scan, Transformer } from "./simpler.ts";
import { Transformed } from "./transformer.ts";

const source = await Deno.readTextFile("samples\\2008-8-24!.nwctxt");
try {
  await Deno.writeTextFile(
    ".\\target\\scan.json",
    JSON.stringify(scan(source), null, 2),
  );
  const old = new Transformed(source).toXML();
  await Deno.writeTextFile(
    ".\\target\\test.xml",
    old,
  );
  const simpler = new Transformer().transform(source).toString();
  await Deno.writeTextFile(
    ".\\target\\test2.xml",
    simpler,
  );

  for (let i = 0, l = old.length; i < l; i++) {
    if (old[i] !== simpler[i]) {
      console.log(
        `Difference at index ${i}: ${old.substring(i, i + 10)} !== ${
          simpler.substring(i, i + 10)
        }`,
      );
      break;
    }
  }
} catch (e) {
  console.error("Something went wrong", e);
}
