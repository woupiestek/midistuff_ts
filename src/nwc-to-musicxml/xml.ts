export type Element = number & { readonly __tag: unique symbol };

export class Elements {
  #next = 0;
  #tag: string[] = [];
  #attribute: ({ [_: string]: string } | undefined)[] = [];
  #text: string[][] = [];
  #element: Element[][] = [];

  create(
    tag: string,
    attributes: { [_: string]: string } | undefined = undefined,
    ...content: (string | Element)[]
  ): Element {
    this.#tag[this.#next] = tag;
    this.#attribute[this.#next] = attributes;
    this.#text[this.#next] = [];
    this.#element[this.#next] = [];
    for (let i = 0, l = content.length; i < l; i++) {
      let text = "";
      while (typeof content[i] === "string") {
        text += content[i++];
      }
      this.#text[this.#next].push(text);
      if (i < l) this.#element[this.#next].push(content[i] as Element);
    }
    return this.#next++ as Element;
  }

  escapeXml(unsafe: string) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "&":
          return "&amp;";
        case "'":
          return "&apos;";
        case '"':
          return "&quot;";
      }
      return c;
    });
  }
  #strings: string[] = [];
  stringify(element: Element): string {
    return this.#strings[element] ||= this.#stringify(element);
  }
  #stringify(element: Element): string {
    let attributes = "";
    if (this.#attribute[element]) {
      for (const [k, v] of Object.entries(this.#attribute[element])) {
        attributes += ` ${k}="${this.escapeXml(v)}"`;
      }
    }
    let content = "";
    const l = this.#element[element].length;
    for (let i = 0; i < l; i++) {
      content += this.escapeXml(this.#text[element][i]);
      content += this.stringify(this.#element[element][i]);
    }
    if (l < this.#text[element].length) {
      content += this.escapeXml(this.#text[element][l]);
    }
    if (content === "") {
      return `<${this.#tag[element]}${attributes}/>`;
    }
    return `<${this.#tag[element]}${attributes}>${content}</${
      this.#tag[element]
    }>`;
  }
}
