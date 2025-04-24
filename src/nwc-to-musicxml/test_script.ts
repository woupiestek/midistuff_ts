import { scan, Transformer } from "./simpler.ts";

const filesNames = [
  "2007-3-12",
  "2008-8-24!",
  "2009-2-20 web!",
  "2010-11-2!",
  "2011-6-30 kwint!",
  "2012-1-20 3!",
  "2015-7-27 2(!)",
  "coollove",
];

for (const fileName of filesNames) {
  const source = await Deno.readTextFile(`samples\\${fileName}.nwctxt`);
  try {
    await Deno.writeTextFile(
      `.\\target\\${fileName}.json`,
      JSON.stringify(scan(source), null, 2),
    );
    const simpler = new Transformer().transform(source).toString();
    await Deno.writeTextFile(
      `.\\target\\${fileName}.xml`,
      simpler,
    );
  } catch (e) {
    console.error("Something went wrong", e);
  }
}
