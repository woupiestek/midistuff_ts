import { Scanner, Token, TokenType } from "./scanner3.ts";

export enum NodeType {
  ERROR,
  INSERT,
  JOIN,
  NOTE,
  REST,
  SEQUENCE,
}

export type Operations = Record<string, number> & {
  duration?: number;
  dyn?: number;
  key?: number;
  program?: number;
  tempo?: number;
};

export type Node =
  | {
      type: NodeType.JOIN | NodeType.SEQUENCE;
      children: Node[];
      operations?: Operations;
    }
  | {
      type: NodeType.INSERT;
      index: number;
    }
  | {
      type: NodeType.REST;
      operations?: Operations;
    }
  | {
      type: NodeType.NOTE;
      degree: number;
      accident: -2 | -1 | 0 | 1 | 2;
      operations?: Operations;
    }
  | {
      type: NodeType.ERROR;
      token: Token;
      error: Error;
    };

export type AST = {
  main: Node;
  sections: {
    mark: string;
    node: Node;
  }[];
};

export class Parser {
  #scanner;
  #current;
  #sections: { mark: string; node: Node }[] = [];
  #bindings: { mark: string; index: number }[] = [];
  constructor(private readonly source: Uint8Array) {
    this.#scanner = new Scanner(source);
    this.#current = this.#scanner.next();
  }

