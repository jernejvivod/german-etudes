'use strict';

// Every sentence topic's sentences(settings, n, rnd): what the Daily review asks of it, and what its own Start round
// is built from.
const test = require('node:test');
const assert = require('node:assert/strict');
const { gaps } = require('../src/core/cloze.js');
const V = require('../src/core/vocab.js');
const { mulberry32, isolateStorage, ankiNote, registry } = require('./helpers.js');

const TOPICS = registry();
const anki = TOPICS.find((t) => t.id === 'anki');
// The topics whose Hints switch shows the tags before checking (Nominalisierung's shows the noun in the gap instead).
const HIDING = ['adjectives', 'determiners', 'prepositions', 'pronouns', 'wordorder', 'anki'];

isolateStorage(test);

// A few learnt cards, so the topics' My Anki words paths run too; Anki-Sätze's deck as in anki.test.js.
const note = (id, article, word, examples, sched = {}) => ({
  id, article, word, pos: 'n', dueIn: 1, lapses: 0, ease: 2500, ...sched, examples: examples.map((de) => ({ de, en: 'English.' })),
});
test.before(() => {
  V.useNotes([ankiNote('der Tisch', { article: 'der', word: 'Tisch, Tische' }), ankiNote('Ankunft', { lapses: 2 }), ankiNote('Entscheidung')]);
  anki.useNotes([
    note(1, 'der', 'Mann, Männer', ['Er ist ein gut aussehender <b>Mann</b>.']),
    note(2, 'das', 'Mittel, Mittel', ['Ich werde in der Apotheke nach einem <b>Mittel</b> gegen Durchfall fragen.']),
    note(3, 'die', 'Apotheke, Apotheken', ['Die <b>Apotheke</b> ist&nbsp;geschlossen.']),
    note(5, 'der', 'Junge, Jungen', ['Ich helfe dem <b>Jungen</b>.'], { lapses: 3 }),
  ]);
});
test.after(() => V.useNotes([]));

test('every sentence topic gives n sentences in the shape the drill and the Daily review need', () => {
  for (const t of TOPICS) {
    assert.equal(typeof t.sentences, 'function', t.id);
    for (const n of [1, 2, 7, 30]) {
      const settings = { ...t.defaults };
      const step = t.sentences(settings, n, mulberry32(n));
      const what = `${t.id}, ${n}`;
      assert.equal(step.type, 'drill', what);
      assert.equal(step.label, 'Sentences', what);
      assert.equal(typeof step.hint, 'string', what);
      if (t === anki) assert.ok(step.items.length >= 1 && step.items.length <= n, what);
      else assert.equal(step.items.length, n, what);
      if (HIDING.includes(t.id)) assert.equal(step.hideTags, !settings.hints, what);
      else assert.equal(step.hideTags, undefined, what);
      for (const item of step.items) {
        assert.ok(gaps(item).length >= 1, what);
        assert.ok(Array.isArray(item.tags), what);
        assert.equal(typeof item.explain, 'string', what);
        assert.ok(item.notes === undefined || Array.isArray(item.notes), what);
      }
    }
  }
});

test('the hint and hidden tags follow the settings', () => {
  for (const t of TOPICS.filter((x) => HIDING.includes(x.id))) {
    for (const hints of [true, false]) assert.equal(t.sentences({ ...t.defaults, hints }, 2, mulberry32(1)).hideTags, !hints, t.id);
  }
});

test('a topic\'s Start round has the same sentences as sentences() with its length', () => {
  for (const t of TOPICS) {
    const settings = { ...t.defaults };
    const length = settings.length ?? 12; // Adjektivendungen: a quick round
    for (const seed of [1, 2]) {
      const drill = t.sessions[0].build(settings, mulberry32(seed)).find((s) => s.type === 'drill');
      const own = t.sentences(settings, length, mulberry32(seed));
      if (t.id === 'adjectives') {
        // Its round has its own order; the step is the same but for the sentences.
        assert.deepEqual({ ...drill, items: drill.items.length }, { ...own, items: own.items.length });
      } else assert.deepEqual(drill, own, `${t.id}, seed ${seed}`);
    }
  }
});

test('the options that shape only a topic\'s own round say so (round: true), and My Anki words is the review\'s (daily)', () => {
  for (const t of TOPICS) {
    for (const opt of t.options.filter((o) => o.key === 'length')) assert.equal(opt.round, true, t.id);
  }
  const adjectives = TOPICS.find((t) => t.id === 'adjectives');
  assert.deepEqual(adjectives.options.filter((o) => o.round).map((o) => o.key), ['mode', 'order']);
  // The Daily review always uses My Anki words.
  for (const t of TOPICS) for (const opt of t.options.filter((o) => o.key === 'vocab')) assert.equal(opt.daily, 'anki', t.id);
});
