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
  const { main: node } = new Parser(textEncoder.encode("3cs;.c")).parse();
  if (node.type !== NodeType.NOTE) fail("wrong type");
  assertEquals(node.pitch, 49);
  assertEquals(node.duration, 0.75);
});

Deno.test(function parseSequence() {
  const { main: node } = new Parser(
    textEncoder.encode("{ 3c;.2 3d;.4 3e;.4 3c;.4 r;.2 }")
  ).parse();
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(node.children.length, 1);
  const child = node.children[0];
  if (child.type !== NodeType.SEQUENCE) fail("wrong child type");
  assertEquals(child.children.length, 5);
});

Deno.test(function parseJoin() {
  const { main: node } = new Parser(
    textEncoder.encode("{ 3c ;.8, 3ef ;.8, 3g ;.4 }")
  ).parse();
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(node.children.length, 3);
  const child = node.children[0];
  if (child.type !== NodeType.SEQUENCE) fail("wrong child type");
  assertEquals(child.children.length, 1);
});

Deno.test(function parseMark() {
  const { main: node, sections } = new Parser(
    textEncoder.encode("\\mark $line_1 { 3c;.2 3d;.4 3e;.4 3c;.4 r;.2 }")
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
    textEncoder.encode("{\\mark $C 3c;.4 \\repeat $C}")
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
    textEncoder.encode("\\repeat $line_1")
  ).parse();
  if (node.type !== NodeType.ERROR) fail("wrong type");
  assertEquals(
    node.error.message,
    "Error at line 1 (END ''): Could not resolve line_1"
  );
});

Deno.test(function parseProgram() {
  const { main: node } = new Parser(
    textEncoder.encode("\\program =64 { 3c;.2 3d;.4 3e;.4 3c;.4 r;.2 }")
  ).parse();
  if (node.type !== NodeType.PROGRAM) fail("wrong type");
  assertEquals(node.value, 64);
  const child = node.next;
  if (child.type !== NodeType.JOIN) fail("wrong child type");
});

Deno.test(function parseTempo() {
  const { main: node } = new Parser(
    textEncoder.encode("\\tempo =1666.667 { 3c;.2 3d;.4 3e;.4 3c;.4 r;.2 }")
  ).parse();
  if (node.type !== NodeType.TEMPO) fail("wrong type");
  assertEquals(node.value, 1666.667);
  const child = node.next;
  if (child.type !== NodeType.JOIN) fail("wrong child type");
});

Deno.test(function parseDynamic() {
  const { main: node } = new Parser(
    textEncoder.encode("\\dyn fff { 3c;.2 3d;.4 3e;.4 3c;.4 r;.2 }")
  ).parse();
  if (node.type !== NodeType.DYN) fail("wrong type");
  assertEquals(node.value, 113);
  const child = node.next;
  if (child.type !== NodeType.JOIN) fail("wrong child type");
});

Deno.test(function parseCrescendo() {
  const { main: node } = new Parser(
    textEncoder.encode("\\cresc p f { 3c;.2 3d;.4 3e;.4 3c;.4 r;.2 }")
  ).parse();
  if (node.type !== NodeType.CRESC) fail("wrong type");
  assertEquals(node.from, 43);
  assertEquals(node.to, 85);
  const child = node.next;
  if (child.type !== NodeType.JOIN) fail("wrong child type");
});

const SCORE = textEncoder.encode(
  "\\tempo =1500 \\dyn f {\n" +
    "\\mark $A {3c;.2 3d;.4 3e;.4 3c;.4 r;.2} \\repeat $A\n" +
    "\\mark $B {3e;.2 3f;.4 3g;.8 r;.2} \\repeat $B\n" +
    "% this was a puzzle to get right!\n" +
    "\\mark $C {3g;.2 3a;.1 3g;.2 3f;.1 3e;.4 3c;.4 r;.2} \\repeat $C\n" +
    "\\mark $D {3c;.2 2g;.4 3c;.8 r;.2} \\repeat $D\n}"
);

Deno.test(function parseCombination() {
  const { main: node, sections } = new Parser(SCORE).parse();
  if (node.type !== NodeType.TEMPO) fail("wrong type");
  assertEquals(sections.length, 4);
  // just get here without problems
});

Deno.test(function parseError() {
  const { main: node } = new Parser(
    textEncoder.encode("{ 3h ;.8, 3ef ;.8, 3g ;.4 }")
  ).parse();
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(node.children.length, 3);
  const child = node.children[0];
  if (child.type !== NodeType.ERROR) fail("wrong child type");
  assertEquals(child.token.type, TokenType.ERROR);
  assertEquals(
    child.error.message,
    "Error at line 1 (ERROR '3h'): expected a collection '{', an operation '...', a rest 'r...' or a note '3c...'"
  );
});
