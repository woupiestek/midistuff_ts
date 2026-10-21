import { test } from "bun:test";
import { deepStrictEqual as assertEquals, fail } from "node:assert";
import { Node, NodeType, Parser } from "./parser3.ts";
import { Tokens, TokenType } from "./tokens.ts";

test("parseRest", function parseRest() {
  const { main: node } = new Parser(new Tokens("_/4 r")).parse();
  if (node.type !== NodeType.REST) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.options?.duration?.numerator, 1);
  assertEquals(node.options?.duration?.denominator, 4);
});

test("parseSimpleRest", function parseSimpleRest() {
  const { main: node } = new Parser(new Tokens("r")).parse();
  if (node.type !== NodeType.REST) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.options?.duration?.numerator, undefined);
  assertEquals(node.options?.duration?.denominator, undefined);
});

test("parseNote", function parseNote() {
  const { main: node } = new Parser(new Tokens("_3/4 -7++")).parse();
  if (node.type !== NodeType.NOTE) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.degree, -7);
  assertEquals(node.accident, 2);
  assertEquals(node.options?.duration?.numerator, 3);
  assertEquals(node.options?.duration?.denominator, 4);
});

test("parseSimpleNote", function parseSimpleNote() {
  const { main: node } = new Parser(new Tokens("-7")).parse();
  if (node.type !== NodeType.NOTE) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.degree, -7);
  assertEquals(node.accident, 0);
  assertEquals(node.options?.duration?.numerator, undefined);
  assertEquals(node.options?.duration?.denominator, undefined);
});

test("parseSet", function parseSet() {
  const { main: node } = new Parser(new Tokens("_/4[ _/8 0 1 2 0 _/8 r ]"))
    .parse();
  if (node.type !== NodeType.ARRAY) {
    fail(`wrong child type ${NodeType[node.type]}`);
  }
  assertEquals(node.children.length, 5);
});

test("parsePitchSet", function parsePitchSet() {
  const { main: node } = new Parser(new Tokens("_5/16[ 0 2 4 ]")).parse();
  if (node.type !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  assertEquals(node.children.length, 3);
  assertEquals(node.options?.duration?.numerator, 5);
  assertEquals(node.options?.duration?.denominator, 16);
});

test("parseJoin", function parseJoin() {
  const { main: node } = new Parser(new Tokens("_/2{ 0  2-  4 }")).parse();
  if (node.type === NodeType.ERROR) throw node.error;
  if (node.type !== NodeType.SET) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.children.length, 3);
});

test("parseMark", function parseMark() {
  const { main: node, sections } = new Parser(
    new Tokens("$line_1 = _/4[ _/8 0 1 2 0 _/8 r ]"),
  ).parse();
  if (node.type !== NodeType.INSERT) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.index, 0);
  assertEquals(sections.marks.length, 1);
  assertEquals(sections.marks[0], "$line_1");
  const child = sections.nodes[0];
  if (child.type !== NodeType.ARRAY) fail("wrong child type");
});

test("parseResolvedRepeat", function parseResolvedRepeat() {
  const { main: node, sections } = new Parser(new Tokens("[ C = 0 C ]"))
    .parse();
  assertEquals(sections.marks.length, 1);
  assertEquals(sections.marks[0], "C");
  if (node.type !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  assertEquals(node.children.length, 2);
  for (const child of node.children) {
    if (child.type !== NodeType.INSERT) {
      fail(`wrong type ${NodeType[node.type]}`);
    }
    assertEquals(child.index, 0);
  }
});

test("parseRepeat", function parseRepeat() {
  const { main: node } = new Parser(new Tokens("$line_1")).parse();
  if (node.type !== NodeType.ERROR) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(
    node.error.message,
    "Error at [1;1] '…$li…': Could not resolve '$line_1'",
  );
});

test("parseOperations", function parseOperations() {
  const { main: node } = new Parser(
    new Tokens(
      "key -3 _5/16[ 'program_64' 'vivace'  'fff' _/8 0 1 2 0 _/8 r ]",
    ),
  ).parse();
  if (node.type !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  assertEquals(node.options?.key, -3);
  assertEquals(
    node.children.slice(0, 3).map((it) =>
      it.type === NodeType.EVENT ? it.value : ""
    ),
    ["program_64", "vivace", "fff"],
  );
  assertEquals(node.options?.duration?.numerator, 5);
  assertEquals(node.options?.duration?.denominator, 16);
});

test("parseCombination", function parseCombination() {
  const { main: node, sections } = new Parser(
    new Tokens(
      "['allegro' 'f' \
       $A = [_/8 0 1 2 0 _/8 r] $A\
       $B = [_/8 2 3 _/2 4 _/8 r] $B\
       % this was a puzzle to get right!\n\
       $C = _/8[4 _/16 5 4 _/16 3 _/4 2 _/4 0 r] $C\
       $D = [_/8 0 -3 _/2 0 _/8r] $D\n]",
    ),
  ).parse();

  if (node.type === NodeType.ERROR) {
    fail(node.error.message);
  }
  if (node.type !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  assertEquals(sections.marks.length, 4);
  assertEquals(node.options?.key, undefined);
  assertEquals(node.children[0], Node.event("allegro"));
  assertEquals(node.children[1], Node.event("f"));
});

test("parseError", function parseError() {
  const tokens = new Tokens("{ 3h 2 4 }");
  const { main } = new Parser(tokens).parse();
  if (main.type !== NodeType.ERROR) {
    fail(`wrong child type ${NodeType[main.type]}`);
  }
  assertEquals(tokens.types[main.token], TokenType.INTEGER);
  assertEquals(
    main.error.message,
    "Error at [1;4] '…{ 3h 2…': Could not resolve 'h'",
  );
});

test("noFalseAccidentals", function noFalseAccidentals() {
  const { main: node } = new Parser(new Tokens("[_/8 0 -3 _/2 0 _/8 r]"))
    .parse();
  if (node.type !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  const accidents = node.children.map((it) =>
    it.type === NodeType.NOTE ? it.accident : -1
  );
  assertEquals(accidents, [0, 0, 0, -1]);
});

test("noFalseDurations", function noFalseDurations() {
  const { main: node } = new Parser(new Tokens("[_/8 2 3 _/2 4 _/8 r]"))
    .parse();
  if (node.type !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  const durations = node.children.map((it) =>
    it.type !== NodeType.ERROR &&
      it.type !== NodeType.EVENT &&
      it.type !== NodeType.INSERT &&
      it.options?.duration?.numerator &&
      it.options?.duration?.denominator
      ? it.options.duration?.numerator / it.options.duration?.denominator
      : undefined
  );
  assertEquals(durations, [0.125, undefined, 0.5, 0.125]);
});

test("addMetaData", function addMetaData() {
  const { main, metadata } = new Parser(
    new Tokens(
      "0,{ 'tempo'= 500000 'title'='one note' 'cresc poco a poco'={'from'=43'to'=85} 'parts'=['piano' 'viola']}",
    ),
  ).parse();
  if (main.type === NodeType.ERROR) {
    throw main.error;
  }
  assertEquals(metadata.tempo, 500000);
  assertEquals(metadata.title, "one note");
  const cpap = metadata["cresc poco a poco"];
  if (!(cpap instanceof Object) || cpap instanceof Array) {
    console.log(cpap);
    fail("unexpected type");
  }
  assertEquals(cpap.from, 43);
  assertEquals(cpap.to, 85);
  assertEquals(metadata.parts, ["piano", "viola"]);
});
