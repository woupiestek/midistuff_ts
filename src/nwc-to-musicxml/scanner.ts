export type NWCLines = {
  tags: string[];
  lineNumbersByTag: Record<string, number[]>;
  values: Record<string, string[]>[];
};

export function scan(source: string): NWCLines {
  const lines = source.split("\n").map((line) => line.trim()).filter((line) =>
    line.length > 0
  );
  const result: NWCLines = { tags: [], values: [], lineNumbersByTag: {} };
  let lineNumber = 0;
  for (const line of lines) {
    const columns = line.split("|");
    if (columns[0] !== "") continue; // wait
    const tag = columns[1].trim();
    result.tags.push(tag);
    (result.lineNumbersByTag[tag] ??= []).push(lineNumber++);
    result.values.push(Object.fromEntries(
      columns.slice(2).map((value) => {
        const [k, v] = value.split(":");
        return [k, v.split(",")];
      }),
    ));
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
