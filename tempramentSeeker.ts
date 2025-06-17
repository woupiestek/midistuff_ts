import { assert } from "https://deno.land/std@0.178.0/testing/asserts.ts";

function approximateLog(b: number, a: number) {
  assert(a > b);
  assert(b > 1);
  const c = [1, 0];
  const d = [0, 1];
  for (let i = 2; i < 8; i++) {
    const p = i & 1;
    let ci = c[i - 2];
    let di = d[i - 2];
    for (;;) {
      ci += c[i - 1];
      di += d[i - 1];
      const e = a ** ci;
      const f = b ** di;
      if (p && e > f) break;
      if (!p && e < f) break;
      c[i] = ci;
      d[i] = di;
      if (e === f) break;
    }
  }
  console.log(
    `${b}:${a}`,
    Array(8).keys().map((i) => `${c[i]}/${d[i]}`).toArray().slice(3).join(),
  );
}

approximateLog(5, 16);
approximateLog(10 / 3, 8);
approximateLog(1.75, 2);
approximateLog(1.5, 2);
approximateLog(2, 3);
approximateLog(3, 4);
approximateLog(1.25, 2);
approximateLog(4, 5);
approximateLog(1.2, 2);
approximateLog(5, 6);

function idealStep(
  perthird: number,
  perfifth: number,
  peroctave: number,
) {
  return Math.exp(
    (perthird * Math.log(1.25) + perfifth * Math.log(1.5) +
      peroctave * Math.log(2)) /
      (perthird ** 2 + perfifth ** 2 + peroctave ** 2),
  );
}

function show(perthird: number, perfifth: number, peroctave: number) {
  const step = idealStep(perthird, perfifth, peroctave);
  console.log(
    perthird,
    step ** perthird,
    perfifth,
    step ** perfifth,
    peroctave,
    step ** peroctave,
  );
}
show(4, 7, 12);
show(6, 11, 19);
show(10, 18, 31);

function approximate(x: number) {
  const t = [1, x | 0];
  const n = [0, 1];
  for (let i = 2; i < 5; i++) {
    const a = Math.ceil((t[i - 2] - x * n[i - 2]) / (t[i - 1] - x * n[i - 1]));
    t[i] = t[i - 2] - a * t[i - 1];
    n[i] = n[i - 2] - a * n[i - 1];
  }
  console.log(
    Array(5).keys().map((i) => `${t[i]}/${n[i]}`).toArray().slice(2).join(),
  );
}

approximate(2 ** (7 / 12));
approximate(2 ** (1 / 2));
approximate(2 ** (5 / 12));
approximate(2 ** (1 / 3));
approximate(2 ** (1 / 4));
approximate(2 ** (1 / 6));
approximate(2 ** (1 / 12));

approximate(2 ** (11 / 19));
approximate(2 ** (8 / 19));
approximate(2 ** (6 / 19));
approximate(2 ** (5 / 19));
approximate(2 ** (3 / 19));
