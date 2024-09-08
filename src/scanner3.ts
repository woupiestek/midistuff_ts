import {} from "https://deno.land/std@0.184.0/path/_constants.ts";
import { TrieMap } from "./trieMap.ts";
import { Ratio } from "./util.ts";

export enum TokenType {
  COMMA,
  DURATION,
  END,
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

export type Token = {
  type: TokenType;
  from: number;
};

export const Token = {
  stringify({ type, from }: Token) {
    return `${TokenType[type]}[${from}]`;
  },
};

const CODES: Record<string, number> = Object.fromEntries(
  Array.from(Array(0x7e)).map((_, i) => [String.fromCharCode(i), i]),
);

const KEYWORDS: TrieMap<TokenType> = new TrieMap();
KEYWORDS.put("key", TokenType.KEY);
KEYWORDS.put("r", TokenType.REST);

export class Scanner {
  #current = 0;
  #from = 0;
  constructor(private readonly source: string) {}

  #token(type: TokenType): Token {
    return {
      type,
      from: this.#from,
    };
  }

  done() {
    return this.#current >= this.source.length;
  }

  #match(char: string): boolean {
    if (this.done() || this.source[this.#current] !== char) return false;
    this.#current++;
    return true;
  }

  #pop(): number {
    if (this.done()) throw new Error(`Out of input`);
    return this.source.charCodeAt(this.#current++);
  }

  getText(from: number): string {
    if (this.source[from] !== "'") throw new Error("no text here");
    let to = from;
    while (to < this.source.length) {
      to++;
      if (this.source[to] !== "'") continue;
      to++;
      if (this.source[to] !== "'") {
        return this.source.slice(from + 1, to - 1).replace("''", "'");
      }
    }
    throw new Error("invalid text");
  }

  #text(): Token {
    for (;;) {
      if (this.done()) return this.#token(TokenType.ERROR);
      if (this.source[this.#current++] === "'") {
        if (this.source[this.#current] === "'") {
          this.#current++;
        } else return this.#token(TokenType.TEXT);
      }
    }
  }

  #advanceWhile(condition: (index: number) => boolean) {
    for (; !this.done() && condition(this.#current); this.#current++);
  }

  #whitespace() {
    this.#advanceWhile((i) => Scanner.#white(this.source.charCodeAt(i)));
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
    return Scanner.#isLetter(ch) || Scanner.#isDigit(ch);
  }

  static #ic(ch: number) {
    return ch === CODES["_"] || Scanner.#isLetterOrDigit(ch);
  }

  getIdentifierName(from: number) {
    let to = from + 1;
    for (
      ;
      to < this.source.length &&
      Scanner.#ic(this.source.charCodeAt(to));
      to++
    );
    return this.source.slice(from, to);
  }

  #identifier() {
    this.#advanceWhile((i) => Scanner.#ic(this.source.charCodeAt(i)));
  }

  #positiveIntegerValue(from: number): [number, number] {
    let to = from, value = 0;
    while (
      to < this.source.length &&
      Scanner.#isDigit(this.source.charCodeAt(to))
    ) {
      value = 10 * value + (this.source.charCodeAt(to++) - 48);
    }
    return [value, to];
  }

  getIntegerValue(from: number): number {
    if (this.source[from] === "-") {
      return -this.#positiveIntegerValue(from + 1)[0];
    }
    return this.#positiveIntegerValue(from)[0];
  }

  #integer(): Token {
    this.#advanceWhile((i) => Scanner.#isDigit(this.source.charCodeAt(i)));
    let type = TokenType.INTEGER;
    if (this.#match("+")) {
      type = this.#match("+")
        ? TokenType.INTEGER_PLUS_PLUS
        : TokenType.INTEGER_PLUS;
    } else if (this.#match("-")) {
      type = this.#match("-")
        ? TokenType.INTEGER_MINUS_MINUS
        : TokenType.INTEGER_MINUS;
    }
    return this.#token(type);
  }

  getRatio(from: number): Ratio {
    const [numerator, next] = this.#positiveIntegerValue(from + 1);
    if (this.source[next] === "/") {
      const [denominator] = this.#positiveIntegerValue(next + 1);
      return new Ratio(numerator || 1, denominator || 1);
    }
    return new Ratio(numerator || 1, 1);
  }

  #duration(): Token {
    this.#advanceWhile((i) => Scanner.#isDigit(this.source.charCodeAt(i)));
    if (this.#match("/")) {
      this.#advanceWhile((i) => Scanner.#isDigit(this.source.charCodeAt(i)));
    }
    return this.#token(TokenType.DURATION);
  }

  next(): Token {
    this.#skip();
    this.#from = this.#current;
    if (this.done()) return this.#token(TokenType.END);
    const code = this.#pop();
    if (Scanner.#isDigit(code)) {
      return this.#integer();
    }
    if (Scanner.#isLetter(code)) {
      this.#identifier();
      return this.#token(
        KEYWORDS.get(this.source.slice(this.#from, this.#current)) ||
          TokenType.IDENTIFIER,
      );
    }
    switch (code) {
      case CODES["-"]: {
        if (
          !this.done() &&
          Scanner.#isDigit(this.source.charCodeAt(this.#current))
        ) {
          return this.#integer();
        }
        return this.#token(TokenType.ERROR);
      }
      case CODES[","]:
        return this.#token(TokenType.COMMA);
      case CODES["["]:
        return this.#token(TokenType.LEFT_BRACKET);
      case CODES["]"]:
        return this.#token(TokenType.RIGHT_BRACKET);
      case CODES["{"]:
        return this.#token(TokenType.LEFT_BRACE);
      case CODES["}"]:
        return this.#token(TokenType.RIGHT_BRACE);
      case CODES["="]:
        return this.#token(TokenType.IS);
      case CODES["_"]:
        return this.#duration();
      case CODES["'"]:
        return this.#text();
      case CODES["$"]:
        this.#identifier();
        return this.#token(TokenType.IDENTIFIER);
      default:
        break;
    }

    return this.#token(TokenType.ERROR);
  }

  getLineAndColumn(from: number) {
    let line = 1, i = 0;
    let start = 0;
    for (; i < from; i++) {
      if (this.source[i] === "\n") {
        line++;
        start = i + 1;
      }
    }
    return [line, from - start + 1];
  }
}
