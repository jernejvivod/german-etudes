'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/topics/prepositions.js');
const { gaps, text, isCorrectGap } = require('../src/core/cloze.js');
const { mulberry32, findItem } = require('./helpers.js');

const W = '[\\wäöüß]+';
const ON = { adjectives: true };
const OFF = { adjectives: false };

test('every frame noun exists and fits the frame', () => {
  for (const f of P.FRAMES) {
    for (const key of f.nouns) {
      const noun = P.NOUNS[key];
      assert.ok(noun, `${f.prep}: unknown noun ${key}`);
      if (noun.plOnly) assert.ok(f.plural || f.dets.includes('none'), `${key} is plural-only but ${f.prep} frame is singular`);
      for (const withAdj of [true, false]) {
        const adj = withAdj && f.adj !== false;
        assert.ok(P.detChoices(f, noun, !!noun.plOnly, adj).length > 0, `${f.prep} ${key}: no determiner (adjective ${adj})`);
      }
      if (f.case === 'gen' && noun.g !== 'f' && !noun.plOnly) assert.ok(noun.gen?.startsWith(noun.nom), `${key}: genitive`);
    }
    if (f.two) assert.ok(f.nouns.length > 1);
  }
});

test('every group and Wechsel side builds clean sentences', () => {
  const rnd = mulberry32(5);
  const sides = [['akk'], ['dat'], ['gen'], ['fixed'], ['wechsel', 'acc'], ['wechsel', 'dat']];
  for (let i = 0; i < 400; i++) {
    for (const [group, caseKey] of sides) {
      for (const settings of [ON, OFF]) {
        const item = P.buildItem(group, caseKey, settings, rnd);
        const s = text(item);
        assert.doesNotMatch(s, /[{}]|undefined|null|  /, s);
        assert.match(s, /^[A-ZÄÖÜ].*[.?]$/, s);
        if (caseKey) assert.equal(item.case, caseKey);
        assert.ok(gaps(item).some((g) => g.slot === 'det') || item.gender === 'pl', s);
        if (settings === OFF) assert.ok(!gaps(item).some((g) => g.slot === 'adj'), s);
        assert.ok(item.explain.length > 10 && !/undefined/.test(item.explain), item.explain);
        // No two-word gap without a placeholder telling which preposition it is.
        for (const g of gaps(item)) if (!g.prefix) assert.ok(g.placeholder, s);
      }
    }
  }
});

test('contractions are one gap and accept the full form', () => {
  const find = (pred) => findItem((rnd) => P.buildItem('wechsel', null, ON, rnd), pred);
  const im = find((item) => item.prep === 'in' && item.case === 'dat' && ['m', 'n'].includes(item.gender) && gaps(item)[0].answer === 'im');
  const det = gaps(im)[0];
  assert.equal(det.placeholder, 'in + d…');
  assert.ok(isCorrectGap(det, 'im'));
  assert.ok(isCorrectGap(det, 'in  dem'));
  assert.ok(!isCorrectGap(det, 'in den'));
  const ins = find((item) => item.prep === 'in' && item.case === 'acc' && item.gender === 'n' && gaps(item)[0].answer === 'ins');
  assert.ok(isCorrectGap(gaps(ins)[0], 'in das'));
  // Without a contraction the gap still holds preposition + article, so its shape gives nothing away.
  const inDen = find((item) => item.prep === 'in' && item.case === 'acc' && item.gender === 'm' && gaps(item)[0].answer === 'in den');
  assert.deepEqual(gaps(inDen)[0].alts, []);
  const zur = findItem((rnd) => P.buildItem('dat', null, ON, rnd), (item) => item.prep === 'zu' && item.gender === 'f' && !gaps(item)[0].prefix);
  assert.equal(gaps(zur)[0].answer, 'zur');
});

