'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/topics/passive.js');
const { gaps, text } = require('../src/core/cloze.js');
const { mulberry32, findItem } = require('./helpers.js');

const ALL_KINDS = Object.keys(P.KINDS).filter((k) => k !== 'ersatz'); // Passiversatz has its own test
// Every passive subject must start with an article, possessive or pronoun — that word is the subject gap.
const SUBJECT_HEADS = ['der', 'die', 'das', 'ein', 'eine', 'mein', 'ich', 'du', 'er', 'wir', 'ihr'];

test('every entry verb is in the verb table, every kind has entries', () => {
  for (const e of P.ENTRIES) assert.ok(P.VERBS[e.verb], e.verb);
  for (const kind of ALL_KINDS) assert.ok(P.ENTRIES.some((e) => e.kinds.includes(kind)), kind);
});

test('items for every kind × tense: answers, agreement and shape', () => {
  const rnd = mulberry32(21);
  for (const { kind, tense } of P.combos(ALL_KINDS, P.TENSES)) {
    const form = P.KINDS[kind].forms[tense];
    for (let i = 0; i < 300; i++) {
      const item = P.buildItem(kind, tense, rnd);
      const all = gaps(item);
      const subj = all.filter((g) => g.slot === 'subj');
      const [fin, pii, aux2] = all.filter((g) => g.slot !== 'subj');
      assert.ok(SUBJECT_HEADS.includes(subj[0].answer.toLowerCase()), subj[0].answer);
      assert.ok(all.every((g) => g.label), 'every gap has a screen-reader label');
      assert.ok(P.CONJ[form.verb][form.tense].includes(fin.answer), `${kind}/${tense}: ${fin.answer}`);
      assert.equal(pii.answer, P.VERBS[item.verb].pii);
      assert.equal(aux2 ? aux2.answer : '', form.aux2);
      const label = kind === 'sein' ? `Aktiv · ${P.ACTIVE_TENSE_LABELS[P.ZUSTAND_SOURCE[tense]]}` : 'Aktiv';
      assert.equal(item.prompt.label, label);
      for (const s of [item.prompt.text, text(item)]) {
        assert.match(s, /^[A-ZÄÖÜ][^.]*\.$/, s);
        assert.doesNotMatch(s, /undefined|null|\s{2}/, s);
      }
    }
  }
});

test('Zustandspassiv has no Perfekt / Plusquamperfekt', () => {
  assert.deepEqual(P.combos(['sein'], P.TENSES).map((c) => c.tense), ['praes', 'praet', 'fut']);
  assert.throws(() => P.buildItem('sein', 'perf'));
});

test('known transformations', () => {
  const find = (kind, tense, pred) => findItem((rnd) => P.buildItem(kind, tense, rnd), pred, 2);
  let item = find('werden', 'perf', (i) => i.verb === 'einladen' && i.prompt.text.includes(' mich '));
  assert.match(text(item), /^Ich bin .*eingeladen worden\.$/);
  item = find('werden', 'praes', (i) => i.prompt.text.startsWith('Der Mechaniker repariert das Auto'));
  assert.match(text(item), /^Das Auto wird \w+ vom Mechaniker in der Werkstatt repariert\.$/);
  item = find('werden', 'praet', (i) => i.prompt.text.includes(' den Brief '));
  assert.equal(gaps(item)[0].answer, 'Der');
  assert.match(item.explain, /"den Brief" becomes the subject "der Brief"/);
  item = find('werden', 'praes', (i) => i.prompt.text.includes(' den Patienten '));
  assert.deepEqual(gaps(item).filter((g) => g.slot === 'subj').map((g) => g.answer), ['Der', 'Patient']);
  item = find('bekommen', 'perf', (i) => i.prompt.text.startsWith('Die Oma hat dem Kind'));
  assert.equal(gaps(item)[0].answer, 'Das');
  assert.match(text(item), /^Das Kind hat .*von der Oma zum Geburtstag ein Buch geschenkt bekommen\.$/);
  item = find('sein', 'praes', (i) => i.verb === 'schließen' && i.prompt.text.includes('die Tür'));
  assert.match(item.prompt.text, /^Man hat die Tür \w+ geschlossen\.$/);
  assert.match(text(item), /^Die Tür ist \w+ geschlossen\.$/);
  item = find('sein', 'fut', (i) => i.verb === 'schließen');
  assert.match(item.prompt.text, /geschlossen haben\.$/);
  assert.match(text(item), /geschlossen sein\.$/);
});

test('rounds cycle through the selected combos', () => {
  const rnd = mulberry32(4);
  const items = P.buildRound({ kinds: ['werden', 'sein'], tenses: ['praes', 'perf'], length: 9 }, rnd);
  assert.equal(items.length, 9);
  const seen = new Set(items.slice(0, 3).map((i) => `${i.kind}/${i.tense}`));
  assert.equal(seen.size, 3); // werden/praes, werden/perf, sein/praes — each once before repeating
  assert.ok(items.every((i) => !(i.kind === 'sein' && i.tense === 'perf')));
});

test('session: auxiliary table first, only applicable columns', () => {
  const rnd = mulberry32(5);
  const steps = P.sessions[0].build({ kinds: ['werden', 'sein'], tenses: ['praes', 'perf'], length: 10 }, rnd);
  assert.deepEqual(steps.map((s) => s.type), ['table', 'drill']);
  const [werden, sein] = steps[0].table.blocks;
  assert.deepEqual(werden.answers, [P.CONJ.werden.praes, P.CONJ.sein.praes]);
  assert.equal(werden.cols[1].sub, '+ gebaut worden');
  assert.equal(sein.cols.length, 1);
  assert.equal(steps[1].items.length, 10);
});

test('validation', () => {
  assert.ok(P.options.filter((o) => o.type === 'checkboxes').every((o) => o.min === 1));
  assert.ok(P.validate({ kinds: ['sein'], tenses: ['perf', 'plusq'] }));
  assert.equal(P.validate({ kinds: ['sein'], tenses: ['perf', 'praes'] }), null);
  assert.match(P.validate({ kinds: ['werden', 'sein'], tenses: ['perf'] }), /^Zustandspassiv/);
});

test('Passiversatz: sich lassen, sein + zu and -bar stand for kann / muss + passive', () => {
  const rnd = mulberry32(41);
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const tense = i % 2 ? 'praes' : 'praet';
    const it = P.buildItem('ersatz', tense, rnd);
    seen.add(it.form);
    const g = gaps(it);
    const t = text(it);
    assert.match(it.prompt.text, /(kann|können|konnte|konnten|muss|müssen|musste|mussten) .+ \S+ werden\.$/, it.prompt.text);
    if (/muss/.test(it.prompt.text)) assert.equal(it.form, 'zu', t);
    if (it.form === 'lassen') assert.match(t, / (lässt|lassen|ließ|ließen) sich .+ \S+en\.$/, t);
    if (it.form === 'zu') assert.match(g[1].answer, /^(zu \S+|\S+zu\S+)$/, t);
    if (it.form === 'bar') assert.equal(g[0].answer, P.BAR[it.verb]);
    assert.doesNotMatch(t, /\s{2}|undefined/, t);
  }
  assert.deepEqual([...seen].sort(), ['bar', 'lassen', 'zu']);
  assert.ok(P.ERSATZ_ENTRIES.every((e) => e.subjects.length && e.subjects.every((s) => s.nom.includes(' '))));
  assert.match(P.validate({ kinds: ['ersatz'], tenses: ['perf'] }), /Passiversatz/);
});
