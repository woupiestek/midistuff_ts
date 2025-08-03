import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Filer } from "./filer3.ts";
import { Parser } from "./parser3.ts";
import { MessageType } from "./midiTypes.ts";
import { Tokens } from "./tokens.ts";

Deno.test(function simpleMelody() {
  const { file } = new Filer(
    new Parser(new Tokens("[ _/8 0 _/4 1 _/4 2 _/4 0 _/8 r ]")).parse(),
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
    new Filer(new Parser(new Tokens("_13/16[0]")).parse()).time,
    312,
  );
  assertEquals(
    new Filer(new Parser(new Tokens("[_13/16 0]")).parse()).time,
    312,
  );
});

Deno.test(function simpleChord() {
  const { file } = new Filer(new Parser(new Tokens("_/2{ 0 2- 4 }")).parse());
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
  const { file } = new Filer(new Parser(new Tokens("[$C = _/4 0 $C]")).parse());
  assertEquals(file.tracks[1].length, 5);
});

Deno.test(function simpleProgram() {
  const { file } = new Filer(
    new Parser(new Tokens("['program_64' _/8 0 _/4 1 _/4 2 _/4 0 _/8 r ]"))
      .parse(),
  );
  assertEquals(file.tracks[1].length, 10);
});

Deno.test(function otherParamsChange() {
  const { file } = new Filer(
    new Parser(new Tokens("key 3 ['vivace' 'fff' _/8 0 1 2 0 _/8 r ]")).parse(),
  );
  assertEquals(file.tracks[1].length, 9);
});

Deno.test(function jacob() {
  const { file } = new Filer(
    new Parser(
      new Tokens(
        "['allegro' 'f' \n" +
          "$A = [_/8 0 1 2 0 _/8 r] $A\n" +
          "$B = [_/8 2 3 _/2 4 _/8 r] $B\n" +
          "% this was a puzzle to get right!\n" +
          "$C = _/8[4 _/16 5 4 _/16 3 _/4 2 _/4 0 r] $C\n" +
          "$D = [_/8 0 -3 _/2 0 _/8 r] $D\n]",
      ),
    ).parse(),
  );
  assertEquals(file.tracks[1].length, 65);
});
