import { AST, KeyValuePairs, Node, NodeType, Options } from "./parser3.ts";

export class Printer {
  #strings: string[] = [];
  pop() {
    const b = this.#strings.join("");
    this.#strings = [];
    return b;
  }

  file(ast: AST): void {
    if (ast.metadata.length > 0) {
      this.#pairs(ast.metadata);
      this.#emit(" ");
    }
    this.#node(ast.main, ast.sections);
  }

  #space() {
      this.#strings.push(" ");
  }

  #emit(chars: string) {
      this.#strings.push(chars);
  }

  #string(value: string) {
    this.#emit('"' + value.replace('"', '""') + '"');
  }

  #integer(value: number) {
    this.#emit((value | 0).toString());
  }

  #pairs(metadata: KeyValuePairs) {
    this.#emit("{");
    const { key, value } = metadata[0];
    this.#pair(key, value);
    for (let i = 1; i < metadata.length; i++) {
      this.#space();
      const { key, value } = metadata[i];
      this.#pair(key, value);
    }
    this.#emit("}");
  }

  #pair(key: string, value: string | number | KeyValuePairs) {
    this.#string(key);
    this.#emit(":");
    this.#space();
    switch (typeof value) {
      case "string":
        this.#string(value);
        break;
      case "number":
        this.#integer(value);
        break;
      default:
        this.#pairs(value);
        break;
    }
    this.#emit(";");
  }

  #options(options: Options) {
    if (options.key) {
      this.#emit("key");
      this.#space();
      this.#integer(options.key);
      this.#space();
    }
    if (options.labels) {
      for (const label of options.labels) {
        this.#string(label);
        this.#space();
      }
    }
    if (options.durationNumerator && options.durationDenominator) {
      this.#emit("_");
      if (options.durationNumerator > 1) {
        this.#integer(options.durationNumerator);
      }
      if (options.durationDenominator > 1) {
        this.#emit("/");
        this.#integer(options.durationDenominator);
      }
      this.#space();
    }
  }

  #node(node: Node, sections: { mark: string; node: Node; done?: boolean }[]) {
    switch (node.type) {
      case NodeType.ERROR:
        this.#emit("%");
        this.#string(node.error.message);
        break;
      case NodeType.INSERT: {
        const section = sections[node.index];
        this.#emit("$");
        this.#emit(section.mark);
        if (!section.done) {
          section.done = true;
          this.#space();
          this.#emit("=");
          this.#space();
          this.#node(section.node, sections);
        }
        break;
      }
      case NodeType.SET:
        if (node.options) this.#options(node.options);
        this.#emit("[");
        if (node.children.length === 0) {
          this.#emit("]");
          break;
        }
        this.#node(node.children[0], sections);
        for (let i = 1; i < node.children.length; i++) {
          this.#emit(",");
          this.#space();
          this.#node(node.children[i], sections);
        }
        this.#emit("]");
        break;
      case NodeType.NOTE:
        if (node.options) this.#options(node.options);
        this.#integer(node.degree);
        switch (node.accident) {
          case 0:
            break;
          case 2:
            this.#emit("++");
            break;
          case 1:
            this.#emit("+");
            break;
          case -2:
            this.#emit("--");
            break;
          case -1:
            this.#emit("-");
            break;
        }
        break;
      case NodeType.REST:
        if (node.options) this.#options(node.options);
        this.#emit("r");
        break;
      case NodeType.SEQUENCE:
        if (node.options) this.#options(node.options);
        this.#node(node.children[0], sections);
        for (let i = 1; i < node.children.length; i++) {
          this.#space();
          this.#node(node.children[i], sections);
        }
        break;
    }
  }
}
