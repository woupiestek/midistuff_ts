import { Scanner, Token, TokenType } from "./scanner3.ts";
import { Ratio } from "./util.ts";

export enum NodeType {
  ARRAY,
  ERROR,
  INSERT,
  NOTE,
  REST,
  SET,
}
export type Options = {
  duration?: Ratio;
  key?: number;
  labels?: Set<string>;
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
    const type = TokenType[this.#current.type];
    const line = this.#current.line;
    const lexeme = this.source.slice(this.#current.from, this.#current.to);
    return new Error(`Error at line ${line} (${type} '${lexeme}'): ${message}`);
  }

  parse(): AST {
    let main: Node;
    try {
      main = this.#node();
    } catch (error) {
      main = { type: NodeType.ERROR, token: this.#current, error };
      return { metadata: {}, main, sections: [] };
    }
    let metadata: Dict = {};
    if (this.#match(TokenType.COMMA) && this.#match(TokenType.LEFT_BRACE)) {
      try {
        metadata = this.dict();
      } catch (error) {
        main = { type: NodeType.ERROR, token: this.#current, error };
        return {
          metadata: {},
          main: {
            type: NodeType.ERROR,
            token: this.#current,
            error: this.#error("error parsing metadata"),
          },
          sections: [],
        };
      }
    }
    if (!this.#done()) {
      return {
        metadata: {},
        main: {
          type: NodeType.ERROR,
          token: this.#current,
          error: this.#error("input left over"),
        },
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
    const value = this.source.slice(this.#current.from, this.#current.to);
    this.#advance();
    return value;
  }

  #integer(min: number, max: number): number {
    if (this.#current.type !== TokenType.INTEGER) {
      throw this.#error(`Expected an integer`);
    }
    const value = this.#current.value;
    if (value === undefined) {
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

  #duration(options: Options) {
    let numerator = 1;
    let denominator = 1;
    if (this.#current.type === TokenType.INTEGER) {
      numerator = this.#integer(1, Number.MAX_SAFE_INTEGER);
    }
    if (this.#match(TokenType.SLASH)) {
      denominator = this.#integer(1, Number.MAX_SAFE_INTEGER);
    }
    options.duration = new Ratio(numerator, denominator);
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
        case TokenType.UNDERSCORE:
          if (options.duration !== undefined) {
            throw this.#error("Double duration");
          }
          this.#advance();
          this.#duration(options);
          continue;
        case TokenType.TEXT: {
          const lexeme = this.source
            .slice(this.#current.from + 1, this.#current.to - 1)
            .replace('""', '"');
          if (options.labels === undefined) {
            options.labels = new Set([lexeme]);
          } else {
            if (options.labels.has(lexeme)) {
              throw this.#error(`Double '${lexeme}'`);
            }
            options.labels.add(lexeme);
          }
          this.#advance();
          continue;
        }
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
    const degree = this.#current.value;
    if (degree === undefined) {
      // should not be reachable
      throw this.#error(`Expected integer to have a value`);
    }
    if (degree < -34 || 38 < degree) {
      throw this.#error(`Value ${degree} is out of range [-34, 38]`);
    }
    this.#current = this.#scanner.next();
    return {
      type: NodeType.NOTE,
      degree,
      accident,
      options,
    };
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
        return {
          type: NodeType.REST,
          options,
        };
      default:
        throw this.#error(`Expected note, rest or set here`);
    }
  }

  #insert(): Node {
    const mark = this.#mark();
    if (!this.#match(TokenType.IS)) {
      return {
        type: NodeType.INSERT,
        index: this.#resolve(mark),
      };
    }
    const index = this.#sections.push({ mark, node: this.#node() }) - 1;
    this.#bindings.push({ mark, index });
    return {
      type: NodeType.INSERT,
      index,
    };
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
      return { type: NodeType.ERROR, error, token };
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
        return token2.value || 0;
      case TokenType.TEXT:
        return this.source
          .slice(token2.from + 1, token2.to - 1)
          .replace('""', '"');
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
          key = this.source
            .slice(token1.from + 1, token1.to - 1)
            .replace('""', '"');
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
