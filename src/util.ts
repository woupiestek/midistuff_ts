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
