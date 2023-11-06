import { MessageType } from "./midiTypes.ts";

const DYNAMICS = {
  pppp: 1,
  ppp: 15,
  pp: 29,
  p: 43,
  mp: 57,
  mf: 71,
  // confusing with the note f!
  f: 85,
  ff: 99,
  fff: 113,
  ffff: 127,
};
// too simple: (1+octave)*12
// const OCTAVES =

// rests...

// durations in hex fractions...

// running status for durations and dynamics, or separate dynamic events?

// keys/clefs for octave control?

// something for tempo, though the first version could just accept the 120 4ths pm option

// comments!

// complicated: 'f' is a note, a dynamic and a hexadecimal number. 'c4' merely fails to be a dynamic.
// - no space between notes/rests and their durations, perhaps a connective symbol, but maybe not.
// - always start with 'r' for rest, 'n' for note, 'd' for dynamic
// - we could still go back to start with note letter if the 'd' for dynamic is replaced
// -

export enum TokenType {
  NOTE,
  REST,
  DYNAMIC,
  END,
  ERROR,
}

const CODES: Record<string, number> = {};
for (let i = 33; i < 127; i++) {
  CODES[String.fromCharCode(i)] = i;
}

export type Token =
  | {
    type: TokenType.END | TokenType.ERROR;
  }
  | {
    type: TokenType.REST | TokenType.DYNAMIC;
    value: number;
  }
  | {
    type: TokenType.NOTE;
    tone: number;
    duration: number;
  };

export class TextScanner {
  current = 0;
  constructor(readonly source: Uint8Array) {}

  // rest + dynamic + note ...

  done() {
    return this.current >= this.source.length;
  }

  error(msg: string) {
    return new Error(`Error at ${this.current}: '${msg}' `);
  }

  top() {
    if (this.done()) throw this.error("nothing left to scan");
    return this.source[this.current];
  }

  pop() {
    if (this.done()) throw this.error("nothing left to scan");
    return this.source[this.current++];
  }

  consume(code: number) {
    const value = this.pop();
    if (code !== value) {
      throw this.error(`Expected ${code} but found ${value}`);
    }
  }

  match(code: number) {
    if (this.done() || code !== this.top()) {
      return false;
    }
    this.current++;
    return true;
  }

  whitespace() {
    while (!this.done()) {
      const value = this.source[this.current];
      if ((value >= 9 && value <= 13) || value === 32) {
        this.current++;
      } else {
        return;
      }
    }
  }

  *hexDigits() {
    while (!this.done()) {
      const value = this.top();
      let y = 0;
      if (CODES[0] <= value && value <= CODES[9]) {
        y = value - CODES[0];
      } else if (CODES.a <= value && value <= CODES.f) {
        y = value - CODES.a + 10;
      } else break;
      this.current++;
      yield y;
    }
  }

  duration(): number {
    let value = 0;
    for (const digit of this.hexDigits()) {
      value = 16 * value + digit;
    }
    if (!this.match(CODES["."])) {
      return value;
    }
    let f = 1 / 16;
    for (const digit of this.hexDigits()) {
      value += f * digit;
      f /= 16;
    }
    return value;
  }

  note(ch: number): Token {
    let tone = [9, 11, 0, 2, 4, 5, 7][ch - CODES.a];
    const sharps = this.count(CODES["+"]);
    if (sharps === 0) {
      const flats = this.count(CODES["-"]);
      tone -= flats;
    } else {
      tone += sharps;
    }
    // octave
    const octave = this.pop() - CODES[0];
    if (octave <= 0 || octave > 8) {
      throw this.error(`octave ${octave} out of range`);
    }
    tone += (octave + 1) * 12;
    this.consume(CODES[";"]);
    return { type: TokenType.NOTE, tone, duration: this.duration() };
  }

  count(code: number): number {
    let value = 0;
    while (this.match(code)) {
      value++;
    }
    return value;
  }

  dynamic(): Token {
    const type = TokenType.DYNAMIC;
    switch (this.pop()) {
      case CODES.f: {
        const x = this.count(CODES.f);
        if (x <= 3) {
          return {
            type: TokenType.DYNAMIC,
            value: [DYNAMICS.f, DYNAMICS.ff, DYNAMICS.fff, DYNAMICS.ffff][x],
          };
        } else break;
      }
      case CODES.m:
        switch (this.pop()) {
          case CODES.f:
            return { type, value: DYNAMICS.mf };
          case CODES.p:
            return { type, value: DYNAMICS.mp };
          default:
            break;
        }
        break;
      case CODES.p: {
        const x = this.count(CODES.p);
        if (x <= 3) {
          return {
            type: TokenType.DYNAMIC,
            value: [DYNAMICS.p, DYNAMICS.pp, DYNAMICS.ppp, DYNAMICS.pppp][x],
          };
        } else {
          break;
        }
      }
    }
    throw this.error("bad dynamic");
  }

  next(): Token {
    this.whitespace();
    if (this.done()) return { type: TokenType.END };
    const ch = this.pop();
    if (ch === CODES.r) {
      return this.rest();
    } else if (CODES.a <= ch && ch <= CODES.g) {
      return this.note(ch);
    } else if (ch === CODES["\\"]) {
      return this.dynamic();
    } else {
      return { type: TokenType.ERROR };
    }
  }

  private rest(): Token {
    return {
      type: TokenType.REST,
      value: this.duration(),
    };
  }
}

export function messages(tokens: Token[], channel = 0) {
  let velocity = DYNAMICS.mp;
  const tempo = 2000; // ms per whole note
  let realTime = 0; // ms since start
  const messages = [];
  for (const token of tokens) {
    switch (token.type) {
      case TokenType.NOTE:
        messages.push({
          realTime,
          message: [(MessageType.noteOn << 4) + channel, token.tone, velocity],
        });
        realTime += token.duration * tempo;
        messages.push({
          realTime,
          message: [(MessageType.noteOff << 4) + channel, token.tone, velocity],
        });
        break;
      case TokenType.REST:
        realTime += token.value * tempo;
        break;
      case TokenType.DYNAMIC:
        velocity = token.value;
        break;
      case TokenType.END:
        return messages;
      case TokenType.ERROR:
        // just ignore for now
        break;
    }
  }
  return messages;
}
