import { Pyth } from "../pythagorean.ts";
import { mod } from "../util.ts";
import { Element } from "./xml.ts";

export function pitchFromPyth(pyth: Pyth): Element {
  const pitch = Element.make(
    "pitch",
    Element.make(
      "octave",
      (4 + Math.floor((pyth.wholes + pyth.halves / 2) / 6)).toString(),
    ),
    Element.make("step", "ABCDEFG"[mod(pyth.degree + 2, 7)]),
  );
  const _alter = Math.floor((2 * pyth.wholes - 5 * pyth.halves + 1) / 7);
  if (_alter !== 0) {
    pitch.content.push(Element.make("alter", _alter.toString()));
  }
  return pitch;
}
