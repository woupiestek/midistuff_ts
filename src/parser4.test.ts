import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { NodeType, Parser } from "./parser4.ts";
import { TokenType } from "./scanner3.ts";

Deno.test(function parseRest() {
  const { main: node } = new Parser("_/4 r").parse();
  if (node?.type !== NodeType.REST) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  assertEquals(node.options?.duration?.numerator, 1);
  assertEquals(node.options?.duration?.denominator, 4);
});

Deno.test(function parseSimpleRest() {
  const { main: node } = new Parser("r").parse();
  if (node?.type !== NodeType.REST) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  assertEquals(node.options?.duration?.numerator, undefined);
  assertEquals(node.options?.duration?.denominator, undefined);
});

Deno.test(function parseNote() {
  const { main: node, target } = new Parser("_3/4 -7++").parse();
  if (node?.type !== NodeType.NOTE) {
    target.errors.forEach((it) => console.error(it.error));
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  const note = target.notes[node?.index];
  assertEquals(note.degree, -7);
  assertEquals(note.accident, 2);
  assertEquals(node.options?.duration?.numerator, 3);
  assertEquals(node.options?.duration?.denominator, 4);
});

Deno.test(function parseSimpleNote() {
  const { main: node, target } = new Parser("-7").parse();
  if (node?.type !== NodeType.NOTE) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  const note = target.notes[node?.index];
  assertEquals(note.degree, -7);
  assertEquals(note.accident, 0);
  assertEquals(node.options?.duration?.numerator, undefined);
  assertEquals(node.options?.duration?.denominator, undefined);
});

Deno.test(function parseSet() {
  const { main: node } = new Parser("_/4[ _/8 0 1 2 0 _/8 r ]").parse();
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node.type)}`);
  }
  assertEquals(NodeType.length(node.type), 5);
});

Deno.test(function parsePitchSet() {
  const { main: node } = new Parser("_5/16[ 0 2 4 ]").parse();
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  assertEquals(NodeType.length(node.type), 3);
  assertEquals(node.options?.duration?.numerator, 5);
  assertEquals(node.options?.duration?.denominator, 16);
});

Deno.test(function parseJoin() {
  const { main: node } = new Parser("_/2{ 0  2-  4 }").parse();
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.SET) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  assertEquals(NodeType.length(node.type), 3);
});

Deno.test(function parseResolvedRepeat() {
  const { main: node, target } = new Parser("[ C = 0 C ]").parse();
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  assertEquals(NodeType.length(node.type), 2);
  const node1 = target.nodes[node.index];
  const node2 = target.nodes[node.index + 1];
  assertEquals(node1, node2);
});

Deno.test(function parseRepeat() {
  const { target } = new Parser("$line_1").parse();
  assertEquals(
    target.errors[0].error.message,
    "Error at [1;8] '…e_1…': Could not resolve '$line_1'",
  );
});

Deno.test(function parseOperations() {
  const { main: node, target } = new Parser(
    "key -3 _5/16[ 'program_64' 'vivace'  'fff' _/8 0 1 2 0 _/8 r ]",
  ).parse();
  if (!node) fail("missing node");
  if (NodeType.base(node?.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  assertEquals(node.options?.key, -3);
  assertEquals(target.events, ["program_64", "vivace", "fff"]);
  assertEquals(node.options?.duration?.numerator, 5);
  assertEquals(node.options?.duration?.denominator, 16);
});

Deno.test(function parseCombination() {
  const { main: node, target } = new Parser(
    "['allegro' 'f' \n" +
      "$A = [_/8 0 1 2 0 _/8 r] $A\n" +
      "$B = [_/8 2 3 _/2 4 _/8 r] $B\n" +
      "% this was a puzzle to get right!\n" +
      "$C = _/8[4 _/16 5 4 _/16 3 _/4 2 _/4 0 r] $C\n" +
      "$D = [_/8 0 -3 _/2 0 _/8r] $D\n]",
  ).parse();
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  assertEquals(node.options?.key, undefined);
  assertEquals(target.events, ["allegro", "f"]);
});

Deno.test(function parseError() {
  const { target } = new Parser("{ 3h 2 4 }").parse();
  const error = target.errors[0];
  assertEquals(error.token.type, TokenType.INTEGER);
  assertEquals(
    error.error.message,
    "Error at [1;6] '…3h 2 4…': Could not resolve 'h'",
  );
});

Deno.test(function noFalseAccidentals() {
  const { main: node, target } = new Parser("[_/8 0 -3 _/2 0 _/8 r]").parse();
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  const accidents = target.notes.map((it) => it.accident);
  assertEquals(accidents, [0, 0, 0]);
});

Deno.test(function noFalseDurations() {
  const { main: node, target } = new Parser("[_/8 2 3 _/2 4 _/8 r]").parse();
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  const from = node.index;
  const to = from + NodeType.length(node.type);

  const durations = target.nodes.slice(from, to).map((it) =>
      it.options?.duration?.numerator &&
      it.options?.duration?.denominator
      ? it.options.duration?.numerator / it.options.duration?.denominator
      : undefined
  );
  assertEquals(durations, [0.125, undefined, 0.5, 0.125]);
});

Deno.test(function addMetaData() {
  const { metadata } = new Parser(
    "0,{ 'tempo'= 500000 'title'='one note' 'cresc poco a poco'={'from'=43'to'=85} 'parts'=['piano' 'viola']}",
  ).parse();
  assertEquals(metadata?.tempo, 500000);
  assertEquals(metadata?.title, "one note");
  const cpap = metadata?.["cresc poco a poco"];
  if (!(cpap instanceof Object) || cpap instanceof Array) {
    console.log(cpap);
    fail("unexpected type");
  }
  assertEquals(cpap.from, 43);
  assertEquals(cpap.to, 85);
  assertEquals(metadata?.parts, ["piano", "viola"]);
});
