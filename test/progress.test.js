'use strict';

// The Progress screen's checklist (progress.js): every topic's parts, ticked for Sentences and for Table, and what the
// options screen's quick buttons tick for a round.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/core/progress.js');
const D = require('../src/core/daily.js');
const S = require('../src/core/scope.js');
const { isolateStorage, registry } = require('./helpers.js');

const TOPICS = registry();
const byId = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
const { passive, prepositions, determiners, adjectives, nominal, fvg, anki } = byId;

isolateStorage(test);

// Marks as stored, from { [topicId]: { [kind]: parts } }; old ones from { [topicId]: { [kind]: settings } }.
const stored = (field) => (own) => Object.fromEntries(Object.entries(own).map(([id, kinds]) => [id,
  Object.fromEntries(Object.entries(kinds).map(([kind, value]) => [kind, { [field]: value, since: 1 }]))]));
const marks = stored('parts');
const oldMarks = stored('settings');
const defaults = (t) => t.defaults;
const tree = (own, saved = defaults) => P.tree(TOPICS, marks(own), saved);
const topicOf = (result, id) => result.topics.find((t) => t.id === id);
const partOf = (result, id, value) => topicOf(result, id).options.flatMap((o) => o.parts).find((p) => p.value === value);
const ticked = (item, kind) => item.options.flatMap((o) => o.parts).filter((p) => (kind ? p[kind] : p.learnt)).map((p) => p.value);

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
  assert.ok(result.topics.every((t) => 'sentences' in t.marks && Object.values(t.marks).every((m) => m.state === 'none' && !m.ticked && m.text === '' && !m.problem)));
  assert.ok(result.topics.flatMap((t) => t.options.flatMap((o) => o.parts)).every((p) => !p.learnt));
  // What each kind can hold: Passiv 9 parts both; Artikelwörter's table only the determiners; no part in the tables of
  // Adjektivendungen and Nominalisierung, nor in Funktionsverbgefüge.
  const totals = (id) => Object.fromEntries(Object.entries(topicOf(result, id).marks).map(([kind, m]) => [kind, m.total]));
  assert.deepEqual(totals('passive'), { sentences: 9, table: 9 });
  assert.deepEqual(totals('determiners'), { sentences: 6, table: 2 });
  assert.deepEqual(totals('prepositions'), { sentences: 6, table: 4 });
  assert.deepEqual(totals('adjectives'), { sentences: 6, table: 0 });
  assert.deepEqual(totals('fvg'), { sentences: 0 });
});

test('each part ticked or not for each kind, null where the kind cannot hold it', () => {
  const result = tree({});
  const kinds = (id, value) => {
    const { sentences, table } = partOf(result, id, value);
    return [sentences, table];
  };
  assert.deepEqual(kinds('passive', 'praet'), [false, false]);
  assert.deepEqual(kinds('prepositions', 'akk'), [false, false]);
  assert.deepEqual(kinds('prepositions', 'fixed'), [false, null], 'the case table has no fixed verbs');
  assert.deepEqual(kinds('determiners', 'ein'), [false, false]);
  assert.deepEqual(kinds('determiners', 'dat'), [false, null], 'the cases are not part of the table');
  assert.deepEqual(kinds('adjectives', 'comp'), [false, null]);
  assert.deepEqual(kinds('verbforms', 'konj1'), [false, null], 'no table');
});

test('Passiv: ticks per kind, the topic switch\'s state, the count and the parts in words', () => {
  const result = tree({ passive: { sentences: { kinds: ['werden'], tenses: ['praes', 'praet'] }, table: { kinds: ['werden', 'sein'], tenses: ['praes'] } } });
  const item = topicOf(result, 'passive');
  assert.deepEqual(ticked(item, 'sentences'), ['werden', 'praes', 'praet']);
  assert.deepEqual(ticked(item, 'table'), ['werden', 'sein', 'praes']);
  assert.deepEqual(ticked(item), ['werden', 'sein', 'praes', 'praet'], 'either kind');
  assert.deepEqual(item.marks, {
    sentences: { state: 'learnt', ticked: 3, total: 9, text: 'Vorgangspassiv · Präsens, Präteritum', problem: null },
    table: { state: 'learnt', ticked: 3, total: 9, text: 'Vorgangspassiv, Zustandspassiv · Präsens', problem: null },
  });
  assert.deepEqual(partOf(result, 'passive', 'sein'), { value: 'sein', label: 'Zustandspassiv', sentences: false, table: true, learnt: true });
  assert.equal(item.open, true);
  assert.equal(result.learnt, 4);
  assert.equal(result.marked, 1);
});

