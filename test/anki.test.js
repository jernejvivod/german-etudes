'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/topics/anki.js');
const V = require('../src/core/vocab.js');
const { gaps, text, isCorrectGap } = require('../src/core/cloze.js');
const { mulberry32, isolateStorage } = require('./helpers.js');

isolateStorage(test);

// Notes as the main process hands them over (raw Anki fields).
function note(id, article, word, pos, examples, sched = {}) {
  return {
    id, article, word, pos, dueIn: 1, lapses: 0, ease: 2500, ...sched,
    examples: examples.map((de) => ({ de, en: 'English.' })),
  };
}

const NOTES = [
  note(1, 'der', 'Mann, Männer', 'n', ['Er ist ein gut aussehender <b>Mann</b>.']),
  note(2, 'das', 'Mittel, Mittel', 'n', ['Ich werde in der Apotheke nach einem <b>Mittel</b> gegen Durchfall fragen.']),
  note(3, 'die', 'Apotheke, Apotheken', 'n', ['Die <b>Apotheke</b> ist&nbsp;geschlossen.']),
  note(4, 'das', 'Kind, Kinder', 'n', ['Wir spielen mit den <b>Kindern</b> im Garten.'], { dueIn: 10 }),
  note(5, 'der', 'Junge, Jungen', 'n', ['Ich helfe dem <b>Jungen</b>.'], { lapses: 3 }),
  note(6, '', 'kalt', 'adj', ['Ich trinke gern kaltes Wasser.', 'Es ist <b>kalt</b>.'], { lapses: 1 }),
  note(7, 'das', 'Wasser', 'n', ['Wasser ist gesund.'], { dueIn: null, ease: null }),
  note(8, 'der', 'Garten, Gärten', 'n', ['Das ist das Haus mit Garten.'], { dueIn: -2 }),
  note(9, '', 'hoch', 'adj', ['Es gibt hier hohe Berge.'], { dueIn: 20 }),
];

A.useNotes(NOTES);
const NOUNS = A.nounIndex(NOTES);
const STEMS = A.adjectiveStems(NOTES);
const items = (n) => n.examples.map((ex) => A.sentenceItem(n, ex, NOUNS, STEMS)).filter(Boolean);
const show = (item) => item.tokens.map((t) => (typeof t === 'string' ? t : `${t.prefix}[${t.answer}]`)).join('');

test('noun genders, including plural, dative plural, genitive and n-noun forms', () => {
  const index = A.nounIndex(NOTES);
  assert.deepEqual([...index.get('Mann')], ['m']);
  assert.deepEqual([...index.get('Männern')], ['pl']);
  assert.deepEqual([...index.get('Mannes')], ['m']);
  assert.deepEqual([...index.get('Jungen')].sort(), ['m', 'pl']);
});

test('article words and adjectives become gaps; the solved sentence is the original', () => {
  const [mann] = items(NOTES[0]);
  assert.equal(show(mann), 'Er ist ein[] gut aussehend[er] Mann.');
  assert.equal(text(mann), 'Er ist ein gut aussehender Mann.');
  assert.match(mann.explain, /maskulin Nominativ/);
  assert.match(mann.explain, /bare ein-word/);

  const [mittel] = items(NOTES[1]);
  assert.equal(show(mittel), 'Ich werde in d[er] Apotheke nach ein[em] Mittel gegen Durchfall fragen.');
  assert.match(mittel.explain, /der Apotheke: feminin Dativ, after "in"/);
  assert.match(mittel.explain, /einem Mittel: neutrum Dativ, after "nach"/);
});

test('contractions are one gap that also accepts the full form', () => {
  const [kinder] = items(NOTES[3]);
  assert.equal(show(kinder), 'Wir spielen mit d[en] Kindern [im] Garten.');
  const im = gaps(kinder)[1];
  assert.equal(im.placeholder, 'in + d…');
  assert.ok(isCorrectGap(im, 'in dem'));
  assert.match(kinder.explain, /den Kindern: Plural Dativ, after "mit"/);
  assert.match(kinder.explain, /im Garten: maskulin Dativ/);
});

test('n-nouns are read by their article ending', () => {
  const [junge] = items(NOTES[4]);
  assert.match(junge.explain, /dem Jungen: maskulin Dativ/);
});

test('no article: only known adjectives count, as strong endings', () => {
  const [wasser] = items(NOTES[5]);
  assert.equal(show(wasser), 'Ich trinke gern kalt[es] Wasser.');
  assert.match(wasser.explain, /neutrum (Nominativ or )?Akkusativ, no article → strong -es/);
  // The preposition is found across uninflected words before the adjectives.
  const mit = A.sentenceItem(NOTES[5], { de: 'Wir kochen mit sehr kaltem Wasser.', en: '' }, NOUNS, STEMS);
  assert.match(mit.explain, /kaltem Wasser: neutrum Dativ, after "mit"/);
  // hoch → hoh- before an ending; "Das ist" is no noun phrase.
  assert.equal(show(items(NOTES[8])[0]), 'Es gibt hier hoh[e] Berge.');
  assert.equal(show(items(NOTES[7])[0]), 'Das ist d[as] Haus mit Garten.');
  assert.equal(items(NOTES[6]).length, 0);
});

test('due cards within the window; a round draws among them and names their notes', () => {
  // Not in review (7) and due later (4, 9) are left out.
  assert.deepEqual(A.dueNotes(7).map((n) => n.id), [1, 2, 3, 5, 6, 8]);
  const idOf = (item) => item.notes[0].id;
  // More asked for than there is: every card of the window with a sentence to gap, the hard and the overdue one too.
  const all = (window) => A.buildRound({ window, length: 20 }, mulberry32(1)).map(idOf).sort();
  assert.deepEqual(all(7), [1, 2, 3, 5, 6, 8]);
  assert.deepEqual(all(14), [1, 2, 3, 4, 5, 6, 8]);
  assert.deepEqual(all(30), [1, 2, 3, 4, 5, 6, 8, 9]);
  // A shorter round: cards of the window, none twice; each item names its note for the app to mark as shown.
  const round = A.buildRound({ window: 7, length: 3 }, mulberry32(2));
  assert.equal(new Set(round.map(idOf)).size, 3);
  for (const item of round) {
    assert.deepEqual(item.notes, [NOTES.find((n) => n.id === idOf(item))]);
    assert.ok(item.notes[0].dueIn <= 7);
  }
  // Cards checked a moment ago weigh less, but stay in the window.
  V.markShown(NOTES.filter((n) => [5, 6, 8].includes(n.id)));
  assert.deepEqual(all(7), [1, 2, 3, 5, 6, 8]);
});
