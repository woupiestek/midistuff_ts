import { test } from "bun:test";
import { deepStrictEqual as assertEquals } from "node:assert";
import { Pyth } from "./pythagorean.ts";

test("fromMidiLimits", function fromMidiLimits() {
  // b
  assertEquals(Pyth.fromMidi(59), new Pyth(25, 9));
  // c
  assertEquals(Pyth.fromMidi(60), new Pyth(25, 10));
  // e flat
  assertEquals(Pyth.fromMidi(63), new Pyth(26, 11));
  // f
  assertEquals(Pyth.fromMidi(65), new Pyth(27, 11));
  // g sharp
  assertEquals(Pyth.fromMidi(68), new Pyth(29, 10));
});

test("fromMidiAndBack", function fromMidiAndBack() {
  for (let tone = 60; tone < 72; tone++) {
    assertEquals(tone, Pyth.fromMidi(tone).toMidi());
  }
});

test("fromPitchAndBack", function fromPitchAndBack() {
  for (let key = -4; key <= 4; key++) {
    for (let degree = -12; degree <= 12; degree++) {
      for (let alter = -1; alter <= 1; alter++) {
        assertEquals(Pyth.fromPitch(key, degree, alter).toPitch(key), {
          degree,
          alter,
        });
      }
    }
  }
});

test("toPitch", function toPitch() {
  assertEquals(new Pyth(0, 0).toPitch(-6), { degree: 0, alter: 1 });
  assertEquals(new Pyth(0, 0).toPitch(0), { degree: 0, alter: 0 });
  assertEquals(new Pyth(0, 0).toPitch(2), { degree: 0, alter: -1 });
  assertEquals(new Pyth(0, -1).toPitch(-1), { degree: -1, alter: 1 });
  assertEquals(new Pyth(0, -1).toPitch(0), { degree: -1, alter: 0 });
  assertEquals(new Pyth(0, -1).toPitch(7), { degree: -1, alter: -1 });
});
