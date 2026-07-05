import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Tokens, TokenType } from "./tokens.ts";

Deno.test(function tokens() {
  const tokens = new Tokens(
    ", [ ] r = { } _3/4 1739 -17--   % this should be ignored!\n\n\n\n\n\\asdfghjklz1234567890 mp 'make '' it 😉 hard\n' key $line_1",
  );
  assertEquals(tokens.types.map((it) => TokenType[it]), [
    "COMMA",
    "LEFT_BRACKET",
    "RIGHT_BRACKET",
    "REST",
    "IS",
    "LEFT_BRACE",
    "RIGHT_BRACE",
    "DURATION",
    "INTEGER",
    "INTEGER_MINUS_MINUS",
    "ERROR",
    "IDENTIFIER",
    "IDENTIFIER",
    "TEXT",
    "KEY",
    "IDENTIFIER",
  ]);
  assertEquals(tokens.tos, [
    1,
    3,
    5,
    7,
    9,
    11,
    13,
    18,
    23,
    29,
    63,
    83,
    86,
    108,
    112,
    120,
  ]);
});
