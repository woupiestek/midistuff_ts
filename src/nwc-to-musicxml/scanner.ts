export class Scanner {
  #indices: number[] = [];
  #column: number[] = [];
  #line: number[] = [];
  constructor(private readonly source: string) {
    let isString = false;
    for (let i = 0, l = this.source.length; i < l; i++) {
      if ('"' === this.source[i]) {
        isString = !isString;
        if (isString) this.#indices.push(i);
      }
      if (isString) continue;
      if ("\:,=!".includes(this.source[i])) {
        this.#indices.push(i);
      }
      if ("|" === this.source[i]) {
        this.#column.push(this.#indices.length);
        this.#indices.push(i);
      }
      if ("\n" === this.source[i]) {
        this.#line.push(this.#column.length);
      }
    }
    this.#line.push(this.#column.length);
  }
  lines() {
    return this.#line.map((_, i) => i).slice(1);
  }
  getLineTag(line: number) {
    return this.#indices[this.#column[this.#line[line]]];
  }
  *getColumns(line: number) {
    for (
      let i = this.#line[line] + 1,
        l = this.#line[line + 1] ?? this.#column.length;
      i < l;
      i++
    ) {
      yield i;
    }
  }
  getColumnTag(column: number) {
    return this.#indices[this.#column[column]];
  }
  getValues(column: number) {
    return this.#indices.slice(
      this.#column[column] + 1,
      this.#column[column + 1],
    );
  }

  getName(from: number): string {
    let to = from;
    while (to < this.source.length && /\w/.test(this.source[to++]));
    return this.source.slice(from, to - 1);
  }

  getKeyPart(from: number): string {
    let to = from;
    while (/[#A-Gb]/.test(this.source[to++]));
    return this.source.slice(from, to - 1);
  }

  getSignature(from: number): string {
    let to = from;
    while (/[\w/]/.test(this.source[to++]));
    return this.source.slice(from, to - 1);
  }

  getPos(from: number): string {
    let to = from;
    while (/[-0-9#bnvx^]/.test(this.source[to++]));
    return this.source.slice(from, to - 1);
  }

  getString(from: number): string {
    let to = from;
    while (to < this.source.length) {
      switch (this.source[to++]) {
        case '"':
          return this.source.slice(from, to - 1);
        case "\n":
          throw new Error("unterminated string");
        case "\\":
          to++;
          // fall through
        default:
          continue;
      }
    }
    throw new Error("unterminated string");
  }
}
