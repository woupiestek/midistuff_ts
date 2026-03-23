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
  printer.track({
    waits: [10],
    events: [{ type: MessageType.noteOn, channel: 5, note: 64, velocity: 64 }],
  });
  const { waits, events } = scanner(printer).track();
  assertEquals(waits[0], 10);
  if (events[0]?.type !== MessageType.noteOn) fail("unexpected event type");
  assertEquals(events[0].channel, 5);
  assertEquals(events[0].note, 64);
  assertEquals(events[0].velocity, 64);
});

Deno.test(function printAndScanTrackWithRunningStatus() {
  const printer = new Printer();
  printer.track({
    waits: [10, 10],
    events: [{ type: MessageType.noteOn, channel: 5, note: 64, velocity: 64 }, {
      type: MessageType.noteOn,
      channel: 5,
      note: 60,
      velocity: 64,
    }],
  });
  const { waits, events } = scanner(printer).track();
  assertEquals(waits[0], 10);
  if (events[0]?.type !== MessageType.noteOn) fail("unexpected event type");
  assertEquals(events[0].channel, 5);
  assertEquals(events[0].note, 64);
  assertEquals(events[0].velocity, 64);
  assertEquals(waits[1], 10);
  if (events[1]?.type !== MessageType.noteOn) fail("unexpected event type");
  assertEquals(events[1].channel, 5);
  assertEquals(events[1].note, 60);
  assertEquals(events[1].velocity, 64);
});
