import { Scanner, Token, TokenType } from "./scanner3.ts";
import { TrieMap } from "./trieMap.ts";

export enum NodeType {
  CRESC,
  DYN,
  ERROR,
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
    mark: string;
  }
  | {
    type: NodeType.MARK;
    mark: string;
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
  }
  | {
    type: NodeType.ERROR;
    token: Token;
    error: Error;
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

  #error(message: string) {
    const type = TokenType[this.#current.type];
    const line = this.#current.line;
    const lexeme = Parser.#decoder.decode(
      this.source.slice(this.#current.from, this.#current.to),
    );
    return new Error(`Error at line ${line} (${type} '${lexeme}'): ${message}`);
  }

  parse() {
    const result = this.#node();
    if (!this.#done()) throw this.#error("input left over");
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

  // use triemap and test the whole thing
  #operation(): Node {
    const type = KEYWORDS.getByArray(
      this.source.slice(this.#current.from + 1, this.#current.to),
    );
    if (type === null) throw this.#error(`Bad keyword`);
    this.#advance();
    switch (type) {
      case NodeType.CRESC: {
        return {
          type,
          from: this.#value(TokenType.VELOCITY),
          to: this.#value(TokenType.VELOCITY),
          next: this.#node(),
        };
      }
      case NodeType.DYN: {
        return {
          type,
          value: this.#value(TokenType.VELOCITY),
          next: this.#node(),
        };
      }
      case NodeType.REPEAT:
        return {
          type,
          mark: this.#mark(),
        };
      case NodeType.PROGRAM: {
        return {
          type: NodeType.PROGRAM,
          value: this.#value(TokenType.DEC),
          next: this.#node(),
        };
      }
      case NodeType.MARK: {
        return {
          type: NodeType.MARK,
          mark: this.#mark(),
          next: this.#node(),
        };
      }
      case NodeType.TEMPO: {
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
        return { type: NodeType.JOIN, children: this.#collection() };
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
