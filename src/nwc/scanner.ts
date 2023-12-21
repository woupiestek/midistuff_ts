// first one: get a load of the available symbols

//  !"(),-./0123456789:<=>ABCDEFGHIJKLMNOPRSTUVWYZ^abcdefghiklmnoprstuvwxyz|©

export enum TokenType {
  BANG,
  COLON,
  COMMA,
  END,
  ERROR,
  IS,
  LINE,
  OTHER,
  PIPE,
  STRING,
}

export type Token = {
  from: number;
  line: number;
  to: number;
  type: TokenType;
};

export class Scanner {
  #current = 0;
  #from = 0;
  #line = 1;
  constructor(private readonly source: string) {}

  done() {
    return this.#current >= this.source.length;
  }

  #pop() {
    if (this.done()) return undefined;
    return this.source[this.#current++];
  }

  #bang() {
    while (this.#pop() !== "\n");
    this.#line++;
  }

  #letter() {
    if (this.done()) return false;
    const code = this.source.charCodeAt(this.#current);
    if ((code & 192) === 64) {
      const c31 = code & 31;
      return c31 > 0 && c31 <= 26;
    }
    return 48 <= code && code <= 57;
  }

  #key() {
    while (this.#letter()) {
      this.#pop();
    }
  }

  #string(): Token {
    for (;;) {
      switch (this.#pop()) {
        case undefined:
          return this.#token(TokenType.ERROR);
        case "\\":
          this.#pop();
          continue;
        case '"':
          return this.#token(TokenType.STRING);
      }
    }
  }

  #value(): Token {
    for (;;) {
      switch (this.source[this.#current]) {
        case undefined:
        case ",":
        case ":":
        case "=":
        case "|":
        case "\r":
          return this.#token(TokenType.OTHER);
      }
      this.#pop();
    }
  }

  #token(type: TokenType): Token {
    return { type, from: this.#from, to: this.#current, line: this.#line };
  }

  next(): Token {
    this.#returns();
    this.#from = this.#current;
    switch (this.#pop()) {
      case undefined:
        return this.#token(TokenType.END);
      case "!":
        this.#bang();
        return this.#token(TokenType.BANG);
      case "|":
        return this.#token(TokenType.PIPE);
      case '"':
        return this.#string();
      case ",":
        return this.#token(TokenType.COMMA);
      case ":":
        return this.#token(TokenType.COLON);
      case "=":
        return this.#token(TokenType.IS);
      case "\n":
        this.#line++;
        return this.#token(TokenType.LINE);
      default:
        return this.#value();
    }
  }

  #returns() {
    while (
      this.#current < this.source.length &&
      this.source[this.#current] === "\r"
    ) {
      this.#current++;
    }
  }
}
