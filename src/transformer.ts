import { AST, Node, NodeType } from "./parser3.ts";
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

export class Transformer {
  #sections: { nodes: Node[]; marks: string[] } = { nodes: [], marks: [] };
  #keys: number[] = [];
  #durations: Ratio[] = [];
  #buffer: (Event | Note)[] = [];
  #time: Ratio = new Ratio(0, 1);
  transform(ast: AST) {
    this.#sections = ast.sections;
    // todo: something with the metadata
    this.#buffer = [];
    this.#time = new Ratio(0, 1);
    this.#node(ast.main, 0, new Ratio(1, 4));
    return this.#buffer;
  }

  #node(node: Node, key: number, duration: Ratio) {
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
        const _node = this.#sections.nodes[node.index];
        if (!_node) console.error(`section ${node.index} is missing`);
        this.#node(
          _node,
          this.#keys[node.index] ||= key,
          this.#durations[node.index] ||= duration,
        );
        return;
      }
      case NodeType.NOTE: {
        const stop = this.#time.plus(node.options?.duration ?? duration);
        this.#buffer.push({
          type: "note",
          start: this.#time,
          stop,
          pyth: Pyth.fromPitch(
            node.options?.key ?? key,
            node.degree,
            node.accident,
          ),
        });
        this.#time = stop;
        return;
      }
      case NodeType.REST: {
        this.#time = this.#time.plus(node.options?.duration ?? duration);
        return;
      }
      case NodeType.ARRAY: {
        for (const child of node.children) {
          this.#node(
            child,
            node.options?.key ?? key,
            node.options?.duration ?? duration,
          );
        }
        return;
      }
      case NodeType.SET: {
        const start = this.#time;
        let end = start;
        for (const child of node.children) {
          this.#time = start;
          this.#node(
            child,
            node.options?.key ?? key,
            node.options?.duration ?? duration,
          );
          if (end.less(this.#time)) end = this.#time;
        }
        this.#time = end;
        return;
      }
    }
  }
}
