import {} from "https://deno.land/std@0.184.0/path/_constants.ts";
import { TrieMap } from "./trieMap.ts";

export enum TokenType {
  COMMA,
  DOUBLE_MINUS,
  DOUBLE_PLUS,
  END,
  ERROR,
  HEX,
  INT,
  LBRACE,
  MARK,
  MINUS,
  OPERATOR,
  PLUS,
  RBRACE,
  REST,
  VELOCITY,
}
export type Token = {
  type: TokenType;
  from: number;
  to: number;
  line: number;
  value?: number;
};

export const Token = {
  stringify({ type, from, to, line, value }: Token) {
    return `${TokenType[type]}(${value || ""}) [${from},${to}[ (line ${line})`;
  },
};

const CODES: Record<string, number> = Object.fromEntries(
  Array.from(Array(0x7e)).map((_, i) => [String.fromCharCode(i), i]),
);

const OPERANDS: TrieMap<[TokenType, ...number[]]> = new TrieMap();
OPERANDS.put("r", [TokenType.REST]);
OPERANDS.put("pppp", [TokenType.VELOCITY, 1]);
OPERANDS.put("ppp", [TokenType.VELOCITY, 15]);
OPERANDS.put("pp", [TokenType.VELOCITY, 29]);
OPERANDS.put("p", [TokenType.VELOCITY, 43]);
OPERANDS.put("mp", [TokenType.VELOCITY, 57]);
OPERANDS.put("mf", [TokenType.VELOCITY, 71]);
OPERANDS.put("f", [TokenType.VELOCITY, 85]);
OPERANDS.put("ff", [TokenType.VELOCITY, 99]);
OPERANDS.put("fff", [TokenType.VELOCITY, 113]);
OPERANDS.put("ffff", [TokenType.VELOCITY, 127]);

export class Scanner {
  #current = 0;
  #from = 0;
  #line = 1;
  constructor(private readonly source: Uint8Array) {}

  #token(type: TokenType, value?: number): Token {
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
    if (this.done() || this.source[this.#current] !== CODES[char]) return false;
    this.#current++;
    return true;
  }

  #pop(): number {
    if (this.done()) throw new Error(`Out of input`);
    return this.source[this.#current++];
  }

  #whitespace() {
    while (!this.done()) {
      const value = this.source[this.#current];
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
    while (!this.done() && Scanner.#ic(this.source[this.#current])) {
      this.#current++;
    }
  }

  #hexDigit(): number | null {
    if (this.done()) return null;
    const code = this.source[this.#current++];
    const c15 = code & 15;
    if ((code & 240) === 48 && c15 <= 9) return c15;
    if ((code & 216) === 64 && c15 !== 0 && c15 !== 7) return c15 + 9;
    this.#current--;
    return null;
  }

  #hex() {
    let value = 0;
    for (;;) {
      const digit = this.#hexDigit();
      if (digit === null) break;
      value = 16 * value + digit;
    }
    if (this.#match(".")) {
      let f = 1 / 16;
      for (;;) {
        const digit = this.#hexDigit();
        if (digit === null) break;
        value += f * digit;
        f /= 16;
      }
    }
    return value;
  }

  #integer(value: number): number {
    while (!this.done() && Scanner.#isDigit(this.source[this.#current])) {
      value = 10 * value + (this.source[this.#current++] - 48);
    }
    return value;
  }

  next(): Token {
    this.#skip();
    this.#from = this.#current;
    if (this.done()) return this.#token(TokenType.END);
    const code = this.#pop();
    if (Scanner.#isDigit(code)) {
      return this.#token(TokenType.INT, this.#integer(code - 48));
    }
    switch (code) {
      case CODES["-"]:
        return this.#token(
          this.#match("-") ? TokenType.DOUBLE_MINUS : TokenType.MINUS,
        );
      case CODES["+"]:
        return this.#token(
          this.#match("+") ? TokenType.DOUBLE_PLUS : TokenType.PLUS,
        );
      case CODES[","]:
        return this.#token(TokenType.COMMA);
      case CODES["{"]:
        return this.#token(TokenType.LBRACE);
      case CODES["}"]:
        return this.#token(TokenType.RBRACE);
      case CODES["\\"]:
        this.#identifier();
        return this.#token(TokenType.OPERATOR);
      case CODES[";"]:
        return this.#token(TokenType.HEX, this.#hex());
      case CODES["$"]:
        this.#identifier();
        return this.#token(TokenType.MARK);
      default:
        break;
    }
    if (Scanner.#ic(code)) {
      this.#identifier();
      const specific = OPERANDS.getByArray(
        this.source.slice(this.#from, this.#current),
      );
      if (specific !== null) {
        return this.#token(...specific);
      }
    }
    return this.#token(TokenType.ERROR);
  }
}
