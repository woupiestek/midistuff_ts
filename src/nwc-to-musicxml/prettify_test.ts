import { readFile } from "node:fs/promises";
import { indent } from "./xml.ts";

try {
  const source = await readFile("./target/vocalacc.xml", "utf8");
  //await writeFile(
  //  ".\\target\\Zonder titel.musicxml",
  indent(source).forEach((line) => console.log(line));
  //  );
} catch (e) {
  console.error("Something went wrong", e);
}
