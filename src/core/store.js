// What the app remembers between sessions (settings, the verb rotation, the cards shown): JSON values in the page's
// localStorage. Remembering is a convenience only: where there is no storage or it fails (tests, a full or blocked
// storage), values are kept in memory while the app runs, and an unreadable value counts as none.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Etudes ||= { topics: [] }).store = api;
})(globalThis, function () {
  'use strict';

  let other = null; // set by tests; otherwise the page's localStorage
  const memory = new Map(); // what this session wrote, as stored text (null: removed); it wins over a storage that failed to keep it
  const storage = () => other || globalThis.localStorage;

  // The value stored under key, or fallback when there is none or it is unreadable.
  function read(key, fallback) {
    let text = memory.get(key) ?? null;
    if (!memory.has(key)) {
      try {
        text = storage().getItem(key);
      } catch {
        // No storage: nothing stored.
      }
    }
    try {
      return JSON.parse(text) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    const text = JSON.stringify(value);
    memory.set(key, text);
    try {
      storage().setItem(key, text);
    } catch {
      // Kept in memory only.
    }
  }

  function remove(key) {
    memory.set(key, null);
    try {
      storage().removeItem(key);
    } catch {
      // Nothing was stored.
    }
  }

  // Tests: another storage (null: the page's again), starting with nothing in memory, as after a restart.
  function use(storageObject) {
    other = storageObject;
    memory.clear();
  }

  return { read, write, remove, use };
});
