import { assert } from "https://deno.land/std@0.178.0/testing/asserts.ts";

function approximateLog(b: number, a: number) {
  assert(a > b);
  assert(b > 1);
  const c = [1, 0];
  const d = [0, 1];
  for (let i = 2; i < 10; i++) {
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
    Array(10).keys().map((i) => `${c[i]}/${d[i]}`).toArray().join(", "),
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
