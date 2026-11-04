/** Runtime read-only snapshot for public map-shaped metadata. */
export class ReadonlyMapSnapshot<K, V> implements ReadonlyMap<K, V> {
  readonly #data: Map<K, V>;

  constructor(entries: Iterable<readonly [K, V]>) {
    this.#data = new Map(entries);
    Object.freeze(this);
  }

  get size(): number { return this.#data.size; }
  get(key: K): V | undefined { return this.#data.get(key); }
  has(key: K): boolean { return this.#data.has(key); }
  entries(): MapIterator<[K, V]> { return this.#data.entries(); }
  keys(): MapIterator<K> { return this.#data.keys(); }
  values(): MapIterator<V> { return this.#data.values(); }
  [Symbol.iterator](): MapIterator<[K, V]> { return this.entries(); }
  get [Symbol.toStringTag](): string { return 'ReadonlyMap'; }

  forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown): void {
    this.#data.forEach((value, key) => callbackfn.call(thisArg, value, key, this));
  }
}

/** Runtime read-only facade whose contents follow the supplied backing map. */
export class ReadonlyMapView<K, V> implements ReadonlyMap<K, V> {
  readonly #data: ReadonlyMap<K, V>;

  constructor(data: ReadonlyMap<K, V>) {
    this.#data = data;
    Object.freeze(this);
  }

  get size(): number { return this.#data.size; }
  get(key: K): V | undefined { return this.#data.get(key); }
  has(key: K): boolean { return this.#data.has(key); }
  entries(): MapIterator<[K, V]> { return this.#data.entries(); }
  keys(): MapIterator<K> { return this.#data.keys(); }
  values(): MapIterator<V> { return this.#data.values(); }
  [Symbol.iterator](): MapIterator<[K, V]> { return this.entries(); }
  get [Symbol.toStringTag](): string { return 'ReadonlyMap'; }

  forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown): void {
    this.#data.forEach((value, key) => callbackfn.call(thisArg, value, key, this));
  }
}
