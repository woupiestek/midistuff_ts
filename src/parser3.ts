import { Scanner, Token, TokenType } from "./scanner3.ts";
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
    token: Token;
    error: Error;
  };

export const Node = {
  array(children: Node[], options?: Options): Node {
    return { type: NodeType.ARRAY, children, options };
  },
  error(token: Token, e: Error): Node {
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
    mark: string;
    node: Node;
  }[];
};

export class Parser {
  #scanner;
  #current;
  #sections: { mark: string; node: Node }[] = [];
  #bindings: { mark: string; index: number }[] = [];
  constructor(private readonly source: string) {
    this.#scanner = new Scanner(source);
    this.#current = this.#scanner.next();
  }

  #done() {
    return this.#current.type === TokenType.END;
  }

  #error(message: string) {
    const [line, column] = this.#scanner.getLineAndColumn(this.#current.from);
    // add a few characters of the source?
    return new Error(
      `Error at [${line};${column}] '\u2026${
        this.source.slice(this.#current.from - 3, this.#current.from + 3)
      }\u2026': ${message}`,
    );
  }

  parse(): AST {
    let main: Node;
    try {
      main = this.#node();
    } catch (error) {
      main = Node.error(this.#current, error as Error);
      return { metadata: {}, main, sections: [] };
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
          sections: [],
        };
      }
    }
    if (!this.#done()) {
      return {
        metadata: {},
        main: Node.error(this.#current, this.#error("input left over")),
        sections: [],
      };
    }
    return { metadata, main, sections: this.#sections };
  }

  #advance() {
    if (!this.#done()) {
      this.#current = this.#scanner.next();
    }
  }

  #match(type: TokenType) {
    if (type === this.#current.type) {
      this.#advance();
      return true;
    }
    return false;
  }

  #consume(type: TokenType) {
    if (!this.#match(type)) {
      throw this.#error(`Expected a ${TokenType[type]}`);
    }
  }

  #mark(): string {
    if (this.#current.type !== TokenType.IDENTIFIER) {
      throw this.#error(`Mark expected`);
    }
    const value = this.#scanner.getIdentifierName(this.#current.from);
    this.#advance();
    return value;
  }

  #integer(min: number, max: number): number {
    if (this.#current.type !== TokenType.INTEGER) {
      throw this.#error(`Expected an integer`);
    }

    const value = this.#scanner.getIntegerValue(this.#current.from);
    if (typeof value !== "number") {
      // should not be reachable
      throw this.#error(`Expected integer to have a value`);
    }
    if (value < min || max < value) {
      throw this.#error(`Value ${value} is out of range [${min}, ${max}]`);
    }
    this.#current = this.#scanner.next();
    return value;
  }

  #resolve(mark: string): number {
    for (let i = this.#bindings.length - 1; i >= 0; i--) {
      if (this.#bindings[i].mark === mark) return this.#bindings[i].index;
    }
    throw this.#error(`Could not resolve '${mark}'`);
  }

  #options(): Options | undefined {
    const options: Options = {};
    a: for (;;) {
      switch (this.#current.type) {
        case TokenType.KEY:
          if (options.key !== undefined) {
            throw this.#error("Double key");
          }
          this.#advance();
          options.key = this.#integer(-7, 7);
          continue;
        case TokenType.DURATION:
          options.duration = this.#scanner.getRatio(this.#current.from);
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
    const degree = this.#scanner.getIntegerValue(this.#current.from);
    if (degree < -34 || 38 < degree) {
      throw this.#error(`Value ${degree} is out of range [-34, 38]`);
    }
    this.#current = this.#scanner.next();
    return Node.note(
      degree,
      accident,
      options,
    );
  }

  #node(): Node {
    if (this.#current.type === TokenType.IDENTIFIER) {
      return this.#insert();
    }
    const options: Options | undefined = this.#options();
    switch (this.#current.type) {
      case TokenType.LEFT_BRACKET: {
        this.#advance();
        const scope = this.#bindings.length;
        const set = this.#set(NodeType.ARRAY, TokenType.RIGHT_BRACKET, options);
        this.#bindings.length = scope; // bindings go out of scope
        return set;
      }
      case TokenType.LEFT_BRACE: {
        this.#advance();
        const scope = this.#bindings.length;
        const set = this.#set(NodeType.SET, TokenType.RIGHT_BRACE, options);
        this.#bindings.length = scope; // bindings go out of scope
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
        const value = this.#scanner
          .getText(this.#current.from);
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
    const index = this.#sections.push({ mark, node: this.#node() }) - 1;
    this.#bindings.push({ mark, index });
    return Node.insert(index);
  }

  #panic() {
    let depth = 1;
    for (;;) {
      switch (this.#current.type) {
        case TokenType.END:
          return;
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

  #pop(): Token {
    if (this.#done()) throw this.#error("Expected more input");
    const current = this.#current;
    this.#current = this.#scanner.next();
    return current;
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
    switch (token2.type) {
      case TokenType.LEFT_BRACE:
        return this.dict();
      case TokenType.LEFT_BRACKET:
        return this.#array();
      case TokenType.INTEGER:
        return this.#scanner.getIntegerValue(token2.from);
      case TokenType.TEXT:
        return this.#scanner.getText(token2.from);
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
      switch (token1.type) {
        case TokenType.RIGHT_BRACE:
          return result;
        case TokenType.TEXT:
          key = this.#scanner.getText(token1.from);
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
