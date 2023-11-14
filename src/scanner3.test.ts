import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Scanner, TokenType } from "./scanner3.ts";

const textEncoder = new TextEncoder();

function scanAndMatch(input: string, type: TokenType) {
  Deno.test(`scan '${input}' gives ${TokenType[type]}`, () => {
    const scanner = new Scanner(textEncoder.encode(input));
    const { type, from, to, line } = scanner.next();
    assertEquals(type, type);
    assertEquals(from, 0);
    assertEquals(to, input.length);
    assertEquals(line, 1);
  });
}

scanAndMatch("", TokenType.END);
scanAndMatch(",", TokenType.COMMA);
scanAndMatch("[", TokenType.LEFT_BRACKET);
scanAndMatch("]", TokenType.RIGHT_BRACKET);
scanAndMatch("r", TokenType.REST);
scanAndMatch("=", TokenType.IS);
scanAndMatch("_", TokenType.UNDERSCORE);
scanAndMatch("/", TokenType.SLASH);
scanAndMatch("{", TokenType.LEFT_BRACE);
scanAndMatch("}", TokenType.RIGHT_BRACE);

Deno.test(function scanInteger() {
  const scanner = new Scanner(textEncoder.encode("1739"));
  const { type, from, to, line, value } = scanner.next();
  assertEquals(type, TokenType.INTEGER);
  assertEquals(value, 1739);
  assertEquals(from, 0);
  assertEquals(to, 4);
  assertEquals(line, 1);
});

Deno.test(function scanIntegerMinusMinus() {
  const scanner = new Scanner(textEncoder.encode("-17--"));
  const { type, from, to, line, value } = scanner.next();
  assertEquals(type, TokenType.INTEGER_MINUS_MINUS);
  assertEquals(value, -17);
  assertEquals(from, 0);
  assertEquals(to, 5);
  assertEquals(line, 1);
});

Deno.test(function scanComment() {
  const scanner = new Scanner(
    textEncoder.encode("   % this should be ignored!"),
  );
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.END);
  assertEquals(from, 28);
  assertEquals(to, 28);
  assertEquals(line, 1);
});

Deno.test(function scanLines() {
  const scanner = new Scanner(textEncoder.encode("\n\n\n\n\n"));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.END);
  assertEquals(from, 5);
  assertEquals(to, 5);
  assertEquals(line, 6);
});

Deno.test(function scanError() {
  const scanner = new Scanner(textEncoder.encode("\\asdfghjklz1234567890"));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.ERROR);
  assertEquals(from, 0);
  assertEquals(to, 1);
  assertEquals(line, 1);
});

Deno.test(function scanIdentifier() {
  const scanner = new Scanner(textEncoder.encode("mp"));
  const { type, from, to, line, value } = scanner.next();
  assertEquals(type, TokenType.IDENTIFIER);
  assertEquals(value, undefined);
  assertEquals(from, 0);
  assertEquals(to, 2);
  assertEquals(line, 1);
});

Deno.test(function scanText() {
  const scanner = new Scanner(textEncoder.encode('"make "" it 😉 hard\n"'));
  const { type, from, to, line, value } = scanner.next();
  assertEquals(type, TokenType.TEXT);
  assertEquals(value, undefined);
  assertEquals(from, 0);
  assertEquals(to, 23);
  assertEquals(line, 1);
});

Deno.test(function scanKeyword() {
  const scanner = new Scanner(textEncoder.encode("key"));
  const { type, from, to, line, value } = scanner.next();
  assertEquals(type, TokenType.KEY);
  assertEquals(value, undefined);
  assertEquals(from, 0);
  assertEquals(to, 3);
  assertEquals(line, 1);
});

Deno.test(function scanMark() {
  const scanner = new Scanner(textEncoder.encode("$line_1"));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.IDENTIFIER);
  assertEquals(from, 0);
  assertEquals(to, 7);
  assertEquals(line, 1);
});
