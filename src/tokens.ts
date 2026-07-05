import { Ratio } from "./util.ts";

export enum TokenType {
  COMMA,
  DURATION,
  ERROR,
  IDENTIFIER,
  INTEGER_MINUS_MINUS,
  INTEGER_MINUS,
  INTEGER_PLUS_PLUS,
  INTEGER_PLUS,
  INTEGER,
  IS,
  KEY,
  LEFT_BRACE,
  LEFT_BRACKET,
  REST,
  RIGHT_BRACE,
  RIGHT_BRACKET,
  TEXT,
}

const CODES: Record<string, number> = Object.fromEntries(
  Array.from(Array(0x7e)).map((_, i) => [String.fromCharCode(i), i]),
);

const KEYWORDS: Record<string, TokenType> = {
  key: TokenType.KEY,
  r: TokenType.REST,
};

export class Tokens {
  types: TokenType[] = [];
  tos: number[] = [];
  #current: number = 0;
  constructor(readonly source: string) {
    while (!this.#done()) {
      this.#next();
    }
  }

  #emit(type: TokenType) {
    this.types.push(type);
    this.tos.push(this.#current);
  }

  #done() {
    return this.#current >= this.source.length;
  }

  #match(char: string): boolean {
    if (this.#done() || this.source[this.#current] !== char) return false;
    this.#current++;
    return true;
  }

  #pop(): number {
    if (this.#done()) throw new Error(`Out of input`);
    return this.source.charCodeAt(this.#current++);
  }

  from(token: number): number {
    let from = token && this.tos[token - 1];
    for (;;) {
      while (Tokens.#white(this.source.charCodeAt(from))) from++;
      if (this.source[from] === "%") {
        while (from < this.source.length && this.source[from] !== "\n") from++;
      } else {
        return from;
      }
    }
  }

  getText(token: number): string {
    if (this.types[token] !== TokenType.TEXT) throw new Error("no text here");
    const from = this.from(token);
    const to = this.tos[token];
    return this.source.slice(from + 1, to - 1).replace("''", "'");
  }

  #text(): boolean {
    for (;;) {
      if (this.#done()) return false;
      if (this.source[this.#current++] === "'") {
        if (this.source[this.#current] === "'") {
          this.#current++;
        } else return true;
      }
    }
  }

  #advanceWhile(condition: (index: number) => boolean) {
    for (; !this.#done() && condition(this.#current); this.#current++);
  }

  #whitespace() {
    this.#advanceWhile((i) => Tokens.#white(this.source.charCodeAt(i)));
  }

  static #white(value: number) {
    return (value >= 9 && value <= 13) || value === 32;
  }

  #comment() {
    this.#advanceWhile((i) => this.source[i] !== "\n");
  }

  #skip() {
    for (;;) {
      this.#whitespace();
      if (this.#match("%")) this.#comment();
      else return;
    }
  }

  static #isLetter(code: number): boolean {
    if ((code & 192) === 64) {
      const c31 = code & 31;
      return c31 > 0 && c31 <= 26;
    }
    return false;
  }

  static #isDigit(code: number): boolean {
    return code >= CODES[0] && code <= CODES[9];
  }

  static #isLetterOrDigit(ch: number): boolean {
    return Tokens.#isLetter(ch) || Tokens.#isDigit(ch);
  }

  static #ic(ch: number) {
    return ch === CODES["_"] || Tokens.#isLetterOrDigit(ch);
  }

  getIdentifierName(token: number) {
    if (
      token >= this.types.length || this.types[token] !== TokenType.IDENTIFIER
    ) {
      throw new Error("no identifier here");
    }
    // main concern: comments and whitespace
    const from = this.from(token);
    const to = this.tos[token];
    return this.source.slice(from, to);
  }

  #identifier() {
    this.#advanceWhile((i) => Tokens.#ic(this.source.charCodeAt(i)));
  }

  #positiveIntegerValue(from: number): [number, number] {
    let to = from, value = 0;
    while (
      to < this.source.length &&
      Tokens.#isDigit(this.source.charCodeAt(to))
    ) {
      value = 10 * value + (this.source.charCodeAt(to++) - 48);
    }
    return [value, to];
  }

  getIntegerValue(token: number): number {
    const from = this.from(token);
    if (this.source[from] === "-") {
      return -this.#positiveIntegerValue(from + 1)[0];
    }
    return this.#positiveIntegerValue(from)[0];
  }

  #integer(): TokenType {
    this.#advanceWhile((i) => Tokens.#isDigit(this.source.charCodeAt(i)));
    if (this.#match("+")) {
      return this.#match("+")
        ? TokenType.INTEGER_PLUS_PLUS
        : TokenType.INTEGER_PLUS;
    } else if (this.#match("-")) {
      return this.#match("-")
        ? TokenType.INTEGER_MINUS_MINUS
        : TokenType.INTEGER_MINUS;
    }
    return TokenType.INTEGER;
  }

  getRatio(token: number): Ratio {
    const [numerator, next] = this.#positiveIntegerValue(this.from(token) + 1);
    if (this.source[next] === "/") {
      const [denominator] = this.#positiveIntegerValue(next + 1);
      return new Ratio(numerator || 1, denominator || 1);
    }
    return new Ratio(numerator || 1, 1);
  }

  #duration() {
    this.#advanceWhile((i) => Tokens.#isDigit(this.source.charCodeAt(i)));
    if (this.#match("/")) {
      this.#advanceWhile((i) => Tokens.#isDigit(this.source.charCodeAt(i)));
    }
    return TokenType.DURATION;
  }

  #next() {
    this.#skip();
    if (this.#done()) return;
    const code = this.#pop();
    if (Tokens.#isDigit(code)) {
      return this.#emit(this.#integer());
    }
    if (Tokens.#isLetter(code)) {
      const from = this.#current - 1;
      this.#identifier();
      return this.#emit(
        KEYWORDS[this.source.slice(from, this.#current)] ??
          TokenType.IDENTIFIER,
      );
    }
    let type = TokenType.ERROR;
    switch (code) {
      case CODES["-"]: {
        if (
          !this.#done() &&
          Tokens.#isDigit(this.source.charCodeAt(this.#current))
        ) {
          type = this.#integer();
          break;
        }
        break;
      }
      case CODES[","]:
        type = TokenType.COMMA;
        break;
      case CODES["["]:
        type = TokenType.LEFT_BRACKET;
        break;
      case CODES["]"]:
        type = TokenType.RIGHT_BRACKET;
        break;
      case CODES["{"]:
        type = TokenType.LEFT_BRACE;
        break;
      case CODES["}"]:
        type = TokenType.RIGHT_BRACE;
        break;
      case CODES["="]:
        type = TokenType.IS;
        break;
      case CODES["_"]:
        this.#duration();
        type = TokenType.DURATION;
        break;
      case CODES["'"]:
        if (this.#text()) {
          type = TokenType.TEXT;
        }
        break;
      case CODES["$"]:
        this.#identifier();
        type = TokenType.IDENTIFIER;
        break;
      default:
        break;
    }
    return this.#emit(type);
  }

  getLineAndColumn(token: number) {
    let line = 1, i = 0;
    let start = 0;
    for (; i < this.from(token); i++) {
      if (this.source[i] === "\n") {
        line++;
        start = i;
      }
      if (this.source[i] === "\r") {
        start = i;
      }
    }
    return [line, this.from(token) - start + 1];
  }
}
