import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { midiToPyth } from "./pythagorean.ts";

Deno.test(function midiToPythLimits() {
  // b
  assertEquals(midiToPyth(59), { wholes: 25, halves: 9 });
  // c
  assertEquals(midiToPyth(60), { wholes: 25, halves: 10 });
  // f
  assertEquals(midiToPyth(65), { wholes: 27, halves: 11 });
  // g sharp
  assertEquals(midiToPyth(68), { wholes: 29, halves: 10 });
});
