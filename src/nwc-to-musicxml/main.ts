import { Transformer } from "./transformer.ts";

const list = [];
for await (const entry of Deno.readDir(".")) {
  if (entry.name.endsWith(".nwctxt")) {
    list.push(entry.name.substring(0, entry.name.length - 7));
  }
}
console.log("selected for coversion:", list);

for (const fileName of list) {
  const source = await Deno.readTextFile(`${fileName}.nwctxt`, {});
  try {
    await Deno.writeTextFile(
      `${fileName}.xml`,
      new Transformer().transform(source),
    );
  } catch (e) {
    console.error(`Something went wrong for ${fileName}`, e);
  }
}
