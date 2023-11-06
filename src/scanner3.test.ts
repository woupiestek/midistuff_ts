import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Scanner, TokenType } from "./scanner3.ts";

const textEncoder = new TextEncoder();

Deno.test(function scanComma() {
  const scanner = new Scanner(textEncoder.encode(","));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.COMMA);
  assertEquals(from, 0);
  assertEquals(to, 1);
  assertEquals(line, 1);
});

Deno.test(function scanEnd() {
  const scanner = new Scanner(textEncoder.encode(""));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.END);
  assertEquals(from, 0);
  assertEquals(to, 0);
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
  const scanner = new Scanner(
    textEncoder.encode("\n\n\n\n\n"),
  );
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.END);
  assertEquals(from, 5);
  assertEquals(to, 5);
  assertEquals(line, 6);
});

Deno.test(function scanError() {
  const scanner = new Scanner(textEncoder.encode("-=*+"));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.ERROR);
  assertEquals(from, 0);
  assertEquals(to, 1);
  assertEquals(line, 1);
});

Deno.test(function scanLBrace() {
  const scanner = new Scanner(textEncoder.encode("{ "));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.LBRACE);
  assertEquals(from, 0);
  assertEquals(to, 1);
  assertEquals(line, 1);
});

Deno.test(function scanOperand() {
  const scanner = new Scanner(textEncoder.encode("1234567890asdfghjkl"));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.OPERAND);
  assertEquals(from, 0);
  assertEquals(to, 19);
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

Deno.test(function scanRBrace() {
  const scanner = new Scanner(textEncoder.encode(" }"));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.RBRACE);
  assertEquals(from, 1);
  assertEquals(to, 2);
  assertEquals(line, 1);
});
