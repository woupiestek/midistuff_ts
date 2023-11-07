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

Deno.test(function scanHex() {
  const scanner = new Scanner(textEncoder.encode(";1a.f9"));
  const { type, from, to, line, value } = scanner.next();
  assertEquals(type, TokenType.HEX);
  assertEquals(value, 26.97265625);
  assertEquals(from, 0);
  assertEquals(to, 6);
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
  const scanner = new Scanner(textEncoder.encode("1234567890asdfghjklz"));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.OPERAND);
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

Deno.test(function scanPitch() {
  const scanner = new Scanner(textEncoder.encode("3cs"));
  const { type, from, to, line, value } = scanner.next();
  assertEquals(type, TokenType.PITCH);
  assertEquals(value, 49);
  assertEquals(from, 0);
  assertEquals(to, 3);
  assertEquals(line, 1);
});

Deno.test(function scanRest() {
  const scanner = new Scanner(textEncoder.encode("r"));
  const { type, from, to, line } = scanner.next();
  assertEquals(type, TokenType.REST);
  assertEquals(from, 0);
  assertEquals(to, 1);
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

Deno.test(function scanVelocity() {
  const scanner = new Scanner(textEncoder.encode("mp"));
  const { type, from, to, line, value } = scanner.next();
  assertEquals(type, TokenType.VELOCITY);
  assertEquals(value, 57);
  assertEquals(from, 0);
  assertEquals(to, 2);
  assertEquals(line, 1);
});
