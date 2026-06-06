import { Transformer } from "./transformer.ts";

const samplesDir = "samples";
const targetDir = "target";

function diffLines(xml: string): string[] {
  return xml.replaceAll("><", ">\n<").split(/\r?\n/);
}

type DiffOperation =
  | { type: "equal"; line: string }
  | { type: "delete"; line: string }
  | { type: "insert"; line: string };

function getPathValue(path: Map<number, number>, key: number): number {
  return path.get(key) ?? -1;
}

function diffOperations(expected: string[], actual: string[]): DiffOperation[] {
  const maxDistance = expected.length + actual.length;
  let path = new Map<number, number>([[1, 0]]);
  const trace: Map<number, number>[] = [];

  for (let distance = 0; distance <= maxDistance; distance++) {
    trace.push(new Map(path));
    for (
      let diagonal = -distance;
      diagonal <= distance;
      diagonal += 2
    ) {
      const cameFromInsert = diagonal === -distance ||
        (diagonal !== distance &&
          getPathValue(path, diagonal - 1) <
            getPathValue(path, diagonal + 1));
      let expectedIndex = cameFromInsert
        ? getPathValue(path, diagonal + 1)
        : getPathValue(path, diagonal - 1) + 1;
      let actualIndex = expectedIndex - diagonal;

      while (
        expectedIndex < expected.length &&
        actualIndex < actual.length &&
        expected[expectedIndex] === actual[actualIndex]
      ) {
        expectedIndex++;
        actualIndex++;
      }

      path.set(diagonal, expectedIndex);
      if (expectedIndex >= expected.length && actualIndex >= actual.length) {
        return backtrackDiff(expected, actual, trace);
      }
    }
  }

  return [];
}

function backtrackDiff(
  expected: string[],
  actual: string[],
  trace: Map<number, number>[],
): DiffOperation[] {
  let expectedIndex = expected.length;
  let actualIndex = actual.length;
  const operations: DiffOperation[] = [];

  for (let distance = trace.length - 1; distance >= 0; distance--) {
    const path = trace[distance];
    const diagonal = expectedIndex - actualIndex;
    const previousDiagonal = diagonal === -distance ||
        (diagonal !== distance &&
          getPathValue(path, diagonal - 1) < getPathValue(path, diagonal + 1))
      ? diagonal + 1
      : diagonal - 1;
    const previousExpectedIndex = getPathValue(path, previousDiagonal);
    const previousActualIndex = previousExpectedIndex - previousDiagonal;

    while (
      expectedIndex > previousExpectedIndex &&
      actualIndex > previousActualIndex
    ) {
      operations.push({
        type: "equal",
        line: expected[expectedIndex - 1],
      });
      expectedIndex--;
      actualIndex--;
    }

    if (distance === 0) break;

    if (expectedIndex === previousExpectedIndex) {
      operations.push({
        type: "insert",
        line: actual[previousActualIndex],
      });
    } else {
      operations.push({
        type: "delete",
        line: expected[previousExpectedIndex],
      });
    }

    expectedIndex = previousExpectedIndex;
    actualIndex = previousActualIndex;
  }

  return operations.reverse();
}

function printDiff(expected: string[], actual: string[]) {
  let expectedLine = 1;
  let actualLine = 1;

  for (const operation of diffOperations(expected, actual)) {
    if (operation.type === "equal") {
      expectedLine++;
      actualLine++;
    } else if (operation.type === "delete") {
      console.log(`- ${expectedLine}: ${operation.line}`);
      expectedLine++;
    } else {
      console.log(`+ ${actualLine}: ${operation.line}`);
      actualLine++;
    }
  }
}

function changedOperations(
  expected: string[],
  actual: string[],
): DiffOperation[] {
  return diffOperations(expected, actual).filter((operation) =>
    operation.type !== "equal"
  );
}

Deno.test("diffOperations keeps alignment after an inserted line", () => {
  const changes = changedOperations(
    ["<a>", "<b>", "<c>"],
    ["<a>", "<inserted>", "<b>", "<c>"],
  );
  if (
    JSON.stringify(changes) !==
      JSON.stringify([{ type: "insert", line: "<inserted>" }])
  ) {
    throw new Error(`Unexpected changes: ${JSON.stringify(changes)}`);
  }
});

Deno.test("diffOperations keeps alignment after a deleted line", () => {
  const changes = changedOperations(
    ["<a>", "<removed>", "<b>", "<c>"],
    ["<a>", "<b>", "<c>"],
  );
  if (
    JSON.stringify(changes) !==
      JSON.stringify([{ type: "delete", line: "<removed>" }])
  ) {
    throw new Error(`Unexpected changes: ${JSON.stringify(changes)}`);
  }
});

if (import.meta.main) {
  const list = [];
  for await (const entry of Deno.readDir(samplesDir)) {
    if (entry.name.endsWith(".nwctxt")) {
      list.push(entry.name.substring(0, entry.name.length - 7));
    }
  }

  for (const fileName of list) {
    console.log("Processing", fileName);
    const source = await Deno.readTextFile(`${samplesDir}\\${fileName}.nwctxt`);
    const target = await Deno.readTextFile(`${targetDir}\\${fileName}.xml`);
    try {
      const result = new Transformer().transform(source);
      if (result === target) {
        console.log(fileName, "OK");
      } else {
        console.log(fileName, "DIFFER");
        const a = diffLines(target);
        const b = diffLines(result);
        printDiff(a, b);
      }
    } catch (e) {
      console.error("Something went wrong", fileName, e);
    }
  }
}
