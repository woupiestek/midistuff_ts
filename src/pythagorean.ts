import { mod } from "./util.ts";

export class Pyth {
  constructor(readonly wholes: number, readonly halves: number) {}

  toMidi() {
    return 2 * this.wholes + this.halves;
  }

  static fromMidi(tone: number) {
    const wholes = Math.floor((tone * 5 + 8) / 12);
    return new Pyth(wholes, tone - 2 * wholes);
  }

  diatone() {
    const octave = Math.floor((this.wholes + this.halves / 2) / 6);
    const tone = "abcdefg"[mod(this.wholes + this.halves + 3, 7)] as
      | "a"
      | "b"
      | "c"
      | "d"
      | "e"
      | "f"
      | "g";
    const alter = 2 * this.wholes - 8 * octave - this.halves;
    return { octave, tone, alter };
  }

  fifths() {
    return 2 * this.wholes - 5 * this.halves;
  }

  toString() {
    return `${this.wholes}W + ${this.halves}H`;
  }

  toPitch(key = 0): Pitch {
    return {
      degree: this.wholes + this.halves,
      alter: Math.floor((this.fifths() + 1 - key) / 7),
    };
  }

  static fromPitch(key: number, degree: number, alter: number) {
    return new Pyth(
      Math.floor((key + 5 * degree + 5) / 7) + alter,
      Math.floor((-key + 2 * degree + 1) / 7) - alter,
    );
  }

  equals(that: Pyth): boolean {
    return this.wholes === that.wholes && this.halves === that.halves;
  }
}

export type Diatone = {
  octave: number;
  tone: "a" | "b" | "c" | "d" | "e" | "f" | "g";
  alter: number;
};

export function diatoneToPyth(
  octave: number,
  tone: "a" | "b" | "c" | "d" | "e" | "f" | "g",
  alter: number,
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
  return new Pyth(5 * octave + x[0] + alter, 2 * octave + x[1] - alter);
}

type Pitch = {
  degree: number;
  alter: number;
};

export function pitchToPyth(key: number, degree: number, alter: number) {
  return new Pyth(
    Math.floor((key + 5 * degree + 5) / 7) + alter,
    Math.floor((-key + 2 * degree + 1) / 7) - alter,
  );
}
