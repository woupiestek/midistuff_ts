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
  type: TokenType;
};

export class Scanner {
  #current = 0;
  #from = 0;
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
  getString(from: number): string {
    let to = from;
    for (;;) {
      switch (this.source[++to]) {
        case undefined:
          throw new Error("not a string");
        case "\\":
          to++;
          continue;
        case '"':
          return this.source.slice(from, to);
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

  getOther(from: number): string {
    let to = from;
    for (;;) {
      switch (this.source[++to]) {
        case undefined:
        case ",":
        case ":":
        case "=":
        case "|":
        case "\r":
          return this.source.slice(from, to);
      }
    }
  }

  #token(type: TokenType): Token {
    return { type, from: this.#from };
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
        this.#key();
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

  line(index: number) {
    let line = 1;
    for (let i = 0; i < index; i++) {
      if (this.source[i] === "\n") {
        line++;
      }
    }
    return line;
  }
}
