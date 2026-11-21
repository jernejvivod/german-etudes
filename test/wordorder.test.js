'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../src/topics/wordorder.js');
const V = require('../src/core/vocab.js');
const { gaps, text, grade } = require('../src/core/cloze.js');
const { mulberry32 } = require('./helpers.js');

// The sentence with its gaps marked: [verb] where it goes, [ ] where it does not.
const show = (item) => item.tokens.map((t) => (typeof t === 'string' ? t : `[${t.answer || ' '}]`)).join('');

test('two gaps per sentence: one takes the verb, the other stays empty; typing it in the wrong one is a mistake', () => {
  const rnd = mulberry32(1);
  for (let i = 0; i < 300; i++) {
    for (const item of W.buildRound({ groups: ['sub', 'adv', 'coord'], vocab: 'builtin', length: 10 }, rnd)) {
      const g = gaps(item);
      assert.equal(g.length, 2, show(item));
      assert.deepEqual(g.map((x) => x.answer).filter(Boolean), [item.verb], show(item));
      assert.equal(item.prompt.text, item.verb);
      assert.doesNotMatch(text(item), /\s{2}|\s[,.?]/, show(item));
      assert.match(text(item), /^[A-ZÄÖÜ]/);
      const right = g.map((x) => x.answer);
      assert.ok(grade(item, right).every((x) => x.ok));
      assert.ok(!grade(item, right.slice().reverse()).every((x) => x.ok), show(item));
    }
  }
});

