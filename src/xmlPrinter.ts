import { AST, Node, NodeType, Options } from "./parser3.ts";

export type XMLStep = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type XMLPitch = {
  alter?: number;
  step: XMLStep;
  octave: number;
};

class Params {
  constructor(readonly duration: number = 1, readonly key: number = 0) {}

  with(options?: Options): Params {
    if (!options) return this;
    let duration = this.duration;
    if (options.duration) {
      duration = options.duration.value;
    }
    return new Params(duration, options.key || this.key);
  }
}
export class XMLPrinter {
  // params.
  #measureDuration = 1;
  // state
  #time = 0;
  #events: {
    pitch?: XMLPitch;
    duration: string;
    measure: string;
    time: string;
  }[] = [];

  static #STEPS: XMLStep[] = ["C", "D", "E", "F", "G", "A", "B"];
  static #ALTER: number[] = [5, 3, 1, 6, 4, 2, 0];
  static pitch(key: number, degree: number, accident: number): XMLPitch {
    const index = (degree + 49) % 7;
    const alter = accident + Math.floor((key + XMLPrinter.#ALTER[index]) / 7);
    return {
      step: XMLPrinter.#STEPS[index],
      octave: 4 + Math.floor(degree / 7),
      alter,
    };
  }

  static #NOTE_TYPE: string[] = [
    "maxima",
    "long",
    "breve",
    "whole",
    "half",
    "quarter",
    "eigth",
    "16th",
    "32th",
    "64th",
    "128th",
    "256th",
    "512th",
    "1024th",
  ];

  #node(node: Node, params: Params) {
    switch (node.type) {
      case NodeType.ERROR:
        // todo
        return;
      case NodeType.INSERT: {
        const section = this.#sections[node.index];
        if (!section) throw new Error(`section ${node.index} is missing`);
        if (!section.params) {
          section.params = params;
        }
        this.#node(section.node, section.params);
        return;
      }
      case NodeType.NOTE: {
        const _params = params.with(node.options);
        const measure = Math.floor(this.#time / this.#measureDuration);
        this.#events.push({
          measure: measure.toString(),
          time: (this.#time - measure * this.#measureDuration).toString(),
          duration: _params.duration.toString(),
          pitch: XMLPrinter.pitch(_params.key, node.degree, node.accident),
        });
        this.#time += _params.duration;
        return;
      }
      case NodeType.REST: {
        const _params = params.with(node.options);
        const measure = Math.floor(this.#time / this.#measureDuration);
        this.#events.push({
          measure: measure.toString(),
          time: (this.#time - measure * this.#measureDuration).toString(),
          duration: _params.duration.toString(),
        });
        this.#time += _params.duration;
        return;
      }
      case NodeType.ARRAY: {
        const _params = params.with(node.options);
        for (const child of node.children) {
          this.#node(child, _params);
        }
        return;
      }
      case NodeType.SET: {
        const _params = params.with(node.options);
        const start = this.#time;
        let end = start;
        for (const child of node.children) {
          this.#time = start;
          this.#node(child, _params);
          if (end < this.#time) {
            end = this.#time;
          }
        }
        this.#time = end;
        return;
      }
    }
  }

  #sections: {
    mark: string;
    node: Node;
    params?: Params;
  }[] = [];

  transform(ast: AST) {
    this.#sections = ast.sections;
    this.#node(ast.main, new Params());
    return { event: this.#events };
  }

  pop() {
    return {
      "score-partwise": {
        "@version": 4.0,
        "part-list": {
          "score-part": [
            { "@id": "P1", "part-name": "Untitled" },
            { "@id": "P2", "part-name": "Untitled" },
          ],
        },
        part: [],
      },
    };
  }
}
