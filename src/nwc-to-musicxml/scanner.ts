export type NWCLine = {
  tag: string;
  values: Record<string, string[]>;
};

export function scan(source: string): NWCLine[] {
  const lines = source.split("\n").map((line) => line.trim()).filter((line) =>
    line.length > 0
  );
  const result = [];
  for (const line of lines) {
    const columns = line.split("|");
    if (columns[0] !== "") continue;
    const tag = columns[1].trim();
    const values = Object.fromEntries(
      columns.slice(2).map((value) => {
        const [k, v] = value.split(":");
        return [k, v.split(",")];
      }),
    );
    result.push({ tag, values });
  }
  return result;
}
