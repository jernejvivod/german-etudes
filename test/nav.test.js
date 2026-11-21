'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeAction } = require('../src/core/nav.js');

test('the topic list: neither key does anything', () => {
  assert.equal(escapeAction('home', false, null), null);
  assert.equal(escapeAction('home', true, null), null);
});

test('options: both keys go to the topic list at once', () => {
  assert.deepEqual(escapeAction('options', false, null), { go: 'home' });
  assert.deepEqual(escapeAction('options', true, null), { go: 'home' });
});

test('summary: Esc goes to the options, Shift+Esc to the topic list, both at once', () => {
  assert.deepEqual(escapeAction('summary', false, null), { go: 'options' });
  assert.deepEqual(escapeAction('summary', true, null), { go: 'home' });
});

for (const screen of ['drill', 'table']) {
  test(`${screen}: the first press arms, a second press of the same key leaves`, () => {
    assert.deepEqual(escapeAction(screen, false, null), { arm: 'options' });
    assert.deepEqual(escapeAction(screen, true, null), { arm: 'home' });
    assert.deepEqual(escapeAction(screen, false, 'options'), { go: 'options' });
    assert.deepEqual(escapeAction(screen, true, 'home'), { go: 'home' });
  });

  test(`${screen}: the other key re-arms for its own target instead of leaving`, () => {
    assert.deepEqual(escapeAction(screen, true, 'options'), { arm: 'home' });
    assert.deepEqual(escapeAction(screen, false, 'home'), { arm: 'options' });
  });
}
