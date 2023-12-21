import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Node, NodeType, Parser } from "./parser3.ts";
import { TokenType } from "./scanner3.ts";

Deno.test(function parseRest() {
  const { main: node } = new Parser("_/4 r").parse();
  if (node.type !== NodeType.REST) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.options?.duration?.numerator, 1);
  assertEquals(node.options?.duration?.denominator, 4);
});

Deno.test(function parseSimpleRest() {
  const { main: node } = new Parser("r").parse();
  if (node.type !== NodeType.REST) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.options?.duration?.numerator, undefined);
  assertEquals(node.options?.duration?.denominator, undefined);
});

Deno.test(function parseNote() {
  const { main: node } = new Parser("_3/4 -7++").parse();
  if (node.type !== NodeType.NOTE) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.degree, -7);
  assertEquals(node.accident, 2);
  assertEquals(node.options?.duration?.numerator, 3);
  assertEquals(node.options?.duration?.denominator, 4);
});

Deno.test(function parseSimpleNote() {
  const { main: node } = new Parser("-7").parse();
  if (node.type !== NodeType.NOTE) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.degree, -7);
  assertEquals(node.accident, 0);
  assertEquals(node.options?.duration?.numerator, undefined);
  assertEquals(node.options?.duration?.denominator, undefined);
});

Deno.test(function parseSet() {
  const { main: node } = new Parser("_/4[ _/8 0 1 2 0 _/8 r ]").parse();
  if (node.type !== NodeType.ARRAY) {
    fail(`wrong child type ${NodeType[node.type]}`);
  }
  assertEquals(node.children.length, 5);
});

Deno.test(function parsePitchSet() {
  const { main: node } = new Parser("_5/16[ 0 2 4 ]").parse();
  if (node.type !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  assertEquals(node.children.length, 3);
  assertEquals(node.options?.duration?.numerator, 5);
  assertEquals(node.options?.duration?.denominator, 16);
});

Deno.test(function parseJoin() {
  const { main: node } = new Parser("_/2{ 0  2-  4 }").parse();
  if (node.type === NodeType.ERROR) throw node.error;
  if (node.type !== NodeType.SET) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.children.length, 3);
});

Deno.test(function parseMark() {
  const { main: node, sections } = new Parser(
    "$line_1 = _/4[ _/8 0 1 2 0 _/8 r ]",
  ).parse();
  if (node.type !== NodeType.INSERT) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.index, 0);
  assertEquals(sections.length, 1);
  assertEquals(sections[0].mark, "$line_1");
  const child = sections[0].node;
  if (child.type !== NodeType.ARRAY) fail("wrong child type");
});

Deno.test(function parseResolvedRepeat() {
  const { main: node, sections } = new Parser("[ C = 0 C ]").parse();
  assertEquals(sections.length, 1);
  assertEquals(sections[0].mark, "C");
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

Deno.test(function parseRepeat() {
  const { main: node } = new Parser("$line_1").parse();
  if (node.type !== NodeType.ERROR) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(
    node.error.message,
    "Error at line 1 (END ''): Could not resolve '$line_1'",
  );
});

Deno.test(function parseOperations() {
  const { main: node } = new Parser(
    "key -3 _5/16[ 'program_64' 'vivace'  'fff' _/8 0 1 2 0 _/8 r ]",
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

Deno.test(function parseCombination() {
  const { main: node, sections } = new Parser(
    "['allegro' 'f' \n" +
      "$A = [_/8 0 1 2 0 _/8 r] $A\n" +
      "$B = [_/8 2 3 _/2 4 _/8 r] $B\n" +
      "% this was a puzzle to get right!\n" +
      "$C = _/8[4 _/16 5 4 _/16 3 _/4 2 _/4 0 r] $C\n" +
      "$D = [_/8 0 -3 _/2 0 _/8r] $D\n]",
  ).parse();
  if (node.type !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  assertEquals(sections.length, 4);
  assertEquals(node.options?.key, undefined);
  assertEquals(node.children[0], Node.event("allegro"));
  assertEquals(node.children[1], Node.event("f"));
});

Deno.test(function parseError() {
  const { main } = new Parser("{ 3h 2 4 }").parse();
  if (main.type !== NodeType.ERROR) {
    fail(`wrong child type ${NodeType[main.type]}`);
  }
  assertEquals(main.token.type, TokenType.INTEGER);
  assertEquals(
    main.error.message,
    "Error at line 1 (INTEGER '2'): Could not resolve 'h'",
  );
});

Deno.test(function noFalseAccidentals() {
  const { main: node } = new Parser("[_/8 0 -3 _/2 0 _/8 r]").parse();
  if (node.type !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  const accidents = node.children.map((it) =>
    it.type === NodeType.NOTE ? it.accident : -1
  );
  assertEquals(accidents, [0, 0, 0, -1]);
});

Deno.test(function noFalseDurations() {
  const { main: node } = new Parser("[_/8 2 3 _/2 4 _/8 r]").parse();
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

Deno.test(function addMetaData() {
  const { main, metadata } = new Parser(
    "0,{ 'tempo'= 500000 'title'='one note' 'cresc poco a poco'={'from'=43'to'=85} 'parts'=['piano' 'viola']}",
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
