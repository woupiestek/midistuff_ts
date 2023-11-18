import { AST, Node, NodeType, Options, Value } from "./parser3.ts";
import { mod, Ratio } from "./util.ts";

export type Note = {
  pitch: {
    step: number;
    alter: number;
  };
  start: Ratio;
  stop: Ratio;
  attributes: Map<string, Value>;
};

export class Params {
  __attributes: Map<string, Value>;
  __duration?: Ratio;
  __key?: number;
  constructor(
    attributes?: Map<string, Value>,
    duration?: Ratio,
    key?: number,
    readonly parent?: Params,
  ) {
    if (parent) {
      if (attributes) {
        this.__attributes = new Map(parent.__attributes);
        for (const [k, v] of attributes) {
          this.__attributes.set(k, v);
        }
      } else {
        this.__attributes = parent.__attributes;
      }
    } else if (attributes) {
      this.__attributes = attributes;
    } else {
      this.__attributes = new Map();
    }
    this.__duration = duration;
    this.__key = key;
  }

  get attributes(): Map<string, Value> {
    return this.__attributes;
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

  alter(degree: number) {
    return Math.floor((this.key + [5, 3, 1, 6, 4, 2, 0][mod(degree, 7)]) / 7);
  }
}

export class Transformer {
  #sections: { node: Node; mark: string; __params?: Params }[] = [];
  #buffer: Note[] = [];
  #time: Ratio = new Ratio(0, 1);
  constructor(readonly sheet: Map<string, Map<string, Value>>) {}

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
    const _attributes: Map<string, Value> = new Map();
    if (options.labels) {
      for (const label of options.labels) {
        const attributes = this.sheet.get(label);
        if (!attributes) continue;
        for (const [k, v] of attributes.entries()) {
          _attributes.set(k, v);
        }
      }
    }
    return new Params(_attributes, options.duration, options.key, params);
  }

  #node(node: Node, params: Params) {
    switch (node.type) {
      case NodeType.ERROR:
        return console.error(node.error);
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
          attributes: _params.attributes,
          start: this.#time,
          stop: this.#time.plus(_params.duration),
          pitch: {
            step: node.degree,
            alter: node.accident + _params.alter(node.degree),
          },
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
      case NodeType.SEQUENCE: {
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
