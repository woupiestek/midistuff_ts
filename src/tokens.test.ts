import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Tokens, TokenType } from "./tokens.ts";

Deno.test(function tokens() {
  const tokens = new Tokens(
    ", [ ] r = { } _3/4 1739 -17--   % this should be ignored!\n\n\n\n\n\\asdfghjklz1234567890 mp 'make '' it 😉 hard\n' key $line_1",
  );
  assertEquals(tokens.types, [
    TokenType.COMMA,
    TokenType.LEFT_BRACKET,
    TokenType.RIGHT_BRACKET,
    TokenType.REST,
    TokenType.IS,
    TokenType.LEFT_BRACE,
    TokenType.RIGHT_BRACE,
    TokenType.DURATION,
    TokenType.INTEGER,
    TokenType.INTEGER_MINUS_MINUS,
    TokenType.ERROR,
    TokenType.IDENTIFIER,
    TokenType.IDENTIFIER,
    TokenType.TEXT,
    TokenType.KEY,
    TokenType.IDENTIFIER,
  ]);
  assertEquals(tokens.froms, [
    0,
    2,
    4,
    6,
    8,
    10,
    12,
    14,
    19,
    24,
    62,
    63,
    84,
    87,
    109,
    113,
  ]);
});
