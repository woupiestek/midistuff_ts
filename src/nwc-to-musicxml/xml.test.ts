import { test } from "bun:test";
import { deepStrictEqual as assertEquals } from "node:assert";
import { Element } from "./xml.ts";

test("some simple example", () => {
  assertEquals(
    new Element("boterham").addText("pindakaas").addComment("boter")
      .addAttribute("graan", "volkoren").stringify(),
    '<boterham graan="volkoren">pindakaas<!--boter--></boterham>',
  );
});

test("big tree", () => {
  let node = new Element("leaf");
  const chars = Array(128).keys().map((i) => String.fromCharCode(i)).filter(
    (ch) => /[!-~]/.test(ch),
  ).toArray().join("");
  for (let i = 0; i < 10; i++) {
    node = new Element(chars[i % chars.length])
      .addAttribute(chars[(i ^ 0x55) % chars.length], "" + i)
      .addElements(node, node);
  }
  assertEquals(
    node.stringify().length,
    23235,
  );
});
