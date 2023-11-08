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
scanAndMatch("--", TokenType.DOUBLE_MINUS);
scanAndMatch("++", TokenType.DOUBLE_PLUS);
scanAndMatch("{", TokenType.LBRACE);
scanAndMatch("-", TokenType.MINUS);
scanAndMatch("+", TokenType.PLUS);
scanAndMatch("}", TokenType.RBRACE);
scanAndMatch("r", TokenType.REST);

Deno.test(function scanInt() {
  const scanner = new Scanner(textEncoder.encode("1739"));
  const { type, from, to, line, value } = scanner.next();
  assertEquals(type, TokenType.INT);
  assertEquals(value, 1739);
  assertEquals(from, 0);
  assertEquals(to, 4);
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

Deno.test(function scanHex() {
  const scanner = new Scanner(textEncoder.encode(";1a.f9"));
  const { type, from, to, line, value } = scanner.next();
  assertEquals(type, TokenType.HEX);
  assertEquals(value, 26.97265625);
  assertEquals(from, 0);
  assertEquals(to, 6);
  assertEquals(line, 1);
});

Deno.test(function scanError() {
  const scanner = new Scanner(textEncoder.encode("asdfghjklz1234567890"));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.ERROR);
  assertEquals(from, 0);
  assertEquals(to, 20);
  assertEquals(line, 1);
});

Deno.test(function scanOperator() {
  const scanner = new Scanner(textEncoder.encode("\\1234567890asdfghjkl"));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.OPERATOR);
  assertEquals(from, 0);
  assertEquals(to, 20);
  assertEquals(line, 1);
});

Deno.test(function scanVelocity() {
  const scanner = new Scanner(textEncoder.encode("mp"));
  const { type, from, to, line, value } = scanner.next();
  assertEquals(type, TokenType.VELOCITY);
  assertEquals(value, 57);
  assertEquals(from, 0);
  assertEquals(to, 2);
  assertEquals(line, 1);
});

Deno.test(function scanMark() {
  const scanner = new Scanner(textEncoder.encode("$line_1"));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.MARK);
  assertEquals(from, 0);
  assertEquals(to, 7);
  assertEquals(line, 1);
});
