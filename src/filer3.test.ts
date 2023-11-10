import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Filer } from "./filer3.ts";
import { Parser } from "./parser3.ts";
import { MessageType } from "./midiTypes.ts";

const textEncoder = new TextEncoder();

Deno.test(function simpleMelody() {
  const { file } = new Filer(
    new Parser(textEncoder.encode("[ _.2 0 _.4 1 _.4 2 _.4 0 _.2 r ]")).parse(),
  );

  assertEquals(file.tracks[1].length, 9);
  assertEquals(
    file.tracks[1].filter(({ event }) => event?.type === MessageType.noteOff)
      .length,
    4,
  );
  assertEquals(
    file.tracks[1].filter(({ event }) => event?.type === MessageType.noteOn)
      .length,
    4,
  );
  assertEquals(
    file.tracks[1].filter(
      ({ event }) => event?.type === MessageType.noteOn && event?.note === 60,
    ).length,
    2,
  );
});

Deno.test(function durations() {
  assertEquals(
    new Filer(new Parser(textEncoder.encode("_.d[r]")).parse()).time,
    312,
  );
  assertEquals(
    new Filer(new Parser(textEncoder.encode("[_.d r]")).parse()).time,
    312,
  );
});

Deno.test(function simpleChord() {
  const { file } = new Filer(
    new Parser(textEncoder.encode("_.8[ 0, 2-, 4 ]")).parse(),
  );
  assertEquals(file.tracks[1].length, 7);
  assertEquals(
    file.tracks[1].filter(({ event }) => event?.type === MessageType.noteOff)
      .length,
    3,
  );
  assertEquals(
    file.tracks[1].filter(({ event }) => event?.type === MessageType.noteOn)
      .length,
    3,
  );
  assertEquals(
    file.tracks[1].filter(
      ({ event }) => event?.type === MessageType.noteOn && event?.note === 60,
    ).length,
    1,
  );
});

Deno.test(function simpleRepeat() {
  const { file } = new Filer(
    new Parser(textEncoder.encode("[$C = _.4 0 $C]")).parse(),
  );
  assertEquals(file.tracks[1].length, 5);
  // assertEquals(messages.filter((it) => it.message[0] === 128).length, 2);
  // assertEquals(messages.filter((it) => it.message[0] === 144).length, 2);
  // assertEquals(messages.filter((it) => it.message[1] === 60).length, 4);
});

Deno.test(function simpleProgram() {
  const { file } = new Filer(
    new Parser(
      textEncoder.encode("program_64 [ _.2 0 _.4 1 _.4 2 _.4 0 _.2 r ]"),
    ).parse(),
  );
  assertEquals(file.tracks[1].length, 10);
  // assertEquals(messages[0].message[0], 0xc0);
  // assertEquals(messages.filter((it) => it.message[0] === 128).length, 4);
  // assertEquals(messages.filter((it) => it.message[0] === 144).length, 4);
  // assertEquals(messages.filter((it) => it.message[1] === 60).length, 4);
});

Deno.test(function otherParamsChange() {
  const { file } = new Filer(
    new Parser(
      textEncoder.encode("vivace key 3 fff [ _.2 0 1 2 0 _.2 r ]"),
    ).parse(),
  );
  assertEquals(file.tracks[1].length, 9);
  // assertEquals(messages.filter((it) => it.message[0] === 128).length, 4);
  // assertEquals(messages.filter((it) => it.message[0] === 144).length, 4);
  // assertEquals(messages.filter((it) => it.message[1] === 61).length, 4);
  // assertEquals(messages.filter((it) => it.message[2] === 113).length, 8);
});

Deno.test(function jacob() {
  const { file } = new Filer(
    new Parser(
      textEncoder.encode(
        "allegro f [\n" +
          "$A = [_.2 0 1 2 0 _.2 r] $A\n" +
          "$B = [_.2 2 3 _.8 4 _.2 r] $B\n" +
          "% this was a puzzle to get right!\n" +
          "$C = _.2[4 _.1 5 4 _.1 3 _.4 2 _.4 0 r] $C\n" +
          "$D = [_.2 0 -3 _.8 0 _.2 r] $D\n]",
      ),
    ).parse(),
  );
  assertEquals(file.tracks[1].length, 65);
  // assertEquals(messages.filter((it) => it.message[0] === 128).length, 32);
  // assertEquals(messages.filter((it) => it.message[0] === 144).length, 32);
  // assertEquals(messages.filter((it) => it.message[1] === 60).length, 20);
  // assertEquals(messages.filter((it) => it.message[2] === 85).length, 64);
});
