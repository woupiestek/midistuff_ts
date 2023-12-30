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
    if (d < 0) {
      n = -n;
      d = -d;
    }
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
  times(that: Ratio) {
    return new Ratio(
      this.numerator * that.numerator,
      this.denominator * that.denominator,
    );
  }
  minus(that: Ratio) {
    return new Ratio(
      this.numerator * that.denominator - this.denominator * that.numerator,
      this.denominator * that.denominator,
    );
  }
  compare(that: Ratio) {
    return (
      this.numerator * that.denominator - this.denominator * that.numerator
    );
  }
  equals(that: Ratio) {
    return (
      this.numerator * that.denominator === this.denominator * that.numerator
    );
  }
  less(that: Ratio) {
    return this.compare(that) < 0;
  }
  lessThan(that: number) {
    return this.numerator < that * this.denominator;
  }
  moreThan(that: number) {
    return this.numerator > that * this.denominator;
  }
  static int(n: number) {
    return new Ratio(n | 0, 1);
  }
  static ZERO = Ratio.int(0);
  static ONE = Ratio.int(1);
  get value() {
    return this.numerator / this.denominator;
  }
  toString() {
    return `${this.numerator}/${this.denominator}`;
  }
}

export function unique<A>(element: A, index: number, array: A[]) {
  return index === 0 || array[index - 1] !== element;
}

export function chain(input: number, depth = 100): number[] {
  const output: number[] = [];
  for (let i = 0; i < depth; i++) {
    const rest = input % 1;
    output.push(input - rest);
    if (rest * rest < Number.EPSILON) {
      return output;
    } else {
      input = 1 / rest;
    }
  }
  return output;
}

export function approximate(input: number, depth: number): Ratio {
  const _chain = chain(input, depth);
  let n = 0;
  let d = 1;
  for (let i = _chain.length - 1; i >= 0; i -= 2) {
    n += _chain[i] * d;
    if (i === 0) {
      return new Ratio(n, d);
    }
    d += _chain[i - 1] * n;
  }
  return new Ratio(d, n);
}
