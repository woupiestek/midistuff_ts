import { Scanner, Token, TokenType } from "./scanner3.ts";
import { TrieMap } from "./trieMap.ts";

export enum NodeType {
  CRESC,
  DYN,
  ERROR,
  JOIN,
  INSERT,
  NOTE,
  PROGRAM,
  REST,
  SEQUENCE,
  TEMPO,
}

export type Node =
  | {
    type: NodeType.JOIN | NodeType.SEQUENCE;
    children: Node[];
  }
  | {
    type: NodeType.CRESC;
    from: number;
    to: number;
    next: Node;
  }
  | {
    type: NodeType.DYN | NodeType.PROGRAM | NodeType.TEMPO;
    value: number;
    next: Node;
  }
  | {
    type: NodeType.INSERT;
    index: number;
  }
  | {
    type: NodeType.REST;
    duration: number;
  }
  | {
    type: NodeType.NOTE;
    pitch: number;
    duration: number;
  }
  | {
    type: NodeType.ERROR;
    token: Token;
    error: Error;
  };

enum Operation {
  CRESC,
  DYN,
  MARK,
  PROGRAM,
  REPEAT,
  TEMPO,
}

const KEYWORDS: TrieMap<Operation> = new TrieMap();
KEYWORDS.put("cresc", Operation.CRESC);
KEYWORDS.put("dyn", Operation.DYN);
KEYWORDS.put("mark", Operation.MARK);
KEYWORDS.put("program", Operation.PROGRAM);
KEYWORDS.put("repeat", Operation.REPEAT);
KEYWORDS.put("tempo", Operation.TEMPO);

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
      this.source.slice(this.#current.from, this.#current.to),
    );
    return new Error(`Error at line ${line} (${type} '${lexeme}'): ${message}`);
  }

  parse(): { main: Node; sections: { mark: string; node: Node }[] } {
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
      throw this.#error(`Expected ${type}`);
    }
    const value = this.#current.value;
    if (value === undefined) {
      throw this.#error(`Expected ${type} to have a value`);
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

  // use triemap and test the whole thing
  #operation(): Node {
    const type = KEYWORDS.getByArray(
      this.source.slice(this.#current.from + 1, this.#current.to),
    );
    if (type === null) throw this.#error(`Bad keyword`);
    this.#advance();
    switch (type) {
      case Operation.CRESC: {
        return {
          type: NodeType.CRESC,
          from: this.#value(TokenType.VELOCITY),
          to: this.#value(TokenType.VELOCITY),
          next: this.#node(),
        };
      }
      case Operation.DYN: {
        return {
          type: NodeType.DYN,
          value: this.#value(TokenType.VELOCITY),
          next: this.#node(),
        };
      }
      case Operation.REPEAT:
        // todo: change node structure
        return {
          type: NodeType.INSERT,
          index: this.#resolve(this.#mark()),
        };
      case Operation.PROGRAM: {
        return {
          type: NodeType.PROGRAM,
          value: this.#value(TokenType.DEC),
          next: this.#node(),
        };
      }
      case Operation.MARK: {
        const mark = this.#mark();
        const index = this.#sections.push({ mark, node: this.#node() }) - 1;
        this.#bindings.push({ mark, index });
        // todo: change node structure
        return {
          type: NodeType.INSERT,
          index,
        };
      }
      case Operation.TEMPO: {
        return {
          type: NodeType.TEMPO,
          value: this.#value(TokenType.DEC),
          next: this.#node(),
        };
      }
      default:
        throw this.#error(`Unknown operator ${name}`);
    }
  }

  #node(): Node {
    switch (this.#current.type) {
      case TokenType.LBRACE: {
        this.#advance();
        const scope = this.#bindings.length;
        const children = this.#collection();
        this.#bindings.length = scope; // bindings go out of scope
        return { type: NodeType.JOIN, children };
      }
      case TokenType.OPERATOR:
        return this.#operation();
      case TokenType.PITCH: {
        const pitch = this.#current.value;
        if (pitch === undefined) {
          throw this.#error(`missing pitch value`);
        }
        this.#advance();
        return {
          type: NodeType.NOTE,
          pitch,
          duration: this.#value(TokenType.HEX),
        };
      }
      case TokenType.REST:
        this.#advance();
        return {
          type: NodeType.REST,
          duration: this.#value(TokenType.HEX),
        };
      default:
        throw this.#error(
          "expected a collection '{', an operation '...', a rest 'r...' or a note '3c...'",
        );
    }
  }

  #sequencEnd() {
    return [TokenType.END, TokenType.COMMA, TokenType.RBRACE].includes(
      this.#current.type,
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
      if (this.#current.type === TokenType.LBRACE) {
        let depth = 1;
        while (depth > 0 && !this.#done()) {
          this.#advance();
          if (this.#current.type === TokenType.LBRACE) {
            depth++;
          } else if (this.#current.type === TokenType.RBRACE) {
            depth--;
          }
        }
      }
      this.#advance();
    }
  }

  #collection(): Node[] {
    if (this.#match(TokenType.RBRACE)) return [];
    const children: Node[] = [];
    for (;;) {
      children.push(this.#sequence());
      if (!this.#match(TokenType.COMMA)) break;
    }
    this.#consume(TokenType.RBRACE);
    return children;
  }
}
