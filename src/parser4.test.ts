import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { NodeType, Parser } from "./parser4.ts";
import { TokenType } from "./scanner3.ts";

Deno.test(function parseRest() {
  const { data: { nodes: [node] } } = new Parser("_/4 r").parse();
  if (node?.type !== NodeType.REST) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  assertEquals(node.duration.numerator, 1);
  assertEquals(node.duration.denominator, 4);
});

Deno.test(function parseSimpleRest() {
  const { data: { nodes: [node] } } = new Parser("r").parse();
  if (node?.type !== NodeType.REST) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  assertEquals(node.duration.numerator, 1);
  assertEquals(node.duration.denominator, 4);
});

Deno.test(function parseNote() {
  const { data } = new Parser("_3/4 -7++").parse();
  const node = data.nodes[0];
  if (node?.type !== NodeType.NOTE) {
    data.errors.forEach((it) => console.error(it.error));
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  const note = data.notes[node.id];
  assertEquals(note.degree, -7);
  assertEquals(note.accident, 2);
  assertEquals(node.duration.numerator, 3);
  assertEquals(node.duration.denominator, 4);
});

Deno.test(function parseSimpleNote() {
  const { data } = new Parser("-7").parse();
  const node = data.nodes[0];
  if (node?.type !== NodeType.NOTE) {
    fail(`wrong type ${NodeType.stringify(node?.type ?? 3)}`);
  }
  const note = data.notes[node.id];
  assertEquals(note.degree, -7);
  assertEquals(note.accident, 0);
  assertEquals(node.duration.numerator, 1);
  assertEquals(node.duration.denominator, 4);
});

Deno.test(function parseSet() {
  const { data: { nodes: [node] } } = new Parser("_/4[ _/8 0 1 2 0 _/8 r ]")
    .parse();
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node.type)}`);
  }
  assertEquals(NodeType.length(node.type), 5);
});

Deno.test(function parsePitchSet() {
  const { data: { nodes: [node] } } = new Parser("_5/16[ 0 2 4 ]").parse();
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node.type ?? 3)}`);
  }
  assertEquals(NodeType.length(node.type), 3);
  assertEquals(node.duration.numerator, 5);
  assertEquals(node.duration.denominator, 16);
});

Deno.test(function parseJoin() {
  const { data: { nodes: [node] } } = new Parser("_/2{ 0  2-  4 }").parse();
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.SET) {
    fail(`wrong type ${NodeType.stringify(node.type ?? 3)}`);
  }
  assertEquals(NodeType.length(node.type), 3);
});

Deno.test(function parseResolvedRepeat() {
  const { data } = new Parser("[ C = 0 C ]").parse();
  const node = data.nodes[0];
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node.type ?? 3)}`);
  }
  assertEquals(NodeType.length(node.type), 2);
  assertEquals(data.nodes[1], data.nodes[2]);
});

Deno.test(function parseRepeat() {
  const { data } = new Parser("$line_1").parse();
  assertEquals(
    data.errors[0].error.message,
    "Error at [1;8] '…e_1…': Could not resolve '$line_1'",
  );
});

Deno.test(function parseOperations() {
  const { data } = new Parser(
    "key -3 _5/16[ 'program_64' 'vivace'  'fff' _/8 0 1 2 0 _/8 r ]",
  ).parse();
  const node = data.nodes[0];
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node.type ?? 3)}`);
  }
  assertEquals(node.key, -3);
  assertEquals(data.events, ["program_64", "vivace", "fff"]);
  assertEquals(node.duration.numerator, 5);
  assertEquals(node.duration.denominator, 16);
});

Deno.test(function parseCombination() {
  const { data } = new Parser(
    "['allegro' 'f' \n" +
      "$A = [_/8 0 1 2 0 _/8 r] $A\n" +
      "$B = [_/8 2 3 _/2 4 _/8 r] $B\n" +
      "% this was a puzzle to get right!\n" +
      "$C = _/8[4 _/16 5 4 _/16 3 _/4 2 _/4 0 r] $C\n" +
      "$D = [_/8 0 -3 _/2 0 _/8r] $D\n]",
  ).parse();
  const node = data.nodes[0];
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node.type ?? 3)}`);
  }
  assertEquals(node.key, 0);
  assertEquals(data.events, ["allegro", "f"]);
});

Deno.test(function parseError() {
  const { data } = new Parser("{ 3h 2 4 }").parse();
  const error = data.errors[0];
  assertEquals(error.token.type, TokenType.INTEGER);
  assertEquals(
    error.error.message,
    "Error at [1;6] '…3h 2 4…': Could not resolve 'h'",
  );
});

Deno.test(function noFalseAccidentals() {
  const { data } = new Parser("[_/8 0 -3 _/2 0 _/8 r]").parse();
  const node = data.nodes[0];
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node.type ?? 3)}`);
  }
  const accidents = data.notes.map((it) => it.accident);
  assertEquals(accidents, [0, 0, 0]);
});

Deno.test(function noFalseDurations() {
  const { data } = new Parser("[_/8 2 3 _/2 4 _/8 r]").parse();
  const node = data.nodes[0];
  if (!node) fail("missing node");
  if (NodeType.base(node.type) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(node.type ?? 3)}`);
  }
  assertEquals(NodeType.length(node.type), 4);
  const durations = data.nodes.slice(1).map((it) =>
    it.duration.numerator &&
      it.duration.denominator
      ? it.duration.numerator / it.duration.denominator
      : undefined
  );
  assertEquals(durations, [0.125, 0.25, 0.5, 0.125]);
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
