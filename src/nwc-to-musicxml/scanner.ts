export type NWCLines = {
  tags: string[];
  values: Record<string, string[]>[];
};

export function scan(source: string): NWCLines {
  const lines = source.split("\n").map((line) => line.trim()).filter((line) =>
    line.length > 0
  );
  const result: NWCLines = { tags: [], values: [] };
  for (const line of lines) {
    const columns = line.split("|");
    if (columns[0] !== "") continue;
    result.tags.push(columns[1].trim());
    result.values.push(Object.fromEntries(
      columns.slice(2).map((value) => {
        const [k, v] = value.split(":");
        return [k, v.split(",")];
      }),
    ));
  }
  return result;
}
