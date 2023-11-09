import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { NodeType, Parser } from "./parser3.ts";
import { Dynamic, TokenType } from "./scanner3.ts";

const textEncoder = new TextEncoder();

Deno.test(function parseRest() {
  const { main: node } = new Parser(textEncoder.encode("r;.4")).parse();
  if (node.type !== NodeType.REST) fail("wrong type");
  assertEquals(node.duration, 0.25);
});

Deno.test(function parseNote() {
  const { main: node } = new Parser(textEncoder.encode("-7+;.c")).parse();
  if (node.type !== NodeType.NOTE) fail("wrong type");
  assertEquals(node.degree, -7);
  assertEquals(node.accident, 1);
  assertEquals(node.duration, 0.75);
});

Deno.test(function parseSequence() {
  const { main: node } = new Parser(
    textEncoder.encode("[ 0;.2 1;.4 2;.4 0;.4 r;.2 ]"),
  ).parse();
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(node.children.length, 1);
  const child = node.children[0];
  if (child.type !== NodeType.SEQUENCE) fail("wrong child type");
  assertEquals(child.children.length, 5);
});

Deno.test(function parseJoin() {
  const { main: node } = new Parser(
    textEncoder.encode("[ 0 ;.8, 2- ;.8, 4 ;.4 ]"),
  ).parse();
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(node.children.length, 3);
  const child = node.children[0];
  if (child.type !== NodeType.SEQUENCE) fail("wrong child type");
  assertEquals(child.children.length, 1);
});

Deno.test(function parseMark() {
  const { main: node, sections } = new Parser(
    textEncoder.encode("$line_1 = [ 0;.2 1;.4 2;.4 0;.4 r;.2 ]"),
  ).parse();
  if (node.type !== NodeType.INSERT) fail("wrong type");
  assertEquals(node.index, 0);
  assertEquals(sections.length, 1);
  assertEquals(sections[0].mark, "line_1");
  const child = sections[0].node;
  if (child.type !== NodeType.JOIN) fail("wrong child type");
});

Deno.test(function parseResolvedRepeat() {
  const { main: node, sections } = new Parser(
    textEncoder.encode("[ $C = 0;.4 $C ]"),
  ).parse();
  assertEquals(sections.length, 1);
  assertEquals(sections[0].mark, "C");
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(node.children.length, 1);
  if (node.children[0].type !== NodeType.SEQUENCE) fail("wrong type");
  assertEquals(node.children[0].children.length, 2);
  for (const child of node.children[0].children) {
    if (child.type !== NodeType.INSERT) fail("wrong type");
    assertEquals(child.index, 0);
  }
});

Deno.test(function parseRepeat() {
  const { main: node } = new Parser(
    textEncoder.encode("$line_1"),
  ).parse();
  if (node.type !== NodeType.ERROR) fail("wrong type");
  assertEquals(
    node.error.message,
    "Error at line 1 (END ''): Could not resolve line_1",
  );
});

Deno.test(function parseOperations() {
  const { main: node } = new Parser(
    textEncoder.encode(
      "\\program 64 \\tempo 1667 \\key 3 \\dyn fff [ 0;.2 1;.4 2;.4 0;.4 r;.2 ]",
    ),
  ).parse();
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(node.operations?.get("program"), 64);
  assertEquals(node.operations?.get("tempo"), 1667);
  assertEquals(node.operations?.get("key"), 3);
  assertEquals(node.operations?.get("dyn"), Dynamic.FFF);
});

Deno.test(function parseDuplicateOperations() {
  const { main: node } = new Parser(
    textEncoder.encode("\\dyn f \\dyn fff [ 0;.2 1;.4 2;.4 0;.4 r;.2 ]"),
  ).parse();
  if (node.type !== NodeType.ERROR) fail("wrong type");
  assertEquals(node.token.type, TokenType.OPERATOR);
  assertEquals(
    node.error.message,
    "Error at line 1 (OPERATOR '\\dyn'): Duplicate operator \\dyn",
  );
});

Deno.test(function parseUnknownOperations() {
  const { main: node } = new Parser(
    textEncoder.encode("\\dir 30 [ 0;.2 1;.4 2;.4 0;.4 r;.2 ]"),
  ).parse();
  if (node.type !== NodeType.ERROR) fail("wrong type");
  assertEquals(node.token.type, TokenType.OPERATOR);
  assertEquals(
    node.error.message,
    "Error at line 1 (OPERATOR '\\dir'): Unknown operator \\dir",
  );
});

Deno.test(function parseCombination() {
  const { main: node, sections } = new Parser(textEncoder.encode(
    "\\tempo 1500 \\dyn f [\n" +
      "$A = [0;.2 1;.4 2;.4 0;.4 r;.2] $A\n" +
      "$B = [2;.2 3;.4 4;.8 r;.2] $B\n" +
      "% this was a puzzle to get right!\n" +
      "$C = [4;.2 5;.1 4;.2 3;.1 2;.4 0;.4 r;.2] $C\n" +
      "$D = [0;.2 -3;.4 0;.8 r;.2] $D\n]",
  )).parse();
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(sections.length, 4);
  assertEquals(node.operations?.get("tempo"), 1500);
  assertEquals(node.operations?.get("key"), undefined);
  assertEquals(node.operations?.get("dyn"), Dynamic.F);
});

Deno.test(function parseError() {
  const { main: node } = new Parser(
    textEncoder.encode("[ 3h ;.8, 2 ;.8, 4 ;.4 ]"),
  ).parse();
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(node.children.length, 3);
  const child = node.children[0];
  if (child.type !== NodeType.ERROR) fail("wrong child type");
  assertEquals(child.token.type, TokenType.ERROR);
  assertEquals(
    child.error.message,
    "Error at line 1 (ERROR 'h'): Expected a HEX",
  );
});
