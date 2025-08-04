import { Tokens, TokenType } from "./tokens.ts";

export enum NodeType {
  ARRAY,
  DICT,
  DURATION,
  EVENT,
  KEY,
  MARK,
  NOTE,
  REST,
  SET,
  VALUE,
}

export class Nodes {
  types: NodeType[] = [];
  parents: number[] = [];
  tokenIds: number[] = [];
  #current = 0;

  constructor(readonly tokens: Tokens) {
    this.#node(0);
    if (this.#match(TokenType.COMMA) && this.#match(TokenType.LEFT_BRACE)) {
      this.#dict(0);
    }
    if (this.#current !== this.tokens.types.length) {
      throw this.#error("Input left over");
    }
  }

  #currentType() {
    return this.tokens.types[this.#current];
  }

  #node(parent: number) {
    switch (this.#currentType()) {
      case TokenType.DURATION:
        this.#node(this.#emit(NodeType.DURATION, parent, this.#current++));
        break;
      case TokenType.IDENTIFIER:
        {
          const mark = this.#emit(NodeType.MARK, parent, this.#current++);
          if (this.#match(TokenType.IS)) {
            this.#node(mark);
          }
        }
        return;
      case TokenType.INTEGER_MINUS_MINUS:
      case TokenType.INTEGER_MINUS:
      case TokenType.INTEGER_PLUS_PLUS:
      case TokenType.INTEGER_PLUS:
      case TokenType.INTEGER:
        this.#emit(NodeType.NOTE, parent, this.#current++);
        break;
      case TokenType.KEY:
        this.#node(this.#emit(NodeType.KEY, parent, this.#current++));
        break;
      case TokenType.LEFT_BRACE:
        {
          const node = this.#emit(NodeType.SET, parent, this.#current++);
          while (!this.#match(TokenType.RIGHT_BRACE)) {
            this.#node(node);
          }
        }
        break;
      case TokenType.LEFT_BRACKET:
        {
          const node = this.#emit(NodeType.SET, parent, this.#current++);
          while (!this.#match(TokenType.RIGHT_BRACKET)) {
            this.#node(node);
          }
        }
        break;
      case TokenType.REST:
        this.#emit(NodeType.REST, parent, this.#current++);
        break;
      case TokenType.TEXT:
        this.#emit(NodeType.EVENT, parent, this.#current++);
        break;
      default:
        throw this.#error(`Expected note, rest or set here`);
    }
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

  #emit(type: NodeType, parent: number, token: number) {
    this.types.push(type);
    this.parents.push(parent);
    return this.tokenIds.push(token) - 1;
  }

  #match(type: TokenType) {
    if (this.#currentType() === type) {
      this.#current++;
      return true;
    }
    return false;
  }

  #array(parent: number) {
    const node = this.#emit(NodeType.ARRAY, parent, this.#current++);
    while (!this.#match(TokenType.RIGHT_BRACKET)) {
      this.#value(node);
    }
  }

  #value(parent: number) {
    switch (this.#currentType()) {
      case TokenType.LEFT_BRACE:
        return this.#dict(parent);
      case TokenType.LEFT_BRACKET:
        return this.#array(parent);
      case TokenType.INTEGER:
      case TokenType.TEXT:
        this.#emit(NodeType.ARRAY, parent, this.#current++);
        return;
      default:
        throw this.#error(
          "Expected integer, label, string, array or key-value pairs",
        );
    }
  }

  #dict(parent: number) {
    const node = this.#emit(NodeType.DICT, parent, this.#current++);
    for (;;) {
      switch (this.#currentType()) {
        case TokenType.RIGHT_BRACE:
          return;
        case TokenType.TEXT:
          break;
        default:
          throw this.#error("Expected string");
      }
      this.#emit(NodeType.KEY, node, this.#current++);
      if (!this.#match(TokenType.IS)) {
        throw this.#error("Expected '='");
      }
      this.#value(node);
    }
  }

  toString() {
    const depth: number[] = [-1];
    const prefixLength = Math.log10(this.types.length + 1);
    const lines = [];
    for (let i = 0, l = this.types.length; i < l; i++) {
      depth[i] = depth[this.parents[i]] + 1;
      const prefix = " ".repeat(prefixLength) + i;
      lines.push(
        prefix.slice(prefix.length - prefixLength) + ":" +
          "  ".repeat(depth[i]) +
          TokenType[this.tokens.types[this.tokenIds[i]]],
      );
    }
    return lines.join("\n");
  }
}