test('known endings', () => {
  const build = (group, caseKey) => (rnd) => P.buildItem(group, caseKey, ON, rnd);
  const durch = findItem(build('akk'), (i) => i.prep === 'durch' && i.noun === 'Park' && gaps(i)[0].prefix === 'd');
  assert.match(text(durch), new RegExp(`durch den ${W}en Park\\.`));
  const mit = findItem(build('dat'), (i) => i.prep === 'mit' && i.noun === 'Freund' && i.gender === 'pl' && gaps(i)[0].slot === 'adj');
  assert.match(text(mit), new RegExp(`mit ${W}en Freunden`));
  assert.equal(gaps(mit).at(-1).answer, 'n');
  const trotz = findItem(build('gen'), (i) => i.noun === 'Regen');
  assert.match(text(trotz), /^Trotz (des|dieses) starken Regens/);
  const kollege = findItem(build('akk'), (i) => i.prep === 'für' && i.noun === 'Kollege' && i.gender === 'm');
  assert.match(text(kollege), /Kollegen\.$/);
  const warten = findItem(build('fixed'), (i) => i.frame.verb === 'warten auf' && i.noun === 'Bus');
  assert.match(text(warten), new RegExp(`auf (den|einen|deinen|meinen|seinen|ihren|unseren|diesen) ${W}en Bus\\.`));
  assert.match(warten.explain, /Wo\?\/Wohin\? rule does not apply/);
  const preise = findItem(build('gen'), (i) => i.noun === 'Preise' && !gaps(i).some((g) => g.slot === 'det' && g.prefix));
  assert.match(text(preise), /^Trotz hoher Preise/);
  const zwischen = findItem((rnd) => P.buildItem('wechsel', 'dat', OFF, rnd), (i) => i.prep === 'zwischen' && /Kollegen|Nachbarn/.test(text(i)));
  assert.match(zwischen.explain, /n-noun/);
});

test('ordinals never follow ein', () => {
  const rnd = mulberry32(8);
  for (let i = 0; i < 3000; i++) {
    const item = P.buildItem('fixed', null, ON, rnd);
    assert.doesNotMatch(text(item), /\bein\w* (nächst|letzt|oberst)/, text(item));
  }
});

test('rounds cycle through the groups, Wechsel on both sides', () => {
  const items = P.buildRound({ ...P.defaults, length: 20 }, mulberry32(2));
  assert.equal(items.length, 20);
  const count = (pred) => items.filter(pred).length;
  for (const g of ['akk', 'dat', 'fixed']) assert.equal(count((i) => i.group === g), 4, g);
  assert.equal(count((i) => i.group === 'wechsel' && i.case === 'acc'), 4);
  assert.equal(count((i) => i.group === 'wechsel' && i.case === 'dat'), 4);
});

test('case table covers the chosen groups, every group when only fixed pairs are chosen', () => {
  const rows = (t) => t.blocks.flatMap((b) => b.rows);
  const dat = P.caseTable({ groups: ['dat', 'fixed'] }, mulberry32(1));
  assert.deepEqual(rows(dat).sort(), [...P.PREPOSITIONS.dat].sort());
  assert.ok(dat.blocks.every((b) => b.answers[0].every((a) => a[0] === 'Dat')));
  const all = P.caseTable({ groups: ['fixed'] }, mulberry32(1));
  assert.equal(rows(all).length, Object.values(P.PREPOSITIONS).flat().length);
});

test('session: case table, then sentences with hidden tags', () => {
  const [start, tableOnly] = P.sessions;
  const steps = start.build(P.defaults, mulberry32(4));
  assert.deepEqual(steps.map((s) => s.type), ['table', 'drill']);
  assert.equal(steps[1].hideTags, true);
  assert.equal(steps[1].items.length, 10);
  assert.deepEqual(tableOnly.build(P.defaults).map((s) => s.type), ['table']);
});

test('da- and wo-words: things become darauf / worauf, people take a pronoun / wen, wem', () => {
  const rnd = mulberry32(21);
  const seen = new Set();
  for (let i = 0; i < 600; i++) {
    const item = P.buildItem('da', null, { vocab: 'builtin' }, rnd);
    const [gap] = gaps(item);
    const answer = gap.answer.toLowerCase();
    const r = /^[aeiouäöü]/.test(item.prep) ? 'r' : '';
    const person = item.tags[2].text === 'Person';
    const asking = item.prompt.label === 'Antwort';
    if (!person) assert.equal(answer, (asking ? 'wo' : 'da') + r + item.prep, text(item));
    else if (asking) assert.equal(answer, `${item.prep} ${item.case === 'acc' ? 'wen' : 'wem'}`, text(item));
    else assert.match(answer, new RegExp(`^${item.prep} (ihn|sie|ihm|ihr|ihnen)$`), text(item));
    assert.notEqual(person && item.gender, 'n', 'no "auf es"');
    assert.ok(item.prompt.text.includes(` ${item.prep} `) || /\b(am|ans|im|ins|zum|zur|vom|beim)\b/.test(item.prompt.text), item.prompt.text);
    assert.match(text(item), /^[A-ZÄÖÜ]/);
    seen.add(`${person}/${asking}`);
  }
  assert.equal(seen.size, 4);
  const dat = P.buildItem('da', null, { vocab: 'builtin' }, () => 0);
  assert.ok(gaps(dat).length === 1);
});
