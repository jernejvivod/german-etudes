'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../src/topics/adjectives.js');
const lexicon = require('../src/core/lexicon.js');
const { gaps, text } = require('../src/core/cloze.js');
const V = require('../src/core/vocab.js');
const { mulberry32, findItem, isolateStorage, ankiNote } = require('./helpers.js');

test('every case × gender × variant has nouns and frames', () => {
  for (const v of G.VARIANTS) {
    for (const g of G.GENDERS) {
      const pool = G.nounPool(v, g);
      assert.ok(pool.length > 0, `${v}/${g} has no nouns`);
      for (const c of G.CASES) {
        assert.ok(G.nounPool(v, g, 'builtin', c).length > 0, `${v}/${g}/${c} has no noun with a frame and determiner`);
        for (const noun of pool) {
          assert.ok(G.FRAMES[c].some((f) => f.cats.includes(noun.cat)), `no ${c} frame for ${noun.cat}`);
        }
      }
    }
  }
});

test('generated items use the table endings and contain no placeholders', () => {
  const rnd = mulberry32(42);
  for (let i = 0; i < 300; i++) {
    for (const v of G.VARIANTS) {
      for (const g of G.GENDERS) {
        for (const c of G.CASES) {
          const item = G.buildItem(v, g, c, rnd);
          const adj = gaps(item).find((x) => x.slot === 'adj');
          assert.equal(adj.answer, G.ADJ_ENDINGS[v][g][G.CASES.indexOf(c)]);
          assert.equal(gaps(item).length, v === 'strong' ? 1 : 2);
          assert.doesNotMatch(text(item), /[{}|]|undefined|null/);
          assert.match(text(item), /^[A-ZÄÖÜ]/, text(item));
        }
      }
    }
  }
});

test('every noun has adjectives', () => {
  for (const v of G.VARIANTS) for (const g of G.GENDERS) for (const noun of G.nounPool(v, g)) {
    assert.ok(G.adjectivesFor(noun).length > 0, noun.lemma);
  }
});

test('ein / jed- never precede a mass noun', () => {
  const rnd = mulberry32(9);
  for (let i = 0; i < 2000; i++) {
    for (const v of ['weak', 'mixed']) for (const g of ['m', 'f', 'n']) {
      const item = G.buildItem(v, g, 'acc', rnd);
      const noun = G.nounPool('strong', g).find((n) => n.lemma === item.noun);
      if (noun) assert.ok(!['ein', 'jed'].includes(item.det), `${item.det} ${item.noun}`);
    }
  }
});


test('strong singular uses only mass nouns, plural only countable nouns', () => {
  for (const g of ['m', 'f', 'n']) assert.ok(G.nounPool('strong', g).every((n) => n.mass));
  for (const v of G.VARIANTS) assert.ok(G.nounPool(v, 'pl').every((n) => n.pl));
});

test('known sentences', () => {
  // Fix the random choices by searching for a specific noun.
  const find = (v, g, c, lemma) =>
    findItem((rnd) => G.buildItem(v, g, c, rnd), (item) => item.noun === lemma && [null, 'd', 'ein'].includes(item.det));
  assert.match(text(find('weak', 'm', 'dat', 'Student')), /\b(dem|diesem|jedem) \w+en Studenten\b/i);
  assert.match(text(find('mixed', 'n', 'nom', 'Buch')), /\bein \w+es Buch\b/i);
  assert.match(text(find('strong', 'n', 'gen', 'Wetter')), /\b\w+en Wetters\b/);
  assert.match(text(find('strong', 'pl', 'dat', 'Kind')), /\b\w+en Kindern\b/);
});


test('rounds', () => {
  const rnd = mulberry32(7);
  const quick = G.buildRound({ mode: 'quick' }, rnd);
  assert.equal(quick.length, 12);
  for (const v of G.VARIANTS) {
    const ofV = quick.filter((i) => i.variant === v);
    assert.deepEqual(ofV.map((i) => i.case).sort(), [...G.CASES].sort());
    assert.deepEqual(ofV.map((i) => i.gender).sort(), [...G.GENDERS].sort());
  }
  assert.equal(G.buildRound({ mode: 'full' }, rnd).length, 48);
  const grouped = G.buildRound({ mode: 'full', order: 'grouped' }, rnd).map((i) => i.variant);
  assert.deepEqual(grouped, G.VARIANTS.flatMap((v) => Array(16).fill(v)));
});

