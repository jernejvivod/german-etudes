'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../tools/praep-deck.js');

const LIST = P.readList(fs.readFileSync(path.join(__dirname, '..', 'tools', 'praepositionen.tsv'), 'utf8'));
const card = (word, examples = []) => ({ word, pos: 'v', english: '', article: '', headings: [], examples, dueIn: 4, lapses: 0, ease: 2500 });

test('the list: every pair with a case, a meaning and an example; no pair twice', () => {
  assert.ok(LIST.length > 250);
  for (const e of LIST) {
    assert.match(e.case, /^(Akk|Dat)$/, e.pair);
    assert.ok(e.english && e.example && ['Verb', 'Adjektiv', 'Nomen'].includes(e.kind), e.pair);
    assert.ok(/^(quillbot\*?|added)$/.test(e.source), e.pair);
  }
  const keys = LIST.map((e) => `${e.pair} ${e.case}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(LIST.find((e) => e.pair === 'zählen zu').case, 'Dat');
});

test("the deck: the word with a gap, 'prep + case' to type, the deck's own example where it uses the pair, learnt first", () => {
  const rows = P.buildDeck(LIST, [
    card('warten', [{ de: 'Nach dem Essen warten wir.', en: '' }, { de: 'Ich warte seit einer Stunde auf den Bus.', en: 'I have been waiting for the bus for an hour.' }]),
    card('überreden', [{ de: 'Er konnte sie nicht überreden, mitzukommen. Sie war zu müde.', en: '' }]),
  ]);
  const warten = rows.find((r) => r.Wort === 'warten ___');
  assert.ok(rows.slice(0, 2).includes(warten), 'learnt verbs come first');
  assert.equal(warten.Antwort, 'auf + Akk');
  assert.equal(warten.Beispiel, 'Ich warte seit einer Stunde <b>auf</b> den Bus.');
  assert.ok(warten.tags.includes('anki-beispiel') && warten.tags.includes('gelernt'));
  const ueberreden = rows.find((r) => r.Wort === 'überreden ___');
  assert.ok(!ueberreden.tags.includes('anki-beispiel'), 'zu ängstlich / zu + infinitive is no zu + Dativ');
  assert.ok(rows.find((r) => r.Wort === 'sich freuen ___').tags.includes('paar'));
  assert.equal(P.bold('Ob die Party stattfindet, hängt vom Wetter ab.', 'von'), 'Ob die Party stattfindet, hängt <b>vom</b> Wetter ab.');
  const keys = rows.map((r) => r.Schlüssel);
  assert.equal(new Set(keys).size, keys.length, 'the first field is unique');
});

test('the app\'s own fixed pairs (Präpositionen) have the same case in the list', () => {
  const app = require('../src/topics/prepositions.js');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'topics', 'prepositions.js'), 'utf8');
  const pairs = [...src.matchAll(/fixed\('(acc|dat)', '[^']+', '([^']+)'/g)].map((m) => [m[2], m[1] === 'acc' ? 'Akk' : 'Dat']);
  assert.ok(app && pairs.length > 20);
  const ALIASES = { 'Angst haben vor': 'die Angst vor', 'schützen vor': 'sich schützen vor' };
  for (const [pair, kase] of pairs) {
    const name = ALIASES[pair] || pair;
    assert.ok(LIST.some((e) => e.pair === name && e.case === kase), `${pair} + ${kase} is not in the list`);
  }
});

test('deck examples: no "zu sein", no "am Montag", not first in a later sentence; only the pair\'s preposition bold', () => {
  const rows = P.buildDeck(LIST, [
    card('überreden', [{ de: 'Er hat versucht, nett zu sein.', en: '' }]),
    card('arbeiten', [{ de: 'Ich arbeite am Montag nicht.', en: '' }]),
    card('suchen', [{ de: 'Es regnet. Nach dem Essen suchen wir.', en: '' }]),
    card('sich freuen'),
    card('freuen', [{ de: 'Ich freue mich über deinen Brief.', en: '' }]),
  ]);
  const row = (key) => rows.find((r) => r.Schlüssel === key);
  for (const key of ['überreden zu + Dat', 'arbeiten an + Dat', 'suchen nach + Dat']) assert.ok(!row(key).tags.includes('anki-beispiel'), key);
  assert.equal(row('sich freuen über + Akk').Beispiel, 'Ich freue mich <b>über</b> deinen Brief.');
  assert.equal(P.bold('Ich warte noch auf eine Antwort auf meine Frage.', 'auf', 'Antwort'), 'Ich warte noch auf eine Antwort <b>auf</b> meine Frage.');
  assert.equal(P.bold('A < B & C', 'mit'), 'A &lt; B &amp; C');
});
