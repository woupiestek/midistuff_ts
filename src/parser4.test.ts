import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { NodeType, Parser } from "./parser4.ts";
import { TokenType } from "./tokens.ts";

Deno.test(function parseRest() {
  const { data: { nodes, rests } } = new Parser("_/4 r").parse();
  if (nodes.types[0] !== NodeType.REST) {
    fail(`wrong type ${NodeType.stringify(nodes.types[0] ?? 3)}`);
  }
  assertEquals(rests[0].numerator, 1);
  assertEquals(rests[0].denominator, 4);
});

Deno.test(function parseSimpleRest() {
  const { data: { nodes, rests } } = new Parser("r").parse();
  if (nodes.types[0] !== NodeType.REST) {
    fail(`wrong type ${NodeType.stringify(nodes.types[0] ?? 3)}`);
  }
  assertEquals(rests[0].numerator, 1);
  assertEquals(rests[0].denominator, 4);
});

Deno.test(function parseNote() {
  const { data } = new Parser("_3/4 -7++").parse();
  if (data.nodes.types[0] !== NodeType.NOTE) {
    data.errors.errors.forEach((it) => console.error(it));
    fail(`wrong type ${NodeType.stringify(data.nodes.types[0] ?? 3)}`);
  }
  const id = data.nodes.ids[0];
  assertEquals(data.notes.degrees[id], -7);
  assertEquals(data.notes.accidentals[id], 2);
  assertEquals(data.notes.durations[id].numerator, 3);
  assertEquals(data.notes.durations[id].denominator, 4);
});

Deno.test(function parseSimpleNote() {
  const { data } = new Parser("-7").parse();
  if (data.nodes.types[0] !== NodeType.NOTE) {
    fail(`wrong type ${NodeType.stringify(data.nodes.types[0] ?? 3)}`);
  }
  const id = data.nodes.ids[0];
  assertEquals(data.notes.degrees[id], -7);
  assertEquals(data.notes.accidentals[id], undefined);
  assertEquals(data.notes.durations[id].numerator, 1);
  assertEquals(data.notes.durations[id].denominator, 4);
});

Deno.test(function parseSet() {
  const { data: { nodes } } = new Parser("_/4[ _/8 0 1 2 0 _/8 r ]")
    .parse();
  if (NodeType.base(nodes.types[0]) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(nodes.types[0])}`);
  }
  assertEquals(NodeType.length(nodes.types[0]), 5);
});

Deno.test(function parsePitchSet() {
  const { data: { nodes, notes } } = new Parser("_5/16[ 0 2 4 ]").parse();
  if (NodeType.base(nodes.types[0]) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(nodes.types[0] ?? 3)}`);
  }
  assertEquals(NodeType.length(nodes.types[0]), 3);
  notes.durations.forEach((d) => {
    assertEquals(d.numerator, 5);
    assertEquals(d.denominator, 16);
  });
});

Deno.test(function parseJoin() {
  const { data: { nodes } } = new Parser("_/2{ 0  2-  4 }").parse();
  if (NodeType.base(nodes.types[0]) !== NodeType.SET) {
    fail(`wrong type ${NodeType.stringify(nodes.types[0] ?? 3)}`);
  }
  assertEquals(NodeType.length(nodes.types[0]), 3);
});

Deno.test(function parseResolvedRepeat() {
  const { data } = new Parser("[ C = 0 C ]").parse();
  if (NodeType.base(data.nodes.types[0]) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(data.nodes.types[0] ?? 3)}`);
  }
  assertEquals(NodeType.length(data.nodes.types[0]), 2);
  assertEquals(data.nodes.ids[1], data.nodes.ids[2]);
});

Deno.test(function parseRepeat() {
  const { data } = new Parser("$line_1").parse();
  assertEquals(
    data.errors.errors[0].message,
    "Error at [1;1] '…$li…': Could not resolve '$line_1'",
  );
});

Deno.test(function parseOperations() {
  const { data } = new Parser(
    "key -3 _5/16[ 'program_64' 'vivace'  'fff' _/8 0 1 2 0 _/8 r ]",
  ).parse();
  if (NodeType.base(data.nodes.types[0]) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(data.nodes.types[0] ?? 3)}`);
  }
  assertEquals(data.notes.keys[0], -3);
  assertEquals(data.events, ["program_64", "vivace", "fff"]);
  assertEquals(data.notes.durations[0].numerator, 1);
  assertEquals(data.notes.durations[0].denominator, 8);
  assertEquals(data.notes.durations[1].numerator, 5);
  assertEquals(data.notes.durations[1].denominator, 16);
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
  if (NodeType.base(data.nodes.types[0]) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(data.nodes.types[0] ?? 3)}`);
  }
  assertEquals(data.notes.keys[0], 0);
  assertEquals(data.events, ["allegro", "f"]);
});

Deno.test(function parseError() {
  const parser = new Parser("{ 3h 2 4 }");
  const { data } = parser.parse();
  assertEquals(parser.tokens.types[data.errors.tokens[0]], TokenType.INTEGER);
  assertEquals(
    data.errors.errors[0].message,
    "Error at [1;4] '…{ 3h 2…': Could not resolve 'h'",
  );
});

Deno.test(function noFalseAccidentals() {
  const { data } = new Parser("[_/8 0 -3 _/2 0 _/8 r]").parse();
  if (NodeType.base(data.nodes.types[0]) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(data.nodes.types[0] ?? 3)}`);
  }
  assertEquals(data.notes.accidentals, {});
});

Deno.test(function noFalseDurations() {
  const { data } = new Parser("[_/8 2 3 _/2 4 _/8 r]").parse();
  if (NodeType.base(data.nodes.types[0]) !== NodeType.ARRAY) {
    fail(`wrong type ${NodeType.stringify(data.nodes.types[0] ?? 3)}`);
  }
  assertEquals(NodeType.length(data.nodes.types[0]), 4);
  const durations = data.notes.durations.map((it) =>
    it.numerator &&
      it.denominator
      ? it.numerator / it.denominator
      : undefined
  );
  assertEquals(durations, [
    0.125,
    0.25,
    0.5,
  ]);
  const rests = data.rests.map((it) =>
    it.numerator &&
      it.denominator
      ? it.numerator / it.denominator
      : undefined
  );
  assertEquals(rests, [0.125]);
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