test('explanations exist for every cell', () => {
  const rnd = mulberry32(3);
  for (const v of G.VARIANTS) for (const g of G.GENDERS) for (const c of G.CASES) {
    assert.ok(G.explain(G.buildItem(v, g, c, rnd)).length > 10);
  }
});

test('mixed endings = strong where the ein-word has no ending, weak elsewhere', () => {
  for (const g of G.GENDERS) G.CASES.forEach((c, ci) => {
    const source = G.DET_ENDINGS.ein[g][ci] === '' ? 'strong' : 'weak';
    assert.equal(G.ADJ_ENDINGS.mixed[g][ci], G.ADJ_ENDINGS[source][g][ci], `${g}/${c}`);
  });
});

test('session: sentences, then the endings table', () => {
  const rnd = mulberry32(11);
  const [start, tablesOnly] = G.sessions;
  const steps = start.build(G.defaults, rnd);
  assert.deepEqual(steps.map((x) => x.type), ['drill', 'table']);
  assert.ok(steps[0].items.every((i) => i.tags.length === 3 && i.explain));
  const table = steps[1].table;
  assert.equal(table.blocks.length, 3);
  assert.deepEqual(table.blocks[0].answers[0], ['er', 'en', 'em', 'en']);
  assert.deepEqual(tablesOnly.build(G.defaults).map((x) => x.type), ['table']);
  assert.equal(start.build({ ...G.defaults, hints: false }, rnd)[0].hideTags, true);
});

test('kein only where the frame takes it, jeder never pointing at one thing, no definite article on qualities', () => {
  const rnd = mulberry32(7);
  for (let i = 0; i < 200; i++) {
    for (const g of G.GENDERS) {
      for (const c of G.CASES) {
        const mixed = G.buildItem('mixed', g, c, rnd);
        const frame = G.FRAMES[c].find((f) => f.t === mixed.frame);
        if (mixed.det === 'kein') assert.ok(frame.kein, text(mixed));
        const weak = G.buildItem('weak', g, c, rnd);
        if (weak.det === 'jed') assert.ok(!G.FRAMES[c].find((f) => f.t === weak.frame).no?.includes('jed'), text(weak));
      }
    }
  }
  for (const g of G.GENDERS) assert.ok(!G.nounPool('weak', g, 'builtin').some((n) => n.cat === 'quality'));
});


test('comparative and superlative: the whole adjective from its basic form, the superlative only after der or a possessive', () => {
  const rnd = mulberry32(13);
  for (let i = 0; i < 40; i++) {
    for (const g of G.GENDERS) for (const c of G.CASES) {
      for (const v of G.VARIANTS) {
        const comp = G.buildItem(v, g, c, rnd, [], 'builtin', 'comp');
        const adj = gaps(comp).find((x) => x.slot === 'adj');
        assert.equal(adj.prefix, '');
        // Lower-cased: a sentence can start with the adjective ("Kälteres Wetter …").
        assert.equal(adj.placeholder.toLowerCase(), comp.adj);
        assert.equal(adj.answer.toLowerCase(), lexicon.degreeStems(comp.adj, 'comp')[0] + G.ADJ_ENDINGS[v][g][G.CASES.indexOf(c)]);
      }
      for (const v of ['weak', 'mixed']) {
        const sup = G.buildItem(v, g, c, rnd, [], 'builtin', 'sup');
        assert.ok(sup.det === 'd' || ['mein', 'dein', 'sein', 'ihr', 'unser'].includes(sup.det), text(sup));
      }
    }
  }
  assert.throws(() => G.buildItem('strong', 'm', 'nom', rnd, [], 'builtin', 'sup'));
  assert.equal(gaps(G.buildItem('weak', 'm', 'dat', () => 0.5, [], 'builtin', 'sup')).find((x) => x.slot === 'adj').answer.slice(-2), 'en');
});

