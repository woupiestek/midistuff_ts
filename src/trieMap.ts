export class TrieMap<V> {
  #tries: Record<number, TrieMap<V>> = new Array(256);
  #value: V | null = null;

  static #encoder = new TextEncoder();
  static #path(key: string) {
    return TrieMap.#encoder.encode(key);
  }
  #put(path: Uint8Array, value: V) {
    // deno-lint-ignore no-this-alias
    let trie: TrieMap<V> = this;
    for (const index of path) {
      trie = trie.#tries[index] ||= new TrieMap();
    }
    trie.#value = value;
  }
  put(key: string, value: V) {
    this.#put(TrieMap.#path(key), value);
  }
  #get(path: Uint8Array): V | null {
    // deno-lint-ignore no-this-alias
    let trie: TrieMap<V> = this;
    for (const index of path) {
      trie = trie.#tries[index];
      if (trie === undefined) return null;
    }
    return trie.#value;
  }
  get(key: string): V | null {
    return this.#get(TrieMap.#path(key));
  }
  getByArray(key: Uint8Array): V | null {
    return this.#get(key);
  }
}
