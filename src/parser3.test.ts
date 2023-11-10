import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { NodeType, Parser } from "./parser3.ts";
import { TokenType } from "./scanner3.ts";

const textEncoder = new TextEncoder();

Deno.test(function parseRest() {
  const { main: node } = new Parser(textEncoder.encode("_.4 r")).parse();
  if (node.type !== NodeType.REST) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.options?.duration, 0.25);
});

Deno.test(function parseSimpleRest() {
  const { main: node } = new Parser(textEncoder.encode("r")).parse();
  if (node.type !== NodeType.REST) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.options?.duration, undefined);
});

Deno.test(function parseNote() {
  const { main: node } = new Parser(textEncoder.encode("_.c -7++")).parse();
  if (node.type === NodeType.ERROR) {
    console.error(node.error);
  }
  if (node.type !== NodeType.NOTE) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.degree, -7);
  assertEquals(node.accident, 2);
  assertEquals(node.options?.duration, 0.75);
});

Deno.test(function parseSimpleNote() {
  const { main: node } = new Parser(textEncoder.encode("-7")).parse();
  if (node.type !== NodeType.NOTE) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.degree, -7);
  assertEquals(node.accident, 0);
  assertEquals(node.options?.duration, undefined);
});

Deno.test(function parseSet() {
  const { main: node } = new Parser(
    textEncoder.encode("_.4[ _.2 0 1 2 0 _.2 r ]"),
  ).parse();
  if (node.type !== NodeType.JOIN) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.children.length, 1);
  const child = node.children[0];
  if (child.type !== NodeType.SEQUENCE) fail("wrong child type");
  assertEquals(child.children.length, 5);
});

Deno.test(function parsePitchSet() {
  const { main: node } = new Parser(textEncoder.encode("_.5[ 0 2 4 ]")).parse();
  if (node.type !== NodeType.JOIN) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.children.length, 1);
  const child = node.children[0];
  if (child.type !== NodeType.SEQUENCE) fail("wrong child type");
  assertEquals(child.children.length, 3);
  assertEquals(node.options?.duration, 5 / 16);
});

Deno.test(function parseJoin() {
  const { main: node } = new Parser(
    textEncoder.encode("_.8[ 0 , 2- , 4 ]"),
  ).parse();
  if (node.type !== NodeType.JOIN) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.children.length, 3);
  const child = node.children[0];
  if (child.type !== NodeType.SEQUENCE) fail("wrong child type");
  assertEquals(child.children.length, 1);
});

Deno.test(function parseMark() {
  const { main: node, sections } = new Parser(
    textEncoder.encode("$line_1 = _.4[ _.2 0 1 2 0 _.2 r ]"),
  ).parse();
  if (node.type !== NodeType.INSERT) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.index, 0);
  assertEquals(sections.length, 1);
  assertEquals(sections[0].mark, "line_1");
  const child = sections[0].node;
  if (child.type !== NodeType.JOIN) fail("wrong child type");
});

Deno.test(function parseResolvedRepeat() {
  const { main: node, sections } = new Parser(
    textEncoder.encode("[ $C = 0 $C ]"),
  ).parse();
  assertEquals(sections.length, 1);
  assertEquals(sections[0].mark, "C");
  if (node.type !== NodeType.JOIN) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.children.length, 1);
  if (node.children[0].type !== NodeType.SEQUENCE) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  assertEquals(node.children[0].children.length, 2);
  for (const child of node.children[0].children) {
    if (child.type !== NodeType.INSERT) {
      fail(`wrong type ${NodeType[node.type]}`);
    }
    assertEquals(child.index, 0);
  }
});

Deno.test(function parseRepeat() {
  const { main: node } = new Parser(textEncoder.encode("$line_1")).parse();
  if (node.type !== NodeType.ERROR) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(
    node.error.message,
    "Error at line 1 (END ''): Could not resolve line_1",
  );
});

Deno.test(function parseOperations() {
  const { main: node } = new Parser(
    textEncoder.encode(
      "program_64 vivace key -3 fff _.5[ _.2 0 1 2 0 _.2 r ]",
    ),
  ).parse();
  if (node.type !== NodeType.JOIN) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.options?.key, -3);
  assertEquals(node.options?.classes, ["program_64", "vivace", "fff"]);
  assertEquals(node.options?.duration, 5 / 16);
});

Deno.test(function parseDoubleDynamics() {
  const { main: node } = new Parser(
    textEncoder.encode("f f _.4[ _.2 0 1 2 0 _.2 r ]"),
  ).parse();
  if (node.type !== NodeType.ERROR) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.token.type, TokenType.IDENTIFIER);
  assertEquals(
    node.error.message,
    "Error at line 1 (IDENTIFIER 'f'): Double 'f'",
  );
});

Deno.test(function parseCombination() {
  const { main: node, sections } = new Parser(
    textEncoder.encode(
      "allegro f [\n" +
        "$A = [_.2 0 1 2 0 _.2 r] $A\n" +
        "$B = [_.2 2 3 _.8 4 _.2 r] $B\n" +
        "% this was a puzzle to get right!\n" +
        "$C = _.2[4 _.1 5 4 _.1 3 _.4 2 _.4 0 r] $C\n" +
        "$D = [_.2 0 -3 _.8 0 _.2r] $D\n]",
    ),
  ).parse();
  if (node.type !== NodeType.JOIN) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(sections.length, 4);
  assertEquals(node.options?.key, undefined);
  assertEquals(node.options?.classes, ["allegro", "f"]);
});

Deno.test(function parseError() {
  const { main: node } = new Parser(textEncoder.encode("[ 3h, 2, 4 ]")).parse();
  if (node.type !== NodeType.JOIN) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.children.length, 3);
  const child = node.children[0];
  if (child.type !== NodeType.ERROR) {
    fail(`wrong child type ${NodeType[child.type]}`);
  }
  assertEquals(child.token.type, TokenType.COMMA);
  assertEquals(
    child.error.message,
    "Error at line 1 (COMMA ','): Expected note, rest or set here",
  );
});

Deno.test(function noFalseAccidentals() {
  const { main: node } = new Parser(
    textEncoder.encode("[_.2 0 -3 _.8 0 _.2 r]"),
  ).parse();
  if (node.type !== NodeType.JOIN) fail(`wrong type ${NodeType[node.type]}`);
  if (node.children[0].type !== NodeType.SEQUENCE) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  const accidents = node.children[0].children.map((it) =>
    it.type === NodeType.NOTE ? it.accident : -1
  );
  assertEquals(accidents, [0, 0, 0, -1]);
});

Deno.test(function noFalseDurations() {
  const { main: node } = new Parser(
    textEncoder.encode("[_.2 2 3 _.8 4 _.2 r]"),
  ).parse();
  if (node.type !== NodeType.JOIN) fail(`wrong type ${NodeType[node.type]}`);
  if (node.children[0].type !== NodeType.SEQUENCE) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  const durations = node.children[0].children.map((it) =>
    it.type !== NodeType.ERROR && it.type !== NodeType.INSERT
      ? it.options?.duration
      : undefined
  );
  console.log(...node.children);
  assertEquals(durations, [0.125, undefined, 0.5, 0.125]);
});
