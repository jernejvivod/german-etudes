'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/core/store.js');
const { fakeStorage } = require('./helpers.js');

test.after(() => store.use(null));

test('the store: JSON values by key, the fallback for none or junk, in memory where the storage fails', () => {
  const storage = fakeStorage();
  store.use(storage);
  assert.equal(store.read('k', 'none'), 'none');
  store.write('k', { a: [1] });
  assert.equal(storage.data.get('k'), '{"a":[1]}');
  assert.deepEqual(store.read('k', null), { a: [1] });
  storage.data.set('k', '{nonsense');
  store.use(storage); // a restart: read from the storage again
  assert.equal(store.read('k', 'none'), 'none');
  store.remove('k');
  assert.equal(storage.data.size, 0);

  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('denied'); } };
  store.use(broken);
  store.write('k', 7);
  assert.equal(store.read('k', 0), 7);
  store.remove('k');
  assert.equal(store.read('k', 0), 0);
  // A storage that reads but can't write (full): the newer value is still the one read.
  storage.data.set('k', '1');
  store.use({ ...storage, setItem() { throw new Error('full'); }, removeItem() { throw new Error('denied'); } });
  store.write('k', 2);
  assert.equal(store.read('k', 0), 2);
  store.remove('k');
  assert.equal(store.read('k', 0), 0);
  store.use(null); // Node has no localStorage: memory only
  store.write('k', true);
  assert.equal(store.read('k', false), true);
  store.remove('k');
});
