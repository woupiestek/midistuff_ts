import { FourFourSplitter, Lilyponder } from "./lilyponder.ts";
import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Ratio } from "./util.ts";
import { Transformer } from "./transformer.ts";
import { Parser } from "./parser3.ts";

Deno.test(function durationsInContext() {
  const expected = [
    ["16"],
    ["8"],
    ["8."],
    ["4"],
    ["4", "16"],
    ["4."],
    ["4.."],
    ["2"],
    ["2", "16"],
    ["2", "8"],
    ["2", "8."],
    ["2."],
    ["2.", "16"],
    ["2.."],
    ["2..."],
    ["1"],
  ];
  const actual = [];
  const fourFourSplitter = new FourFourSplitter();
  for (let i = 1; i <= 16; i++) {
    fourFourSplitter.set(Ratio.int(0), new Ratio(i, 16));
    actual.push([...fourFourSplitter.get()]);
  }
  assertEquals(actual, expected);

  actual.length = 0;
  for (let i = 0; i < 16; i++) {
    fourFourSplitter.set(new Ratio(i, 16), Ratio.int(1));
    actual.push([...fourFourSplitter.get()]);
  }
  const expected2 = expected.map((it) => it.toReversed()).reverse();
  assertEquals(actual, expected2);

  actual.length = 0;
  for (let i = 0; i < 16; i++) {
    fourFourSplitter.set(new Ratio(1 + 2 * i, 16), new Ratio(64 - 2 * i, 16));
    actual.push([...fourFourSplitter.get()]);
  }

  const expected3 = [
    ["2...", "1", "1", "1"],
    ["16", "2.", "1", "1", "2.."],
    ["8.", "2", "1", "1", "2."],
    ["16", "2", "1", "1", "2", "8"],
    ["4..", "1", "1", "2"],
    ["16", "4", "1", "1", "4."],
    ["8.", "1", "1", "4"],
    ["16", "1", "1", "8"],
    ["2...", "1"],
    ["16", "2.", "2.."],
    ["8.", "2", "2."],
    ["16", "2", "2", "8"],
    ["4..", "2"],
    ["16", "4", "4."],
    ["8.", "4"],
    ["16", "8"],
  ];

  assertEquals(actual, expected3);
});

const transformer = new Transformer();
const lilyponder = new Lilyponder();
Deno.test(function simpleExample() {
  assertEquals(Ratio.int(0).compare(Ratio.int(1)), -1);
  const sample = "['treble' 0 1 2 0 ]";
  const result = lilyponder.process(
    transformer.transform(new Parser(sample).parse()),
  );
  assertEquals(result, "<<{c'4 d'4 e'4 c'4}>>");
});
