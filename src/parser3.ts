import { Scanner, Token, TokenType } from "./scanner3.ts";
import { TrieMap } from "./trieMap.ts";

export enum NodeType {
  CRESC,
  DYN,
  JOIN,
  MARK,
  NOTE,
  PROGRAM,
  REPEAT,
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
      type: NodeType.REPEAT;
      value: string;
    }
  | {
      type: NodeType.MARK;
      value: string;
      next: Node;
    }
  | {
      type: NodeType.REST;
      duration: number;
    }
  | {
      type: NodeType.NOTE;
      pitch: number;
      duration: number;
    };

const KEYWORDS: TrieMap<NodeType> = new TrieMap();
KEYWORDS.put("cresc", NodeType.CRESC);
KEYWORDS.put("dyn", NodeType.DYN);
KEYWORDS.put("mark", NodeType.MARK);
KEYWORDS.put("program", NodeType.PROGRAM);
KEYWORDS.put("repeat", NodeType.REPEAT);
KEYWORDS.put("tempo", NodeType.TEMPO);

export class Parser {
  #scanner;
  #current;
  constructor(private readonly source: Uint8Array) {
    this.#scanner = new Scanner(source);
    this.#current = this.#scanner.next();
  }

  #done() {
    return this.#current.type === TokenType.END;
  }

  parse() {
    const result = this.#node();
    if (result === null || !this.#done()) throw new Error("parse failure");
    return result;
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
      throw new Error(
        `Expected a ${TokenType[type]}, actual ${Token.stringify(
          this.#current
        )}`
      );
    }
  }

  #slice(): Uint8Array {
    if (this.#current.type !== TokenType.OPERAND) {
      throw new Error("Operand expected");
    }
    const value = this.source.slice(this.#current.from, this.#current.to);
    this.#advance();
    return value;
  }

  #string(): string {
    return Parser.#decoder.decode(this.#slice());
  }

  #value(type: TokenType): number {
    if (this.#current.type !== type) {
      throw new Error(
        `Expected ${type}, actual ${Token.stringify(this.#current)}`
      );
    }
    const value = this.#current.value;
    if (value === undefined) {
      throw new Error(`Expected ${type} to have a value`);
    }
    this.#current = this.#scanner.next();
    return value;
  }

  static #decoder = new TextDecoder();

  #next(): Node {
    const node = this.#node();
    if (node === null) throw new Error("Missing argument");
    return node;
  }
  // use triemap and test the whole thing
  #operation(): Node {
    const type = KEYWORDS.getByArray(
      this.source.slice(this.#current.from + 1, this.#current.to)
    );
    if (type === null) throw new Error(`Bad keyword`);
    this.#advance();
    switch (type) {
      case NodeType.CRESC: {
        return {
          type,
          from: this.#value(TokenType.VELOCITY),
          to: this.#value(TokenType.VELOCITY),
          next: this.#next(),
        };
      }
      case NodeType.DYN: {
        return {
          type,
          value: this.#value(TokenType.VELOCITY),
          next: this.#next(),
        };
      }
      case NodeType.REPEAT:
        return {
          type,
          value: this.#string(),
        };
      case NodeType.PROGRAM: {
        return {
          type: NodeType.PROGRAM,
          value: Number.parseInt(this.#string()),
          next: this.#next(),
        };
      }
      case NodeType.MARK: {
        return {
          type: NodeType.MARK,
          value: this.#string(),
          next: this.#next(),
        };
      }
      case NodeType.TEMPO: {
        return {
          type: NodeType.TEMPO,
          value: Number.parseFloat(this.#string()),
          next: this.#next(),
        };
      }
      default:
        throw new Error(`Unknown operator ${name}`);
    }
  }

  #node(): Node | null {
    switch (this.#current.type) {
      case TokenType.LBRACE: {
        this.#advance();
        return { type: NodeType.JOIN, children: this.#collection() };
      }
      case TokenType.OPERATOR:
        return this.#operation();
      case TokenType.PITCH: {
        const pitch = this.#current.value;
        if (pitch === undefined) {
          throw new Error(`missing pitch value`);
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
        return null;
    }
  }

  #sequence(): Node {
    const children: Node[] = [];
    for (;;) {
      const child = this.#node();
      if (child === null) return { type: NodeType.SEQUENCE, children };
      children.push(child);
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
