import { Scanner, Token, TokenType } from "./scanner.ts";

export type Value = [string, string] | string;
export type Row = {
  class: string;
  fields: { [_: string]: Value[] };
};

export class Parser {
  #scanner: Scanner;
  #current: Token;

  constructor(private readonly source: string) {
    this.#scanner = new Scanner(source);
    this.#current = this.#scanner.next();
    this.#consume(TokenType.BANG);
  }

  done() {
    return this.#scanner.done() || this.#match(TokenType.BANG);
  }

  #error(msg: string) {
    return new Error(
      `Failed to parse ${TokenType[this.#current.type]} '\u2026${
        this.source.slice(this.#current.from - 3, this.#current.from + 3)
      }\u2026' at line ${this.#scanner.line(this.#current.from)}: ${msg}`,
    );
  }

  #advance() {
    if (!this.#scanner.done()) this.#current = this.#scanner.next();
  }

  #consume(type: TokenType) {
    if (this.#current.type !== type) {
      throw this.#error(
        `Expected ${TokenType[type]}, got ${TokenType[this.#current.type]}`,
      );
    }
    this.#advance();
  }

  #key() {
    if (this.#current.type !== TokenType.OTHER) {
      throw this.#error(`Expected key, got ${TokenType[this.#current.type]}`);
    }
    const key = this.#scanner.getOther(this.#current.from);
    this.#advance();
    return key;
  }

  #value() {
    switch (this.#current.type) {
      case TokenType.OTHER:
      case TokenType.STRING: {
        const a = this.#scanner.getString(this.#current.from);
        this.#advance();
        return a;
      }
      default:
        throw this.#error("Expected other or string");
    }
  }

  next(): Row {
    this.#consume(TokenType.PIPE);
    const klaz = this.#key();
    const fields: { [_: string]: Value[] } = {};
    while (this.#match(TokenType.PIPE)) {
      const key = this.#key();
      this.#consume(TokenType.COLON);
      const values: Value[] = [];
      for (;;) {
        switch (this.#current.type) {
          case TokenType.OTHER: {
            const a = this.#key();
            values.push(this.#match(TokenType.IS) ? [a, this.#value()] : a);
            break;
          }
          case TokenType.STRING:
            values.push(this.#scanner.getString(this.#current.from));
            this.#advance();
            break;
        }
        if (!this.#match(TokenType.COMMA)) break;
      }
      fields[key] = values;
    }
    this.#consume(TokenType.LINE);
    return {
      class: klaz,
      fields,
    };
  }

  #match(type: TokenType) {
    if (this.#current.type === type) {
      this.#advance();
      return true;
    }
    return false;
  }
}
