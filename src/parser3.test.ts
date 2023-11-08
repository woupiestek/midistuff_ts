import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { NodeType, Parser } from "./parser3.ts";
import { TokenType } from "./scanner3.ts";

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
    textEncoder.encode("{ 0;.2 1;.4 2;.4 0;.4 r;.2 }"),
  ).parse();
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(node.children.length, 1);
  const child = node.children[0];
  if (child.type !== NodeType.SEQUENCE) fail("wrong child type");
  assertEquals(child.children.length, 5);
});

Deno.test(function parseJoin() {
  const { main: node } = new Parser(
    textEncoder.encode("{ 0 ;.8, 2- ;.8, 4 ;.4 }"),
  ).parse();
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(node.children.length, 3);
  const child = node.children[0];
  if (child.type !== NodeType.SEQUENCE) fail("wrong child type");
  assertEquals(child.children.length, 1);
});

Deno.test(function parseMark() {
  const { main: node, sections } = new Parser(
    textEncoder.encode("\\mark $line_1 { 0;.2 1;.4 2;.4 0;.4 r;.2 }"),
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
    textEncoder.encode("{\\mark $C 0;.4 \\repeat $C}"),
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
    textEncoder.encode("\\repeat $line_1"),
  ).parse();
  if (node.type !== NodeType.ERROR) fail("wrong type");
  assertEquals(
    node.error.message,
    "Error at line 1 (END ''): Could not resolve line_1",
  );
});

Deno.test(function parseProgram() {
  const { main: node } = new Parser(
    textEncoder.encode("\\program 64 { 0;.2 1;.4 2;.4 0;.4 r;.2 }"),
  ).parse();
  if (node.type !== NodeType.PROGRAM) fail("wrong type");
  assertEquals(node.value, 64);
  const child = node.next;
  if (child.type !== NodeType.JOIN) fail("wrong child type");
});

Deno.test(function parseTempo() {
  const { main: node } = new Parser(
    textEncoder.encode("\\tempo 1667 { 0;.2 1;.4 2;.4 0;.4 r;.2 }"),
  ).parse();
  if (node.type !== NodeType.TEMPO) fail("wrong type");
  assertEquals(node.value, 1667);
  const child = node.next;
  if (child.type !== NodeType.JOIN) fail("wrong child type");
});

Deno.test(function parseKey() {
  const { main: node } = new Parser(
    textEncoder.encode("\\key 3 { 0;.2 1;.4 2;.4 0;.4 r;.2 }"),
  ).parse();
  if (node.type !== NodeType.KEY) fail("wrong type");
  assertEquals(node.value, 3);
  const child = node.next;
  if (child.type !== NodeType.JOIN) fail("wrong child type");
});

Deno.test(function parseDynamic() {
  const { main: node } = new Parser(
    textEncoder.encode("\\dyn fff { 0;.2 1;.4 2;.4 0;.4 r;.2 }"),
  ).parse();
  if (node.type !== NodeType.DYN) fail("wrong type");
  assertEquals(node.value, 113);
  const child = node.next;
  if (child.type !== NodeType.JOIN) fail("wrong child type");
});

const SCORE = textEncoder.encode(
  "\\tempo 1500 \\dyn f {\n" +
    "\\mark $A {0;.2 1;.4 2;.4 0;.4 r;.2} \\repeat $A\n" +
    "\\mark $B {2;.2 3;.4 4;.8 r;.2} \\repeat $B\n" +
    "% this was a puzzle to get right!\n" +
    "\\mark $C {4;.2 5;.1 4;.2 3;.1 2;.4 0;.4 r;.2} \\repeat $C\n" +
    "\\mark $D {0;.2 -3;.4 0;.8 r;.2} \\repeat $D\n}",
);

Deno.test(function parseCombination() {
  const { main: node, sections } = new Parser(SCORE).parse();
  if (node.type !== NodeType.TEMPO) fail("wrong type");
  assertEquals(sections.length, 4);
});

Deno.test(function parseError() {
  const { main: node } = new Parser(
    textEncoder.encode("{ 3h ;.8, 2 ;.8, 4 ;.4 }"),
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