test('built-in rules: verb last after weil, right after deshalb, unchanged after denn, first after a fronted clause', () => {
  const rnd = mulberry32(2);
  const weil = W.connectorItem('weil', rnd);
  assert.match(show(weil), /, weil \S+( \S+)? \[ \] .+ \[\S+\]\.$/, show(weil));
  const deshalb = W.connectorItem('deshalb', rnd);
  assert.match(show(deshalb), /, deshalb \[\S+\] \S+ \[ \] /, show(deshalb));
  const denn = W.connectorItem('denn', rnd);
  assert.match(show(denn), /, denn (\S+ )+?\[\S+\] .+ \[ \]\.$/, show(denn));
  const fronted = Array.from({ length: 40 }, () => W.frontedItem(rnd)).map(show).find((s) => /, \[\S+\] /.test(s));
  assert.match(fronted, /^(Weil|Obwohl|Wenn) [^[]+, \[\S+\] \S+ \[ \]/, fronted);
});

test('deck sentences: subordinate clauses, adverbs in position 1 and aber / denn clauses; unsure ones are left out', () => {
  const note = (word, de) => ({ id: de, article: '', word, pos: 'v', english: '', headings: [], examples: [{ de, en: 'In English.' }], dueIn: 1, lapses: 0, ease: 2500 });
  V.useNotes([
    note('verlieren, verliert, verlor, hat verloren', 'Margret ist wütend, weil ich ihr Halsband verloren habe.'),
    note('vergessen, vergisst, vergaß, hat vergessen', 'Lisa ist böse, weil ihr Mann ihren Hochzeitstag vergessen hat.'),
    note('entspannen', 'Sonntags entspanne ich mich und tue gar nichts.'),
    note('hören', 'Martin rief ihren Namen, aber sie hörte ihn nicht.'),
    note('fahren, fährt, fuhr, ist gefahren', 'Als Kind wollte ich immer einen Lastwagen fahren.'),
    note('kochen', 'Mutti liest das Rezept durch, bevor sie anfängt zu kochen.'),
  ]);
  const items = W.deckItems(['sub', 'adv', 'coord']);
  assert.deepEqual(items.map(show), [
    'Margret ist wütend, weil ich [ ] ihr Halsband verloren [habe].',
    'Lisa ist böse, weil ihr Mann [ ] ihren Hochzeitstag vergessen [hat].',
    'Sonntags [entspanne] ich [ ] mich und tue gar nichts.',
    'Martin rief ihren Namen, aber sie [hörte] ihn nicht [ ].',
  ]);
  assert.ok(items.every((i) => i.source === 'anki' && i.english === 'In English.'));
  // Each names its note (the notes' ids are their sentences here).
  assert.deepEqual(items.map((i) => i.notes.map((n) => n.id)), items.map((i) => [text(i)]));
  assert.deepEqual(W.deckItems(['adv']).map((i) => i.conj), ['sonntags']);
  const round = W.buildRound({ groups: ['sub', 'adv', 'coord'], vocab: 'anki', length: 10 }, mulberry32(3));
  assert.equal(round.filter((i) => i.source === 'anki').length, 4);
  assert.equal(new Set(round.filter((i) => i.source === 'anki').map((i) => i.notes[0])).size, 4);
  assert.ok(round.find((i) => i.source === 'anki').explain.endsWith('— In English.'));
  V.useNotes([]);
});

test('new groups: modal Perfekt, zu-Infinitiv and je … desto have one filled and one empty gap; the wrong gap is a mistake', () => {
  const rnd = mulberry32(4);
  for (let i = 0; i < 200; i++) {
    for (const item of W.buildRound({ groups: ['modal', 'inf', 'je'], vocab: 'builtin', length: 10 }, rnd)) {
      const g = gaps(item);
      assert.equal(g.length, 2, show(item));
      assert.doesNotMatch(text(item), /\s{2}|\s[,.?!]/, show(item));
      const right = g.map((x) => x.answer);
      assert.ok(grade(item, right).every((x) => x.ok));
      assert.ok(!grade(item, right.slice().reverse()).every((x) => x.ok), show(item));
    }
  }
  assert.match(show(W.modalItem(W.MODAL_PERFECT[0])), /, weil sie länger \[hat\] arbeiten müssen \[ \]\.$/);
  const zu = W.ZU_CLAUSES.map((e) => show(W.zuItem(e)));
  assert.ok(zu.includes('Ich habe vergessen, [ ] dich [anzurufen].'), zu.join('\n'));
  assert.ok(zu.includes('Er ist gegangen, ohne [ ] sich [zu verabschieden].'), zu.join('\n'));
  const je = Array.from({ length: 30 }, () => show(W.jeItem(W.JE_DESTO[0], rnd)));
  assert.ok(je.some((s) => /^Je \S+ \[ \] .*\[\S+\], desto /.test(s)) && je.some((s) => /desto \S+ \[\S+\] \S+ \[ \]/.test(s)), je.join('\n'));
});

test('two-part connectors: both parts are typed, kein drops out, the verb agrees', () => {
  const items = W.PAIRED.map((e) => W.pairedItem(e));
  const weder = items.find((i) => i.prompt.text === 'Ich trinke keinen Kaffee und keinen Tee.');
  assert.equal(show(weder), 'Ich trinke [weder] Kaffee [noch] Tee.');
  const both = items.find((i) => i.prompt.text.startsWith('Anna und Tom'));
  assert.equal(text(both), 'Sowohl Anna als auch Tom kommen zur Party.');
  const neither = items.find((i) => i.prompt.text.startsWith('Anna kommt nicht'));
  assert.ok(grade(neither, ['Weder', 'noch', 'kommen']).every((x) => x.ok) && grade(neither, ['weder', 'noch', 'kommt']).every((x) => x.ok));
});

test('deck sentences: zu-infinitives at the end of a clause, joined for separable verbs; not inside a subordinate clause', () => {
  V.useNotes([
    { word: 'anrufen', pos: 'v', dueIn: 3, lapses: 0, ease: 2500, examples: [{ de: 'Helen entschied sich, ihre Mutter anzurufen.', en: '' }] },
    { word: 'gehen', pos: 'v', dueIn: 3, lapses: 0, ease: 2500, examples: [
      { de: 'Sie stand auf, um zur Arbeit zu gehen.', en: '' },
      { de: 'Er blieb, weil er keine Lust hatte zu gehen.', en: '' },
    ] },
  ].map((n) => ({ english: '', article: '', headings: [], ...n })));
  const found = W.deckItems(['inf']).map(show);
  assert.deepEqual(found, ['Helen entschied sich, [ ] ihre Mutter [anzurufen].', 'Sie stand auf, um [ ] zur Arbeit [zu gehen].']);
  V.useNotes([]);
});

test('review fixes: a capitalized noun before zu is no verb; paired entries with one template have their own keys', () => {
  V.useNotes([{ word: 'essen', pos: 'v', dueIn: 3, lapses: 0, ease: 2500, english: '', article: '', headings: [], examples: [{ de: 'Sie ging nach Hause, um das Essen zu bringen.', en: '' }] }]);
  assert.deepEqual(W.deckItems(['inf']).map(show), ['Sie ging nach Hause, um [ ] das Essen [zu bringen].']);
  V.useNotes([]);
  const rnd = mulberry32(8);
  const keys = new Set(W.buildRound({ groups: ['paired'], vocab: 'builtin', length: 40 }, rnd).map((i) => i.key));
  const anna = W.PAIRED.filter((e) => e.t.includes('Anna {B} Tom {V} zur Party'));
  assert.ok(anna.length === 2 && anna.every((e) => keys.has(e)));
});

test('Mittelfeld, nicht / kein, connector choices: one right place, the wrong one makes a different sentence', () => {
  const rnd = mulberry32(91);
  for (let i = 0; i < 150; i++) {
    for (const item of W.buildRound({ groups: ['mittel', 'nicht', 'conj', 'inf'], vocab: 'builtin', length: 10 }, rnd)) {
      const g = gaps(item);
      const t = text(item);
      assert.doesNotMatch(t, /\s{2}|\s[,.?!]|undefined|\{/, show(item));
      assert.match(t, /^[A-ZÄÖÜ]/);
      const right = g.map((x) => x.answer);
      assert.ok(grade(item, right).every((x) => x.ok), show(item));
      if (g.length === 2) {
        const swapped = { ...item, tokens: item.tokens.map((x) => (typeof x === 'object' ? { ...x, answer: right[1 - g.indexOf(x)] } : x)) };
        assert.notEqual(text(swapped), t, show(item));
      }
    }
  }
  assert.equal(show(W.nichtItem(W.NICHT[3])), 'Ich kenne [ ] den Mann [nicht].');
  const noZu = W.noZuItem(W.NO_ZU[0]);
  assert.equal(show(noZu), 'Ich muss [ ] morgen früh [aufstehen].');
  const k = W.negateItem(() => 0.9, [], 'builtin');
  assert.match(gaps(k)[0].answer, /^(kein\w*|nicht)$/);
  assert.equal(gaps(W.choiceItem(W.CHOICES[0]))[0].placeholder, 'als / wenn / wann');
});

test('review fixes: seitdem starting a sentence is capitalized; nicht / kein tags give nothing away; one learnt entry does not fill a round', () => {
  const seitdem = W.choiceItem(W.CHOICES.find((e) => e.a === 'seitdem'));
  assert.match(text(seitdem), /\. Seitdem fährt/);
  for (let i = 0; i < 20; i++) assert.equal(W.negateItem(mulberry32(i), [], 'builtin').tags[0].text, 'nicht / kein');
  const rnd = mulberry32(5);
  const recent = [];
  const picks = [];
  for (let i = 0; i < 10; i++) {
    const x = V.pickPreferring(['a', 'b', 'c', 'd', 'e', 'f'], ['a'], rnd, { recent, key: (e) => e });
    recent.push(x);
    if (recent.length > 4) recent.shift();
    picks.push(x);
  }
  assert.ok(picks.filter((x) => x === 'a').length <= 3, picks.join(''));
});
