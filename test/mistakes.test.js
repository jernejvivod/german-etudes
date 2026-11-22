'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/core/mistakes.js');

// A drill result: the item and a grade per gap.
const result = (item, ...oks) => ({ item, grades: oks.map((ok) => ({ ok })) });

test('wrong and missed: a result with any gap wrong, in the round\'s order', () => {
  const results = [result('a', true), result('b', true, false, true), result('c', false), result('d', true, true)];
  assert.deepEqual(results.map(M.wrong), [false, true, true, false]);
  assert.deepEqual(M.missed(results), ['b', 'c']);
  assert.deepEqual(M.missed([result('a', true), result('b', true, true)]), []);
  assert.deepEqual(M.missed([]), []);
});

test('start: null without mistakes, else a copy of the items', () => {
  assert.equal(M.start([]), null);
  const items = ['a', 'b'];
  const review = M.start(items);
  assert.deepEqual(review, { queue: ['a', 'b'], total: 2, tries: 0, last: null });
  assert.notEqual(review.queue, items);
});

test('the queue: right drops the item, wrong sends it to the end, until none is left', () => {
  let rv = M.start(['a', 'b', 'c']);
  const step = (ok) => (rv = M.next(M.check(rv, ok)));
  step(false);
  assert.deepEqual(rv.queue, ['b', 'c', 'a']);
  step(true);
  assert.deepEqual(rv.queue, ['c', 'a']);
  step(true);
  assert.deepEqual(rv.queue, ['a']);
  const lastOne = M.check(rv, true);
  assert.equal(lastOne.tries, 4);
  assert.equal(M.next(lastOne), null);
});

test('a single wrong item comes back at once', () => {
  const rv = M.next(M.check(M.start(['a']), false));
  assert.deepEqual(rv, { queue: ['a'], total: 1, tries: 1, last: null });
});

test('left: the item on screen counts until it is answered right', () => {
  const rv = M.start(['a', 'b']);
  assert.equal(M.left(rv), 2);
  assert.equal(M.left(M.check(rv, true)), 1);
  assert.equal(M.left(M.check(rv, false)), 2);
});

test('the texts', () => {
  const rv = { queue: ['a', 'b'], total: 3, tries: 5, last: null };
  assert.equal(M.note(rv), 'Now the ones you missed (3)');
  assert.equal(M.counter(rv), 'Mistakes · 2 left');
  assert.equal(M.counter({ ...rv, last: true }), 'Mistakes · 1 left', 'a right answer counts at once');
  assert.equal(M.counter({ ...rv, last: false }), 'Mistakes · 2 left');
  assert.equal(M.outcome(rv), '3 missed, answered right in 5 tries');
  assert.equal(M.outcome({ queue: [], total: 1, tries: 1, last: true }), '1 missed, answered right in 1 try');
});

test('nothing is changed in place', () => {
  const items = Object.freeze(['a', 'b']);
  const rv = Object.freeze(M.start(items));
  Object.freeze(rv.queue);
  const checked = Object.freeze(M.check(rv, false));
  M.next(checked);
  M.next(Object.freeze(M.check(rv, true)));
  assert.deepEqual(rv, { queue: ['a', 'b'], total: 2, tries: 0, last: null });
  assert.deepEqual(checked, { queue: ['a', 'b'], total: 2, tries: 1, last: false });
  assert.deepEqual(items, ['a', 'b']);
});
