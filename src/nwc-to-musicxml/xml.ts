type Element = {
  tag: string;
  attributes: Map<string, string>;
  texts: string[];
  elements: Element[];
};

export class Elements {
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
    for (const [k, v] of Object.entries(element.attributes)) {
      attributes += ` ${k}="${this.escapeXml(v)}"`;
    }
    let content = "";
    for (
      let i = 0;
      i < element.elements.length || i < element.texts.length;
      i++
    ) {
      if (element.texts[i]) content += this.escapeXml(element.texts[i]);
      if (element.elements[i]) content += this.stringify(element.elements[i]);
    }
    return `<${element.tag}${attributes}>${content}</${element.tag}>`;
  }
}