test('partly marked and unfit marks say what keeps them out; both count as marked', () => {
  const partly = tree({ passive: { sentences: { tenses: ['praes', 'praet'] } } });
  assert.deepEqual(topicOf(partly, 'passive').marks.sentences, {
    state: 'partly', ticked: 2, total: 9, text: 'Präsens, Präteritum', problem: 'tick at least one of Kind of passive',
  });
  assert.equal(partly.marked, 1);
  assert.equal(partly.learnt, 2);
  const unfit = tree({ passive: { table: { kinds: ['sein'], tenses: ['perf'] } } });
  assert.equal(topicOf(unfit, 'passive').marks.table.state, 'unfit');
  assert.match(topicOf(unfit, 'passive').marks.table.problem, /^Zustandspassiv is practised in Präsens, Präteritum, Futur I only/);
  assert.equal(unfit.marked, 1);
  // The parts saved on the options screen do not count.
  const saved = (t) => (t.id === 'passive' ? { ...t.defaults, kinds: [] } : t.defaults);
  assert.equal(topicOf(tree({ passive: { sentences: { kinds: ['werden'], tenses: ['praes'] } } }, saved), 'passive').marks.sentences.state, 'learnt');
});

test('topics without parts: the mark is the whole-topic switch, marked but not in the parts', () => {
  const result = tree({ fvg: { sentences: {} }, anki: { sentences: {} }, adjectives: { table: {} }, nominal: { table: {} } });
  for (const t of [fvg, anki]) {
    assert.deepEqual(topicOf(result, t.id).marks, { sentences: { state: 'learnt', ticked: 0, total: 0, text: 'all', problem: null } }, t.id);
  }
  for (const t of [adjectives, nominal]) {
    const item = topicOf(result, t.id);
    assert.deepEqual(item.marks.table, { state: 'learnt', ticked: 0, total: 0, text: 'the whole table', problem: null }, t.id);
    assert.equal(item.marks.sentences.state, 'none', t.id);
    assert.deepEqual(ticked(item), [], t.id);
    assert.equal(item.open, true, t.id);
  }
  assert.deepEqual(topicOf(result, 'fvg').options, []);
  assert.equal(result.marked, 4);
  assert.equal(result.learnt, 0);
  assert.equal(result.total, EXPECTED_TOTAL);
});

test('old marks (their settings) tick the parts they ticked before', () => {
  const result = P.tree(TOPICS, oldMarks({
    passive: { sentences: { kinds: ['werden'], tenses: ['praes', 'praet'], length: 20 }, table: { kinds: ['werden', 'sein'], tenses: ['praes'] } },
    determiners: { table: { families: ['ein'], cases: ['nom'], hints: true } },
    prepositions: { table: { groups: ['fixed'] } },
    verbforms: { sentences: { tenses: ['praes', 'gone'] } },
    pronouns: { sentences: {} },
    fvg: { sentences: { vocab: 'builtin' } },
    adjectives: { table: { degrees: ['comp'] } },
  }), defaults);
  assert.deepEqual(ticked(topicOf(result, 'passive'), 'sentences'), ['werden', 'praes', 'praet']);
  assert.deepEqual(ticked(topicOf(result, 'passive'), 'table'), ['werden', 'sein', 'praes']);
  assert.deepEqual(ticked(topicOf(result, 'determiners')), ['ein'], 'the cases are not part of the table');
  assert.deepEqual(ticked(topicOf(result, 'prepositions')), ['akk', 'dat', 'wechsel', 'gen'], 'no group with a case: the whole table');
  assert.equal(topicOf(result, 'prepositions').marks.table.text, 'the whole table');
  assert.deepEqual(ticked(topicOf(result, 'verbforms')), ['praes'], 'a choice no longer offered dropped');
  assert.deepEqual(ticked(topicOf(result, 'pronouns')), byId.pronouns.defaults.kinds, 'a missing key is its default');
  assert.equal(topicOf(result, 'fvg').marks.sentences.state, 'learnt');
  assert.equal(topicOf(result, 'adjectives').marks.table.state, 'learnt');
  assert.equal(result.marked, 7);
});

test('a topic with neither sentences nor a table offers no mark and no part', () => {
  const fake = { id: 'fake', title: 'Fake', defaults: { parts: ['a'] }, options: [{ key: 'parts', label: 'Parts', type: 'checkboxes', choices: [{ value: 'a', label: 'A' }] }] };
  const result = P.tree([fake], marks({ fake: { sentences: { parts: ['a'] } } }), defaults);
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
    assert.deepEqual(Object.keys(topicOf(result, 'verbforms').marks), ['sentences']);
    assert.deepEqual(ticked(topicOf(result, 'verbforms')), []);
  } finally {
    for (const id of ['passive', 'gone', 'verbforms']) for (const kind of D.KINDS) D.setMark(id, kind, null);
  }
});

