import { Scanner, Token, TokenType } from "./scanner3.ts";
import { Ratio } from "./util.ts";

export type Dict = { [_: string]: Value };
export type Value = Dict | number | string | Value[];

export type Note = {
  degree: number;
  accident: -2 | -1 | 0 | 1 | 2;
};

export type Node = {
  type: number;
  id: number;
  duration: Ratio;
  key: number;
};

export const NodeType = {
  ARRAY: 1,
  EVENT: 2,
  NOTE: 3,
  REST: 4,
  SET: 5,
  multiply(typ: number, length: number = 1): number {
    return length * 16 + typ;
  },
  length(typ: number): number {
    return typ >> 4;
  },
  base(typ: number): number {
    return typ & 15;
  },
  stringify(typ: number): string {
    switch (NodeType.base(typ)) {
      case NodeType.ARRAY:
        return `array[${NodeType.length(typ)}]`;
      case NodeType.EVENT:
        return "event";
      case NodeType.NOTE:
        return "note";
      case NodeType.SET:
        return `set[${NodeType.length(typ)}]`;
      default:
        return `invalid node type ${typ}`;
    }
  },
};

export type Data = {
  errors: { token: Token; error: Error }[];
  events: string[];
  indices: number[];
  nodes: Node[];
  notes: Note[];
};

export type ParseResult = {
  data: Data;
  metadata?: Dict;
};