test('degree rounds: degrees rotate, superlative-only rounds skip the strong endings, the forms table comes first', () => {
  const rnd = mulberry32(17);
  const both = G.buildRound({ mode: 'full', degrees: ['comp', 'sup'] }, rnd);
  assert.equal(both.length, 48);
  assert.ok(both.filter((i) => i.variant === 'strong').every((i) => i.degree === 'comp'));
  assert.ok(both.some((i) => i.degree === 'sup'));
  const sup = G.buildRound({ mode: 'quick', degrees: ['sup'] }, rnd);
  assert.deepEqual([...new Set(sup.map((i) => i.variant))].sort(), ['mixed', 'weak']);
  const steps = G.sessions[0].build({ ...G.defaults, degrees: ['pos', 'comp'] }, rnd);
  assert.deepEqual(steps.map((s) => s.type), ['table', 'drill', 'table']);
  const block = steps[0].table.blocks[0];
  block.rows.forEach((a, r) => {
    assert.deepEqual(block.answers[0][r], lexicon.degreeStems(a, 'comp'));
    assert.match(block.answers[1][r][0], /^am \S+en$/);
  });
  assert.equal(lexicon.degreeStems('gut', 'sup')[0], 'best');
});

test('participles: every cell has a noun, the answer is the participle with the ending, no frame clashes', () => {
  const rnd = mulberry32(23);
  for (const d of ['p1', 'p2']) for (const v of G.VARIANTS) for (const g of G.GENDERS) for (const c of G.CASES) {
    assert.ok(G.nounPool(v, g, 'builtin', c, d).length, `${d} ${v}/${g}/${c} has no noun`);
    for (let i = 0; i < 20; i++) {
      const item = G.buildItem(v, g, c, rnd, [], 'builtin', d);
      const p = G.PARTICIPLES.find((x) => x.form === d && x.inf === item.adj && !x.clash?.test(item.frame));
      assert.ok(p, `${item.adj} in "${item.frame}"`);
      const adj = gaps(item).find((x) => x.slot === 'adj');
      assert.equal(adj.answer.toLowerCase(), p.stems[0] + G.ADJ_ENDINGS[v][g][G.CASES.indexOf(c)]);
      assert.equal(adj.placeholder, p.inf);
      if (item.ext) assert.ok(text(item).toLowerCase().includes(`${item.ext} ${adj.answer}`.toLowerCase()), text(item));
    }
  }
  const sleeping = G.buildItem('weak', 'm', 'nom', () => 0, [], 'builtin', 'p1');
  assert.match(G.explain(sleeping), /Partizip I: the infinitive \+ d/);
});

test('participle rounds: the participles table comes first, with both participles', () => {
  const steps = G.sessions[0].build({ ...G.defaults, degrees: ['p1', 'p2'] }, mulberry32(5));
  assert.deepEqual(steps.map((s) => s.label), ['Partizipien', 'Sentences', 'Endings table']);
  const block = steps[0].table.blocks[0];
  assert.ok(block.rows.length > 0);
  const r = block.rows.indexOf('verletzen');
  if (r >= 0) assert.deepEqual([block.answers[0][r], block.answers[1][r]], [['verletzend'], ['verletzt']]);
  assert.match(steps[1].hint, /Partizip/);
});

test('nominalised adjectives: people only, the adjective ending on a capitalized stem, no neuter or strong singular', () => {
  const rnd = mulberry32(71);
  for (const v of G.VARIANTS) for (const g of ['m', 'f', 'pl']) for (const c of G.CASES) {
    if (v === 'strong' && (g !== 'pl' || c === 'gen')) {
      assert.throws(() => G.buildItem(v, g, c, rnd, [], 'builtin', 'nom'));
      continue;
    }
    for (let i = 0; i < 10; i++) {
      const it = G.buildItem(v, g, c, rnd, [], 'builtin', 'nom');
      const adj = gaps(it).find((x) => x.slot === 'adj');
      assert.match(adj.prefix, /^[A-ZÄÖÜ]/);
      assert.equal(adj.answer, G.ADJ_ENDINGS[v][g][G.CASES.indexOf(c)]);
      assert.ok(it.prompt.text);
    }
  }
  const round = G.buildRound({ mode: 'quick', degrees: ['nom'] }, rnd);
  assert.ok(round.length >= 10 && round.every((i) => i.gender !== 'n'));
  const mixed = G.buildRound({ mode: 'full', degrees: ['pos', 'nom'] }, rnd);
  assert.equal(mixed.length, 48);
});

