import {} from "https://deno.land/std@0.184.0/path/_constants.ts";

export enum TokenType {
  COMMA,
  END,
  ERROR,
  LBRACE,
  OPERAND,
  OPERATOR,
  RBRACE,
}

export type Token = {
  type: TokenType;
  from: number;
  to: number;
  line: number;
};

const CODES: Record<string, number> = {};
for (let i = 33; i < 127; i++) {
  CODES[String.fromCharCode(i)] = i;
}

export class Scanner {
  #current = 0;
  #from = 0;
  #line = 1;
  constructor(private readonly source: Uint8Array) {}

  #token(type: TokenType): Token {
    return {
      type,
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
      if ((value >= 9 && value <= 13) || value === 32) {
        this.#current++;
        if (value === 10) {
          this.#line++;
        }
      } else {
        return;
      }
    }
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

  // '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\x7F'
  //      x x     x                                                                               xxx
  static #ic(ch: number) {
    return (
      (CODES["'"] <= ch && ch <= CODES["$"]) ||
      (CODES[0] <= ch && ch <= CODES[";"]) ||
      (CODES["?"] <= ch && ch <= CODES.Z) ||
      (CODES["^"] <= ch && ch <= CODES.z)
    );
  }

  #identifier() {
    while (!this.done() && Scanner.#ic(this.source[this.#current])) {
      this.#current++;
    }
  }

  next(): Token {
    this.#skip();
    this.#from = this.#current;
    if (this.done()) return this.#token(TokenType.END);
    const ch = this.#pop();
    if (Scanner.#ic(ch)) {
      this.#identifier();
      return this.#token(TokenType.OPERAND);
    }
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
      default:
        return this.#token(TokenType.ERROR);
    }
  }
}
