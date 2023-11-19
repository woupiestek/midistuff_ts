import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Printer } from "./midiFilePrinter.ts";
import { Scanner } from "./midiFileScanner.ts";
import { MessageType } from "./midiTypes.ts";

function scanner(printer: Printer): Scanner {
  return new Scanner(new Uint8Array(printer.pop()));
}

Deno.test(function printAndScanVariableLengthNumber() {
  const printer = new Printer();
  for (let i = 1; i < 2.68e8; i *= 5) {
    printer.variableLengthNumber(i);
    const n = scanner(printer).variableLengthNumber();
    assertEquals(n, i);
  }
});

Deno.test(function printAndScanText() {
  const printer = new Printer();
  printer.text("Hello, world!");
  assertEquals(scanner(printer).text(), "Hello, world!");
});

Deno.test(function printAndScanFixedLengthNumber() {
  const printer = new Printer();
  for (let length = 1; length < 4; length++) {
    for (let i = 1; i < Math.pow(128, length); i *= 5) {
      printer.fixedLengthNumber(i, length);
      const n = scanner(printer).fixedLengthNumber(length);
      assertEquals(n, i);
    }
  }
});

Deno.test(function printAndScanHeader() {
  const printer = new Printer();
  printer.header(1, 10, { type: "metrical", ppqn: 30 });
  const { format, numberOfTracks, timing } = scanner(printer).header();
  assertEquals(format, 1);
  assertEquals(numberOfTracks, 10);
  if (timing.type === "metrical") assertEquals(timing.ppqn, 30);
  else fail("unexpected timing type");
});

Deno.test(function printAndScanTrack() {
  const printer = new Printer();
  printer.track([{
    wait: 10,
    event: { type: MessageType.noteOn, channel: 5, note: 64, velocity: 64 },
  }]);
  const { wait, event } = scanner(printer).track()[0];
  assertEquals(wait, 10);
  if (event?.type !== MessageType.noteOn) fail("unexpected event type");
  assertEquals(event.channel, 5);
  assertEquals(event.note, 64);
  assertEquals(event.velocity, 64);
});

Deno.test(function printAndScanTrackWithRunningStatus() {
  const printer = new Printer();
  printer.track([{
    wait: 10,
    event: { type: MessageType.noteOn, channel: 5, note: 64, velocity: 64 },
  }, {
    wait: 10,
    event: { type: MessageType.noteOn, channel: 5, note: 60, velocity: 64 },
  }]);
  const track = scanner(printer).track();
  const { wait, event } = track[0];
  assertEquals(wait, 10);
  if (event?.type !== MessageType.noteOn) fail("unexpected event type");
  assertEquals(event.channel, 5);
  assertEquals(event.note, 64);
  assertEquals(event.velocity, 64);

  const { wait: w2, event: e2 } = track[1];
  assertEquals(w2, 10);
  if (e2?.type !== MessageType.noteOn) fail("unexpected event type");
  assertEquals(e2.channel, 5);
  assertEquals(e2.note, 60);
  assertEquals(e2.velocity, 64);
});
