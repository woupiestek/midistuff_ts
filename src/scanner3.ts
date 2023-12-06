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
  to: number;
  line: number;
  value?: number | Ratio;
};

export const Token = {
  stringify({ type, from, to, line, value }: Token) {
    return `${TokenType[type]}(${value || ""}) [${from},${to}[ (line ${line})`;
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
  #line = 1;
  constructor(private readonly source: string) {}

  #token(type: TokenType, value?: number | Ratio): Token {
    return {
      type,
      value,
      from: this.#from,
      to: this.#current,
      line: this.#line,
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

  #whitespace() {
    while (!this.done()) {
      const value = this.source.charCodeAt(this.#current);
      if (Scanner.#white(value)) {
        this.#current++;
        if (value === CODES["\n"]) {
          this.#line++;
        }
      } else {
        return;
      }
    }
  }

  static #white(value: number) {
    return (value >= 9 && value <= 13) || value === 32;
  }

  #comment() {
    while (!this.done()) {
      if (this.#pop() === CODES["\n"]) {
        this.#line++;
        break;
      }
    }
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

  #identifier() {
    while (!this.done() && Scanner.#ic(this.source.charCodeAt(this.#current))) {
      this.#current++;
    }
  }

  #integer(value: number, positive: boolean): Token {
    while (
      !this.done() &&
      Scanner.#isDigit(this.source.charCodeAt(this.#current))
    ) {
      value = 10 * value + (this.source.charCodeAt(this.#current++) - 48);
    }
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
    return this.#token(type, positive ? value : -value);
  }

  #duration(): Token {
    let numerator = 0;
    while (
      !this.done() &&
      Scanner.#isDigit(this.source.charCodeAt(this.#current))
    ) {
      numerator = 10 * numerator +
        (this.source.charCodeAt(this.#current++) - 48);
    }
    if (numerator === 0) numerator = 1;
    let denominator = 0;
    if (this.#match("/")) {
      while (
        !this.done() &&
        Scanner.#isDigit(this.source.charCodeAt(this.#current))
      ) {
        denominator = 10 * denominator +
          (this.source.charCodeAt(this.#current++) - 48);
      }
    }
    if (denominator === 0) denominator = 1;
    return this.#token(TokenType.DURATION, new Ratio(numerator, denominator));
  }

  next(): Token {
    this.#skip();
    this.#from = this.#current;
    if (this.done()) return this.#token(TokenType.END);
    const code = this.#pop();
    if (Scanner.#isDigit(code)) {
      return this.#integer(code - 48, true);
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
          return this.#integer(this.#pop() - 48, false);
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
}
