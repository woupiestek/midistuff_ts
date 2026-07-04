function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&'"\n]/g, (c) => {
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
      case "\n":
        return "&#xA;";
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
    this.#parents[this.#size] = this.#size;
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
    this.#parents[this.#size] = this.#size;
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
    const as: string[] = new Array(this.#size + 1);
    const cs: string[] = new Array(this.#size + 1);
    for (let i = this.#size - 1; i >= 0; i--) {
      const j = i > 0 ? i - this.#parents[i] : this.#size;
      switch (this.#keys[i]) {
        case Element.#comment:
          cs[j] = `<!--${(this.#values[i])}-->${cs[j] ?? ""}`;
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
          cs[j] = c + (cs[j] ?? "");
          break;
        }
        case Element.#text:
          cs[j] = (this.#values[i]) + (cs[j] ?? "");
          break;
        default:
          as[j] = `${(this.#keys[i])}="${(this.#values[i])}"${
            as[j] ? " " + as[j] : ""
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

// insert newlines and spaces at the end of tags, where it is safe to do so.
export function indent(xml: string): string[] {
  const ends = Array(xml.length).keys().filter((i) => xml[i] === ">").toArray();
  for (let i = 0; i < ends.length; i++) {
    const end = ends[i];
    if (xml[end - 1] === "/" || xml[end - 1] === "?") ends[i]--;
    else if (xml.substring(end - 2, end) == "--") ends[i] -= 2;
  }
  const depth: number[] = [0];
  for (let i = 0; i < ends.length; i++) {
    depth[i + 1] = depth[i];
    if (xml[ends[i]] === ">") {
      for (let k = ends[i]; k >= 2; k--) {
        if (xml.substring(k - 2, k) === "</") {
          depth[i + 1] -= 1;
          break;
        }
        if (xml[k - 1] === "<") {
          depth[i + 1] += 1;
          break;
        }
        if (xml[k - 1] === "!") {
          break;
        }
      }
    }
  }
  const lines = ends.map((_, i) =>
    "  ".repeat(depth[i]) +
    xml.substring(i && ends[i - 1], ends[i]).trim()
  );
  lines.push(xml.substring(ends[ends.length - 1]).trim());
  return lines;
}
