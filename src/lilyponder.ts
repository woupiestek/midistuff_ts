import { NodeType, Node, Options, AST } from "./parser3.ts";

export class Params {
  constructor(readonly options: Options, readonly parent?: Params) {}

  get key(): number {
    if (!this.options.key) {
      this.options.key = this.parent?.key || 0;
    }
    return this.options.key;
  }
}

export class Lilyponder {
  static #STEPS = "cdefgab";
  static #ALTER: number[] = [5, 3, 1, 6, 4, 2, 0];
  static #pitch(key: number, degree: number, accident: number): string {
    const index = degree < 0 ? -(-degree % 7) : degree % 7;
    const name = [Lilyponder.#STEPS[index]];
    const alter = accident + Math.floor((key + Lilyponder.#ALTER[index]) / 7);
    if (alter > 0) for (let i = 0; i < alter; i++) name.push("is");
    if (alter < 0) for (let i = 0; i < -alter; i++) name.push("es");
    const octave = Math.floor(degree / 7);
    if (octave < -1) for (let i = 0; i < 1 - octave; i++) name.push(",");
    if (octave > -1) for (let i = 0; i < 1 + octave; i++) name.push("'");
    return name.join("");
  }

  #node(node: Node, params: Params): string {
    switch (node.type) {
      case NodeType.ERROR:
      case NodeType.INSERT:
        // todo
        return "?";
      case NodeType.NOTE: {
        const _params = node.options
          ? new Params(node.options, params)
          : params;
        return Lilyponder.#pitch(_params.key, node.degree, node.accident);
      }
      case NodeType.REST:
        return "?";
      case NodeType.SEQUENCE: {
        const _params = node.options
          ? new Params(node.options, params)
          : params;
        const result = ["{"];
        for (const child of node.children) {
          result.push(this.#node(child, _params));
        }
        result.push("}");
        return result.join(" ");
      }
      case NodeType.SET: {
        const _params = node.options
          ? new Params(node.options, params)
          : params;
        const result = ["<<"];
        for (const child of node.children) {
          result.push(this.#node(child, _params));
        }
        result.push(">>");
        return result.join(" ");
      }
    }
  }

  stringify(ast: AST): string {
    return this.#node(ast.main, new Params({}));
  }
}
