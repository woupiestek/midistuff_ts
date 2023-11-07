import {
  assertEquals,
  fail,
} from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { NodeType, Parser } from "./parser3.ts";

const textEncoder = new TextEncoder();

Deno.test(function parseRest() {
  const node = new Parser(textEncoder.encode("r.4")).parse();
  if (node.type !== NodeType.REST) fail("wrong type");
  assertEquals(node.duration, 0.25);
});

Deno.test(function parseNote() {
  const node = new Parser(textEncoder.encode("3cs;.c")).parse();
  if (node.type !== NodeType.NOTE) fail("wrong type");
  assertEquals(node.pitch, 49);
  assertEquals(node.duration, 0.75);
});

Deno.test(function parseSequence() {
  const node = new Parser(textEncoder.encode("{ 3c;.2 3d;.4 3e;.4 3c;.4 r.2 }"))
    .parse();
  if (node.type !== NodeType.JOIN) fail("wrong type");
  assertEquals(node.children.length, 1);
  const child = node.children[0];
  if (child.type !== NodeType.SEQUENCE) fail("wrong child type");
  assertEquals(child.children.length, 5);
});

// more tests!
