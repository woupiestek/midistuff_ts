export class Element {
  constructor(
    readonly tag: string,
    readonly attributes: Map<string, string> = new Map(),
    readonly content: (string | Element)[] = [],
  ) {}

  toString(): string {
    const parts = [this.tag];
    for (const [k, v] of this.attributes.entries()) {
      parts.push(`${k}="${v}"`);
    }
    const start = parts.join(" ");
    if (this.content.length === 0) {
      return `<${start}/>`;
    }
    return `<${start}>${
      this.content.map((it) => it instanceof Element ? it.toString() : it).join(
        "",
      )
    }</${this.tag}>`;
  }

  static make(tag: string, ...content: (string | Element)[]): Element {
    const element = new Element(tag);
    element.content.push(...content);
    return element;
  }
}

export class ElementBuilder {
  #attributes: Map<string, string> = new Map();
  #content: (string | Element)[] = [];
  #tag = "";
  constructor(t: string) {
    this.#tag = t;
  }
  attribute(key: string, value: string) {
    this.#attributes.set(key, value);
    return this;
  }
  build() {
    return new Element(this.#tag, this.#attributes, this.#content);
  }
  add(x: string | Element) {
    this.#content.push(x);
    return this;
  }
}
