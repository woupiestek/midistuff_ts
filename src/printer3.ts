import { AST, Node, NodeType, Options, Value } from "./parser3.ts";
import { Ratio } from "./util.ts";

type Doc =
  | ["concat", Doc[]]
  | ["line"]
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
  nest(depth: number, doc: Doc): Doc {
    return ["nest", depth, doc];
  },
  text(value: string): Doc {
    return ["text", value];
  },
  delimit(left: Doc, middle: Doc[], right: Doc) {
    return Doc.group([
      left,
      Doc.nest(2, Doc.concat(middle.flatMap((it) => [Doc.line(), it]))),
      Doc.line(),
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
      return ["text", " "];
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
      .map((it) => (typeof it === "string" ? it : "\n".padEnd(it)))
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

export class Printer {
  pretty(width: number, ast: AST): string | undefined {
    const file = this.#file(ast);
    return be(width, 0, [[0, file]])?.layout();
  }

  #file(ast: AST): Doc {
    const node = this.#node(ast.main, ast.sections);
    if (Object.keys(ast.metadata).length === 0) {
      return node;
    }
    return Doc.group([
      node,
      Doc.text(","),
      Doc.line(),
      this.#map(ast.metadata),
    ]);
  }

  #map(map: Record<string, Value>, key?: string) {
    return Doc.delimit(
      this.#assign(Doc.text("{"), key),
      Object.entries(map).map(([k, v]) => this.#value(v, k)),
      Doc.text("}"),
    );
  }

  #array(array: Value[], key?: string): Doc {
    return Doc.delimit(
      this.#assign(Doc.text("["), key),
      Object.entries(array).map((it) => this.#value(it)),
      Doc.text("]"),
    );
  }

  #assign(end: Doc, key?: string): Doc {
    if (!key) return end;
    return Doc.group([
      Doc.text(key),
      Doc.line(),
      Doc.text("="),
      Doc.line(),
      end,
    ]);
  }

  #value(value: Value, key?: string): Doc {
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
    if (options.labels) {
      for (const label of options.labels) {
        docs.push(Doc.text(`"${label.replace('"', '""')}"`), Doc.line());
      }
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

  static RATIO = 2;
  // simplistic grouping
  // to be replaced with grouping by measure
  // how? we have a kind of interpreter here,
  // it just needs a time variable
  #group(doc: Doc[]): Doc[] {
    let group: Doc[] = [];
    const groups: Doc[] = [];
    const l = Math.ceil(Math.sqrt(doc.length * Printer.RATIO));
    for (let i = 0; i < doc.length; i++) {
      group.push(doc[i]);
      if (i % l === l - 1) {
        groups.push(Doc.group(group));
        group = [];
      } else {
        group.push(Doc.line());
      }
    }
    if (group.length > 0) groups.push(Doc.group(group));
    return groups;
  }

  #node(
    node: Node,
    sections: { mark: string; node: Node; done?: boolean }[],
    key?: string,
  ): Doc {
    switch (node.type) {
      case NodeType.ERROR:
        return Doc.error(node.error);
      case NodeType.INSERT: {
        const section = sections[node.index];
        const mark = Doc.text(section.mark);
        if (!section.done) {
          section.done = true;
          return this.#node(section.node, sections, section.mark);
        }
        return mark;
      }
      case NodeType.SET: {
        return Doc.delimit(
          this.#assign(
            node.options
              ? this.#options(node.options, Doc.text("{"))
              : Doc.text("{"),
            key,
          ),
          node.children.map((it) => this.#node(it, sections)),
          Doc.text("}"),
        );
      }
      case NodeType.ARRAY: {
        return Doc.delimit(
          this.#assign(
            node.options
              ? this.#options(node.options, Doc.text("["))
              : Doc.text("["),
            key,
          ),
          // group by measure?
          this.#group(
            node.children.map((child) => this.#node(child, sections)),
          ),
          Doc.text("]"),
        );
      }
      case NodeType.NOTE: {
        const doc = Doc.text(
          (node.degree | 0).toString() +
            ["--", "-", "", "+", "++"][node.accident + 2],
        );
        return this.#assign(
          node.options ? this.#options(node.options, doc) : doc,
          key,
        );
      }
      case NodeType.REST: {
        const doc = Doc.text("r");
        return this.#assign(
          node.options ? this.#options(node.options, doc) : doc,
          key,
        );
      }
    }
  }
}
