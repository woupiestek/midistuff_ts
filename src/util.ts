export function gcd(a: number, b: number): number {
  if (a < 0) a = -a;
  if (b < 0) b = -b;
  for (;;) {
    if (!a) return b;
    b %= a;
    if (!b) return a;
    a %= b;
  }
}

export function mod(x: number, y: number): number {
  return x < 0 ? y - 1 - ((-1 - x) % y) : x % y;
}

export function binaryFloor(x: number): number {
  x |= x >> 1;
  x |= x >> 2;
  x |= x >> 4;
  x |= x >> 8;
  x |= x >> 16;
  return x - (x >>> 1);
}

export class Ratio {
  readonly numerator: number;
  readonly denominator: number;
  constructor(n: number, d: number) {
    const c = gcd(n, d);
    this.numerator = n / c;
    this.denominator = d / c;
  }
  plus(that: Ratio) {
    return new Ratio(
      this.numerator * that.denominator + this.denominator * that.numerator,
      this.denominator * that.denominator,
    );
  }
  compare(that: Ratio) {
    return (
      this.numerator * that.denominator - this.denominator * that.numerator
    );
  }
  less(that: Ratio) {
    return this.compare(that) < 0;
  }
  get value() {
    return this.numerator / this.denominator;
  }
}
