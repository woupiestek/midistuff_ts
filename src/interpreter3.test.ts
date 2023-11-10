import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Interpreter } from "./interpreter3.ts";
import { Parser } from "./parser3.ts";

const textEncoder = new TextEncoder();

Deno.test(function simpleMelody() {
  const messages = new Interpreter(
    new Parser(textEncoder.encode("[ _.2 0 _.4 1 _.4 2 _.4 0 _.2 r ]")).parse(),
  ).messages;
  assertEquals(messages.length, 8);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 4);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 4);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 4);
});

Deno.test(function durations() {
  assertEquals(
    new Interpreter(
      new Parser(textEncoder.encode("_.d[0]")).parse(),
    ).realTime,
    1625,
  );
  assertEquals(
    new Interpreter(
      new Parser(textEncoder.encode("[_.d 0]")).parse(),
    ).realTime,
    1625,
  );
});

Deno.test(function simpleChord() {
  const messages = new Interpreter(
    new Parser(textEncoder.encode("_.8[ 0, 2-, 4 ]")).parse(),
  ).messages;
  assertEquals(messages.length, 6);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 3);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 3);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 2);
});

Deno.test(function simpleRepeat() {
  const messages = new Interpreter(
    new Parser(textEncoder.encode("[$C = _.4 0 $C]")).parse(),
  ).messages;
  assertEquals(messages.length, 4);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 2);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 2);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 4);
});

Deno.test(function simpleProgram() {
  const messages = new Interpreter(
    new Parser(
      textEncoder.encode("program_64 [ _.2 0 _.4 1 _.4 2 _.4 0 _.2 r ]"),
    ).parse(),
  ).messages;
  assertEquals(messages.length, 9);
  assertEquals(messages[0].message[0], 0xc0);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 4);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 4);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 4);
});

Deno.test(function otherParamsChange() {
  const messages = new Interpreter(
    new Parser(
      textEncoder.encode(
        "vivace key 3 fff [ _.2 0 1 2 0 _.2 r ]",
      ),
    ).parse(),
  ).messages;
  assertEquals(messages.length, 8);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 4);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 4);
  assertEquals(messages.filter((it) => it.message[1] === 61).length, 4);
  assertEquals(messages.filter((it) => it.message[2] === 113).length, 8);
});

Deno.test(function jacob() {
  const messages = new Interpreter(new Parser(textEncoder.encode(
    "allegro f [\n" +
      "$A = [_.2 0 1 2 0 _.2 r] $A\n" +
      "$B = [_.2 2 3 _.8 4 _.2 r] $B\n" +
      "% this was a puzzle to get right!\n" +
      "$C = _.2[4 _.1 5 4 _.1 3 _.4 2 _.4 0 r] $C\n" +
      "$D = [_.2 0 -3 _.8 0 _.2 r] $D\n]",
  )).parse()).messages;
  assertEquals(messages.length, 64);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 32);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 32);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 20);
  assertEquals(messages.filter((it) => it.message[2] === 85).length, 64);
});
