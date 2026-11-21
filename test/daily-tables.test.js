'use strict';

// The fixed tables that can be learnt by heart (each topic's table(settings, rnd)), their learnt scope, and Daily tables,
// which goes through every learnt table.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/core/daily.js');
const S = require('../src/core/scope.js');
const store = require('../src/core/store.js');
const { mulberry32, fakeStorage, isolateStorage } = require('./helpers.js');

// The registry, in the app's order (index.html).
const TOPICS = ['adjectives', 'passive', 'prepositions', 'determiners', 'pronouns', 'verbforms', 'wordorder', 'nominal', 'fvg', 'anki']
  .map((id) => require(`../src/topics/${id}.js`));
const byId = Object.fromEntries(TOPICS.map((t) => [t.id, t]));
const WITH_TABLE = TOPICS.filter((t) => t.table);
const { adjectives, passive, prepositions, determiners, pronouns } = byId;

isolateStorage(test);

// Each test of Daily tables starts with an empty stand-in storage.
function fresh() {
  store.use(fakeStorage());
}
test.afterEach(() => store.use(null));

const at = (day, hour, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();
const tableOnly = (t) => t.sessions.find((s) => / only$/.test(s.label));

// A setting other than the default for each topic with a table, and a value for each of its other options.
const OTHER = {
  adjectives: { degrees: ['comp'] },
  determiners: { families: ['ein'] },
  passive: { tenses: ['praes'] },
  prepositions: { groups: ['dat', 'gen'] },
  pronouns: { kinds: ['relative', 'wrelative'] },
  nominal: { directions: ['verb'] },
};

// The settings with one option changed: another radio choice, the first box only, the switch flipped.
function varied(t, opt) {
  const s = { ...t.defaults };
  if (opt.type === 'radio') s[opt.key] = opt.choices.find((c) => c.value !== s[opt.key]).value;
  if (opt.type === 'checkboxes') s[opt.key] = s[opt.key].length === 1 ? [opt.choices.at(-1).value] : [opt.choices[0].value];
  if (opt.type === 'toggle') s[opt.key] = !s[opt.key];
  return s;
}

test('exactly the six topics with a fixed table have table()', () => {
  assert.deepEqual(WITH_TABLE.map((t) => t.id), ['adjectives', 'passive', 'prepositions', 'determiners', 'pronouns', 'nominal']);
});

test('each table() is the topic\'s own "… only" session', () => {
  for (const t of WITH_TABLE) {
    for (const settings of [{ ...t.defaults }, { ...t.defaults, ...OTHER[t.id] }]) {
      const step = t.table(settings, mulberry32(3));
      const what = `${t.id} ${JSON.stringify(settings)}`;
      assert.deepEqual(step, tableOnly(t).build(settings, mulberry32(3))[0], what);
      assert.equal(step.type, 'table', what);
      assert.ok(step.table.blocks.length >= 1, what);
    }
  }
});

test('each table depends on its table options only', () => {
  for (const t of WITH_TABLE) {
    for (const opt of t.options.filter((o) => !o.table)) {
      assert.deepEqual(t.table(varied(t, opt), mulberry32(5)), t.table({ ...t.defaults }, mulberry32(5)), `${t.id}: ${opt.key}`);
    }
  }
  const blocks = (t, s) => t.table({ ...t.defaults, ...s }, mulberry32(1)).table.blocks;
  assert.deepEqual(blocks(determiners, { families: ['ein'] }).map((b) => b.title), ['ein-words']);
  assert.deepEqual(blocks(passive, { tenses: ['praes'] }).map((b) => b.cols.length), [1]);
  assert.equal(blocks(passive, { kinds: ['werden', 'sein'] }).length, 2);
  const rows = (groups) => blocks(prepositions, { groups }).flatMap((b) => b.rows).sort();
  assert.notDeepEqual(rows(['akk']), rows(['dat']));
  assert.deepEqual(rows(['akk']), ['bis', 'durch', 'für', 'gegen', 'ohne', 'um']);
  assert.deepEqual(rows(['akk', 'fixed', 'da']), rows(['akk']), 'the case table has no fixed or da groups');
  assert.deepEqual(rows(['fixed']), rows(['akk', 'dat', 'wechsel', 'gen']), 'none with a case: all of them');
  assert.equal(blocks(pronouns, { kinds: ['relative'] }).length, 1);
});

test('the table scope: the options marked table, the rest left to the defaults', () => {
  assert.deepEqual(S.scopeOf(determiners, determiners.defaults, 'table'), { families: ['der', 'ein'] });
  assert.deepEqual(S.scopeOf(passive, passive.defaults, 'table'), { kinds: ['werden'], tenses: ['praes', 'praet', 'perf'] });
  assert.deepEqual(S.scopeOf(pronouns, pronouns.defaults, 'table'), { kinds: pronouns.defaults.kinds });
  assert.deepEqual(S.scopeOf(adjectives, adjectives.defaults, 'table'), {});
  assert.deepEqual(S.scopeOf(byId.nominal, byId.nominal.defaults, 'table'), {});
  // The sentences scope as before.
  assert.deepEqual(Object.keys(S.scopeOf(determiners, determiners.defaults)), ['families', 'cases', 'hints']);

  assert.ok(S.sameScope(determiners, { ...determiners.defaults, cases: ['nom'], hints: true }, determiners.defaults, 'table'));
  assert.ok(!S.sameScope(determiners, { ...determiners.defaults, cases: ['nom'] }, determiners.defaults));
  assert.ok(!S.sameScope(determiners, { families: ['ein'] }, determiners.defaults, 'table'));
  assert.ok(S.sameScope(adjectives, { degrees: ['comp'], mode: 'full' }, adjectives.defaults, 'table'));

  assert.equal(S.scopeText(determiners, { ...determiners.defaults, families: ['ein'] }, 'table'), 'ein-words');
  assert.equal(S.scopeText(determiners, determiners.defaults, 'table'), 'the whole table');
  assert.equal(S.scopeText(adjectives, adjectives.defaults, 'table'), 'the whole table');
  assert.equal(S.scopeText(passive, passive.defaults, 'table'), 'Vorgangspassiv · Präsens, Präteritum, Perfekt');
  assert.equal(S.scopeText(passive, passive.defaults), 'Vorgangspassiv · Präsens, Präteritum, Perfekt');
});

test('Präpositionen\'s table scope holds only the groups with a case of their own', () => {
  const scopeOf = (groups) => S.scopeOf(prepositions, { ...prepositions.defaults, groups }, 'table');
  assert.deepEqual(scopeOf(prepositions.defaults.groups), { groups: ['akk', 'dat', 'wechsel'] });
  assert.deepEqual(scopeOf(['fixed', 'da']), { groups: ['akk', 'dat', 'wechsel', 'gen'] });
  assert.deepEqual(scopeOf(['gen', 'da']), { groups: ['gen'] });
  const text = (groups) => S.scopeText(prepositions, { ...prepositions.defaults, groups }, 'table');
  assert.equal(text(prepositions.defaults.groups), 'Akkusativ, Dativ, Wechselpräpositionen');
  assert.equal(text(['fixed']), 'the whole table');
  assert.equal(text(['akk', 'dat', 'wechsel', 'gen', 'fixed', 'da']), 'the whole table');
  assert.ok(S.sameScope(prepositions, { groups: ['akk', 'fixed'] }, { ...prepositions.defaults, groups: ['akk'] }, 'table'));
  // A stored scope builds the same table.
  const stored = S.fitSettings(prepositions, scopeOf(['akk', 'da']));
  assert.deepEqual(prepositions.table(stored, mulberry32(2)), prepositions.table({ ...prepositions.defaults, groups: ['akk', 'da'] }, mulberry32(2)));
});

// ---------- Daily tables ----------

test('Daily tables with no table learnt explains how to mark one; a Sentences learnt mark does not count', () => {
  fresh();
  const tables = D.tablesTopic(TOPICS);
  assert.equal(tables.id, 'daily-tables');
  assert.equal(tables.kind, 'table');
  const none = 'No table is marked learnt yet. Open Adjektivendungen, Passiv, Präpositionen, Artikelwörter, Pronomen or Nominalisierung and turn on Table learnt on its options screen.';
  assert.equal(tables.validate({}), none);
  D.setMark('passive', 'sentences', { kinds: ['werden'] });
  assert.equal(tables.validate({}), none);
  assert.deepEqual(tables.learnt(), []);
  assert.deepEqual(tables.listing({}), []);
  D.setMark('passive', 'table', { kinds: ['werden'], tenses: ['praes'] });
  assert.equal(tables.validate({}), null);
  assert.deepEqual(tables.learnt().map((t) => t.id), ['passive']);
  D.setMark('passive', 'table', null);
  assert.ok(D.markOf('passive', 'sentences'), 'the sentences mark stays');
});

test('Daily tables: the least recently done first, each table in its learnt scope and named after its topic', () => {
  fresh();
  D.setMark('adjectives', 'table', {}, at(1, 10));
  D.setMark('passive', 'table', { kinds: ['werden'], tenses: ['praes', 'praet', 'perf'] }, at(3, 10));
  D.setMark('determiners', 'table', { families: ['ein'] }, at(4, 10));
  D.noteSeen('table', 'passive', at(20, 10));
  D.noteSeen('table', 'adjectives', at(21, 10));
  const tables = D.tablesTopic(TOPICS);
  assert.deepEqual(tables.listing({}), [
    { title: 'Artikelwörter — Endings table', text: 'ein-words · learnt 4 Nov' },
    { title: 'Passiv — Auxiliary verbs', text: 'Vorgangspassiv · Präsens, Präteritum, Perfekt · learnt 3 Nov' },
    { title: 'Adjektivendungen — Endings table', text: 'the whole table · learnt 1 Nov' },
  ], 'in the order they come up');
  assert.equal(tables.intro({}), 'Write out every table you have marked learnt from memory, the least recently done first.');

  const steps = tables.sessions[0].build({}, mulberry32(3));
  assert.deepEqual(steps.map((s) => s.label), ['Artikelwörter — Endings table', 'Passiv — Auxiliary verbs', 'Adjektivendungen — Endings table']);
  assert.deepEqual(steps.map((s) => s.topicTitle), ['Artikelwörter', 'Passiv', 'Adjektivendungen']);
  for (const s of steps) assert.equal(s.type, 'table');
  assert.deepEqual(steps[0].table.blocks.map((b) => b.title), ['ein-words']);
  assert.deepEqual(steps[1].table, passive.table(passive.defaults).table);
});

test('Daily tables leaves out the marks it cannot use and says why', () => {
  fresh();
  D.setMark('gone', 'table', {});
  D.setMark('verbforms', 'table', {});
  D.setMark('passive', 'table', { kinds: ['sein'], tenses: ['perf'] });
  const tables = D.tablesTopic(TOPICS);
  assert.equal(tables.intro({}), 'Write out every table you have marked learnt from memory, the least recently done first. '
    + 'gone: there is no such table any more. '
    + 'Verbformen: there is no such table any more. '
    + 'Passiv: its learnt settings no longer fit — open it and save them again.');
  assert.equal(tables.validate({}), 'None of the learnt tables can be used — see above.');
  assert.deepEqual(tables.listing({}), []);
  D.setMark('pronouns', 'table', { kinds: ['relative'] });
  assert.equal(tables.validate({}), null);
  assert.deepEqual(tables.sessions[0].build({}).map((s) => s.topicTitle), ['Pronomen']);
});

test('Daily tables notes each table seen at its first check, and done once every table is checked', () => {
  fresh();
  D.setMark('passive', 'table', { kinds: ['werden'], tenses: ['praes'] });
  D.setMark('determiners', 'table', { families: ['der'] });
  let now = at(21, 22);
  const tables = D.tablesTopic(TOPICS, () => now);
  const [first, second] = tables.sessions[0].build({}, mulberry32(1));
  first.onChecked({ correct: 3, total: 6 });
  assert.deepEqual(D.log('table').seen, { passive: at(21, 22) });
  now = at(21, 23);
  first.onChecked({ correct: 6, total: 6 }); // a retry
  assert.deepEqual(D.log('table').seen, { passive: at(21, 22) });
  assert.ok(!D.doneToday('table', now));
  now = at(22, 3); // still the 21st
  second.onChecked({ correct: 1, total: 16 });
  assert.deepEqual(D.log('table').seen, { passive: at(21, 22), determiners: at(22, 3) });
  assert.equal(D.log('table').done, '2026-11-21');
  assert.ok(D.doneToday('table', at(21, 23)));
  assert.ok(!D.doneToday('table', at(22, 4)));
  assert.equal(D.log('sentences').done, null, 'the Daily review is not done');

  // A new round counts afresh: the first check notes it seen again.
  now = at(22, 9);
  const [again] = tables.sessions[0].build({}, mulberry32(1));
  assert.equal(again.topicTitle, 'Passiv', 'both seen on the 21st: the registry\'s order');
  again.onChecked({ correct: 0, total: 6 });
  assert.equal(D.log('table').seen.passive, at(22, 9));
  assert.ok(!D.doneToday('table', now));
});
