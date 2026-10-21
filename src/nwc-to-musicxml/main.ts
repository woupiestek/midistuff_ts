import { readdir, readFile, writeFile } from "node:fs/promises";
import { parse } from "node:path";
import { Transformer } from "./transformer.ts";

const list = [];
for (const name of await readdir(".")) {
  if (name.endsWith(".nwctxt")) {
    list.push(parse(name).name);
  }
}
console.log("selected for coversion:", list);

for (const fileName of list) {
  const source = await readFile(`${fileName}.nwctxt`, "utf8");
  try {
    await writeFile(
      `${fileName}.xml`,
      new Transformer().transform(source),
    );
  } catch (e) {
    console.error(`Something went wrong for ${fileName}`, e);
  }
}
