import { Scanner, Token, TokenType } from "./scanner3.ts";
import { Ratio } from "./util.ts";

export type Options = {
  duration?: Ratio;
  key?: number;
};

export type Dict = { [_: string]: Value };
export type Value = Dict | number | string | Value[];

export type Note = {
  degree: number;
  accident: -2 | -1 | 0 | 1 | 2;
};

export type Node = {
  type: number;
  index: number;
  options?: Options;
};

export const NodeType = {
  ARRAY: 0,
  EVENT: 2,
  NOTE: 4,
  REST: 5,
  SET: 6,
  NODE: 7,
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
      case NodeType.NODE:
        return "node";
      case NodeType.NOTE:
        return "note";
      case NodeType.SET:
        return `set[${NodeType.length(typ)}]`;
      default:
        return `invalid node type ${typ}`;
    }
  },
};

// I have to recall what the options are doing again...
export type Nodes = {
  errors: { token: Token; error: Error }[];
  events: string[];
  notes: Note[];
  nodes: Node[];
};

export class Parser {
  #scanner;
  #current;
  #bindings: { mark: string; node: Node }[] = [];
  #stack: Node[] = [];
  #target: Nodes = {
    errors: [],
    events: [],
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

  errorNode(error: Error) {
    this.#target.errors.push({ token: this.#current, error });
  }

  parse() {
    try {
      this.#node();
    } catch (error) {
      this.errorNode(error);
      return { target: this.#target, main: this.#stack.pop() };
    }
    let metadata: Dict = {};
    if (this.#match(TokenType.COMMA) && this.#match(TokenType.LEFT_BRACE)) {
      try {
        metadata = this.dict();
      } catch (error) {
        this.errorNode(error);
        return { target: this.#target, main: this.#stack.pop() };
      }
    }
    if (!this.#done()) {
      this.errorNode(this.#error("input left over"));
      return { target: this.#target, main: this.#stack.pop() };
    }
    return { metadata, target: this.#target, main: this.#stack.pop() };
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
      if (this.#bindings[i].mark === mark) return this.#bindings[i].node;
    }
    throw this.#error(`Could not resolve '${mark}'`);
  }

  #options(): Options | undefined {
    const options: Options = {};
    a: for (;;) {
      switch (this.#current.type) {
        case TokenType.KEY:
          if (options.key !== undefined) {
            throw this.#error("Double key");
          }
          this.#advance();
          options.key = this.#integer(-7, 7);
          continue;
        case TokenType.DURATION:
          options.duration = this.#scanner.getRatio(this.#current.from);
          this.#advance();
          continue;
        default:
          break a;
      }
    }
    if (Object.values(options).every((it) => it === undefined)) {
      return undefined;
    }
    return options;
  }

  #note(accident: -2 | -1 | 0 | 1 | 2, options?: Options) {
    const degree = this.#scanner.getIntegerValue(this.#current.from);
    if (degree < -34 || 38 < degree) {
      throw this.#error(`Value ${degree} is out of range [-34, 38]`);
    }
    this.#current = this.#scanner.next();
    const index = this.#target.notes.length;
    this.#target.notes.push({ degree, accident });
    this.#stack.push( {
      type: NodeType.NOTE,
      index,
      options,
    });
  }

  #node() {
    if (this.#current.type === TokenType.IDENTIFIER) {
      this.#insert();
      return;
    }
    const options: Options | undefined = this.#options();
    switch (this.#current.type) {
      case TokenType.LEFT_BRACKET: {
        this.#advance();
        this.#set(NodeType.ARRAY, TokenType.RIGHT_BRACKET, options);
        return;
      }
      case TokenType.LEFT_BRACE: {
        this.#advance();
        this.#set(NodeType.SET, TokenType.RIGHT_BRACE, options);
        return;
      }
      case TokenType.INTEGER_MINUS:
        return this.#note(-1, options);
      case TokenType.INTEGER_MINUS_MINUS:
        return this.#note(-2, options);
      case TokenType.INTEGER_PLUS:
        return this.#note(1, options);
      case TokenType.INTEGER_PLUS_PLUS:
        return this.#note(2, options);
      case TokenType.INTEGER:
        return this.#note(0, options);
      case TokenType.REST:
        if (options) {
          if (options.key !== undefined) {
            throw this.#error("Key signatures are not allowed rests");
          }
        }
        this.#advance();
        this.#stack.push({ type: NodeType.REST, index: 0, options });
        return;
      case TokenType.TEXT: {
        const value = this.#scanner.getText(this.#current.from);
        this.#advance();
        this.#target.events.push(value);
        this.#stack.push({
          type: NodeType.EVENT,
          index: this.#target.events.length - 1,
          options,
        });
        return;
      }
      default:
        throw this.#error(`Expected note, rest or set here`);
    }
  }

  #insert() {
    const mark = this.#mark();
    if (!this.#match(TokenType.IS)) {
      this.#stack.push(this.#resolve(mark));
    } else {
      this.#node();
      this.#bindings.push({ mark, node: this.#stack[this.#stack.length - 1] });
    }
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
    options?: Options,
  ) {
    const scope = this.#bindings.length;
    try {
      const length = this.#stack.length;
      while (!this.#match(stop)) {
        this.#node();
      }
      const slice = this.#stack.slice(length);
      this.#stack.length = length;
      const index = this.#target.nodes.length;
      this.#target.nodes.push(...slice);
      this.#stack.push({
        type: NodeType.multiply(type, slice.length),
        index,
        options,
      });
    } catch (error) {
      this.errorNode(error);
      this.#panic();
    } finally {
      // bindings go out of scope
      this.#bindings.length = scope;
    }
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
