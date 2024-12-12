import { Scanner } from "./scanner.ts";
import { Transformed } from "./transformer.ts";

const source = await Deno.readTextFile("samples\\2008-8-24!.nwctxt");
try {
  const scanner = new Scanner(source);
  for (const line of scanner.lines()) {
    const _line = [scanner.getName(scanner.getLineTag(line) + 1)];
    for (const column of scanner.getColumns(line)) {
      _line.push(scanner.getName(scanner.getColumnTag(column) + 1));
    }
    console.log(..._line);
  }
  const transformed = new Transformed(source);
  const dur = new Set(
    transformed.data.flatMap(({ dur }) =>
      dur ? (dur instanceof Array ? dur : [dur]) : []
    ),
  );
  //console.log(dur);
  console.log(transformed);
} catch (e) {
  console.error("Something went wrong", e);
}
