import { AST, Node, NodeType, Options, Value } from "./parser3.ts";

export class Printer {
  #strings: string[] = [];
  pop() {
    const b = this.#strings.join("");
    this.#strings = [];
    return b;
  }

  file(ast: AST): void {
    this.#node(ast.main, ast.sections);
    if (ast.metadata.size > 0) {
      this.#emit(" ");
      this.#map(ast.metadata);
    }
  }

  #space() {
    this.#strings.push(" ");
  }

  #emit(...chars: string[]) {
    this.#strings.push(...chars);
  }

  #string(value: string) {
    this.#emit('"', value.replace('"', '""'), '"');
  }

  #integer(value: number) {
    this.#emit((value | 0).toString());
  }

  #map(map: Map<string, Value>) {
    this.#emit("{");
    if (map.size === 0) return this.#emit("}");
    const entries = [...map.entries()];
    const [key, value] = entries[0];
    this.#pair(key, value);
    for (let i = 1; i < entries.length; i++) {
      this.#space();
      const [key, value] = entries[i];
      this.#pair(key, value);
    }
    this.#emit("}");
  }

  #array(array: Value[]) {
    if (array.length === 0) {
      this.#emit("]");
      return;
    }
    this.#value(array[0]);
    for (const value of array) {
      this.#space();
      this.#value(value);
    }
    this.#emit("]");
  }

  #value(value: Value) {
    switch (typeof value) {
      case "string":
        this.#string(value);
        break;
      case "number":
        this.#integer(value);
        break;
      default:
        if (value instanceof Map) {
          this.#map(value);
          break;
        }
        this.#array(value);
        break;
    }
  }

  #pair(key: string, value: Value) {
    this.#string(key);
    this.#space();
    this.#emit("=");
    this.#space();
    this.#value(value);
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
      case NodeType.ARRAY:
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
