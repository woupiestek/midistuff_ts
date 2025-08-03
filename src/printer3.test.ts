import { assertEquals } from "https://deno.land/std@0.178.0/testing/asserts.ts";
import { Parser } from "./parser3.ts";
import { Printer } from "./printer3.ts";
import { Tokens } from "./tokens.ts";

Deno.test(function parseCombination() {
  const text = "[\n  'allegro' 'f' $A = [_/8 0 1 2 0 _/8 r] $A\n" +
    "  $B = [_/8 2 3 _/2 4 _/8 r] $B\n" +
    "  $C = _/8 [4 _/16 5 4 _/16 3 _/4 2 _/4 0 r] $C\n" +
    "  $D = [_/8 0 -3 _/2 0 _/8 r] $D\n],\n{'bpm' = 135}";
  const text2 = new Printer().pretty(
    64,
    new Parser(new Tokens(text)).parse(),
  );
  assertEquals(text2, text);
});
