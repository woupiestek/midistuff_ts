import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Interpreter } from "./interpreter3.ts";
import { Parser } from "./parser3.ts";

const textEncoder = new TextEncoder();

Deno.test(function simpleMelodie() {
  const messages = new Interpreter(
    new Parser(textEncoder.encode("[ 0;.2 1;.4 2;.4 0;.4 r;.2 ]")).parse(),
  ).messages;
  assertEquals(messages.length, 8);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 4);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 4);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 4);
});

Deno.test(function simpleChord() {
  const messages = new Interpreter(
    new Parser(textEncoder.encode("[ 0 ;.8, 2- ;.8, 4 ;.4 ]")).parse(),
  ).messages;
  assertEquals(messages.length, 6);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 3);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 3);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 2);
});

Deno.test(function simpleRepeat() {
  const messages = new Interpreter(
    new Parser(textEncoder.encode("[$C = 0;.4 $C]")).parse(),
  ).messages;
  assertEquals(messages.length, 4);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 2);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 2);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 4);
});

Deno.test(function simpleProgram() {
  const messages = new Interpreter(
    new Parser(
      textEncoder.encode("\\program 64 [ 0;.2 1;.4 2;.4 0;.4 r;.2 ]"),
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
        "\\tempo 1667 \\key 3 \\dyn fff [ 0;.2 1;.4 2;.4 0;.4 r;.2 ]",
      ),
    ).parse(),
  ).messages;
  assertEquals(messages.length, 8);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 4);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 4);
  assertEquals(messages.filter((it) => it.message[1] === 61).length, 4);
  assertEquals(messages.filter((it) => it.message[2] === 113).length, 8);
});

Deno.test(function otherParamsChange() {
  const messages = new Interpreter(new Parser(textEncoder.encode(
    "\\tempo 1500 \\dyn f [\n" +
      "$A = [0;.2 1;.4 2;.4 0;.4 r;.2] $A\n" +
      "$B = [2;.2 3;.4 4;.8 r;.2] $B\n" +
      "% this was a puzzle to get right!\n" +
      "$C = [4;.2 5;.1 4;.2 3;.1 2;.4 0;.4 r;.2] $C\n" +
      "$D = [0;.2 -3;.4 0;.8 r;.2] $D\n]",
  )).parse()).messages;
  assertEquals(messages.length, 64);
  assertEquals(messages.filter((it) => it.message[0] === 128).length, 32);
  assertEquals(messages.filter((it) => it.message[0] === 144).length, 32);
  assertEquals(messages.filter((it) => it.message[1] === 60).length, 20);
  assertEquals(messages.filter((it) => it.message[2] === 85).length, 64);
});
