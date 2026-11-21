'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../src/topics/nominal.js');
const { gaps, text, grade } = require('../src/core/cloze.js');
const V = require('../src/core/vocab.js');
const { mulberry32, isolateStorage, ankiNote } = require('./helpers.js');

const show = (item) => item.tokens.map((t) => (typeof t === 'string' ? t : `[${t.answer}]`)).join('');

test('both directions for every entry: the gaps, the prompt and the other sentence say the same', () => {
  const rnd = mulberry32(61);
  for (const e of N.ENTRIES) {
    for (let i = 0; i < 10; i++) {
      const nom = N.buildItem('nom', e, rnd);
      const verb = N.buildItem('verb', e, rnd);
      for (const it of [nom, verb]) {
        assert.doesNotMatch(text(it) + it.prompt.text, /\{|undefined|\s{2}|\s[,.]/, show(it));
        assert.match(text(it), /^[A-ZÄÖÜ].*\.$/);
        assert.ok(grade(it, gaps(it).map((g) => g.answer)).every((x) => x.ok));
      }
      assert.ok(text(nom).toLowerCase().startsWith(e.prep), text(nom));
      assert.ok(text(nom).endsWith(` ${e.main}.`) && text(verb).endsWith(`, ${e.main}.`));
      assert.ok(text(verb).toLowerCase().startsWith(e.conj), text(verb));
    }
  }
});

test('the phrase follows the subject and the case: possessive, article, contraction, genitive -s', () => {
  const entry = (noun) => N.ENTRIES.find((e) => e.np.noun === noun);
  assert.equal(N.phraseFor(entry('Ankunft'), 'er').answer, 'bei seiner Ankunft');
  assert.equal(N.phraseFor(entry('Umzug'), 'wir').answer, 'seit unserem Umzug');
  assert.equal(N.phraseFor(entry('Studium'), 'sie').answer, 'während ihres Studiums');
  assert.equal(N.phraseFor(entry('Hilfe'), 'ihr').answer, 'ohne eure Hilfe');
  assert.deepEqual(N.phraseFor(entry('Regen'), null), { answer: 'wegen des Regens', alts: ['aufgrund des Regens'], article: 'des' });
  assert.deepEqual(N.phraseFor(entry('Essen'), null).answer, 'nach dem Essen');
  assert.equal(N.verbGroup(entry('Ankunft').v, 'praet', '3sg'), 'ankam');
  assert.equal(N.verbGroup(entry('Umzug').v, 'perf', '1sg'), 'umgezogen bin');
});

test('rounds alternate the chosen directions; the table lists connectors and the round\'s nouns', () => {
  const rnd = mulberry32(62);
  const items = N.buildRound({ directions: ['verb'], length: 10, vocab: 'builtin', hints: true }, rnd);
  assert.equal(items.length, 10);
  assert.ok(items.every((i) => i.direction === 'verb'));
  const steps = N.sessions[0].build({ ...N.defaults, vocab: 'builtin' }, rnd);
  assert.deepEqual(steps.map((s) => s.type), ['table', 'drill']);
  const [connectors] = steps[0].table.blocks;
  assert.deepEqual(connectors.answers[0][0], ['wegen', 'aufgrund']);
  const hidden = N.buildItem('nom', N.ENTRIES[0], rnd, { hints: false });
  assert.equal(gaps(hidden)[0].placeholder, undefined);
});

test('review fixes: ihr- allows both sie forms, wenn / falls and weil / da count, keys are unique', () => {
  const rnd = mulberry32(63);
  const hochzeit = N.ENTRIES.find((e) => e.noun === 'Hochzeit');
  for (let i = 0; i < 20; i++) {
    const it = N.buildItem('verb', hochzeit, rnd);
    const verb = gaps(it)[1];
    if (/ sie $/.test(it.tokens[1])) assert.deepEqual([verb.answer, ...verb.alts].sort(), ['heiratete', 'heirateten']);
  }
  const brand = N.buildItem('verb', N.ENTRIES.find((e) => e.noun === 'Brand'), rnd);
  assert.ok(grade(brand, ['wenn', 'brennt']).every((x) => x.ok));
  assert.equal(new Set(N.ENTRIES.map((e) => e.key)).size, N.ENTRIES.length);
});

test('the Anki option: entries with a learnt word come up, tagged, and name its note', (t) => {
  isolateStorage(t);
  t.after(() => V.useNotes([]));
  // A learnt noun that has lapsed, and a learnt verb (umziehen, for Umzug); Hochzeit is in the deck but not learnt yet.
  const notes = [ankiNote('Ankunft', { lapses: 3 }), ankiNote('umziehen', { pos: 'v' }), ankiNote('Hochzeit', { dueIn: null })];
  V.useNotes(notes);
  const settings = { directions: ['nom', 'verb'], length: 10, vocab: 'anki', hints: true };
  const round = N.buildRound(settings, mulberry32(64));
  assert.ok(round.some((it) => it.entry.noun === 'Ankunft') && round.some((it) => it.entry.noun === 'Umzug'));
  for (const it of round) {
    assert.deepEqual(it.notes, { Ankunft: [notes[0]], Umzug: [notes[1]] }[it.entry.noun] || [], it.entry.noun);
    assert.equal(it.tags.some((tag) => tag.text === 'Anki'), it.notes.length > 0);
  }
  for (const it of N.buildRound({ ...settings, vocab: 'builtin' }, mulberry32(64))) assert.deepEqual(it.notes, []);
});
