import { AST, Node, NodeType, Options, Value } from "./parser3.ts";
import { Ratio } from "./util.ts";

type Doc =
  | ["concat", Doc[]]
  | ["line"]
  | ["limit line"]
  | ["error", Error]
  | ["nest", number, Doc]
  | ["text", string]
  | ["union", Doc, Doc];

const Doc = {
  concat(docs: Doc[]): Doc {
    const result = [];
    for (const doc of docs) {
      if (doc[0] === "concat") {
        result.push(...doc[1]);
      } else {
        result.push(doc);
      }
    }
    return ["concat", result];
  },
  error(error: Error): Doc {
    return ["error", error];
  },
  group(doc: Doc[]): Doc {
    return ["union", Doc.concat(doc.map(flatten)), Doc.concat(doc)];
  },
  line(): Doc {
    return ["line"];
  },
  limitLine(): Doc {
    return ["limit line"];
  },
  nest(depth: number, doc: Doc): Doc {
    return ["nest", depth, doc];
  },
  text(value: string): Doc {
    return ["text", value];
  },
  delimit(left: Doc, middle: Doc[], right: Doc) {
    if (middle.length === 0) {
      return Doc.concat([left, right]);
    }
    const [h, ...t] = middle;
    return Doc.group([
      left,
      Doc.nest(
        2,
        Doc.concat([
          Doc.limitLine(),
          h,
          ...t.flatMap((it) => [Doc.line(), it]),
        ]),
      ),
      Doc.limitLine(),
      right,
    ]);
  },
};

function flatten(doc: Doc): Doc {
  switch (doc[0]) {
    case "concat":
      return Doc.concat(doc[1].map(flatten));
    case "error":
      return doc;
    case "line":
      return Doc.text(" ");
    case "limit line":
      return Doc.concat([]);
    case "nest":
      return flatten(doc[2]);
    case "text":
      return doc;
    case "union":
      return flatten(doc[1]);
  }
}

class Doc2 {
  #elements: (number | string)[] = [];
  #column = 0;
  fits(width: number): boolean {
    return this.#column < width;
  }
  push(element: string | number) {
    if (typeof element === "string") {
      this.#column += element.length;
    } else {
      this.#column = element;
    }
    this.#elements.push(element);
    return this;
  }
  layout() {
    return this.#elements
      .map((it) => (typeof it === "string" ? it : "\n".padEnd(1 + it)))
      .join("");
  }
}

function be(width: number, count: number, pairs: [number, Doc][]): Doc2 | null {
  if (count > width) return null;
  if (pairs.length === 0) return new Doc2();
  const [indent, doc] = pairs.pop() as [number, Doc];
  switch (doc[0]) {
    case "concat": {
      const ps: [number, Doc][] = doc[1].map((it: Doc) => [indent, it]);
      pairs.push(...ps);
      return be(width, count, pairs);
    }
    case "error":
      return (
        be(width, indent, pairs)?.push(`% ${doc[1].message}`).push(indent) ||
        null
      );
    case "line":
    case "limit line":
      return be(width, indent, pairs)?.push(indent) || null;
    case "text":
      return be(width, count += doc[1].length, pairs)?.push(doc[1]) || null;
    case "nest":
      pairs.push([doc[1] + indent, doc[2]]);
      return be(width, count, pairs);
    case "union": {
      const pairs2: [number, Doc][] = [...pairs, [indent, doc[2]]];
      pairs.push([indent, doc[1]]);
      const a = be(width, count, pairs);
      if (a != null && a.fits(width - count)) return a;
      return be(width, count, pairs2);
    }
  }
}

type Combi = {
  doc: Doc;
  duration: number;
};
export class Printer {
  constructor(private groupingDuration = 2) {}

  pretty(width: number, ast: AST): string | undefined {
    const file = this.#file(ast);
    return be(width, 0, [[0, file]])?.layout();
  }

