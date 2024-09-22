import { Scanner, Token, TokenType } from "./scanner.ts";

export type Column = {
  tag: Token;
  values: Token[];
};

export type Line = {
  tag: Token;
  columns: Column[];
};

export type NWC = {
  begin: Token;
  middle: Line[];
  end: Token;
};

export class Parser {
  next;

  constructor(readonly scanner: Scanner) {
    this.next = this.scanner.next();
  }

  result() {
    return this.#nwc();
  }

  #pop() {
    const current = this.next;
    this.next = this.scanner.next();
    return current;
  }

  #consume(typ: TokenType, errorMessage: string): Token {
    if (this.next.type === typ) return this.#pop();
    throw new Error(errorMessage);
  }

  #match(typ: TokenType): boolean {
    if (this.next.type !== typ) return false;
    this.#pop();
    return true;
  }

  #nwc(): NWC {
    const begin = this.#consume(TokenType.BANG, "Missing begin");
    const middle = [];
    console.log("what!?", TokenType[this.next.type]);
    while (this.#match(TokenType.LINE)) {
      if (this.next.type === TokenType.PIPE) {
        middle.push(this.#line());
      } else {
        const end = this.#consume(TokenType.BANG, "Missing end");
        return { begin, middle, end };
      }
    }
    throw new Error("Malformed nwc document");
  }

  #line(): Line {
    const tag = this.#pop();
    const columns = [];
    while (this.next.type === TokenType.PIPE) {
      columns.push(this.#column());
    }
    return { tag, columns };
  }

  #column(): Column {
    const tag = this.#pop();
    const values = [];
    a: for (;;) {
      switch (this.next.type) {
        case TokenType.COLON:
        case TokenType.COMMA:
        case TokenType.IS:
        case TokenType.STRING:
          values.push(this.#pop());
          continue;
        default:
          break a;
      }
    }
    return { tag, values };
  }
}
