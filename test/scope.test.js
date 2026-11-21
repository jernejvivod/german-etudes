'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/core/scope.js');
const passive = require('../src/topics/passive.js');

const topic = {
  defaults: { parts: ['a', 'b'], mode: 'x', on: false, length: 10 },
  options: [
    { key: 'parts', label: 'Parts', type: 'checkboxes', min: 1, choices: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }] },
    { key: 'mode', label: 'Mode', type: 'radio', choices: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }] },
    { key: 'on', label: 'On', type: 'toggle', text: 'On' },
    { key: 'length', label: 'Round', type: 'radio', round: true, choices: [{ value: 10, label: '10' }, { value: 20, label: '20' }] },
  ],
};

test('fitSettings: saved values over the defaults, without the ones no longer offered', () => {
  assert.deepEqual(S.fitSettings(topic, { parts: ['c', 'z', 'a'], mode: 'gone', on: 'yes', length: 20, other: 1 }),
    { parts: ['a', 'c'], mode: 'x', on: false, length: 20 });
  assert.deepEqual(S.fitSettings(topic, { on: true, mode: 'y' }), { ...topic.defaults, on: true, mode: 'y' });
  assert.deepEqual(S.fitSettings(topic, null), topic.defaults);
  assert.deepEqual(S.fitSettings(topic, 'junk'), topic.defaults);
});

test('settingsProblem: at least one, then the topic\'s own rule (Passiv: Zustandspassiv has no Perfekt)', () => {
  assert.equal(S.settingsProblem(topic, { ...topic.defaults, parts: [] }), 'Pick at least one: parts.');
  assert.equal(S.settingsProblem(topic, topic.defaults), null);
  const s = { ...passive.defaults, kinds: ['sein'], tenses: ['perf'] };
  assert.match(S.settingsProblem(passive, s), /is practised in Präsens, Präteritum, Futur I only/);
  assert.equal(S.settingsProblem(passive, passive.defaults), null);
  assert.equal(S.settingsProblem(passive, { ...passive.defaults, tenses: [] }), 'Pick at least one: tenses.');
});

test('scopeOf drops the round and daily options; sameScope ignores them and fits a stored scope first', () => {
  assert.deepEqual(S.scopeOf(topic, topic.defaults), { parts: ['a', 'b'], mode: 'x', on: false });
  assert.deepEqual(Object.keys(S.scopeOf(topic, { length: 1, on: true, mode: 'y', parts: [] })), ['parts', 'mode', 'on']);
  assert.ok(S.sameScope(topic, { ...topic.defaults, length: 20 }, topic.defaults));
  assert.ok(S.sameScope(topic, { parts: ['a', 'b'] }, topic.defaults), 'a missing key counts as its default');
  assert.ok(!S.sameScope(topic, { ...topic.defaults, on: true }, topic.defaults));
  assert.ok(!S.sameScope(passive, { ...passive.defaults, tenses: ['praes'] }, passive.defaults));
  assert.ok(S.sameScope(passive, { ...passive.defaults, length: 20 }, passive.defaults), 'Passiv\'s length is a round option');
  const daily = { ...topic, options: [...topic.options, { key: 'vocab', label: 'Words', type: 'radio', daily: 'anki', choices: [{ value: 'anki' }, { value: 'builtin' }] }] };
  assert.deepEqual(Object.keys(S.scopeOf(daily, { ...topic.defaults, vocab: 'builtin' })), ['parts', 'mode', 'on'], 'the review\'s own value');
});

test('scopeText: the chosen labels, "all …" for a full option, "all" for everything', () => {
  assert.equal(S.scopeText(passive, { ...passive.defaults, tenses: ['praes', 'praet'] }), 'Vorgangspassiv · Präsens, Präteritum');
  assert.equal(S.scopeText(topic, topic.defaults), 'Alpha, Beta · Mode: X');
  assert.equal(S.scopeText(topic, { ...topic.defaults, parts: ['a', 'b', 'c'], on: true }), 'all · Mode: X · with on');
  assert.equal(S.scopeText(passive, { ...passive.defaults, tenses: [...passive.TENSES] }), 'Vorgangspassiv · all tenses');
  assert.equal(S.scopeText({ options: [] }, {}), 'all');
  const prepositions = require('../src/topics/prepositions.js');
  assert.equal(S.scopeText(prepositions, { ...prepositions.defaults, hints: true }), 'Akkusativ, Dativ, Wechselpräpositionen, Verbs with fixed prepositions · with adjectives · with hints');
});

test('inScope: round and daily options are not in the sentences\' scope; only table options are in the table\'s', () => {
  const [parts, , , length] = topic.options;
  assert.ok(S.inScope(parts, 'sentences'));
  assert.ok(!S.inScope(parts, 'table'));
  assert.ok(!S.inScope(length, 'sentences'));
  assert.ok(!S.inScope({ ...length, table: true }, 'sentences'));
  assert.ok(!S.inScope({ key: 'vocab', daily: 'anki' }, 'sentences'));
  assert.ok(!S.inScope({ key: 'vocab', daily: 'anki' }, 'table'));
  assert.ok(S.inScope(passive.options.find((o) => o.key === 'tenses'), 'table'));
  assert.ok(S.inScope(passive.options.find((o) => o.key === 'tenses'), 'sentences'));
});

test('scopeChoices: the choices a kind of mark can hold (Präpositionen\'s case table: the groups with a case)', () => {
  const prepositions = require('../src/topics/prepositions.js');
  const groups = prepositions.options.find((o) => o.key === 'groups');
  assert.deepEqual(S.scopeChoices(groups, 'sentences'), ['akk', 'dat', 'wechsel', 'gen', 'fixed', 'da']);
  assert.deepEqual(S.scopeChoices(groups, 'table'), ['akk', 'dat', 'wechsel', 'gen']);
  assert.deepEqual(S.scopeChoices(passive.options.find((o) => o.key === 'kinds'), 'table'), ['werden', 'sein', 'bekommen', 'ersatz']);
});
