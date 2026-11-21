'use strict';

const vocab = require('../src/core/vocab.js');

// Deterministic PRNG so failures are reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Runs a generator until it produces an item matching pred.
function findItem(build, pred, seed = 1, tries = 5000) {
  const rnd = mulberry32(seed);
  for (let i = 0; i < tries; i++) {
    const item = build(rnd);
    if (pred(item)) return item;
  }
  throw new Error('no matching item generated');
}

// A stand-in for localStorage, so that what a test stores stays out of the real one. data: what is stored, by key.
function fakeStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
}

// Keeps what the app stores (store.js: the cards shown, the verb rotation …) in a stand-in storage, starting empty, and
// drops it afterwards. t: a test's context — or `test` itself, at the top of a file, for all its tests. Returns the storage.
function isolateStorage(t) {
  const storage = fakeStorage();
  vocab.useStorage(storage);
  t.after(() => {
    vocab.forget();
    vocab.useStorage(null);
  });
  return storage;
}

// A note as anki.js hands it over: a noun card due today that never lapsed, unless the fields say otherwise.
function ankiNote(word, fields = {}) {
  return { id: word, article: '', word, pos: 'n', english: '', headings: [], examples: [], dueIn: 0, lapses: 0, ease: 2500, ...fields };
}

// Every topic, in the app's order (the scripts in index.html).
const registry = () => ['adjectives', 'passive', 'prepositions', 'determiners', 'pronouns', 'verbforms', 'wordorder', 'nominal', 'fvg', 'anki']
  .map((id) => require(`../src/topics/${id}.js`));

module.exports = { mulberry32, findItem, fakeStorage, isolateStorage, ankiNote, registry };
