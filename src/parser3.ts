import { Scanner, Token, TokenType } from "./scanner3.ts";

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

class TrieMap<V> {
  #tries: Record<number, TrieMap<V>> = {};
  #value: V | null = null;
  static #path(key: string): number[] {
    return Array.from(key)
      .map((_, i) => key.charCodeAt(i))
      .reverse();
  }
  #put(path: number[], value: V) {
    const index = path.pop();
    if (index === undefined) {
      this.#value = value;
      return;
    }
    (this.#tries[index] ||= new TrieMap()).#put(path, value);
  }
  put(key: string, value: V) {
    this.#put(TrieMap.#path(key), value);
  }
  #get(path: number[]): V | null {
    const index = path.pop();
    if (index === undefined) {
      return this.#value;
    }
    const trie = this.#tries[index];
    if (trie === null) return null;
    return trie.#get(path);
  }
  get(key: string): V | null {
    return this.#get(TrieMap.#path(key));
  }
  getByArray(key: Uint8Array): V | null {
    return this.#get([...key].reverse());
  }
}

const DYNAMICS: TrieMap<number> = new TrieMap();
DYNAMICS.put("pppp", 1);
DYNAMICS.put("ppp", 15);
DYNAMICS.put("pp", 29);
DYNAMICS.put("p", 43);
DYNAMICS.put("mp", 57);
DYNAMICS.put("mf", 71);
DYNAMICS.put("f", 85);
DYNAMICS.put("ff", 99);
DYNAMICS.put("fff", 113);
DYNAMICS.put("ffff", 127);

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
    const result = this.#next();
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
        `Expected a ${TokenType[type]}, actual ${
          Token.stringify(
            this.#current,
          )
        }`,
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

  #dynamic(): number {
    const velocity = DYNAMICS.getByArray(this.#slice());
    if (velocity === null) throw new Error("Expected dynamic");
    return velocity;
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
      this.source.slice(this.#current.from + 1, this.#current.to),
    );
    if (type === null) throw new Error(`Bad keyword`);
    this.#advance();
    switch (type) {
      case NodeType.CRESC: {
        return {
          type,
          from: this.#dynamic(),
          to: this.#dynamic(),
          next: this.#next(),
        };
      }
      case NodeType.DYN: {
        return {
          type,
          value: this.#dynamic(),
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

  #noteOrRest(): Node {
    return new NoteOrRestScanner(this.#slice()).node();
  }

  #node(): Node | null {
    switch (this.#current.type) {
      case TokenType.LBRACE: {
        this.#advance();
        return { type: NodeType.JOIN, children: this.#collection() };
      }
      case TokenType.OPERATOR:
        return this.#operation();
      case TokenType.OPERAND:
        return this.#noteOrRest();
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

const CODES = {
  0: "0".charCodeAt(0),
  8: "8".charCodeAt(0),
  9: "9".charCodeAt(0),
  a: "a".charCodeAt(0),
  f: "f".charCodeAt(0),
  g: "g".charCodeAt(0),
  r: "r".charCodeAt(0),
  s: "s".charCodeAt(0),
  ".": ".".charCodeAt(0),
  ";": ";".charCodeAt(0),
};

class NoteOrRestScanner {
  #current = 0;
  constructor(private readonly source: Uint8Array) {}
  done() {
    return this.#current >= this.source.length;
  }

  #match(code: number): boolean {
    if (this.done() || this.source[this.#current] !== code) return false;
    this.#current++;
    return true;
  }

  #pop(): number | null {
    if (this.done()) return null;
    return this.source[this.#current++];
  }

  #hex(): number | null {
    const code = this.#pop();
    if (code === null) return null;
    if (CODES[0] <= code && code <= CODES[9]) return code - CODES[0];
    if (CODES.a <= code && code <= CODES.f) return code - CODES.a + 10;
    this.#current--;
    return null;
  }

  #duration(): number {
    let value = 0;
    for (;;) {
      const hex = this.#hex();
      if (hex === null) break;
      value = value * 16 + hex;
    }
    if (!this.#match(CODES["."])) {
      return value;
    }
    let f = 1 / 16;
    for (;;) {
      const hex = this.#hex();
      if (hex === null) break;
      value += f * hex;
      f /= 16;
    }
    return value;
  }

  #pitch(): number {
    const code = this.#pop();
    // octave
    if (code === null || CODES[0] > code || code > CODES[8]) {
      throw new Error("bad octave");
    }
    let tone = (code - CODES[0] + 1) * 12;
    // note
    const code2 = this.#pop();
    if (code2 === null || CODES.a > code2 || code2 > CODES.g) {
      throw new Error("bad pitch");
    }
    tone += [9, 11, 0, 2, 4, 5, 7][code2 - CODES.a];
    // accidentals
    if (this.#match(CODES.s)) {
      tone++;
      while (this.#match(CODES.s)) {
        tone++;
      }
    } else if (this.#match(CODES.f)) {
      tone--;
      while (this.#match(CODES.f)) {
        tone--;
      }
    }
    if (!this.#match(CODES[";"])) throw new Error('Expected ";');
    return tone;
  }

  node(): Node {
    // rest
    if (this.#match(CODES.r)) {
      const duration = this.#duration();
      if (this.done()) return { type: NodeType.REST, duration };
      throw new Error("bad rest");
    }
    // note
    const pitch = this.#pitch();
    const duration = this.#duration();
    if (this.done()) {
      return { type: NodeType.NOTE, pitch, duration };
    }
    throw new Error("bad rest");
  }
}
