import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Filer } from "./filer3.ts";
import { Parser } from "./parser3.ts";
import { Printer } from "./midiFilePrinter.ts";
import { Tokens } from "./tokens.ts";

const list = [];
for (const name of await readdir("samples")) {
  if (name.endsWith(".txt")) {
    list.push(name.substring(0, name.length - 4));
  }
}

for (const fileName of list) {
  try {
    console.log(`processing ${fileName}`);
    const printer = new Printer();
    printer.file(
      new Filer(
        new Parser(
          new Tokens(await readFile(join("samples", `${fileName}.txt`), "utf8")),
        ).parse(),
      ).file,
    );
    await writeFile(
      join("target", `${fileName}.mid`),
      new Uint8Array(printer.pop()),
    );
  } catch (e) {
    console.error("Something went wrong", e);
  }
}
