import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { MIDI } from "./midi4.ts";
import { Parser } from "./parser4.ts";

Deno.test(function simpleMelody() {
  const messages = new MIDI(
    new Parser("[ _/8 0 _/4 1 _/4 2 _/4 0 _/8 r ]").parse(),
  ).messages;
  assertEquals(messages.length, 8);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 4);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 4);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 4);
});

Deno.test(function durations() {
  assertEquals(
    new MIDI(new Parser("_13/16[0]").parse()).realTime,
    1625,
  );
  assertEquals(
    new MIDI(new Parser("[_13/16 0]").parse()).realTime,
    1625,
  );
});

Deno.test(function simpleChord() {
  const messages = new MIDI(new Parser("_/2{ 0 2- 4 }").parse()).messages;
  assertEquals(messages.length, 6);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 3);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 3);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 2);
});

Deno.test(function simpleRepeat() {
  const messages = new MIDI(new Parser("[$C = _/4 0 $C]").parse()).messages;
  assertEquals(messages.length, 4);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 2);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 2);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 4);
});

Deno.test(function simpleProgram() {
  const messages = new MIDI(
    new Parser("['program_64' _/8 0 _/4 1 _/4 2 _/4 0 _/8 r ]").parse(),
  ).messages;
  assertEquals(messages.length, 9);
  assertEquals(messages[0].message[0], 0xc0);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 4);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 4);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 4);
});

Deno.test(function otherParamsChange() {
  const messages = new MIDI(
    new Parser("key 3 ['vivace' 'fff' _/8 0 1 2 0 _/8 r ]").parse(),
  ).messages;
  assertEquals(messages.length, 8);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 4);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 4);
  assertEquals(messages.filter((it) => it.message[1] === 61).length, 4);
  assertEquals(messages.filter((it) => it.message[2] === 113).length, 8);
});

// trouble here
Deno.test(function jacob() {
  const messages = new MIDI(
    new Parser(
      "['allegro' 'f' \n" +
        "$A = [_/8 0 1 2 0 _/8 r] $A\n" +
        "$B = [_/8 2 3 _/2 4 _/8 r] $B\n" +
        "% this was a puzzle to get right!\n" +
        "$C = _/8[4 _/16 5 4 _/16 3 _/4 2 _/4 0 r] $C\n" +
        "$D = [_/8 0 -3 _/2 0 _/8 r] $D\n]",
    ).parse(),
  ).messages;
  assertEquals(messages.length, 64);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 32);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 32);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 20);
  assertEquals(messages.filter((it) => it.message[2] === 85).length, 64);
});
