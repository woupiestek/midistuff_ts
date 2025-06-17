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
}

export class Elements {
  #id = -1;
  #values: number[] = [];
  // let this be a tree and traverse it in order
  // highest id gets highest prio.
  // the exact structure should not matter, however.
  #leftSibling: number[] = [];
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
    this.#leftSibling[this.#id] = this.#id;
    return this.#id as Element;
  }

  createComment(text: string) {
    const hash = cyrb53(text) & MASK;
    this.#strings.set(hash, text);
    this.#values[++this.#id] = hash ^ COMMENT;
    this.#parents[this.#id] = this.#id;
    this.#leftSibling[this.#id] = this.#id;
    return this.#id as Element;
  }

  insertText(parent: Element, text: string) {
    const hash = cyrb53(text) & MASK;
    this.#strings.set(hash, text);
    this.#values[++this.#id] = hash ^ TEXT;
    this.#parents[this.#id] = parent;
    this.#leftSibling[this.#id] = this.#id;
    return this.#id as Element;
  }

  insertAttribute(parent: Element, key: string, value: string) {
    const k = cyrb53(key);
    this.#strings.set(k, key);
    const v = cyrb53(value);
    this.#strings.set(v, value);
    this.#values[++this.#id] = this.#attributes.add(k, v) ^ ATTRIBUTE;
    this.#parents[this.#id] = parent;
    this.#leftSibling[this.#id] = this.#id;
  }

  insertAtStart(parent: Element, element: Element) {
    this.#parents[element] = parent;
    this.#leftSibling[element] = element;
  }

  insertAfter(sibling: Element, element: Element) {
    this.#parents[element] = this.#parents[sibling];
    this.#leftSibling[element] = sibling;
  }

  // todo
  // eventually use depth vector for pretty print
  stringify() {
    const roots: number[] = [];

    const firstChild = this.#parents.map(() => -1);

    const nextSibling = this.#parents.map(() => -1);

    for (let i = this.#parents.length - 1; i >= 0; i--) {
      if (this.#parents[i] === i) {
        roots.push(i);
        continue;
      }
      nextSibling[i] = firstChild[this.#parents[i]];
      firstChild[this.#parents[i]] = i;
    }
  }
}
