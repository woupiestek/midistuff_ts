import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Element } from "./xml3.ts";

Deno.test("some simple example", () => {
  assertEquals(
    new Element("boterham").addText("pindakaas").addComment("boter")
      .addAttribute("graan", "volkoren").stringify(),
    '<boterham graan="volkoren">pindakaas<!-- boter --></boterham>',
  );
});

Deno.test("big tree", () => {
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
