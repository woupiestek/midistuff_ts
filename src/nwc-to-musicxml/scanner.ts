export enum TokenType {
  BANG,
  COLON,
  COMMA,
  END,
  ERROR,
  IS,
  LINE,
  PIPE,
  STRING,
}

export type Token = {
  from: number;
  type: TokenType;
};

export class Scanner {
  #current = 0;
  constructor(private readonly source: string) {}

  hasNext() {
    return this.#current < this.source.length;
  }

  #token(typ: TokenType): Token {
    return { type: typ, from: this.#current - 1 };
  }

  #string() {
    while (this.hasNext()) {
      switch (this.source[this.#current++]) {
        case '"':
          return;
        case "\n":
          return this.#token(TokenType.ERROR);
        case "\\":
          this.#current++;
          // fall through
        default:
          continue;
      }
    }
    return this.#token(TokenType.ERROR);
  }

  next() {
    while (this.hasNext()) {
      switch (this.source[this.#current++]) {
        case "|":
          return this.#token(TokenType.PIPE);
        case ":":
          return this.#token(TokenType.COLON);
        case ",":
          return this.#token(TokenType.COMMA);
        case "=":
          return this.#token(TokenType.IS);
        case "\n":
          return this.#token(TokenType.LINE);
        case "!":
          return this.#token(TokenType.BANG);
        case '"': {
          const token = this.#token(TokenType.STRING);
          return this.#string() || token;
        }
        default:
          continue;
      }
    }
    return this.#token(TokenType.END);
  }

  getName(from: number): string {
    let to = from;
    while (/\w/.test(this.source[to++]));
    return this.source.slice(from, to - 1);
  }

  getKeyPart(from: number): string {
    let to = from;
    while (/[#A-Gb]/.test(this.source[to++]));
    return this.source.slice(from, to - 1);
  }

  getPos(from: number): string {
    let to = from;
    while (/[-0-9#bnvx]/.test(this.source[to++]));
    return this.source.slice(from, to - 1);
  }

  getString(from: number): string {
    let to = from;
    while (to < this.source.length) {
      switch (this.source[to++]) {
        case '"':
          return this.source.slice(from, to - 1);
        case "\n":
          throw new Error("unterminated string");
        case "\\":
          to++;
          // fall through
        default:
          continue;
      }
    }
    throw new Error("unterminated string");
  }
}
