import {} from "https://deno.land/std@0.184.0/path/_constants.ts";
import { TrieMap } from "./trieMap.ts";

export enum TokenType {
  COMMA,
  END,
  ERROR,
  HEX,
  LBRACE,
  OPERAND,
  OPERATOR,
  PITCH,
  REST,
  RBRACE,
  VELOCITY,
}

export type Token = {
  type: TokenType;
  from: number;
  to: number;
  value?: number;
  line: number;
};

export const Token = {
  stringify({ type, from, to, line }: Token) {
    return `${TokenType[type]} [${from},${to}[ (line ${line})`;
  },
};

const CODES: Record<string, number> = Object.fromEntries(
  Array.from(Array(0x7e)).map((_, i) => [String.fromCharCode(i), i]),
);

const OPERANDS: TrieMap<[TokenType, number?]> = new TrieMap();
OPERANDS.put("r", [TokenType.REST]);
for (let octave = 0; octave <= 8; octave++) {
  const t1 = (octave + 1) * 12;
  for (let i = 0; i < 7; i++) {
    const letter = "abcdefg"[i];
    const t2 = [9, 11, 0, 2, 4, 5, 7][i] + t1;
    for (let j = 0; j < 5; j++) {
      const accidental = ["ff", "f", "", "s", "ss"][j];
      const t3 = [-2, -1, 0, 1, 2][j] + t2;
      OPERANDS.put(`${octave}${letter}${accidental}`, [TokenType.PITCH, t3]);
    }
  }
}
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

  #match(code: number): boolean {
    if (this.done() || this.source[this.#current] !== code) return false;
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
        if (value === 10) {
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
    while (!this.done() && !this.#match(CODES["\n"])) {
      this.#current++;
    }
  }

  #skip() {
    for (;;) {
      this.#whitespace();
      if (this.#match(CODES["%"])) this.#comment();
      else return;
    }
  }

  static #isLetterOrCipher(ch: number): boolean {
    return (
      (CODES[0] <= ch && ch <= CODES[9]) ||
      (CODES.A <= ch && ch <= CODES.Z) ||
      (CODES.a <= ch && ch <= CODES.z)
    );
  }
  static #ic(ch: number) {
    return Scanner.#isLetterOrCipher(ch);
  }

  #identifier() {
    while (!this.done() && Scanner.#ic(this.source[this.#current])) {
      this.#current++;
    }
  }

  #hexDigit(): number | null {
    if (this.done()) return null;
    const code = this.source[this.#current++];
    if (CODES[0] <= code && code <= CODES[9]) return code - CODES[0];
    if (CODES.a <= code && code <= CODES.f) return code - CODES.a + 10;
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
    if (this.#match(CODES["."])) {
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

  next(): Token {
    this.#skip();
    this.#from = this.#current;
    if (this.done()) return this.#token(TokenType.END);
    const ch = this.#pop();
    switch (ch) {
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
      default:
        if (Scanner.#ic(ch)) {
          this.#identifier();
          const token = this.#token(TokenType.OPERAND);
          const specific = OPERANDS.getByArray(
            this.source.slice(token.from, token.to),
          );
          if (specific === null) return token;
          token.type = specific[0];
          token.value = specific[1];
          return token;
        }
        // todo: this is effectively unreachable
        return this.#token(TokenType.ERROR);
    }
  }
}
