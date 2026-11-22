'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { leaveAction } = require('../src/core/nav.js');

const VIAS = ['esc', 'shift-esc', 'quit', 'topics'];

test('the topic list: no way out does anything', () => {
  for (const via of VIAS) {
    for (const dirty of [false, true]) assert.equal(leaveAction({ screen: 'home', via, dirty }), null, via);
  }
});

for (const screen of ['options', 'progress']) {
  test(`${screen}: Esc, Shift+Esc and ← Topics go to the topic list at once`, () => {
    for (const via of ['esc', 'shift-esc', 'topics']) {
      for (const dirty of [false, true]) assert.deepEqual(leaveAction({ screen, via, dirty }), { go: 'home' }, via);
    }
  });
}

test('summary: Esc goes to the options, Shift+Esc and ← Topics to the topic list, all at once', () => {
  for (const dirty of [false, true]) {
    assert.deepEqual(leaveAction({ screen: 'summary', via: 'esc', dirty }), { go: 'options' });
    assert.deepEqual(leaveAction({ screen: 'summary', via: 'shift-esc', dirty }), { go: 'home' });
    assert.deepEqual(leaveAction({ screen: 'summary', via: 'topics', dirty }), { go: 'home' });
  }
});

// A drill or table: what each way out does with each thing armed, clean and dirty.
const ARMED = {
  none: null,
  'key-options': { target: 'options', by: 'key' },
  'key-home': { target: 'home', by: 'key' },
  'click-options': { target: 'options', by: 'click' },
  'click-home': { target: 'home', by: 'click' },
};
const go = (target) => ({ go: target });
const key = (target) => ({ arm: target, by: 'key' });
const ask = (target) => ({ arm: target, by: 'click' });
const STAY = { stay: true };

// [via, armed, clean, dirty]
const ROUND = [
  // Keys arm whatever dirty is; a second press of the same key leaves, the other re-arms. With the bar up, Esc stays and
  // Shift+Esc confirms the topic list or asks for it.
  ['esc', 'none', key('options'), key('options')],
  ['esc', 'key-options', go('options'), go('options')],
  ['esc', 'key-home', key('options'), key('options')],
  ['esc', 'click-options', STAY, STAY],
  ['esc', 'click-home', STAY, STAY],
  ['shift-esc', 'none', key('home'), key('home')],
  ['shift-esc', 'key-options', key('home'), key('home')],
  ['shift-esc', 'key-home', go('home'), go('home')],
  ['shift-esc', 'click-options', ask('home'), ask('home')],
  ['shift-esc', 'click-home', go('home'), go('home')],
  // Clicks: clean, they leave at once (over a key's arm too); dirty, they ask, and a second click of the same one leaves.
  ['quit', 'none', go('options'), ask('options')],
  ['quit', 'key-options', go('options'), ask('options')],
  ['quit', 'key-home', go('options'), ask('options')],
  ['quit', 'click-options', go('options'), go('options')],
  ['quit', 'click-home', go('options'), ask('options')],
  ['topics', 'none', go('home'), ask('home')],
  ['topics', 'key-options', go('home'), ask('home')],
  ['topics', 'key-home', go('home'), ask('home')],
  ['topics', 'click-options', go('home'), ask('home')],
  ['topics', 'click-home', go('home'), go('home')],
];

for (const screen of ['drill', 'table']) {
  test(`${screen}: every way out, with each thing armed, clean and dirty`, () => {
    for (const [via, armed, clean, dirty] of ROUND) {
      assert.deepEqual(leaveAction({ screen, via, armed: ARMED[armed] }), clean, `${via}, ${armed}, clean`);
      assert.deepEqual(leaveAction({ screen, via, armed: ARMED[armed], dirty: true }), dirty, `${via}, ${armed}, dirty`);
    }
  });
}