// A deck card for a person in m/f with the same word for both: "Verwandte, die Verwandte".
const nominalCard = (word, fields) => ankiNote(`${word}, die ${word}`, { pos: 'n m/f', ...fields });
// The weak masculine nominative 'nom' items of n draws.
const nomItems = (n, rnd) => Array.from({ length: n }, () => G.buildItem('weak', 'm', 'nom', rnd, [], 'anki', 'nom'));

test('nominalised adjectives from the deck: same word for both genders, with its card, not der Vorfahre / die Vorfahrin', (t) => {
  t.after(() => V.useNotes([]));
  const notes = [nominalCard('Verwandte'), ankiNote('Vorfahre, die Vorfahrin', { pos: 'n m/f' }), ankiNote('Erwachsene, die Erwachsene, Erwachsenen', { pos: 'n m/f' })];
  V.useNotes(notes);
  assert.deepEqual(V.nominals.map((x) => x.stem), ['Verwandt', 'Erwachsen']);
  assert.deepEqual(V.nominals.map((x) => x.note), [notes[0], notes[2]]);
  // Two cards for one stem: one entry, with the hardest card.
  const hard = nominalCard('Verwandte', { id: 'hard', lapses: 3 });
  V.useNotes([nominalCard('Verwandte', { id: 'easy' }), hard]);
  assert.deepEqual(V.nominals, [{ stem: 'Verwandt', note: hard }]);
});

test('nominalised adjectives from the deck name their card, the built-in ones join where few are learnt', (t) => {
  isolateStorage(t);
  t.after(() => V.useNotes([]));
  const notes = [nominalCard('Verwandte'), nominalCard('Abgeordnete')];
  V.useNotes(notes);
  const byStem = { Verwandt: [notes[0]], Abgeordnet: [notes[1]] };
  const rnd = mulberry32(73);
  const items = [...G.buildRound({ mode: 'full', vocab: 'anki', degrees: ['nom'] }, rnd), ...nomItems(100, rnd)];
  // Verwandt is a built-in one too: always the deck's.
  for (const it of items) assert.deepEqual(it.notes, byStem[it.noun] || [], it.noun);
  assert.ok(items.some((it) => it.noun === 'Abgeordnet') && items.some((it) => it.noun === 'Verwandt'));
  assert.ok(items.some((it) => !it.notes.length), 'no built-in nominalised adjective');
  for (const it of G.buildRound({ mode: 'full', vocab: 'builtin', degrees: ['nom'] }, rnd)) assert.deepEqual(it.notes, []);
});

test('nominalised adjectives from the deck: the due and hard ones most often, less right after they were shown', (t) => {
  isolateStorage(t);
  t.after(() => V.useNotes([]));
  const hard = nominalCard('Abgeordnete', { lapses: 3 });
  V.useNotes([hard, nominalCard('Vorgesetzte'), nominalCard('Gefangene', { dueIn: 60 })]);
  const counts = (seed) => {
    const count = { Abgeordnet: 0, Vorgesetzt: 0, Gefangen: 0 };
    for (const it of nomItems(300, mulberry32(seed))) if (it.noun in count) count[it.noun]++;
    return count;
  };
  const before = counts(74);
  // Among three deck words one gets at most twice its even share of their picks (vocab's MAX_SHARE).
  assert.ok(before.Abgeordnet > before.Vorgesetzt && before.Abgeordnet > 10 * before.Gefangen, JSON.stringify(before));
  V.markShown([hard]);
  const after = counts(74);
  assert.ok(after.Abgeordnet < 0.6 * before.Abgeordnet && after.Abgeordnet < after.Vorgesetzt, JSON.stringify(after));
});

test('nominalised adjectives: from eight learnt ones the built-in ones drop out', (t) => {
  isolateStorage(t);
  t.after(() => V.useNotes([]));
  V.useNotes(['Abgeordnete', 'Vorgesetzte', 'Gefangene', 'Geliebte', 'Obdachlose', 'Tote', 'Kranke', 'Jugendliche'].map((w) => nominalCard(w)));
  for (const it of nomItems(100, mulberry32(75))) assert.equal(it.notes.length, 1, it.noun);
});

test('a full round of nominalised adjectives has no repeated cells', () => {
  const round = G.buildRound({ mode: 'full', degrees: ['nom'] }, mulberry32(72));
  const cells = round.map((i) => `${i.variant} ${i.gender} ${i.case}`);
  assert.equal(new Set(cells).size, cells.length);
});
