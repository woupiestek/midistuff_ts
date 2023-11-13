import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { XMLPrinter } from "./xmlPrinter.ts";

Deno.test(function testPitches() {
  assertEquals(XMLPrinter.pitch(0, 0, 0), {
    alter: 0,
    step: "C",
    octave: 4,
  });
  assertEquals(XMLPrinter.pitch(2, 0, 0), {
    alter: 1,
    step: "C",
    octave: 4,
  });
  assertEquals(XMLPrinter.pitch(7, 0, 0), {
    alter: 1,
    step: "C",
    octave: 4,
  });
  assertEquals(XMLPrinter.pitch(2, 3, 0), {
    alter: 1,
    step: "F",
    octave: 4,
  });
  assertEquals(XMLPrinter.pitch(2, 4, 0), {
    alter: 0,
    step: "G",
    octave: 4,
  });
  assertEquals(XMLPrinter.pitch(2, -25, 0), {
    alter: 1,
    step: "F",
    octave: 0,
  });
});
