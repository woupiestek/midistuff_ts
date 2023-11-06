import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { TextScanner, Token } from "./textScanner.ts";

const SCORE = "\\mf c3&.2 d3&.4 e3&.4 c3&.4 r.2 c3&.2 d3&.4 e3&.4 c3&.4 r.2";
const textEncoder = new TextEncoder();
Deno.test(function scan() {
  let tokens: Token[] = [];
  try {
    const scanner = new TextScanner(textEncoder.encode(SCORE));
    while (!scanner.done()) {
      tokens.push(scanner.next());
    }
  } catch (e) {
    console.error(e);
  }
  console.log(...tokens);
  assertEquals(tokens.length, 11);
});
