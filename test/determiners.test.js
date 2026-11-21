'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/topics/determiners.js');
const { CASES, GENDERS, DET_ENDINGS } = require('../src/core/declension.js');
const { NOUNS } = require('../src/core/lexicon.js');
const { gaps, text, isCorrectGap } = require('../src/core/cloze.js');
const { mulberry32, findItem } = require('./helpers.js');

const ALL = { families: ['der', 'ein'], cases: CASES, length: 10 };
const MASS = NOUNS.filter((n) => n.mass).map((n) => n.lemma);

test('every case × gender × family can be built, also when only that case is chosen', () => {
  const rnd = mulberry32(3);
  for (const family of D.FAMILIES) for (const c of CASES) for (const gender of GENDERS) {
    for (const settings of [ALL, { families: [family], cases: [c] }]) {
      D.buildItem({ case: c, gender, family }, settings, rnd);
    }
  }
});

test('generated sentences are clean and use the table endings', () => {
  const rnd = mulberry32(42);
  for (let i = 0; i < 150; i++) {
    for (const family of D.FAMILIES) for (const c of CASES) for (const gender of GENDERS) {
      const item = D.buildItem({ case: c, gender, family }, ALL, rnd);
      const s = text(item);
      assert.doesNotMatch(s, /[{}|]|undefined|null|  /, s);
      assert.match(s, /^[A-ZÄÖÜ].*[.?]$/, s);
      assert.equal(gaps(item).length, item.parts.length);
      assert.equal(new Set(item.nouns).size, item.nouns.length, `noun repeated: ${s}`);
      item.parts.forEach((part, k) => {
        if (['ein', 'jed'].includes(part.stem)) assert.ok(!MASS.includes(item.nouns[k]), `${part.stem}- with a mass noun: ${s}`);
        if (part.case === 'gen') assert.notEqual(part.stem, 'kein', `kein in the genitive: ${s}`);
      });
      assert.ok(item.explain.length > 10 && !/undefined/.test(item.explain), item.explain);
    }
  }
});

test('ein-words have no ending in Nom m and Nom/Akk n, der-words always do', () => {
  for (const g of GENDERS) CASES.forEach((c, ci) => {
    const bare = (g === 'm' && c === 'nom') || (g === 'n' && ci < 2);
    assert.equal(DET_ENDINGS.ein[g][ci] === '', bare, `${g} ${c}`);
    assert.notEqual(DET_ENDINGS.dies[g][ci], '');
  });
  const mein = findItem((rnd) => D.buildItem({ case: 'nom', gender: 'm', family: 'ein' }, ALL, rnd), (i) => /\bmein \w/i.test(text(i)));
  assert.match(mein.explain, /no ending/);
  const dieses = findItem((rnd) => D.buildItem({ case: 'nom', gender: 'n', family: 'der' }, ALL, rnd), (i) => /^Dieses /.test(text(i)));
  assert.match(dieses.explain, /dieses — like das \(Nom, neutrum, -as → -es\)/);
});

test('euer is a whole-word gap that drops its e before an ending', () => {
  const build = (c, gender) => (rnd) => D.buildItem({ case: c, gender, family: 'ein' }, ALL, rnd);
  const accF = (i) => gaps(i).find((g, k) => i.parts[k].case === 'acc' && i.parts[k].gender === 'f' && i.parts[k].stem === 'euer');
  const eure = findItem(build('acc', 'f'), accF);
  const gap = accF(eure);
  assert.equal(gap.answer.toLowerCase(), 'eure');
  assert.ok(isCorrectGap(gap, 'eure'));
  assert.ok(isCorrectGap(gap, '-e'));
  assert.equal(gap.placeholder.toLowerCase(), 'euer…');
  assert.match(eure.explain, /euer becomes eur- before an ending/);
  const bare = findItem(build('nom', 'm'), (i) => gaps(i).some((g, k) => i.parts[k].stem === 'euer' && g.answer.toLowerCase() === 'euer'));
  assert.ok(isCorrectGap(gaps(bare).find((g, k) => bare.parts[k].stem === 'euer'), ''));
});

test('welcher only in its question frames', () => {
  const rnd = mulberry32(5);
  for (let i = 0; i < 2000; i++) {
    const item = D.buildItem({ case: 'acc', gender: 'm', family: 'der' }, ALL, rnd);
    const s = text(item);
    if (/welch/i.test(s)) assert.match(s, /^(Welch|Mit welch)\w+ .*\?$/, s);
  }
});

test('rounds cover every cell before repeating', () => {
  const items = D.buildRound({ ...ALL, length: 32 }, mulberry32(9));
  const cells = new Set(items.map((i) => `${i.target.family}/${i.target.case}/${i.target.gender}`));
  assert.equal(cells.size, 32);
});

test('session: sentences, then the ending tables of the chosen families', () => {
  const [start, tableOnly] = D.sessions;
  const steps = start.build(D.defaults, mulberry32(1));
  assert.deepEqual(steps.map((s) => s.type), ['drill', 'table']);
  assert.equal(steps[0].hideTags, true);
  assert.deepEqual(steps[1].table.blocks.map((b) => b.title), ['der-words', 'ein-words']);
  assert.deepEqual(steps[1].table.blocks[1].answers[0], ['', 'en', 'em', 'es']);
  assert.equal(tableOnly.build({ ...D.defaults, families: ['ein'] })[0].table.blocks.length, 1);
});

test('kein only in one-gap sentences, jeder never as an object', () => {
  const rnd = mulberry32(11);
  for (let i = 0; i < 400; i++) {
    const item = D.buildItem({ case: 'dat', gender: 'f', family: 'ein' }, ALL, rnd);
    if (item.parts.length > 1) assert.ok(!item.parts.some((p) => p.stem === 'kein'), text(item));
    const der = D.buildItem({ case: 'acc', gender: 'm', family: 'der' }, ALL, rnd);
    assert.ok(!der.parts.some((p) => p.stem === 'jed' && p.case === 'acc'), text(der));
  }
});
