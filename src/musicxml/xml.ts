export class Element {
  readonly attributes: Map<string, string> = new Map();
  readonly content: (string | Element)[] = [];
  constructor(
    readonly tag: string,
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
