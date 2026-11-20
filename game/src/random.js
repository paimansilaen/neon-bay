// A small seeded random number generator (mulberry32): the same seed gives the same game,
// which is what makes the screenshot scenes repeatable. The generator is a closure over one
// 32-bit state word; every draw mixes it and returns a float in [0, 1).

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random float in [min, max) from a `random` draw. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** One random element of `items`. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
