import { Tokens, TokenType } from "./tokens.ts";
import { Ratio } from "./util.ts";

export enum NodeType {
  ARRAY,
  ERROR,
  EVENT,
  INSERT,
  NOTE,
  REST,
  SET,
}
export type Options = {
  duration?: Ratio;
  key?: number;
};

export type Dict = { [_: string]: Value };
export type Value = Dict | number | string | Value[];
export type Node =
  | {
    type: NodeType.SET | NodeType.ARRAY;
    children: Node[];
    options?: Options;
  }
  | {
    type: NodeType.INSERT;
    index: number;
  }
  | {
    type: NodeType.EVENT;
    value: string;
  }
  | {
    type: NodeType.REST;
    options?: Options;
  }
  | {
    type: NodeType.NOTE;
    degree: number;
    accident: -2 | -1 | 0 | 1 | 2;
    options?: Options;
  }
  | {
    type: NodeType.ERROR;
    token: number;
    error: Error;
  };

export const Node = {
  array(children: Node[], options?: Options): Node {
    return { type: NodeType.ARRAY, children, options };
  },
  error(token: number, e: Error): Node {
    return { type: NodeType.ERROR, error: e, token };
  },
  event(value: string): Node {
    return { type: NodeType.EVENT, value };
  },
  insert(index: number): Node {
    return { type: NodeType.INSERT, index };
  },
  note(degree: number, accident: -2 | -1 | 0 | 1 | 2, options?: Options): Node {
    return { type: NodeType.NOTE, accident, degree, options };
  },
  rest(options?: Options): Node {
    return { type: NodeType.REST, options };
  },
  set(children: Node[], options?: Options): Node {
    return { type: NodeType.SET, children, options };
  },
};

export type AST = {
  metadata: Dict;
  main: Node;
  sections: {
    marks: string[];
    nodes: Node[];
  };
};

function sections() {
  return { marks: [], nodes: [] };
}