  #file(ast: AST): Doc {
    const node = this.#node(ast.main, ast.sections, 0.25);
    if (Object.keys(ast.metadata).length === 0) {
      return node.doc;
    }
    return Doc.group([
      node.doc,
      Doc.text(","),
      Doc.line(),
      this.#map(ast.metadata),
    ]);
  }

  #map(map: Record<string, Value>, key?: Doc): Doc {
    return Doc.delimit(
      this.#assign(Doc.text("{"), key),
      Object.entries(map).map(([k, v]) => this.#value(v, this.#label(k))),
      Doc.text("}"),
    );
  }

  #array(array: Value[], key?: Doc): Doc {
    return Doc.delimit(
      this.#assign(Doc.text("["), key),
      Object.entries(array).map((it) => this.#value(it)),
      Doc.text("]"),
    );
  }

  #assign(end: Doc, key?: Doc): Doc {
    if (!key) return end;
    return Doc.group([
      key,
      Doc.line(),
      Doc.text("="),
      Doc.line(),
      end,
    ]);
  }

  #value(value: Value, key?: Doc): Doc {
    switch (typeof value) {
      case "string":
        return this.#assign(Doc.text(value), key);
      case "number":
        Doc.text((value | 0).toString());
        return this.#assign(Doc.text((value | 0).toString()), key);
      default:
        if (value instanceof Array) {
          return this.#array(value, key);
        }
        return this.#map(value, key);
    }
  }

  #label(string: string): Doc {
    return Doc.text(`'${string.replace("'", "''")}'`);
  }

  #options(options: Options, end: Doc): Doc {
    const docs = [];
    if (options.key) {
      docs.push(
        Doc.text("key"),
        Doc.line(),
        Doc.text((options.key | 0).toString()),
        Doc.line(),
      );
    }
    if (options.duration) {
      docs.push(this.#duration(options.duration), Doc.line());
    }
    docs.push(end);
    return Doc.group(docs);
  }

  #duration(ratio: Ratio): Doc {
    const y = ["_"];
    if (ratio.numerator > 1) {
      y.push((ratio.numerator | 0).toString());
    }
    if (ratio.denominator > 1) {
      y.push("/");
      y.push((ratio.denominator | 0).toString());
    }
    return Doc.text(y.join(""));
  }

  /* use duration to group a series of documents. The idea was to put each measure on a
  line. Currently it just takes a duration of 2 whole notes, which can be set in the
  constructor.
   */
  #group(combies: Combi[]): Combi[] {
    if (combies.length === 0) return [];
    const groups: Combi[] = [];
    let group: Doc[] = [combies[0].doc];
    let time = combies[0].duration;
    for (let i = 1; i < combies.length; i++) {
      const { duration, doc } = combies[i];
      if (time + duration / 2 >= this.groupingDuration) {
        groups.push({ doc: Doc.group(group), duration: time });
        group = [doc];
        time = duration;
      } else {
        time += duration;
        group.push(Doc.line());
        group.push(doc);
      }
    }
    if (group.length > 0) {
      groups.push({ doc: Doc.group(group), duration: time });
    }
    return groups;
  }

  #node(
    node: Node,
    sections: { mark: string; node: Node; duration?: number }[],
    currentDuration: number,
    key?: Doc,
  ): Combi {
    switch (node.type) {
      case NodeType.ERROR:
        return { doc: Doc.error(node.error), duration: 0 };
      case NodeType.EVENT:
        return { doc: this.#label(node.value), duration: 0 };
      case NodeType.INSERT: {
        const section = sections[node.index];
        const mark = Doc.text(section.mark);
        if (section.duration === undefined) {
          const y = this.#node(
            section.node,
            sections,
            currentDuration,
            Doc.text(section.mark),
          );
          section.duration = y.duration;
          return y;
        }
        return { doc: mark, duration: section.duration };
      }
      case NodeType.SET: {
        let duration = 0;
        const doc = Doc.delimit(
          this.#assign(
            node.options
              ? this.#options(node.options, Doc.text("{"))
              : Doc.text("{"),
            key,
          ),
          node.children.map((it) => {
            const { duration: d, doc } = this.#node(
              it,
              sections,
              node.options?.duration?.value || currentDuration,
            );
            if (d > duration) duration = d;
            return doc;
          }),
          Doc.text("}"),
        );
        return { doc, duration };
      }
      case NodeType.ARRAY: {
        const groups = this.#group(
          node.children.map((child) =>
            this.#node(
              child,
              sections,
              node.options?.duration?.value || currentDuration,
            )
          ),
        );
        const duration = groups.reduce(
          (time, { duration }) => (time += duration),
          0,
        );
        const doc = Doc.delimit(
          this.#assign(
            node.options
              ? this.#options(node.options, Doc.text("["))
              : Doc.text("["),
            key,
          ),
          // group by measure?
          groups.map(({ doc }) => doc),
          Doc.text("]"),
        );
        return { doc, duration };
      }
      case NodeType.NOTE: {
        const doc = Doc.text(
          (node.degree | 0).toString() +
            ["--", "-", "", "+", "++"][node.accident + 2],
        );
        return {
          doc: this.#assign(
            node.options ? this.#options(node.options, doc) : doc,
            key,
          ),
          duration: node.options?.duration?.value || currentDuration,
        };
      }
      case NodeType.REST: {
        const doc = Doc.text("r");
        return {
          doc: this.#assign(
            node.options ? this.#options(node.options, doc) : doc,
            key,
          ),
          duration: node.options?.duration?.value || currentDuration,
        };
      }
    }
  }
}
