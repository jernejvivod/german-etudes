'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/topics/fvg.js');
const { gaps, text, grade } = require('../src/core/cloze.js');
const V = require('../src/core/vocab.js');
const { mulberry32, isolateStorage, ankiNote } = require('./helpers.js');

test('every pair: the verb and its preposition / article are gaps, the noun is shown', () => {
  for (const e of F.PAIRS) {
    const it = F.buildItem(e);
    const g = gaps(it);
    assert.equal(g.find((x) => x.slot === 'verb').answer, e.v[0]);
    assert.equal(g.some((x) => x.slot === 'prep'), !!e.p, e.pair);
    assert.ok(text(it).includes(e.noun), e.pair);
    assert.doesNotMatch(text(it), /\{|\s{2}|\s[,.?!]/, text(it));
    assert.ok(grade(it, g.map((x) => x.answer)).every((x) => x.ok));
  }
});

test('the table asks for the verb of each noun part; both verbs count for zur Verfügung', () => {
  const [block] = F.verbsTable(F.PAIRS).blocks;
  const row = (label) => block.answers[0][block.rows.indexOf(label)];
  assert.deepEqual(row('Kritik … an'), ['üben']);
  assert.deepEqual(row('zur Verfügung …'), ['stellen', 'stehen']);
  assert.ok(block.rows.every((r) => r.includes('…')));
  assert.equal(F.buildRound({ length: 10, vocab: 'builtin' }, mulberry32(3)).length, 10);
});

test('a round has no pair twice when the list is long enough', () => {
  const round = F.buildRound({ length: 20, vocab: 'builtin' }, mulberry32(4));
  assert.equal(new Set(round.map((i) => i.key)).size, 20);
});

test('the Anki option: pairs with a learnt noun are in the round, tagged, and name its note', (t) => {
  isolateStorage(t);
  t.after(() => V.useNotes([]));
  // Two learnt nouns, one of them lapsed and due; a third card not learnt yet.
  const notes = [ankiNote('Entscheidung', { lapses: 3 }), ankiNote('Kritik', { dueIn: 20 }), ankiNote('Abschied', { dueIn: null })];
  V.useNotes(notes);
  const noteOf = { Entscheidung: notes[0], Kritik: notes[1] };
  const round = F.buildRound({ length: 10, vocab: 'anki' }, mulberry32(5));
  assert.equal(new Set(round.map((it) => it.key)).size, 10);
  const nouns = round.map((it) => it.tags[0].text);
  for (const pair of F.PAIRS.filter((e) => noteOf[e.noun])) assert.ok(round.some((it) => it.key === pair.pair), pair.pair);
  round.forEach((it, i) => {
    assert.deepEqual(it.notes, noteOf[nouns[i]] ? [noteOf[nouns[i]]] : []);
    assert.equal(it.tags.some((tag) => tag.text === 'Anki'), it.notes.length > 0);
  });
  for (const it of F.buildRound({ length: 10, vocab: 'builtin' }, mulberry32(6))) assert.deepEqual(it.notes, []);
});