export class Parser {
  #scanner;
  #current;
  #bindings: { mark: string; index: number }[] = [];
  #target: Data = {
    errors: [],
    events: [],
    indices: [],
    notes: [],
    nodes: [],
  };
  constructor(private readonly source: string) {
    this.#scanner = new Scanner(source);
    this.#current = this.#scanner.next();
  }

  #done() {
    return this.#current.type === TokenType.END;
  }

  #error(message: string) {
    const [line, column] = this.#scanner.getLineAndColumn(this.#current.from);
    // add a few characters of the source?
    return new Error(
      `Error at [${line};${column}] '\u2026${
        this.source.slice(this.#current.from - 3, this.#current.from + 3)
      }\u2026': ${message}`,
    );
  }

  storeError(error: Error) {
    this.#target.errors.push({ token: this.#current, error });
  }

  parse(): ParseResult {
    try {
      this.#node(0, new Ratio(1, 4));
    } catch (error) {
      this.storeError(error as Error);
      return { data: this.#target };
    }
    let metadata: Dict = {};
    if (this.#match(TokenType.COMMA) && this.#match(TokenType.LEFT_BRACE)) {
      try {
        metadata = this.dict();
      } catch (error) {
        this.storeError(error as Error);
        return { data: this.#target };
      }
    }
    if (!this.#done()) {
      this.storeError(this.#error("input left over"));
      return { metadata, data: this.#target };
    }
    return { metadata, data: this.#target };
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
    if (this.#current.type !== TokenType.IDENTIFIER) {
      throw this.#error(`Mark expected`);
    }
    const value = this.#scanner.getIdentifierName(this.#current.from);
    this.#advance();
    return value;
  }

  #integer(min: number, max: number): number {
    if (this.#current.type !== TokenType.INTEGER) {
      throw this.#error(`Expected an integer`);
    }

    const value = this.#scanner.getIntegerValue(this.#current.from);
    if (typeof value !== "number") {
      // should not be reachable
      throw this.#error(`Expected integer to have a value`);
    }
    if (value < min || max < value) {
      throw this.#error(`Value ${value} is out of range [${min}, ${max}]`);
    }
    this.#current = this.#scanner.next();
    return value;
  }

  #resolve(mark: string): Node {
    for (let i = this.#bindings.length - 1; i >= 0; i--) {
      const binding = this.#bindings[i];
      if (binding.mark === mark) {
        return this.#target.nodes[binding.index];
      }
    }
    throw this.#error(`Could not resolve '${mark}'`);
  }

  #options(): { key?: number; duration?: Ratio } {
    let key, duration;
    a: for (;;) {
      switch (this.#current.type) {
        case TokenType.KEY:
          if (key !== undefined) {
            throw this.#error("Double key");
          }
          this.#advance();
          key = this.#integer(-7, 7);
          continue;
        case TokenType.DURATION:
          if (duration !== undefined) {
            throw this.#error("Double duration");
          }
          duration = this.#scanner.getRatio(this.#current.from);
          this.#advance();
          continue;
        default:
          break a;
      }
    }
    return { key, duration };
  }

  #push(type: number, id: number, key: number, duration: Ratio): number {
    return this.#target.nodes.push({ type, id, key, duration }) - 1;
  }

  #note(accident: -2 | -1 | 0 | 1 | 2, key: number, duration: Ratio) {
    const degree = this.#scanner.getIntegerValue(this.#current.from);
    if (degree < -34 || 38 < degree) {
      throw this.#error(`Value ${degree} is out of range [-34, 38]`);
    }
    this.#current = this.#scanner.next();
    const id = this.#target.notes.length;
    this.#target.notes.push({ degree, accident });
    return this.#push(NodeType.NOTE, id, key, duration);
  }

  #node(key: number, duration: Ratio): number {
    const options = this.#options();
    key = options.key ?? key;
    duration = options.duration ?? duration;
    if (key === undefined) console.log("key", key);
    switch (this.#current.type) {
      case TokenType.LEFT_BRACKET: {
        this.#advance();
        return this.#set(
          NodeType.ARRAY,
          TokenType.RIGHT_BRACKET,
          key,
          duration,
        );
      }
      case TokenType.LEFT_BRACE: {
        this.#advance();
        return this.#set(
          NodeType.SET,
          TokenType.RIGHT_BRACE,
          key,
          duration,
        );
      }
      case TokenType.IDENTIFIER: {
        if (options.key !== undefined || options.duration !== undefined) {
          throw this.#error(
            "Key signatures and durartion are not allowed on marks",
          );
        }

        return this.#insert(key, duration);
      }
      case TokenType.INTEGER_MINUS:
        return this.#note(-1, key, duration);
      case TokenType.INTEGER_MINUS_MINUS:
        return this.#note(-2, key, duration);
      case TokenType.INTEGER_PLUS:
        return this.#note(1, key, duration);
      case TokenType.INTEGER_PLUS_PLUS:
        return this.#note(2, key, duration);
      case TokenType.INTEGER:
        return this.#note(0, key, duration);
      case TokenType.REST:
        if (options.key !== undefined) {
          throw this.#error("Key signatures are not allowed on rests");
        }
        this.#advance();
        return this.#push(
          NodeType.REST,
          0,
          key,
          duration,
        );
      case TokenType.TEXT: {
        const value = this.#scanner.getText(this.#current.from);
        this.#advance();
        return this.#push(
          NodeType.EVENT,
          this.#target.events.push(value) - 1,
          key,
          duration,
        );
      }
      default:
        throw this.#error(`Expected note, rest or set here`);
    }
  }

  #insert(key: number, duration: Ratio) {
    const mark = this.#mark();
    if (!this.#match(TokenType.IS)) {
      return this.#target.nodes.push(this.#resolve(mark)) - 1;
    }
    const index = this.#node(key, duration);
    this.#bindings.push({
      mark,
      index,
    });
    return index;
  }

  #panic() {
    let depth = 1;
    for (;;) {
      switch (this.#current.type) {
        case TokenType.END:
          return;
        case TokenType.LEFT_BRACE:
          depth++;
          break;
        case TokenType.LEFT_BRACKET:
          depth++;
          break;
        case TokenType.RIGHT_BRACE:
          depth--;
          break;
        case TokenType.RIGHT_BRACKET:
          depth--;
          break;
        default:
          break;
      }
      this.#advance();
      if (depth === 0) return;
    }
  }

  #set(
    type: number,
    stop: TokenType,
    key: number,
    duration: Ratio,
  ) {
    const scope = this.#bindings.length;
    const node = { type, key, duration, id: 0 };
    const index = this.#target.nodes.push(node) - 1;
    // the interleaving issue again!
    // when dealing with nested structures, a stack and a bump allocator are needed.
    try {
      const indices = [];
      while (!this.#match(stop)) {
        indices.push(this.#node(key, duration));
      }
      node.type = NodeType.multiply(type, indices.length);
      node.id = this.#target.indices.length;
      this.#target.indices.push(...indices);
    } catch (error) {
      this.storeError(error as Error);
      this.#panic();
    } finally {
      // bindings go out of scope
      this.#bindings.length = scope;
    }
    return index;
  }

  #pop(): Token {
    if (this.#done()) throw this.#error("Expected more input");
    const current = this.#current;
    this.#current = this.#scanner.next();
    return current;
  }

  #array(): Value[] {
    const array = [];
    for (;;) {
      if (this.#match(TokenType.RIGHT_BRACKET)) return array;
      array.push(this.#value());
    }
  }

  #value(): Value {
    const token2 = this.#pop();
    switch (token2.type) {
      case TokenType.LEFT_BRACE:
        return this.dict();
      case TokenType.LEFT_BRACKET:
        return this.#array();
      case TokenType.INTEGER:
        return this.#scanner.getIntegerValue(token2.from);
      case TokenType.TEXT:
        return this.#scanner.getText(token2.from);
      default:
        throw this.#error(
          "Expected integer, label, string, array or key-value pairs",
        );
    }
  }

  dict(): Dict {
    const result: Dict = {};
    for (;;) {
      const token1 = this.#pop();
      let key: string;
      switch (token1.type) {
        case TokenType.RIGHT_BRACE:
          return result;
        case TokenType.TEXT:
          key = this.#scanner.getText(token1.from);
          break;
        default:
          throw this.#error("Expected label or string");
      }
      if (result[key] !== undefined) throw this.#error(`Double key ${key}`);
      this.#consume(TokenType.IS);
      result[key] = this.#value();
    }
  }
}