  #done() {
    return this.#current.type === TokenType.END;
  }

  #error(message: string) {
    const type = TokenType[this.#current.type];
    const line = this.#current.line;
    const lexeme = Parser.#decoder.decode(
      this.source.slice(this.#current.from, this.#current.to)
    );
    return new Error(`Error at line ${line} (${type} '${lexeme}'): ${message}`);
  }

  parse(): AST {
    try {
      const main = this.#node();
      if (!this.#done()) throw this.#error("input left over");
      return { main, sections: this.#sections };
    } catch (error) {
      return {
        main: { type: NodeType.ERROR, token: this.#current, error },
        sections: this.#sections,
      };
    }
  }

  #advance() {
    if (!this.#done()) {
      this.#current = this.#scanner.next();
    }
  }

  #match(type: TokenType) {
    if (type === this.#current.type) {
      this.#advance();
      return true;
    }
    return false;
  }

  #consume(type: TokenType) {
    if (!this.#match(type)) {
      throw this.#error(`Expected a ${TokenType[type]}`);
    }
  }

  #mark(): string {
    if (this.#current.type !== TokenType.MARK) {
      throw this.#error(`Mark expected`);
    }
    const value = this.source.slice(this.#current.from + 1, this.#current.to);
    this.#advance();
    return Parser.#decoder.decode(value);
  }

  #value(type: TokenType): number {
    if (this.#current.type !== type) {
      throw this.#error(`Expected a ${TokenType[type]}`);
    }
    const value = this.#current.value;
    if (value === undefined) {
      throw this.#error(`Expected ${TokenType[type]} to have a value`);
    }
    this.#current = this.#scanner.next();
    return value;
  }

  static #decoder = new TextDecoder();

  #resolve(mark: string): number {
    for (let i = this.#bindings.length - 1; i >= 0; i--) {
      if (this.#bindings[i].mark === mark) return this.#bindings[i].index;
    }
    throw this.#error(`Could not resolve ${mark}`);
  }

  // todo: check the ranges of the values.
  #operations(): Operations | undefined {
    if (this.#current.type !== TokenType.OPERATOR) {
      return undefined;
    }
    const operations: Operations = {};
    do {
      const slice = this.source.slice(this.#current.from + 1, this.#current.to);
      const name = Parser.#decoder.decode(slice);
      if (operations[name] !== undefined) {
        throw this.#error(`Duplicate operator \\${name}`);
      }
      switch (name) {
        case "dyn":
          this.#advance();
          operations[name] = this.#value(TokenType.DYNAMIC);
          break;
        case "key":
          this.#advance();
          operations[name] = this.#match(TokenType.MINUS)
            ? -this.#value(TokenType.INT)
            : this.#value(TokenType.INT);
          break;
        case "program":
          this.#advance();
          operations[name] = this.#value(TokenType.INT);
          break;
        case "tempo":
          this.#advance();
          operations[name] = this.#value(TokenType.INT);
          break;
        default:
          throw this.#error(`Unknown operator \\${name}`);
      }
    } while (this.#current.type === TokenType.OPERATOR);
    return operations;
  }

  #accident(): -2 | -1 | 0 | 1 | 2 {
    switch (this.#current.type) {
      case TokenType.DOUBLE_MINUS:
        this.#advance();
        return -2;
      case TokenType.DOUBLE_PLUS:
        this.#advance();
        return 2;
      case TokenType.MINUS:
        this.#advance();
        return -1;
      case TokenType.PLUS:
        this.#advance();
        return 1;
      default:
        return 0;
    }
  }

  #addDuration(node: Node): Node {
    if (node.type === NodeType.ERROR || node.type === NodeType.INSERT) {
      return node;
    }
    if (this.#current.type === TokenType.HEX && this.#current.value) {
      if (!node.operations) {
        node.operations = { duration: this.#current.value };
      } else {
        node.operations.duration = this.#current.value;
      }
      this.#advance();
    }
    return node;
  }

  #node(): Node {
    if (this.#current.type === TokenType.MARK) {
      return this.#insert();
    }
    const operations: Operations | undefined = this.#operations();
    switch (this.#current.type) {
      case TokenType.LEFT_BRACKET: {
        this.#advance();
        const scope = this.#bindings.length;
        const children = this.#set();
        this.#bindings.length = scope; // bindings go out of scope
        return this.#addDuration({
          type: NodeType.JOIN,
          children,
          operations,
        });
      }
      case TokenType.MINUS: {
        this.#advance();
        return this.#addDuration({
          type: NodeType.NOTE,
          degree: -this.#value(TokenType.INT),
          accident: this.#accident(),
          operations,
        });
      }
      case TokenType.INT: {
        return this.#addDuration({
          type: NodeType.NOTE,
          degree: this.#value(TokenType.INT),
          accident: this.#accident(),
          operations,
        });
      }
      case TokenType.REST:
        if (operations) {
          if (operations.dyn !== undefined) {
            throw this.#error("\\dyn is not allowed on a rest");
          }
          if (operations.key !== undefined) {
            throw this.#error("\\key is not allowed on a rest");
          }
          if (operations.program !== undefined) {
            throw this.#error("\\program is not allowed on a rest");
          }
        }
        this.#advance();
        return this.#addDuration({
          type: NodeType.REST,
          operations,
        });
      default:
        throw this.#error(
          "expected a mark '$...' collection '[...]', an operation '...', a rest 'r...' or a note '3c...'"
        );
    }
  }

  #insert(): Node {
    const mark = this.#mark();
    if (!this.#match(TokenType.IS)) {
      return {
        type: NodeType.INSERT,
        index: this.#resolve(mark),
      };
    }
    const index = this.#sections.push({ mark, node: this.#node() }) - 1;
    this.#bindings.push({ mark, index });
    return {
      type: NodeType.INSERT,
      index,
    };
  }

  #sequencEnd() {
    return [TokenType.END, TokenType.COMMA, TokenType.RIGHT_BRACKET].includes(
      this.#current.type
    );
  }

  #sequence(): Node {
    try {
      const children: Node[] = [];
      while (!this.#sequencEnd()) {
        children.push(this.#node());
      }
      return { type: NodeType.SEQUENCE, children };
    } catch (error) {
      const token = this.#current;
      this.#panic();
      return { type: NodeType.ERROR, token, error };
    }
  }

  #panic() {
    while (!this.#sequencEnd()) {
      if (this.#current.type === TokenType.LEFT_BRACKET) {
        let depth = 1;
        while (depth > 0 && !this.#done()) {
          this.#advance();
          if (this.#current.type === TokenType.LEFT_BRACKET) {
            depth++;
          } else if (this.#current.type === TokenType.RIGHT_BRACKET) {
            depth--;
          }
        }
      }
      this.#advance();
    }
  }

  #set(): Node[] {
    if (this.#match(TokenType.RIGHT_BRACKET)) return [];
    const children: Node[] = [];
    for (;;) {
      children.push(this.#sequence());
      if (!this.#match(TokenType.COMMA)) break;
    }
    this.#consume(TokenType.RIGHT_BRACKET);
    return children;
  }
}
