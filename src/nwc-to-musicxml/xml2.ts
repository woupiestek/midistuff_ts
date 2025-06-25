import { cyrb53 } from "./cyrb53.ts";

export type Node = number & { readonly __tag: unique symbol };

// note: no reuse possible!
// everything must be copied

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

class StringPool {
  #entries: { [_: number]: string } = {};
  insert(string: string) {
    const hash = (cyrb53(string) & 0xFFFFFFFF) >>> 0;
    this.#entries[hash] = string;
    return hash;
  }
  get(hash: number) {
    return this.#entries[hash];
  }
}

const minByteLength = 32;
const maxByteLength = 2 ** 28;

export class XML {
  #keyBuffer = new ArrayBuffer(minByteLength, { maxByteLength });
  #keys = new Uint32Array(this.#keyBuffer);
  #valueBuffer = new ArrayBuffer(minByteLength, { maxByteLength });
  #values = new Uint32Array(this.#valueBuffer);
  #parentBuffer = new ArrayBuffer(minByteLength, { maxByteLength });
  #parents = new Uint32Array(this.#parentBuffer);

  #size = 0;

  get #capacity() {
    return this.#keyBuffer.byteLength / 4;
  }

  #grow() {
    const length = 2 * this.#keyBuffer.byteLength;
    this.#keyBuffer.resize(length);
    this.#valueBuffer.resize(length);
    this.#parentBuffer.resize(length);
  }

  // pool all strings
  #stringPool = new StringPool();
  #comment = this.#stringPool.insert("<!---->");
  #element = this.#stringPool.insert("</>");
  #text = this.#stringPool.insert('""');

  #create(key: number, value: number) {
    if (this.#size >= this.#capacity) {
      this.#grow();
    }
    this.#keys[this.#size] = key;
    this.#values[this.#size] = value;
    this.#parents[this.#size] = this.#size;
    return this.#size++ as Node;
  }

  element(tag: string) {
    return this.#create(this.#element, this.#stringPool.insert(escapeXml(tag)));
  }

  comment(text: string) {
    return this.#create(
      this.#comment,
      this.#stringPool.insert(escapeXml(text)),
    );
  }

  text(text: string) {
    return this.#create(this.#text, this.#stringPool.insert(escapeXml(text)));
  }

  attribute(key: string, value: string) {
    return this.#create(
      this.#stringPool.insert(escapeXml(key)),
      this.#stringPool.insert(escapeXml(value)),
    );
  }

  insertInto(parent: Node, ...nodes: Node[]) {
    for (const node of nodes) this.#parents[node] = parent;
    return parent;
  }

  insertAttributes(parent: Node, entries: { [_: string]: string }) {
    return this.insertInto(
      parent,
      ...Object.entries(entries).map(([k, v]) => this.attribute(k, v)),
    );
  }

  builder(tag: string) {
    const element = this.element(tag);
    const self = {
      attributes: (entries: { [_: string]: string }) => {
        for (const [k, v] of Object.entries(entries)) {
          this.#parents[this.attribute(k, v)] = element;
        }
        return self;
      },
      children: (...nodes: (Node | string | null)[]) => {
        for (const node of nodes) {
          if (node === null) continue;
          this.#parents[typeof node === "string" ? this.text(node) : node] =
            element;
        }
        return self;
      },
      build: () => element,
    };
    return self;
  }

  stringify() {
    const as: string[] = [];
    const cs: string[] = [];
    for (let i = this.#size - 1; i >= 0; i--) {
      let p = this.#parents[i];
      if (p === i) p = this.#size;
      switch (this.#keys[i]) {
        case this.#comment:
          cs[p] = `<!-- ${this.#stringPool.get(this.#values[i])} -->${
            cs[p] ?? ""
          }`;
          break;
        case this.#element: {
          const tag = this.#stringPool.get(this.#values[i]);
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
        case this.#text:
          cs[p] = this.#stringPool.get(this.#values[i]) + (cs[p] ?? "");
          break;
        default:
          as[p] = `${this.#stringPool.get(this.#keys[i])}="${
            this.#stringPool.get(this.#values[i])
          }"${as[p] ? " " + as[p] : ""}`;
          break;
      }
    }
    return cs[this.#size];
  }
}
