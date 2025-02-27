import { Transformed } from "./transformer.ts";

const source = await Deno.readTextFile("samples\\2008-8-24!.nwctxt");
try {
  const transformed = new Transformed(source);
  await Deno.writeTextFile(".\\target\\test.xml", transformed.toXML());
} catch (e) {
  console.error("Something went wrong", e);
}
