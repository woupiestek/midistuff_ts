export type NWCLines = {
  lineNumbersByTag: Record<string, number[]>;
  values: Record<string, string[]>[];
  skipped: number[];
};

export function scan(source: string): NWCLines {
  const lines = source.split("\n");
  const result: NWCLines = { values: [], lineNumbersByTag: {}, skipped: [] };
  for (let i = 0; i < lines.length; i++) {
    const columns = lines[i].trim().split("|");
    if (columns.length < 2) {
      result.skipped.push(i);
      continue;
    }
    const tag = columns[1].trim();
    (result.lineNumbersByTag[tag] ??= []).push(i);
    result.values[i] = {};
    for (const value of columns.slice(2)) {
      const [k, v] = value.split(":");
      result.values[i][k] = v.split(",");
    }
  }
  return result;
}

// assuming a sorted list of numbers,
// count how many of them are less than the given number
export function countLessThan(number: number, numbers: number[]): number {
  // find first index where numbers[idx] >= number
  let lo = 0;
  let hi = numbers.length;

  // Do binary search until the remaining range is small (<16)
  while (hi - lo >= 16) {
    const mid = lo + ((hi - lo) >> 1);
    if (numbers[mid] < number) lo = mid + 1;
    else hi = mid;
  }

  // finish with linear scan in the small range
  let idx = lo;
  while (idx < hi && numbers[idx] < number) idx++;
  return idx;
}
