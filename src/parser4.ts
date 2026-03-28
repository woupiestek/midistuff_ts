import { Tokens, TokenType } from "./tokens.ts";
import { Ratio } from "./util.ts";

export type Dict = { [_: string]: Value };
export type Value = Dict | number | string | Value[];

export type Notes = {
  accidentals: { [_: number]: -2 | -1 | 1 | 2 };
  degrees: number[];
  durations: Ratio[];
  keys: number[];
};

export type Nodes = {
  types: number[];
  ids: number[];
};

// encoding length into variable length node types. smart?
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
  errors: { tokens: number[]; errors: Error[] };
  events: string[];
  indices: number[];
  nodes: Nodes;
  notes: Notes;
  rests: Ratio[];
};

export type ParseResult = {
  data: Data;
  metadata?: Dict;
};

export class Parser {
  tokens;
  #current = 0;
  #bindings: { marks: string[]; indices: number[] } = {
    marks: [],
    indices: [],
  };
  #target: Data = {
    errors: { tokens: [], errors: [] },
    events: [],
    indices: [],
    notes: {
      degrees: [],
      accidentals: {},
      keys: [],
      durations: [],
    },
    rests: [],
    nodes: {
      types: [],
      ids: [],
    },
  };
  constructor(private readonly source: string) {
    this.tokens = new Tokens(source);
  }

  #done() {
    return this.#current === this.tokens.froms.length;
  }

  #error(message: string) {
    const [line, column] = this.tokens.getLineAndColumn(this.#current - 1);
    const from = this.tokens.froms[this.#current - 1];
    // add a few characters of the source?
    return new Error(
      `Error at [${line};${column}] '\u2026${
        this.source.slice(from >= 3 ? from - 3 : 0, from + 3)
      }\u2026': ${message}`,
    );
  }

  storeError(error: Error) {
    this.#target.errors.tokens.push(this.#current);
    this.#target.errors.errors.push(error);
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
      this.#current++;
    }
  }

  get #currentType() {
    return this.tokens.types[this.#current];
  }

  #match(type: TokenType) {
    if (type === this.#currentType) {
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
    if (this.#currentType !== TokenType.IDENTIFIER) {
      throw this.#error(`Mark expected`);
    }
    const value = this.tokens.getIdentifierName(this.#current);
    this.#advance();
    return value;
  }

  #integer(min: number, max: number): number {
    if (this.#currentType !== TokenType.INTEGER) {
      throw this.#error(`Expected an integer`);
    }

    const value = this.tokens.getIntegerValue(this.#current);
    if (typeof value !== "number") {
      // should not be reachable
      throw this.#error(`Expected integer to have a value`);
    }
    if (value < min || max < value) {
      throw this.#error(`Value ${value} is out of range [${min}, ${max}]`);
    }
    this.#current++;
    return value;
  }

  #options(): { key?: number; duration?: Ratio } {
    let key, duration;
    a: for (;;) {
      switch (this.#currentType) {
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
          duration = this.tokens.getRatio(this.#current);
          this.#advance();
          continue;
        default:
          break a;
      }
    }
    return { key, duration };
  }

  #push(type: number, id: number): number {
    const l = this.#target.nodes.ids.length;
    this.#target.nodes.ids[l] = id;
    this.#target.nodes.types[l] = type;
    return l;
  }

  #note(accident: -2 | -1 | 0 | 1 | 2, key: number, duration: Ratio) {
    const degree = this.tokens.getIntegerValue(this.#current);
    if (degree < -34 || 38 < degree) {
      throw this.#error(`Value ${degree} is out of range [-34, 38]`);
    }
    this.#current++;
    // the note id
    const id = this.#target.notes.degrees.length;
    this.#target.notes.degrees[id] = degree;
    this.#target.notes.keys[id] = key;
    this.#target.notes.durations[id] = duration;
    if (accident) {
      this.#target.notes.accidentals[id] = accident;
    }
    return this.#push(NodeType.NOTE, id);
  }

  #node(key: number, duration: Ratio): number {
    const options = this.#options();
    key = options.key ?? key;
    duration = options.duration ?? duration;
    if (key === undefined) console.log("key", key);
    switch (this.#currentType) {
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
          // 'rest id'
          this.#target.rests.push(duration) - 1,
        );
      case TokenType.TEXT: {
        const value = this.tokens.getText(this.#current);
        this.#advance();
        return this.#push(
          NodeType.EVENT,
          // or the event id
          this.#target.events.push(value) - 1,
        );
      }
      default:
        throw this.#error(`Expected note, rest or set here`);
    }
  }

  #copy(index: number): number {
    return this.#push(
      this.#target.nodes.types[index],
      this.#target.nodes.ids[index],
    );
  }

  #resolve(mark: string): number {
    for (let i = this.#bindings.marks.length - 1; i >= 0; i--) {
      if (this.#bindings.marks[i] === mark) {
        return this.#bindings.indices[i];
      }
    }
    throw this.#error(`Could not resolve '${mark}'`);
  }

  #insert(key: number, duration: Ratio) {
    const mark = this.#mark();
    if (!this.#match(TokenType.IS)) {
      return this.#copy(this.#resolve(mark));
    }
    const index = this.#node(key, duration);
    this.#bindings.marks.push(mark);
    this.#bindings.indices.push(index);
    return index;
  }

  #panic() {
    let depth = 1;
    for (;;) {
      switch (this.#currentType) {
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
    const scope = this.#bindings.marks.length;
    const index = this.#push(type, 0);
    // the interleaving issue again!
    // when dealing with nested structures, a stack and a bump allocator are needed.
    try {
      const indices = [];
      while (!this.#match(stop)) {
        indices.push(this.#node(key, duration));
      }
      this.#target.nodes.types[index] = NodeType.multiply(type, indices.length);
      // or in this case, the id of a vector...
      this.#target.nodes.ids[index] = this.#target.indices.length;
      this.#target.indices.push(...indices);
    } catch (error) {
      this.storeError(error as Error);
      this.#panic();
    } finally {
      // bindings go out of scope
      this.#bindings.marks.length = scope;
      this.#bindings.indices.length = scope;
    }
    return index;
  }

  #pop(): number {
    if (this.#done()) throw this.#error("Expected more input");
    const current = this.#current;
    this.#current++;
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
    switch (this.tokens.types[token2]) {
      case TokenType.LEFT_BRACE:
        return this.dict();
      case TokenType.LEFT_BRACKET:
        return this.#array();
      case TokenType.INTEGER:
        return this.tokens.getIntegerValue(token2);
      case TokenType.TEXT:
        return this.tokens.getText(token2);
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
      switch (this.tokens.types[token1]) {
        case TokenType.RIGHT_BRACE:
          return result;
        case TokenType.TEXT:
          key = this.tokens.getText(token1);
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
