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

export function plus(
  x: [number, number],
  y: [number, number],
): [number, number] {
  const a = x[0] * y[1] + x[1] * y[0];
  const b = x[1] * y[1];
  const c = gcd(a, b);
  return [a / c, b / c];
}

export function less(
  x: [number, number],
  y: [number, number],
): boolean {
  return x[0] * y[1] < x[1] * y[0];
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
