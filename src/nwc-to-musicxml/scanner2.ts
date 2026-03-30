export type NWCFile = {
  tags: {
    [_: string]: Set<number>;
  };
  values: {
    [_: string]: {
      [_: string]: Set<number>;
    };
  };
};

export function scan(source: string): NWCFile {
  const lines = source.split("\n").map((line) => line.trim()).filter((line) =>
    line.length > 0
  );
  const result: NWCFile = { tags: {}, values: {} };
  for (let i = 0, l = lines.length; i < l; i++) {
    const line = lines[i];
    const columns = line.split("|");
    if (columns[0] !== "") continue;
    const tag = columns[1].trim();
    result.tags[tag] ||= new Set();
    result.tags[tag].add(i);
    columns.slice(2).map((value) => {
      const [k, vs] = value.split(":");
      result.values[k] ||= {};
      vs.split(",").forEach((v) => {
        result.values[k][v] ||= new Set();
        result.values[k][v].add(i);
      });
    });
  }
  return result;
}
