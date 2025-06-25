import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { XML } from "./xml2.ts";

Deno.test("some simple example", () => {
  const xml = new XML();

  const boterham = xml.element("boterham");
  const pindakaas = xml.text("pindakaas");
  const boter = xml.comment("boter");
  xml.insertInto(boterham, boter);
  xml.insertInto(boterham, pindakaas);
  const graan = xml.attribute("graan", "volkoren");
  xml.insertInto(boterham, graan);

  assertEquals(
    xml.stringify(),
    '<boterham graan="volkoren">pindakaas<!-- boter --></boterham>',
  );
});

Deno.test("big tree", () => {
  const xml = new XML();
  const nodes = [];
  const chars = Array(128).keys().map((i) => String.fromCharCode(i)).filter(
    (ch) => /[!-~]/.test(ch),
  ).toArray().join("");
  for (let i = 0; i < 1000; i++) {
    nodes[i] = xml.element(chars[i % chars.length]);
    xml.insertInto(
      nodes[i],
      xml.attribute(chars[(i ^ 0x55) % chars.length], "" + i),
    );
    xml.insertInto(nodes[i >> 1], nodes[i]);
  }
  const string = xml.stringify();
  assertEquals(
    string.length,
    13945,
  );
});
