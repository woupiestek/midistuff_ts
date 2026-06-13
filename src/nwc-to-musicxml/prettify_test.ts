import { indent } from "./xml.ts";

try {
  const source = await Deno.readTextFile(".\\target\\vocalacc.xml");
  //await Deno.writeTextFile(
  //  ".\\target\\Zonder titel.musicxml",
  indent(source).forEach((line) => console.log(line));
  //  );
} catch (e) {
  console.error("Something went wrong", e);
}