test('withPart: one part ticked or not, in the choices\' order; null once nothing is ticked', () => {
  const mark = { parts: { kinds: ['werden'], tenses: ['praet'] }, since: 1 };
  assert.deepEqual(P.withPart(passive, 'sentences', mark, 'tenses', 'praes', true), { kinds: ['werden'], tenses: ['praes', 'praet'] });
  assert.deepEqual(P.withPart(passive, 'sentences', mark, 'kinds', 'werden', false), { tenses: ['praet'] }, 'partly: kept');
  assert.deepEqual(P.withPart(passive, 'sentences', null, 'tenses', 'fut', true), { tenses: ['fut'] });
  assert.equal(P.withPart(passive, 'sentences', { parts: { tenses: ['fut'] }, since: 1 }, 'tenses', 'fut', false), null);
  // An old mark is read as its parts first (Präpositionen's old table: the case groups).
  assert.deepEqual(P.withPart(prepositions, 'table', { settings: { groups: ['akk', 'fixed'] }, since: 1 }, 'groups', 'gen', true), { groups: ['akk', 'gen'] });
  assert.deepEqual(P.withPart(determiners, 'sentences', { settings: { families: ['ein'] }, since: 1 }, 'cases', 'gen', false),
    { families: ['ein'], cases: ['nom', 'acc', 'dat'] }, 'the missing cases were the defaults');
});

test('withAll: every part a kind holds, {} without parts; off is null', () => {
  assert.deepEqual(P.withAll(passive, 'table', true), { kinds: ['werden', 'sein', 'bekommen', 'ersatz'], tenses: ['praes', 'praet', 'perf', 'plusq', 'fut'] });
  assert.deepEqual(P.withAll(prepositions, 'table', true), { groups: ['akk', 'dat', 'wechsel', 'gen'] });
  assert.deepEqual(P.withAll(determiners, 'table', true), { families: ['der', 'ein'] });
  assert.deepEqual(P.withAll(fvg, 'sentences', true), {});
  assert.deepEqual(P.withAll(adjectives, 'table', true), {});
  assert.equal(P.withAll(passive, 'sentences', false), null);
});

test('practise: what is learnt for either kind, or what is not yet', () => {
  const all = marks({ passive: { sentences: { kinds: ['werden'], tenses: ['praes'] }, table: { kinds: ['werden'], tenses: ['praet'] } } });
  assert.deepEqual(P.practise(passive, 'learnt', all), { kinds: ['werden'], tenses: ['praes', 'praet'] }, 'both kinds');
  const fresh = P.practise(passive, 'new', all);
  assert.deepEqual(fresh, { kinds: ['sein', 'bekommen', 'ersatz'], tenses: ['perf', 'plusq', 'fut'] });
  assert.equal(S.settingsProblem(passive, { ...passive.defaults, ...fresh }),
    'Passiversatz is practised in Präsens, Präteritum only — tick one of those tenses or untick it.', 'applied anyway');
  // An option with nothing learnt stays as it is; one with everything learnt gets every choice.
  const partly = marks({ passive: { sentences: { tenses: ['praes'] } } });
  assert.deepEqual(P.practise(passive, 'learnt', partly), { tenses: ['praes'] });
  const kinds = marks({ passive: { sentences: { kinds: ['werden', 'sein', 'bekommen', 'ersatz'], tenses: ['praes'] } } });
  assert.deepEqual(P.practise(passive, 'new', kinds), { kinds: ['werden', 'sein', 'bekommen', 'ersatz'], tenses: ['praet', 'perf', 'plusq', 'fut'] });
  // Artikelwörter: the cases are learnt for Sentences only, the determiners for either.
  const det = marks({ determiners: { table: { families: ['ein'] } } });
  assert.deepEqual(P.practise(determiners, 'learnt', det), { families: ['ein'] });
  assert.deepEqual(P.practise(determiners, 'new', det), { families: ['der'], cases: ['nom', 'acc', 'dat', 'gen'] });
  // Nothing learnt, or everything: nothing to tick.
  assert.equal(P.practise(passive, 'learnt', {}), null);
  assert.equal(P.practise(passive, 'new', marks({ passive: { table: P.withAll(passive, 'table', true) } })), null);
  // An old mark counts with the parts it ticked; a topic without parts has nothing to tick.
  assert.deepEqual(P.practise(passive, 'learnt', oldMarks({ passive: { sentences: { tenses: ['fut'] } } })), { kinds: ['werden'], tenses: ['fut'] });
  assert.equal(P.practise(fvg, 'learnt', marks({ fvg: { sentences: {} } })), null);
  assert.equal(P.practise(fvg, 'new', {}), null);
});