export class Parser {
  #current = 0;
  #sections: { marks: string[]; nodes: Node[] } = sections();
  #bindings: { marks: string[]; indices: number[] } = {
    marks: [],
    indices: [],
  };
  constructor(readonly tokens: Tokens) {}

  #done() {
    return this.#current === this.tokens.types.length;
  }

  #error(message: string) {
    const [line, column] = this.tokens.getLineAndColumn(this.#current - 1);
    const from = this.tokens.froms[this.#current - 1] ?? -1;
    // add a few characters of the source?
    return new Error(
      `Error at [${line};${column}] '\u2026${
        this.tokens.source.slice(from >= 3 ? from - 3 : 0, from + 3)
      }\u2026': ${message}`,
    );
  }

  parse(): AST {
    let main: Node;
    try {
      main = this.#node();
    } catch (error) {
      main = Node.error(this.#current, error as Error);
      return { metadata: {}, main, sections: sections() };
    }
    let metadata: Dict = {};
    if (this.#match(TokenType.COMMA) && this.#match(TokenType.LEFT_BRACE)) {
      try {
        metadata = this.dict();
      } catch (error) {
        main = Node.error(this.#current, error as Error);
        return {
          metadata: {},
          main: Node.error(
            this.#current,
            this.#error("error parsing metadata"),
          ),
          sections: sections(),
        };
      }
    }
    if (!this.#done()) {
      return {
        metadata: {},
        main: Node.error(this.#current, this.#error("input left over")),
        sections: sections(),
      };
    }
    return { metadata, main, sections: this.#sections };
  }

  #advance() {
    if (!this.#done()) {
      this.#current++;
    }
  }

  #match(type: TokenType) {
    if (type === this.#currentType()) {
      this.#advance();
      return true;
    }
    return false;
  }

  #currentType() {
    return this.tokens.types[this.#current];
  }

  #consume(type: TokenType) {
    if (!this.#match(type)) {
      throw this.#error(`Expected a ${TokenType[type]}`);
    }
  }

  #mark(): string {
    if (this.#currentType() !== TokenType.IDENTIFIER) {
      throw this.#error(`Mark expected`);
    }
    const value = this.tokens.getIdentifierName(this.#current);
    this.#advance();
    return value;
  }

  #integer(min: number, max: number): number {
    if (this.#currentType() !== TokenType.INTEGER) {
      throw this.#error(`Expected an integer`);
    }

    const value = +this.tokens.getIntegerValue(this.#current);
    if (typeof value !== "number" || Number.isNaN(value)) {
      // should not be reachable
      throw this.#error(`Expected integer to have a value`);
    }
    if (value < min || max < value) {
      throw this.#error(`Value ${value} is out of range [${min}, ${max}]`);
    }
    this.#current++;
    return value;
  }

  #resolve(mark: string): number {
    for (let i = this.#bindings.marks.length - 1; i >= 0; i--) {
      if (this.#bindings.marks[i] === mark) return this.#bindings.indices[i];
    }
    throw this.#error(`Could not resolve '${mark}'`);
  }

  #options(): Options | undefined {
    const options: Options = {};
    a: for (;;) {
      switch (this.#currentType()) {
        case TokenType.KEY:
          if (options.key !== undefined) {
            throw this.#error("Double key");
          }
          this.#advance();
          options.key = this.#integer(-7, 7);
          continue;
        case TokenType.DURATION:
          options.duration = this.tokens.getRatio(this.#current);
          this.#advance();
          continue;
        default:
          break a;
      }
    }
    if (Object.values(options).every((it) => it === undefined)) {
      return undefined;
    }
    return options;
  }

  #note(accident: -2 | -1 | 0 | 1 | 2, options?: Options): Node {
    const degree = this.tokens.getIntegerValue(this.#current);
    if (degree < -34 || 38 < degree) {
      throw this.#error(`Value ${degree} is out of range [-34, 38]`);
    }
    this.#current++;
    return Node.note(
      degree,
      accident,
      options,
    );
  }

  #node(): Node {
    if (this.#currentType() === TokenType.IDENTIFIER) {
      return this.#insert();
    }
    const options: Options | undefined = this.#options();
    switch (this.#currentType()) {
      case TokenType.LEFT_BRACKET: {
        this.#advance();
        const scope = this.#bindings.marks.length;
        const set = this.#set(NodeType.ARRAY, TokenType.RIGHT_BRACKET, options);
        // bindings go out of scope
        this.#bindings.marks.length = scope;
        this.#bindings.indices.length = scope;
        return set;
      }
      case TokenType.LEFT_BRACE: {
        this.#advance();
        const scope = this.#bindings.marks.length;
        const set = this.#set(NodeType.SET, TokenType.RIGHT_BRACE, options);
        // bindings go out of scope
        this.#bindings.marks.length = scope;
        this.#bindings.indices.length = scope;
        return set;
      }
      case TokenType.INTEGER_MINUS:
        return this.#note(-1, options);
      case TokenType.INTEGER_MINUS_MINUS:
        return this.#note(-2, options);
      case TokenType.INTEGER_PLUS:
        return this.#note(1, options);
      case TokenType.INTEGER_PLUS_PLUS:
        return this.#note(2, options);
      case TokenType.INTEGER:
        return this.#note(0, options);
      case TokenType.REST:
        if (options) {
          if (options.key !== undefined) {
            throw this.#error("Key signatures are not allowed rests");
          }
        }
        this.#advance();
        return Node.rest(options);
      case TokenType.TEXT: {
        const value = this.tokens.getText(this.#current);
        this.#advance();
        return Node.event(
          value,
        );
      }
      default:
        throw this.#error(`Expected note, rest or set here`);
    }
  }

  #insert(): Node {
    const mark = this.#mark();
    if (!this.#match(TokenType.IS)) {
      return Node.insert(this.#resolve(mark));
    }
    const index = this.#sections.marks.length;
    this.#sections.marks[index] = mark;
    this.#sections.nodes[index] = this.#node();
    this.#bindings.marks.push(mark);
    this.#bindings.indices.push(index);
    return Node.insert(index);
  }

  #panic() {
    let depth = 1;
    for (;;) {
      switch (this.#currentType()) {
        case TokenType.LEFT_BRACE:
          depth++;
          break;
        case TokenType.LEFT_BRACKET:
          depth++;
          break;
        case TokenType.RIGHT_BRACE:
          depth--;
          break;
        case TokenType.RIGHT_BRACKET:
          depth--;
          break;
        default:
          break;
      }
      this.#advance();
      if (depth === 0) return;
    }
  }

  #set(
    type: NodeType.SET | NodeType.ARRAY,
    stop: TokenType,
    options?: Options,
  ): Node {
    try {
      const children: Node[] = [];
      while (!this.#match(stop)) {
        children.push(this.#node());
      }
      return {
        type,
        children,
        options,
      };
    } catch (error) {
      const token = this.#current;
      this.#panic();
      return Node.error(token, error as Error);
    }
  }

  #pop(): number {
    if (this.#done()) throw this.#error("Expected more input");
    return this.#current++;
  }

  #array(): Value[] {
    const array = [];
    for (;;) {
      if (this.#match(TokenType.RIGHT_BRACKET)) return array;
      array.push(this.#value());
    }
  }

  #value(): Value {
    const token2 = this.#pop();
    switch (this.tokens.types[token2]) {
      case TokenType.LEFT_BRACE:
        return this.dict();
      case TokenType.LEFT_BRACKET:
        return this.#array();
      case TokenType.INTEGER:
        return this.tokens.getIntegerValue(token2);
      case TokenType.TEXT:
        return this.tokens.getText(token2);
      default:
        throw this.#error(
          "Expected integer, label, string, array or key-value pairs",
        );
    }
  }

  dict(): Dict {
    const result: Dict = {};
    for (;;) {
      const token1 = this.#pop();
      let key: string;
      switch (this.tokens.types[token1]) {
        case TokenType.RIGHT_BRACE:
          return result;
        case TokenType.TEXT:
          key = this.tokens.getText(token1);
          break;
        default:
          throw this.#error("Expected label or string");
      }
      if (result[key] !== undefined) throw this.#error(`Double key ${key}`);
      this.#consume(TokenType.IS);
      result[key] = this.#value();
    }
  }
}
