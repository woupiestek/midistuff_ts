import { Filer } from "./filer3.ts";
import { Parser } from "./parser3.ts";
import { Printer } from "./midiFilePrinter.ts";
import { Tokens } from "./tokens.ts";

const list = [];
for await (const entry of Deno.readDir("samples")) {
  if (entry.name.endsWith(".txt")) {
    list.push(entry.name.substring(0, entry.name.length - 4));
  }
}

for (const fileName of list) {
  try {
    console.log(`processing ${fileName}`);
    const printer = new Printer();
    printer.file(
      new Filer(
        new Parser(
          new Tokens(await Deno.readTextFile(`samples\\${fileName}.txt`)),
        ).parse(),
      ).file,
    );
    await Deno.writeFile(
      `.\\target\\${fileName}.mid`,
      new Uint8Array(printer.pop()),
    );
  } catch (e) {
    console.error("Something went wrong", e);
  }
}
