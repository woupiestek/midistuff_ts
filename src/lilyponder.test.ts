import { Lilyponder } from "./lilyponder.ts";
import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";

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
