type Element = number & { readonly __tag: unique symbol };

export class Elements {
  #next = 0;
  #tag: string[] = [];
  #attribute: (Map<string, string> | undefined)[] = [];
  #text: string[][] = [];
  #element: Element[][] = [];

  create(
    tag: string,
    attributes: Map<string, string> | undefined,
    ...content: (string | Element)[]
  ) {
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
  stringify(element: Element): string {
    let attributes = "";
    if (this.#attribute[element]) {
      for (const [k, v] of this.#attribute[element]?.entries()) {
        attributes += ` ${k}="${this.escapeXml(v)}"`;
      }
    }
    let content = "";
    for (
      let i = 0;
      i < this.#element[element].length || i < this.#text[element].length;
      i++
    ) {
      if (this.#text[element][i]) {
        content += this.escapeXml(this.#text[element][i]);
      }
      if (this.#element[element][i]) {
        content += this.stringify(this.#element[element][i]);
      }
    }
    return `<${this.#tag[element]}${attributes}>${content}</${
      this.#tag[element]
    }>`;
  }
}
