const a = [0, 1];

for (let i = 2; i < 100; i++) {
  a[i] = 2 * a[i - 1] + a[i - 2];
}

console.log(a);
console.log(a.map((x, i, a) => i < 2 ? 1 : x / a[i - 1] - 1));
