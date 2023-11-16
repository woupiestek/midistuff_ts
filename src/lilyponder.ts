import { AST, Node, NodeType, Options } from "./parser3.ts";
import { mod, Ratio } from "./util.ts";

export class Params {
  __duration?: string[];
  constructor(readonly options: Options, readonly parent?: Params) {}

  get key(): number {
    if (!this.options.key) {
      this.options.key = this.parent?.key || 0;
    }
    return this.options.key;
  }

  get duration(): string[] {
    if (!this.__duration) {
      if (this.options.duration) {
        this.__duration = Lilyponder.duration(
          this.options.duration.numerator,
          this.options.duration.denominator,
        );
      } else if (this.parent) {
        this.__duration = this.parent.duration;
      } else this.__duration = ["4"];

      if (this.__duration instanceof Ratio) {
        throw new Error("what the fuck happened here!?");
      }
    }
    return this.__duration;
  }

  with(options?: Options) {
    if (!options) return this;
    return new Params(options, this);
  }
}

export class Lilyponder {
  static STEPS = "cdefgab";
  static ALTER: number[] = [5, 3, 1, 6, 4, 2, 0];
  static pitch(key: number, degree: number, accident: number): string {
    const index = mod(degree, 7); //degree < 0 ? 6 - ((-degree - 1) % 7) : degree % 7;
    const name = [Lilyponder.STEPS[index]];
    const alter = accident + Math.floor((key + Lilyponder.ALTER[index]) / 7);
    if (alter > 0) for (let i = 0; i < alter; i++) name.push("is");
    if (alter < 0) for (let i = 0; i < -alter; i++) name.push("es");
    const octave = Math.floor(degree / 7);
    if (octave < -1) for (let i = 0; i < 1 - octave; i++) name.push(",");
    if (octave > -1) for (let i = 0; i < 1 + octave; i++) name.push("'");
    return name.join("");
  }

  static duration(n: number, d: number): string[] {
    const result = [];
    let tie = "";
    let dots = "";
    while (n > 0) {
      switch (n & 3) {
        case 1:
          result.push(`${d}${dots}${tie}`);
          dots = "";
          tie = "~";
          break;
        case 3:
          dots += ".";
          break;
        default:
          break;
      }
      n >>= 1;
      d >>= 1;
    }
    return result.reverse();
  }

  #node(node: Node, params: Params): string[] {
    switch (node.type) {
      case NodeType.ERROR:
        return [`'${node.error.message}'!`];
      case NodeType.INSERT: {
        const section = this.#sections[node.index];
        if (!section.params) {
          section.params = params;
        }
        return this.#node(section.node, section.params);
      }
      case NodeType.NOTE: {
        const _params = params.with(node.options);
        const pitch = Lilyponder.pitch(_params.key, node.degree, node.accident);
        return _params.duration.map((d) => pitch + d);
      }
      case NodeType.REST: {
        const _params = params.with(node.options);
        return _params.duration.map((d) => "r" + d);
      }
      case NodeType.SEQUENCE: {
        const _params = params.with(node.options);
        const result = ["{"];
        for (const child of node.children) {
          result.push(...this.#node(child, _params));
        }
        result.push("}");
        return result;
      }
      case NodeType.SET: {
        const _params = params.with(node.options);
        const result = ["<<"];
        for (const child of node.children) {
          result.push(...this.#node(child, _params));
        }
        result.push(">>");
        return result;
      }
    }
  }

  #sections: { node: Node; mark: string; params?: Params }[] = [];
  stringify(ast: AST): string {
    this.#sections = ast.sections;
    return this.#node(ast.main, new Params({})).join(" ");
  }
}
