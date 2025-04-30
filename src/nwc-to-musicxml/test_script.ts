import { scan, Transformer } from "./simpler.ts";

const list = [];
for await (const entry of Deno.readDir("samples")) {
  if (entry.name.endsWith(".nwctxt")) {
    list.push(entry.name.substring(0, entry.name.length - 7));
  }
}

for (const fileName of list) {
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
