import { Pyth } from "../pythagorean.ts";
import { mod } from "../util.ts";
import { Element } from "./xml.ts";

function pitchFromPyth(pyth: Pyth): Element {
  const _octave = 4 + Math.floor((pyth.wholes + pyth.halves / 2) / 6);
  const pitch = Element.make(
    "pitch",
    Element.make("octave", _octave.toString()),
    Element.make("step", "ABCDEFG"[mod(pyth.degree + 3, 7)]),
  );
  const _alter = 2 * pyth.wholes - 8 * _octave - pyth.halves;
  if (_alter !== 0) {
    pitch.content.push(Element.make("alter", _alter.toString()));
  }
  return pitch;
}
