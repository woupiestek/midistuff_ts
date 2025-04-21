import { scan, Transformer } from "./simpler.ts";

const source = await Deno.readTextFile("samples\\2010-11-2!.nwctxt");
try {
  await Deno.writeTextFile(
    ".\\target\\scan.json",
    JSON.stringify(scan(source), null, 2),
  );
  const simpler = new Transformer().transform(source).toString();
  await Deno.writeTextFile(
    ".\\target\\test.xml",
    simpler,
  );
} catch (e) {
  console.error("Something went wrong", e);
}
