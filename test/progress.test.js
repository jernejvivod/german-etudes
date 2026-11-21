'use strict';

// The Progress screen's checklist (progress.js): every topic's parts, ✓ where a learnt scope holds them.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/core/progress.js');
const D = require('../src/core/daily.js');
const S = require('../src/core/scope.js');
const { isolateStorage, registry } = require('./helpers.js');

const TOPICS = registry();

isolateStorage(test);

// Marks as stored, from { [topicId]: { [kind]: settings } }.
const marks = (own) => Object.fromEntries(Object.entries(own).map(([id, kinds]) => [id,
  Object.fromEntries(Object.entries(kinds).map(([kind, settings]) => [kind, { settings, since: 1 }]))]));
const tree = (own) => P.tree(TOPICS, marks(own));
const topicOf = (result, id) => result.topics.find((t) => t.id === id);
const partOf = (result, id, value) => topicOf(result, id).options.flatMap((o) => o.parts).find((p) => p.value === value);
const ticked = (item) => item.options.flatMap((o) => o.parts).filter((p) => p.learnt).map((p) => p.value);

// Every checkboxes choice some kind the topic offers can hold.
const EXPECTED_TOTAL = TOPICS.reduce((n, t) => n + t.options.filter((opt) => opt.type === 'checkboxes')
  .reduce((m, opt) => m + opt.choices.filter((c) => D.KINDS.some((kind) => t[kind] && S.inScope(opt, kind)
    && S.scopeChoices(opt, kind).includes(c.value))).length, 0), 0);

test('every topic in the registry\'s order, with its checkboxes options as parts; nothing learnt', () => {
  const result = tree({});
  assert.deepEqual(result.topics.map((t) => t.title),
    ['Adjektivendungen', 'Passiv', 'Präpositionen', 'Artikelwörter', 'Pronomen', 'Verbformen', 'Satzstellung', 'Nominalisierung', 'Funktionsverbgefüge', 'Anki-Sätze']);
  assert.deepEqual(Object.fromEntries(result.topics.map((t) => [t.id, t.options.map((o) => o.label)])), {
    adjectives: ['Adjective'],
    passive: ['Kind of passive', 'Tenses'],
    prepositions: ['Prepositions'],
    determiners: ['Determiners', 'Cases'],
    pronouns: ['Pronouns'],
    verbforms: ['Tenses'],
    wordorder: ['Clauses'],
    nominal: ['Direction'],
    fvg: [],
    anki: [],
  });
  assert.equal(result.total, EXPECTED_TOTAL);
  assert.equal(result.total, 54);
  assert.equal(result.learnt, 0);
  assert.equal(result.marked, 0);
  assert.ok(result.topics.every((t) => !t.open));
  assert.deepEqual(result.topics.filter((t) => 'table' in t.marks).map((t) => t.id),
    ['adjectives', 'passive', 'prepositions', 'determiners', 'pronouns', 'nominal']);
  assert.ok(result.topics.every((t) => 'sentences' in t.marks && Object.values(t.marks).every((m) => m === null)));
  assert.ok(result.topics.flatMap((t) => t.options.flatMap((o) => o.parts)).every((p) => !p.learnt && !p.only));
});

test('Passiv marked Sentences learnt: its parts ✓, the topic open, the scope in words', () => {
  const result = tree({ passive: { sentences: { kinds: ['werden'], tenses: ['praes', 'praet'] } } });
  const passive = topicOf(result, 'passive');
  assert.deepEqual(ticked(passive), ['werden', 'praes', 'praet']);
  assert.equal(result.learnt, 3);
  assert.equal(result.marked, 1);
  assert.equal(passive.open, true);
  assert.deepEqual(passive.marks, { sentences: { text: 'Vorgangspassiv · Präsens, Präteritum', whole: false, fits: true }, table: null });
  assert.deepEqual(partOf(result, 'passive', 'praet'), { value: 'praet', label: 'Präteritum', sentences: true, table: false, learnt: true, only: null });
});

test('both of Passiv\'s marks: a part either holds is ✓, and where they disagree it says which', () => {
  const result = tree({ passive: { sentences: { kinds: ['werden'], tenses: ['praes', 'praet'] }, table: { kinds: ['werden', 'sein'], tenses: ['praes'] } } });
  assert.equal(partOf(result, 'passive', 'sein').only, 'table');
  assert.equal(partOf(result, 'passive', 'sein').learnt, true);
  assert.equal(partOf(result, 'passive', 'praet').only, 'sentences');
  assert.equal(partOf(result, 'passive', 'praes').only, null);
  assert.equal(partOf(result, 'passive', 'werden').only, null);
  assert.deepEqual(partOf(result, 'passive', 'perf'), { value: 'perf', label: 'Perfekt', sentences: false, table: false, learnt: false, only: null });
  assert.equal(result.learnt, 4);
  assert.equal(result.marked, 1);
});

