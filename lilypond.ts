import { Lilyponder } from "./src/lilyponder.ts";
import { Parser } from "./src/parser3.ts";
import { Transformer } from "./src/transformer.ts";

const sample = `key 1 "allegro" "f" _/8[
  A = [
    "treble" [4 1 5 6 1 5 4 [0+, 3] [0, 5] _/4 3 _5/8 3
    5 1 6 7 2 6 5 [2-, 4] [1, 6] _/4 4 _5/8 4
    4 1 5 6 1 5 4 2 4 _/4 2 _5/8 2],
    "bass" [_ [-3, -1] -2 -6 -1 0 -6 -1 -2 [-3, -6]
    _ [-4, 0] -3 -6 -2 -1 -6 -2 -3 [-4, -6]
    _ [-3, -1] -2 -7 -1 0 -7 -1 -2 [-7+, -3]]
  ]
  [
    "treble" [3 1 4 5 0+ 4 3 [0+, 2] _/2 [0, 1] _/2 [0, 3]],
    "bass" [-2 -6 -1 0 -5 -1 -2 -5+ _/2 [-4, -2] _/2 [-6, -2+]]
  ]
  A
  [
    "treble" [3 1 4 5 1 4 3 1 _ [1, 4]],
    "bass" [-2 -6 -1 0 -5 -1 -2 -4 _ [-3, -1]]
  ]
]
{ "bpm" = 140 }
`;

const encoder = new TextEncoder();
const ast = new Parser(encoder.encode(sample)).parse();

const transformer = new Transformer(
  new Map([
    ["treble", new Map([["voice", 1]])],
    ["bass", new Map([["voice", 2]])],
  ])
);
console.log(...transformer.transform(ast));

const printer = new Lilyponder();
console.log(printer.stringify(ast));
