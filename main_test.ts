import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import {
  Bytes,
  flatten,
  serializeFixedLengthNumber,
  serializeText,
  serializeVariableLengthNumber,
} from "./src/midiFIlePrinter.ts";
import { Scanner } from "./src/midiFileScanner.ts";

function scanner(bytes: Bytes): Scanner {
  return new Scanner(new Uint8Array(flatten(bytes)));
}

Deno.test(function printAndScanVariableLengthNumber() {
  for (let i = 1; i < 2.68e8; i *= 5) {
    const n = scanner(serializeVariableLengthNumber(i)).variableLengthNumber();
    assertEquals(n, i);
  }
});

Deno.test(function printAndScanText() {
  assertEquals(scanner(serializeText("Hello, world!")).text(),"Hello, world!")
});

Deno.test(function  printAndScanFixedLengthNumber() {
for(let length = 1; length<4; length++) {
  for (let i = 1; i < Math.pow(128,length); i *= 5) {
    const n = scanner(serializeFixedLengthNumber(i,length)).fixedLengthNumber(length);
    assertEquals(n, i);
  }
}
})
