import { Scanner, Token, TokenType } from "./scanner3.ts";

export enum NodeType {
  ERROR,
  INSERT,
  NOTE,
  REST,
  SEQUENCE,
  SET,
}
export type Options = {
  durationNumerator?: number;
  durationDenominator?: number;
  key?: number;
  labels?: Set<string>;
};

export type Value = Map<string, Value> | number | string | Value[];
export type Node =
  | {
    type: NodeType.SET | NodeType.SEQUENCE;
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
  metadata: Map<string, Value>;
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
  constructor(private readonly source: Uint8Array) {
    this.#scanner = new Scanner(source);
    this.#current = this.#scanner.next();
  }

  #done() {
    return this.#current.type === TokenType.END;
  }

  #error(message: string) {
    const type = TokenType[this.#current.type];
    const line = this.#current.line;
    const lexeme = Parser.#decoder.decode(
      this.source.slice(this.#current.from, this.#current.to),
    );
    return new Error(`Error at line ${line} (${type} '${lexeme}'): ${message}`);
  }

  parse(): AST {
    let main: Node;
    try {
      main = this.#node();
    } catch (error) {
      main = { type: NodeType.ERROR, token: this.#current, error };
      return { metadata: new Map(), main, sections: [] };
    }

    let metadata: Map<string, Value> = new Map();
    if (this.#match(TokenType.LEFT_BRACE)) {
      try {
        metadata = this.#pairs();
      } catch (error) {
        main = { type: NodeType.ERROR, token: this.#current, error };
        return {
          metadata: new Map(),
          main: {
            type: NodeType.ERROR,
            token: this.#current,
            error: this.#error("input left over"),
          },
          sections: [],
        };
      }
    }
    if (!this.#done()) {
      return {
        metadata: new Map(),
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
    if (this.#current.type !== TokenType.MARK) {
      throw this.#error(`Mark expected`);
    }
    const value = this.source.slice(this.#current.from + 1, this.#current.to);
    this.#advance();
    return Parser.#decoder.decode(value);
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

  static #decoder = new TextDecoder();

  #resolve(mark: string): number {
    for (let i = this.#bindings.length - 1; i >= 0; i--) {
      if (this.#bindings[i].mark === mark) return this.#bindings[i].index;
    }
    throw this.#error(`Could not resolve ${mark}`);
  }

  #duration(options: Options) {
    if (this.#current.type === TokenType.INTEGER) {
      options.durationNumerator = this.#integer(1, Number.MAX_SAFE_INTEGER);
    } else {
      options.durationNumerator = 1;
    }
    if (this.#match(TokenType.SLASH)) {
      options.durationDenominator = this.#integer(1, Number.MAX_SAFE_INTEGER);
    } else {
      options.durationDenominator = 1;
    }
  }

  #options(): Options | undefined {
    const options: Options = {};
    a: for (;;) {
      switch (this.#current.type) {
        case TokenType.IDENTIFIER: {
          const lexeme = Parser.#decoder.decode(
            this.source.slice(this.#current.from, this.#current.to),
          );
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
        case TokenType.KEY:
          if (options.key !== undefined) {
            throw this.#error("Double key");
          }
          this.#advance();
          options.key = this.#integer(-7, 7);
          continue;
        case TokenType.UNDERSCORE:
          if (options.durationNumerator !== undefined) {
            throw this.#error("Double duration");
          }
          this.#advance();
          this.#duration(options);
          continue;
        case TokenType.TEXT: {
          const lexeme = Parser.#decoder
            .decode(
              this.source.slice(this.#current.from + 1, this.#current.to - 1),
            )
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
    if (this.#current.type === TokenType.MARK) {
      return this.#insert();
    }
    const options: Options | undefined = this.#options();
    switch (this.#current.type) {
      case TokenType.LEFT_BRACKET: {
        this.#advance();
        const scope = this.#bindings.length;
        const children = this.#set();
        this.#bindings.length = scope; // bindings go out of scope
        return {
          type: NodeType.SET,
          children,
          options,
        };
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

  #sequencEnd() {
    return [TokenType.END, TokenType.COMMA, TokenType.RIGHT_BRACKET].includes(
      this.#current.type,
    );
  }

  #sequence(): Node {
    try {
      const children: Node[] = [];
      while (!this.#sequencEnd()) {
        children.push(this.#node());
      }
      return { type: NodeType.SEQUENCE, children };
    } catch (error) {
      const token = this.#current;
      this.#panic();
      return { type: NodeType.ERROR, token, error };
    }
  }

  #panic() {
    while (!this.#sequencEnd()) {
      if (this.#current.type === TokenType.LEFT_BRACKET) {
        let depth = 1;
        while (depth > 0 && !this.#done()) {
          this.#advance();
          if (this.#current.type === TokenType.LEFT_BRACKET) {
            depth++;
          } else if (this.#current.type === TokenType.RIGHT_BRACKET) {
            depth--;
          }
        }
      }
      this.#advance();
    }
  }

  #set(): Node[] {
    if (this.#match(TokenType.RIGHT_BRACKET)) return [];
    const children: Node[] = [];
    for (;;) {
      children.push(this.#sequence());
      if (!this.#match(TokenType.COMMA)) break;
    }
    this.#consume(TokenType.RIGHT_BRACKET);
    return children;
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
        return this.#pairs();
      case TokenType.LEFT_BRACKET:
        return this.#array();
      case TokenType.IDENTIFIER:
        return Parser.#decoder.decode(
          this.source.slice(token2.from, token2.to),
        );
      case TokenType.INTEGER:
        return token2.value || 0;
      case TokenType.TEXT:
        return Parser.#decoder
          .decode(this.source.slice(token2.from + 1, token2.to - 1))
          .replace('""', '"');
      default:
        throw this.#error(
          "Expected integer, label, string, array or key-value pairs",
        );
    }
  }

  #pairs(): Map<string, Value> {
    const result: Map<string, Value> = new Map();
    for (;;) {
      const token1 = this.#pop();
      let key: string;
      switch (token1.type) {
        case TokenType.RIGHT_BRACE:
          return result;
        case TokenType.IDENTIFIER:
          key = Parser.#decoder.decode(
            this.source.slice(token1.from, token1.to),
          );
          break;
        case TokenType.TEXT:
          key = Parser.#decoder
            .decode(this.source.slice(token1.from + 1, token1.to - 1))
            .replace('""', '"');
          break;
        default:
          throw this.#error("Expected label or string");
      }
      if (result.has(key)) throw this.#error(`Double key ${key}`);
      this.#consume(TokenType.IS);
      result.set(key, this.#value());
    }
  }
}
