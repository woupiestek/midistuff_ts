import { AST, Node, NodeType, Options } from "./parser3.ts";
import { Pyth } from "./pythagorean.ts";
import { Ratio } from "./util.ts";

export type Note = {
  type: "note";
  pyth: Pyth;
  start: Ratio;
  stop: Ratio;
};
export type Event = {
  type: "event";
  value: string;
  time: Ratio;
};

export class Params {
  __duration?: Ratio;
  __key?: number;
  constructor(
    duration?: Ratio,
    key?: number,
    readonly parent?: Params,
  ) {
    this.__duration = duration;
    this.__key = key;
  }

  get duration(): Ratio {
    if (!this.__duration) {
      this.__duration = this.parent ? this.parent.duration : new Ratio(1, 4);
    }
    return this.__duration;
  }

  get key(): number {
    if (!this.__key) {
      this.__key = this.parent ? this.parent.key : 0;
    }
    return this.__key;
  }
}

export class Transformer {
  #sections: { node: Node; mark: string; __params?: Params }[] = [];
  #buffer: (Event | Note)[] = [];
  #time: Ratio = new Ratio(0, 1);
  transform(ast: AST) {
    this.#sections = ast.sections;
    // todo: something with the metadata
    this.#buffer = [];
    this.#time = new Ratio(0, 1);
    this.#node(ast.main, new Params());
    return this.#buffer;
  }

  #params(params: Params, options?: Options): Params {
    if (!options) return params;
    return new Params(options.duration, options.key, params);
  }

  #node(node: Node, params: Params) {
    switch (node.type) {
      case NodeType.ERROR:
        return console.error(node.error);
      case NodeType.EVENT:
        this.#buffer.push({
          type: "event",
          value: node.value,
          time: this.#time,
        });
        return;
      case NodeType.INSERT: {
        const section = this.#sections[node.index];
        if (!section) console.error(`section ${node.index} is missing`);
        if (!section.__params) {
          section.__params = params;
        }
        this.#node(section.node, section.__params);
        return;
      }
      case NodeType.NOTE: {
        const _params = this.#params(params, node.options);
        this.#buffer.push({
          type: "note",
          start: this.#time,
          stop: this.#time.plus(_params.duration),
          pyth: Pyth.fromPitch(_params.key, node.degree, node.accident),
        });
        this.#time = this.#time.plus(_params.duration);
        return;
      }
      case NodeType.REST: {
        this.#time = this.#time.plus(
          this.#params(params, node.options).duration,
        );
        return;
      }
      case NodeType.ARRAY: {
        const _params = this.#params(params, node.options);
        for (const child of node.children) {
          this.#node(child, _params);
        }
        return;
      }
      case NodeType.SET: {
        const _params = this.#params(params, node.options);
        const start = this.#time;
        let end = start;
        for (const child of node.children) {
          this.#time = start;
          this.#node(child, _params);
          if (end.less(this.#time)) end = this.#time;
        }
        this.#time = end;
        return;
      }
    }
  }
}
