import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Scanner, TokenType } from "./scanner3.ts";
import { Ratio } from "./util.ts";

function scanAndMatch(input: string, type: TokenType) {
  Deno.test(`scan '${input}' gives ${TokenType[type]}`, () => {
    const scanner = new Scanner(input);
    const { type, from } = scanner.next();
    const [line, column] = scanner.getLineAndColumn(from);
    assertEquals(type, type);
    assertEquals(from, 0);
    assertEquals(line, 1);
    assertEquals(column, 1);
  });
}

scanAndMatch("", TokenType.END);
scanAndMatch(",", TokenType.COMMA);
scanAndMatch("[", TokenType.LEFT_BRACKET);
scanAndMatch("]", TokenType.RIGHT_BRACKET);
scanAndMatch("r", TokenType.REST);
scanAndMatch("=", TokenType.IS);
scanAndMatch("{", TokenType.LEFT_BRACE);
scanAndMatch("}", TokenType.RIGHT_BRACE);

Deno.test(function scanDuration() {
  const scanner = new Scanner("_3/4");
  const { type, from } = scanner.next();
  assertEquals(type, TokenType.DURATION);
  const value = scanner.getRatio(from);
  const [line] = scanner.getLineAndColumn(from);
  if (!(value instanceof Ratio)) fail("Wrong value type");
  assertEquals(value.numerator, 3);
  assertEquals(value.denominator, 4);
  assertEquals(from, 0);
  assertEquals(line, 1);
});

Deno.test(function scanInteger() {
  const scanner = new Scanner("1739");
  const { type, from } = scanner.next();
  const value = scanner.getIntegerValue(from);
  const [line] = scanner.getLineAndColumn(from);
  assertEquals(type, TokenType.INTEGER);
  assertEquals(value, 1739);
  assertEquals(from, 0);
  assertEquals(line, 1);
});

Deno.test(function scanIntegerMinusMinus() {
  const scanner = new Scanner("-17--");
  const { type, from } = scanner.next();
  assertEquals(type, TokenType.INTEGER_MINUS_MINUS);
  const value = scanner.getIntegerValue(from);
  const [line] = scanner.getLineAndColumn(from);
  assertEquals(value, -17);
  assertEquals(from, 0);
  assertEquals(line, 1);
});

Deno.test(function scanComment() {
  const scanner = new Scanner("   % this should be ignored!");
  const { type, from } = scanner.next();
  assertEquals(type, TokenType.END);
  const [line] = scanner.getLineAndColumn(from);
  assertEquals(from, 28);
  assertEquals(line, 1);
});

Deno.test(function scanLines() {
  const scanner = new Scanner("\n\n\n\n\n");
  const { type, from } = scanner.next();
  assertEquals(type, TokenType.END);
  const [line] = scanner.getLineAndColumn(from);
  assertEquals(from, 5);
  assertEquals(line, 6);
});

Deno.test(function scanError() {
  const scanner = new Scanner("\\asdfghjklz1234567890");
  const { type, from } = scanner.next();
  assertEquals(type, TokenType.ERROR);
  const [line] = scanner.getLineAndColumn(from);
  assertEquals(from, 0);
  assertEquals(line, 1);
});

Deno.test(function scanIdentifier() {
  const scanner = new Scanner("mp");
  const { type, from } = scanner.next();
  assertEquals(type, TokenType.IDENTIFIER);
  const [line] = scanner.getLineAndColumn(from);
  assertEquals(from, 0);
  assertEquals(line, 1);
});

Deno.test(function scanText() {
  const scanner = new Scanner("'make '' it 😉 hard\n'");
  const { type, from } = scanner.next();
  assertEquals(type, TokenType.TEXT);
  assertEquals(from, 0);
  const [line] = scanner.getLineAndColumn(from);
  assertEquals(line, 1);
});

Deno.test(function scanKeyword() {
  const scanner = new Scanner("key");
  const { type, from } = scanner.next();
  assertEquals(type, TokenType.KEY);
  assertEquals(from, 0);
  const [line] = scanner.getLineAndColumn(from);
  assertEquals(line, 1);
});

Deno.test(function scanMark() {
  const scanner = new Scanner("$line_1");
  const { type, from } = scanner.next();
  assertEquals(type, TokenType.IDENTIFIER);
  assertEquals(from, 0);
  const [line] = scanner.getLineAndColumn(from);
  assertEquals(line, 1);
});
