import { cyrb53 } from "./cyrb53.ts";

export type Element = number & { readonly __tag: unique symbol };

// note: no reuse possible!
// everything must be copied

const ELEMENT = 0;
const TEXT = 0x4000;
const ATTRIBUTE = 0x8000;
const COMMENT = 0xC000;
const MASK = 0x3FFFF;

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

class Attributes {
  #id = -1;
  #keys: number[] = [];
  #values: number[] = [];
  add(key: number, value: number) {
    this.#keys[++this.#id] = key;
    this.#values[this.#id] = value;
    return this.#id;
  }
  key(id: number) {
    return this.#keys[id];
  }
  value(id: number) {
    return this.#values[id];
  }
}

export class Elements {
  #id = -1;
  #values: number[] = [];
  #parents: number[] = [];
  // something...
  // so collision avoidance might be good
  #strings: Map<number, string> = new Map();

  #attributes = new Attributes();

  createElement(tag: string) {
    const hash = cyrb53(tag) & MASK;
    this.#strings.set(hash, tag);
    this.#values[++this.#id] = hash ^ ELEMENT;
    this.#parents[this.#id] = this.#id;
    return this.#id as Element;
  }

  createComment(text: string) {
    const hash = cyrb53(text) & MASK;
    this.#strings.set(hash, text);
    this.#values[++this.#id] = hash ^ COMMENT;
    this.#parents[this.#id] = this.#id;
    return this.#id as Element;
  }

  createText(text: string) {
    text = escapeXml(text);
    const hash = cyrb53(text) & MASK;
    this.#strings.set(hash, text);
    this.#values[++this.#id] = hash ^ TEXT;
    this.#parents[this.#id] = this.#id;
    return this.#id as Element;
  }

  createAttribute(key: string, value: string) {
    const k = cyrb53(key);
    this.#strings.set(k, key);
    const v = cyrb53(value);
    value = escapeXml(value);
    this.#strings.set(v, value);
    this.#values[++this.#id] = this.#attributes.add(k, v) ^ ATTRIBUTE;
    this.#parents[this.#id] = this.#id;
  }

  insertChild(parent: Element, element: Element) {
    this.#parents[element] = parent;
  }

  // todo: solve the order of xml problem.
  // currently, content has to be inserted in order.
  // goal: have a way to insert elements anywhere
  // the left sibling and insert in front off operations work

  #open(i: number) {
    const x = this.#values[i];
    const y = x & MASK;
    switch (x & COMMENT) {
      case ELEMENT:
        return "<" + this.#strings.get(y);
        // this does not work for attributes
      case TEXT:
        return this.#strings.get(y);
      case ATTRIBUTE: {
        const k = this.#strings.get(this.#attributes.key(y));
        const v = this.#strings.get(this.#attributes.value(y));
        return k + '="' + v + '"';
      }
      case COMMENT:
        return "<!-- " + this.#strings.get(y) + " -->";
    }
  }

  stringify() {
    const roots: number[] = [];
    const firstChild = this.#parents.map(() => -1);
    const nextSibling = this.#parents.map(() => -1);
    for (let i = this.#parents.length - 1; i >= 0; i--) {
      if (this.#parents[i] === i) {
        roots.push(i);
        continue;
      }
      // pick left sibling if available
      // this screws up depth, but that is not a real problem!
      nextSibling[i] = firstChild[this.#parents[i]];
      firstChild[this.#parents[i]] = i;
    }

    const depths: number[] = [];
    const indices = [];
    for (let r = roots.length - 1; r >= 0; r--) {
      let index = roots[r];
      a: for (;;) {
        depths[index] = this.#parents[index] === index
          ? 0
          : depths[this.#parents[index]];
        indices.push(index);
        if (firstChild[index] >= 0) {
          index = firstChild[index];
          continue;
        }
        while (nextSibling[index] < 0) {
          if (this.#parents[index] === index) {
            break a;
          }
          index = this.#parents[index];
        }
        index = nextSibling[index];
      }
    }
  }
}