test('Artikelwörter\'s ein-words table: narrower than the whole; the cases are not part of the table', () => {
  const result = tree({ determiners: { table: { families: ['ein'] } } });
  const determiners = topicOf(result, 'determiners');
  assert.deepEqual(determiners.marks, { sentences: null, table: { text: 'ein-words', whole: false, fits: true } });
  assert.deepEqual(partOf(result, 'determiners', 'ein'), { value: 'ein', label: 'ein-words', sentences: false, table: true, learnt: true, only: null });
  assert.equal(partOf(result, 'determiners', 'der').learnt, false);
  const cases = determiners.options.find((o) => o.key === 'cases').parts;
  assert.ok(cases.every((p) => p.table === null && p.sentences === false && !p.learnt));
});

test('Präpositionen\'s case table holds only the groups with a case of their own', () => {
  const whole = (groups) => topicOf(tree({ prepositions: { table: { groups } } }), 'prepositions').marks.table.whole;
  const result = tree({ prepositions: { table: { groups: ['akk', 'dat', 'wechsel', 'gen'] } } });
  assert.equal(partOf(result, 'prepositions', 'fixed').table, null);
  assert.equal(partOf(result, 'prepositions', 'da').table, null);
  assert.equal(partOf(result, 'prepositions', 'gen').table, true);
  assert.deepEqual(ticked(topicOf(result, 'prepositions')), ['akk', 'dat', 'wechsel', 'gen']);
  assert.equal(whole(['akk', 'dat', 'wechsel', 'gen']), true);
  assert.equal(whole(['akk', 'dat', 'wechsel']), false);
  assert.equal(whole(['fixed']), true, 'no group with a case: the whole table');
});

test('a table with no part in its scope (Adjektivendungen, Nominalisierung) is the whole table and ticks no part', () => {
  for (const id of ['adjectives', 'nominal']) {
    const result = tree({ [id]: { table: {} } });
    const item = topicOf(result, id);
    assert.deepEqual(item.marks.table, { text: 'the whole table', whole: true, fits: true }, id);
    assert.deepEqual(ticked(item), [], id);
    assert.equal(item.open, true, id);
    assert.equal(result.learnt, 0, id);
    assert.equal(result.marked, 1, id);
  }
});

test('marks are fitted as the daily exercises use them', () => {
  // A missing key is its default (Passiv's kinds: Vorgangspassiv).
  const missing = tree({ passive: { sentences: { tenses: ['fut'] } } });
  assert.deepEqual(ticked(topicOf(missing, 'passive')), ['werden', 'fut']);
  // A choice no longer offered is dropped.
  const gone = tree({ verbforms: { sentences: { tenses: ['praes', 'gone'] } } });
  assert.deepEqual(ticked(topicOf(gone, 'verbforms')), ['praes']);
  assert.equal(topicOf(gone, 'verbforms').marks.sentences.text, 'Präsens');
  // Settings that no longer fit still tick their parts.
  const unfit = tree({ passive: { sentences: { kinds: ['sein'], tenses: ['perf'] } } });
  assert.equal(topicOf(unfit, 'passive').marks.sentences.fits, false);
  assert.deepEqual(ticked(topicOf(unfit, 'passive')), ['sein', 'perf']);
});

test('a topic without parts (Funktionsverbgefüge) counts as marked, not in the parts', () => {
  const result = tree({ fvg: { sentences: {} } });
  const fvg = topicOf(result, 'fvg');
  assert.deepEqual(fvg.marks, { sentences: { text: 'all', whole: true, fits: true } });
  assert.deepEqual(fvg.options, []);
  assert.equal(result.marked, 1);
  assert.equal(result.learnt, 0);
  assert.equal(result.total, EXPECTED_TOTAL);
});

test('a topic with neither sentences nor a table offers no mark and no part', () => {
  const fake = { id: 'fake', title: 'Fake', defaults: { parts: ['a'] }, options: [{ key: 'parts', label: 'Parts', type: 'checkboxes', choices: [{ value: 'a', label: 'A' }] }] };
  const result = P.tree([fake], marks({ fake: { sentences: { parts: ['a'] } } }));
  assert.deepEqual(result.topics, [{ id: 'fake', title: 'Fake', open: false, marks: {}, options: [] }]);
  assert.deepEqual([result.learnt, result.total, result.marked], [0, 0, 0]);
});

test('by default the stored marks, without those for unknown topics or kinds a topic does not offer', () => {
  D.setMark('passive', 'sentences', { kinds: ['werden'], tenses: ['praes'] });
  D.setMark('gone', 'sentences', { parts: ['a'] });
  D.setMark('verbforms', 'table', { tenses: ['praes'] });
  try {
    const result = P.tree(TOPICS);
    assert.equal(result.marked, 1);
    assert.equal(result.learnt, 2);
    assert.deepEqual(topicOf(result, 'verbforms').marks, { sentences: null });
    assert.deepEqual(ticked(topicOf(result, 'verbforms')), []);
  } finally {
    for (const id of ['passive', 'gone', 'verbforms']) for (const kind of D.KINDS) D.setMark(id, kind, null);
  }
});
