import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { NodeType, Parser } from "./parser3.ts";
import { TokenType } from "./scanner3.ts";

const textEncoder = new TextEncoder();

Deno.test(function parseRest() {
  const { main: node } = new Parser(textEncoder.encode("_/4 r")).parse();
  if (node.type !== NodeType.REST) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.options?.duration?.numerator, 1);
  assertEquals(node.options?.duration?.denominator, 4);
});

Deno.test(function parseSimpleRest() {
  const { main: node } = new Parser(textEncoder.encode("r")).parse();
  if (node.type !== NodeType.REST) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.options?.duration?.numerator, undefined);
  assertEquals(node.options?.duration?.denominator, undefined);
});

Deno.test(function parseNote() {
  const { main: node } = new Parser(textEncoder.encode("_3/4 -7++")).parse();
  if (node.type !== NodeType.NOTE) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.degree, -7);
  assertEquals(node.accident, 2);
  assertEquals(node.options?.duration?.numerator, 3);
  assertEquals(node.options?.duration?.denominator, 4);
});

Deno.test(function parseSimpleNote() {
  const { main: node } = new Parser(textEncoder.encode("-7")).parse();
  if (node.type !== NodeType.NOTE) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.degree, -7);
  assertEquals(node.accident, 0);
  assertEquals(node.options?.duration?.numerator, undefined);
  assertEquals(node.options?.duration?.denominator, undefined);
});

Deno.test(function parseSet() {
  const { main: node } = new Parser(
    textEncoder.encode("_/4[ _/8 0 1 2 0 _/8 r ]"),
  ).parse();
  if (node.type !== NodeType.SEQUENCE) {
    fail(`wrong child type ${NodeType[node.type]}`);
  }
  assertEquals(node.children.length, 5);
});

Deno.test(function parsePitchSet() {
  const { main: node } = new Parser(
    textEncoder.encode("_5/16[ 0 2 4 ]"),
  ).parse();
  if (node.type !== NodeType.SEQUENCE) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  assertEquals(node.children.length, 3);
  assertEquals(node.options?.duration?.numerator, 5);
  assertEquals(node.options?.duration?.denominator, 16);
});

Deno.test(function parseJoin() {
  const { main: node } = new Parser(
    textEncoder.encode("_/2[ 0 , 2- , 4 ]"),
  ).parse();
  if (node.type !== NodeType.SET) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.children.length, 3);
});

Deno.test(function parseMark() {
  const { main: node, sections } = new Parser(
    textEncoder.encode("$line_1 = _/4[ _/8 0 1 2 0 _/8 r ]"),
  ).parse();
  if (node.type !== NodeType.INSERT) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.index, 0);
  assertEquals(sections.length, 1);
  assertEquals(sections[0].mark, "$line_1");
  const child = sections[0].node;
  if (child.type !== NodeType.SEQUENCE) fail("wrong child type");
});

Deno.test(function parseResolvedRepeat() {
  const { main: node, sections } = new Parser(
    textEncoder.encode("[ C = 0 C ]"),
  ).parse();
  assertEquals(sections.length, 1);
  assertEquals(sections[0].mark, "C");
  if (node.type !== NodeType.SEQUENCE) {
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
  const { main: node } = new Parser(textEncoder.encode("$line_1")).parse();
  if (node.type !== NodeType.ERROR) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(
    node.error.message,
    "Error at line 1 (END ''): Could not resolve '$line_1'",
  );
});

Deno.test(function parseOperations() {
  const { main: node } = new Parser(
    textEncoder.encode(
      '"program_64" "vivace" key -3 "fff" _5/16[ _/8 0 1 2 0 _/8 r ]',
    ),
  ).parse();
  if (node.type !== NodeType.SEQUENCE) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  assertEquals(node.options?.key, -3);
  assertEquals(node.options?.labels, new Set(["program_64", "vivace", "fff"]));
  assertEquals(node.options?.duration?.numerator, 5);
  assertEquals(node.options?.duration?.denominator, 16);
});

Deno.test(function parseDoubleDynamics() {
  const { main: node } = new Parser(
    textEncoder.encode('"f" "f" _/4[ _/8 0 1 2 0 _/8 r ]'),
  ).parse();
  if (node.type !== NodeType.ERROR) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.token.type, TokenType.TEXT);
  assertEquals(
    node.error.message,
    "Error at line 1 (TEXT '\"f\"'): Double 'f'",
  );
});

Deno.test(function parseCombination() {
  const { main: node, sections } = new Parser(
    textEncoder.encode(
      '"allegro" "f" [\n' +
        "$A = [_/8 0 1 2 0 _/8 r] $A\n" +
        "$B = [_/8 2 3 _/2 4 _/8 r] $B\n" +
        "% this was a puzzle to get right!\n" +
        "$C = _/8[4 _/16 5 4 _/16 3 _/4 2 _/4 0 r] $C\n" +
        "$D = [_/8 0 -3 _/2 0 _/8r] $D\n]",
    ),
  ).parse();
  if (node.type !== NodeType.SEQUENCE) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  assertEquals(sections.length, 4);
  assertEquals(node.options?.key, undefined);
  assertEquals(node.options?.labels, new Set(["allegro", "f"]));
});

Deno.test(function parseError() {
  const { main: node } = new Parser(textEncoder.encode("[ 3h, 2, 4 ]")).parse();
  if (node.type !== NodeType.SET) fail(`wrong type ${NodeType[node.type]}`);
  assertEquals(node.children.length, 3);
  const child = node.children[0];
  if (child.type !== NodeType.ERROR) {
    fail(`wrong child type ${NodeType[child.type]}`);
  }
  assertEquals(child.token.type, TokenType.COMMA);
  assertEquals(
    child.error.message,
    "Error at line 1 (COMMA ','): Could not resolve 'h'",
  );
});

Deno.test(function noFalseAccidentals() {
  const { main: node } = new Parser(
    textEncoder.encode("[_/8 0 -3 _/2 0 _/8 r]"),
  ).parse();
  if (node.type !== NodeType.SEQUENCE) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  const accidents = node.children.map((it) =>
    it.type === NodeType.NOTE ? it.accident : -1
  );
  assertEquals(accidents, [0, 0, 0, -1]);
});

Deno.test(function noFalseDurations() {
  const { main: node } = new Parser(
    textEncoder.encode("[_/8 2 3 _/2 4 _/8 r]"),
  ).parse();
  if (node.type !== NodeType.SEQUENCE) {
    fail(`wrong type ${NodeType[node.type]}`);
  }
  const durations = node.children.map((it) =>
    it.type !== NodeType.ERROR &&
      it.type !== NodeType.INSERT &&
      it.options?.duration?.numerator &&
      it.options?.duration?.denominator
      ? it.options.duration?.numerator / it.options.duration?.denominator
      : undefined
  );
  assertEquals(durations, [0.125, undefined, 0.5, 0.125]);
});

Deno.test(function addMetaData() {
  const { metadata } = new Parser(
    textEncoder.encode(
      '0{ "tempo"= 500000 "title"="one note" "cresc poco a poco"={"from"=43"to"=85} "parts"=["piano" "viola"]}',
    ),
  ).parse();
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
