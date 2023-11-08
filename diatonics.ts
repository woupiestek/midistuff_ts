function note(degree: number, key = 0): number {
  return Math.floor((425 + 12 * degree + key) / 7);
}

for (let key = -6; key <= 6; key++) {
  const scale: number[] = [];
  for (let degree = 0; degree <= 7; degree++) {
    scale.push(note(degree, key));
  }
  console.log(key, ":", ...scale);
}

console.log("lowest", note(-35));
console.log("lowest piano", note(-23));
console.log("highest piano", note(28));
console.log("highest", note(39));
