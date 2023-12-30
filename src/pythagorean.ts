export class Pyth {
  constructor(readonly wholes: number, readonly halves: number) {}

  toMidi() {
    return 2 * this.wholes + this.halves;
  }

  static fromMidi(tone: number) {
    const wholes = Math.floor((tone * 5 + 8) / 12);
    return new Pyth(wholes, tone - 2 * wholes);
  }

  fifths() {
    return 2 * this.wholes - 5 * this.halves;
  }

  toString() {
    return `${this.wholes}W + ${this.halves}H`;
  }

  get degree() {
    return this.wholes + this.halves;
  }

  toPitch(key = 0): Pitch {
    return {
      degree: this.degree,
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

type Pitch = {
  degree: number;
  alter: number;
};
