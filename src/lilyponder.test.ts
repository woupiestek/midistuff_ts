import { FourFourSplitter, Lilyponder } from "./lilyponder.ts";
import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Ratio } from "./util.ts";

Deno.test(function durations() {
  const expected = [
    ["16"],
    ["8"],
    ["8."],
    ["4"],
    ["4~", "16"],
    ["4."],
    ["4.."],
    ["2"],
    ["2~", "16"],
    ["2~", "8"],
    ["2~", "8."],
    ["2."],
    ["2.~", "16"],
    ["2.."],
    ["2..."],
    ["1"],
  ];
  const actual = [];
  for (let i = 1; i <= 16; i++) {
    actual.push(Lilyponder.duration(i, 16));
  }
  assertEquals(actual, expected);
});

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
