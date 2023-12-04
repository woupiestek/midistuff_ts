import { mod } from "./util.ts";

export function pythToMidi(wholes: number, halves: number): number {
  return 2 * wholes + halves;
}

export type Pyth = {
  wholes: number;
  halves: number;
};

// choices have to be made to account for data loss
export function midiToPyth(tone: number): Pyth {
  const wholes = Math.floor((tone * 5 + 8) / 12);
  const halves = tone - 2 * wholes;
  // t = 2 w + h
  // 2w - 5h minimized.
  return { wholes, halves };
}
// cases to get this 'correct'
// b : 59 : 25w + 9h
// c : 60 : 25w + 10h
// f : 65 : 27w + 11h

export type Diatone = {
  octave: number;
  tone: "a" | "b" | "c" | "d" | "e" | "f" | "g";
  alter: number;
};
export function pythToDiatone(wholes: number, halves: number): Diatone {
  const octave = Math.floor((wholes + halves / 2) / 6);
  const tone = "abcdefg"[mod(wholes + halves + 3, 7)] as
    | "a"
    | "b"
    | "c"
    | "d"
    | "e"
    | "f"
    | "g";
  const alter = 2 * wholes - 8 * octave - halves;
  return { octave, tone, alter };
}

export function diatoneToPyth(
  octave: number,
  tone: "a" | "b" | "c" | "d" | "e" | "f" | "g",
  alter: number
): Pyth {
  const x = {
    a: [4, 1],
    b: [5, 1],
    c: [0, 0],
    d: [1, 0],
    e: [2, 0],
    f: [2, 1],
    g: [3, 1],
  }[tone];
  const wholes = 5 * octave + x[0] + alter;
  const halves = 2 * octave + x[1] - alter;
  return { wholes, halves };
}
