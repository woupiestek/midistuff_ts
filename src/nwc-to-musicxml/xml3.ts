// put one idea behind the face of the other.

function escapeXml(unsafe: string) {
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

export class Element {
  static #comment = "<!---->";
  static #element = "</>";
  static #text = '""';

  #keys: string[] = [];
  #values: string[] = [];
  #parents: number[] = [];
  #size = 0;

  #add(key: string, value: string) {
    this.#keys[this.#size] = key;
    this.#values[this.#size] = value;
    this.#parents[this.#size] = 0;
    this.#size++;
    return this;
  }

  constructor(tag: string) {
    this.#add(Element.#element, escapeXml(tag));
  }

  addComment(text: string) {
    return this.#add(
      Element.#comment,
      escapeXml(text),
    );
  }

  addText(text: string) {
    return this.#add(Element.#text, escapeXml(text));
  }

  addAttribute(key: string, value: string) {
    return this.#add(
      escapeXml(key),
      escapeXml(value),
    );
  }

  // this now works by copying contents
  addElement(that: Element) {
    this.#parents.push(...that.#parents);
    this.#keys.push(...that.#keys);
    this.#values.push(...that.#values);
    this.#parents[this.#size] = 0;
    for (let i = 1; i < that.#size; i++) {
      this.#parents[this.#size + i] += this.#size;
    }
    this.#size += that.#size;
    return this;
  }

  addElements(...those: Element[]) {
    for (const that of those) {
      this.addElement(that);
    }
    return this;
  }

  addAttributes(entries: { [_: string]: string }) {
    for (const [k, v] of Object.entries(entries)) {
      this.addAttribute(k, v);
    }
    return this;
  }

  stringify() {
    const as: string[] = [];
    const cs: string[] = [];
    for (let i = this.#size - 1; i >= 0; i--) {
      let p = this.#parents[i];
      if (p === i) p = this.#size;
      switch (this.#keys[i]) {
        case Element.#comment:
          cs[p] = `<!-- ${(this.#values[i])} -->${cs[p] ?? ""}`;
          break;
        case Element.#element: {
          const tag = this.#values[i];
          let c = "<" + tag;
          if (as[i]) {
            c += " " + as[i];
          }
          if (cs[i]) {
            c += ">" + cs[i] + "</" + tag + ">";
          } else {
            c += "/>";
          }
          cs[p] = c + (cs[p] ?? "");
          break;
        }
        case Element.#text:
          cs[p] = (this.#values[i]) + (cs[p] ?? "");
          break;
        default:
          as[p] = `${(this.#keys[i])}="${(this.#values[i])}"${
            as[p] ? " " + as[p] : ""
          }`;
          break;
      }
    }
    return cs[this.#size];
  }
}

export function create(
  tag: string,
  attributes: { [_: string]: string } | undefined = undefined,
  ...content: (string | Element | null)[]
) {
  const element = new Element(tag);
  if (attributes) {
    element.addAttributes(attributes);
  }
  for (const item of content) {
    if (item === null) continue;
    if (typeof item === "string") {
      element.addText(item);
    } else {
      element.addElement(item);
    }
  }
  return element;
}
