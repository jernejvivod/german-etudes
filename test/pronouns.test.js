'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/topics/pronouns.js');
const V = require('../src/core/vocab.js');
const { gaps, text, grade, isCorrectGap } = require('../src/core/cloze.js');
const { mulberry32, findItem } = require('./helpers.js');

const build = (kind, sub, rnd, settings = {}) => P.buildItem(kind, sub, settings, rnd);

test('a given person in the frame\'s case, never the subject itself (that would be reflexive)', () => {
  const rnd = mulberry32(1);
  for (let i = 0; i < 400; i++) {
    for (const c of ['acc', 'dat']) {
      const item = build('personal', `given-${c}`, rnd);
      const [gap] = gaps(item);
      const person = Object.values(P.PERSONS).find((p) => p.label === gap.placeholder);
      assert.equal(gap.answer, person[c], text(item));
      assert.doesNotMatch(text(item), /\b(du \S+ dich|du \S+ dir|ich \S+ mich|ich \S+ mir|Kannst du (dich|dir)|Habt ihr euch)\b/, text(item));
    }
  }
});

test('a noun replaced by the pronoun of its gender and case; two pronouns: accusative first', () => {
  const rnd = mulberry32(2);
  const third = { m: ['er', 'ihn', 'ihm'], f: ['sie', 'sie', 'ihr'], n: ['es', 'es', 'ihm'], pl: ['sie', 'sie', 'ihnen'] };
  for (let i = 0; i < 300; i++) {
    for (const [ci, c] of ['nom', 'acc', 'dat'].entries()) {
      const item = build('personal', `noun-${c}`, rnd);
      assert.equal(gaps(item)[0].answer.toLowerCase(), third[item.gender][ci], `${item.prompt.text} → ${text(item)}`);
    }
    const double = build('personal', 'double', rnd);
    const [acc, dat] = gaps(double).map((g) => g.answer);
    assert.ok(['ihn', 'sie', 'es'].includes(acc) && ['ihm', 'ihr', 'ihnen'].includes(dat), text(double));
  }
});

test('reflexive pronouns: accusative when it is the only object, dative next to another object', () => {
  const rnd = mulberry32(3);
  for (let i = 0; i < 300; i++) {
    for (const c of ['acc', 'dat']) {
      const item = build('reflexive', c, rnd);
      const s = text(item);
      if (/^Ich /.test(s)) assert.equal(gaps(item)[0].answer, c === 'acc' ? 'mich' : 'mir', s);
      if (/^Du /.test(s)) assert.equal(gaps(item)[0].answer, c === 'acc' ? 'dich' : 'dir', s);
      if (/^(Er|Sie|Mein|Meine|Der|Die|Das) /.test(s)) assert.equal(gaps(item)[0].answer, 'sich', s);
    }
  }
  assert.ok(P.REFLEXIVE_VERBS.every((e) => e.verb), 'every reflexive verb conjugates');
  const hands = Array.from({ length: 300 }, () => text(build('reflexive', 'dat', rnd))).filter((s) => s.endsWith('die Hände.'));
  assert.ok(hands.includes('Ich wasche mir die Hände.') && hands.includes('Du wäschst dir die Hände.'), hands.join(' | '));
});

test('relative pronouns: gender and number from the noun, case from the clause; denen, dessen, deren', () => {
  const rnd = mulberry32(4);
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    for (const c of ['nom', 'acc', 'dat', 'gen']) {
      const item = build('relative', c, rnd);
      const answer = gaps(item)[0].answer;
      assert.equal(answer, P.RELATIVE[item.gender][['nom', 'acc', 'dat', 'gen'].indexOf(c)], text(item));
      assert.match(text(item), new RegExp(`, (\\S+ )?${answer} `), text(item));
      seen.add(answer);
    }
  }
  assert.deepEqual([...seen].sort(), ['das', 'dem', 'den', 'denen', 'der', 'deren', 'dessen', 'die']);
});

test('rounds mix the chosen kinds; the tables follow the choice', () => {
  const items = P.buildRound({ kinds: ['reflexive', 'relative'], length: 20 }, mulberry32(5));
  assert.equal(items.length, 20);
  assert.deepEqual([...new Set(items.map((i) => i.kind))].sort(), ['reflexive', 'relative']);
  const table = P.tables({ kinds: ['personal', 'relative'] });
  assert.deepEqual(table.blocks.map((b) => b.title), ['Personalpronomen', 'Relativpronomen']);
  assert.deepEqual(table.blocks[0].answers[1].slice(0, 3), ['mir', 'dir', 'ihm']);
  assert.deepEqual(table.blocks[1].answers[3], ['die', 'die', 'denen', 'deren']);
  const steps = P.sessions[0].build(P.defaults, mulberry32(6));
  assert.deepEqual(steps.map((s) => s.type), ['table', 'drill']);
  assert.equal(steps[1].items.length, 10);
});

test('learner nouns: family members take "mein", one-of-a-kind relatives no possessive plural', () => {
  const note = (article, word, english, headings) => ({ id: word, article, word, pos: 'n', english, headings, examples: [], dueIn: 2, lapses: 0, ease: 2500 });
  V.useNotes([
    note('die', 'Tante, Tanten', 'aunt', ['People', 'Social Relationships', 'Family']),
    note('die', 'Mutter, Mütter', 'mother', ['People', 'Social Relationships', 'Family']),
    note('der', 'Gast, Gäste', 'guest', ['People', 'Social Relationships', 'Friendship and Other Social Contacts']),
  ]);
  const [tante, mutter] = V.nouns;
  assert.equal(P.phrase(tante, 'dat', false), 'meiner Tante');
  assert.equal(P.phrase(mutter, 'nom', true), 'die Mütter');
  const rnd = mulberry32(7);
  const mine = Array.from({ length: 40 }, () => build('relative', 'dat', rnd, { vocab: 'anki' }));
  assert.ok(mine.some((i) => ['Tante', 'Mutter', 'Gast'].includes(i.key)));
  V.useNotes([]);
});

test('possessives: the owner picks the word (exact case for Ihr), the noun its ending; standing alone like dieser', () => {
  const rnd = mulberry32(31);
  const stems = { Anna: 'ihr', Lisa: 'ihr', Sophie: 'ihr', Tom: 'sein', Paul: 'sein', Jonas: 'sein' };
  for (let i = 0; i < 400; i++) {
    const item = build('possessive', pick(['owner-acc', 'owner-dat'], rnd), rnd);
    const gap = gaps(item)[0];
    const s = text(item);
    const first = s.split(' ')[0];
    if (stems[first]) assert.ok(gap.answer.startsWith(stems[first]), s);
    if (/^\S+ Sie /.test(s)) assert.match(gap.answer, /^Ihr/, s);
    if (/^Das (Kind|Mädchen) /.test(s)) assert.match(gap.answer, /^sein/, s);
    assert.equal(gap.exact, true);
  }
  const ihr = { answer: 'Ihren', exact: true, prefix: '' };
  assert.ok(isCorrectGap(ihr, 'Ihren') && !isCorrectGap(ihr, 'ihren'));
  assert.deepEqual(P.alonePronoun('mein', 'm', 'nom'), ['meiner']);
  assert.deepEqual(P.alonePronoun('mein', 'n', 'acc'), ['meins', 'meines']);
  assert.deepEqual(P.alonePronoun('euer', 'f', 'dat'), ['eurer']);
  assert.deepEqual(P.alonePronoun('unser', 'n', 'nom'), ['unseres', 'unsers', 'unsres']);
  // No children as owners in grown-up sentences.
  for (let i = 0; i < 300; i++) assert.doesNotMatch(text(build('possessive', 'owner-acc', rnd)), /^(Das Baby|Das Kind|Das Mädchen|Der Junge) /);
  // The table checks the capital too, and the mistakes list shows what was typed.
  assert.equal(P.tables({ kinds: ['possessive'] }).blocks[0].exact, true);
  const cloze = require('../src/core/cloze.js');
  assert.equal(cloze.typed({ answer: 'Ihren', exact: true, prefix: '' }, 'ihren'), 'ihren');
  assert.equal(P.possessive('euer', 'pl', 'acc'), 'eure');
  for (let i = 0; i < 100; i++) {
    const alone = build('possessive', pick(['alone-nom', 'alone-acc', 'alone-dat'], rnd), rnd);
    assert.match(text(alone), /^(Ist|Sind|Ich|Fahren|Fährst) .+[.?]$/, text(alone));
  }
  assert.deepEqual(P.tables({ kinds: ['possessive'] }).blocks.map((b) => b.title), ['Possessivartikel', 'mein, standing alone']);
});

function pick(list, rnd) {
  return list[Math.floor(rnd() * list.length)];
}

test('was, wo(r)-, wer: was after alles / das Beste / a clause, wo(r)- + preposition, preposition + der after a noun', () => {
  const rnd = mulberry32(51);
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    for (const sub of P.SUB_KINDS.wrelative) {
      const it = P.buildItem('wrelative', sub, { vocab: 'builtin' }, rnd);
      const g = gaps(it);
      const t = text(it);
      seen.add(it.sub);
      assert.doesNotMatch(t, /\{|undefined|\s{2}/, t);
      assert.match(t, /^[A-ZÄÖÜ].*[.?]$/, t);
      if (sub === 'was') assert.equal(g[0].answer, 'was');
      if (sub === 'wo') assert.match(g[0].answer, /^wor?(an|auf|für|mit|über|um|von|vor)$/, t);
      if (sub === 'wo-noun') assert.match(g[0].answer, /^(an|auf|für|mit|über|um|von|vor) (der|die|das|den|dem|denen)$/, t);
      if (sub === 'where') assert.equal(g[0].answer, 'wo');
      if (sub === 'wer') assert.deepEqual([g[0].answer.toLowerCase(), g[1].answer].map((a) => a.slice(0, 2)), ['we', 'de']);
    }
  }
  assert.deepEqual([...seen].sort(), ['was', 'wer', 'where', 'wo', 'wo-noun']);
  const both = findItem((r) => P.buildItem('wrelative', 'wer', {}, r), (it) => it.key.startsWith('{W} viel arbeitet'));
  assert.ok(grade(both, ['Wer', '']).every((x) => x.ok) && grade(both, ['wer', 'der']).every((x) => x.ok));
  const persons = findItem((r) => P.buildItem('wrelative', 'wo-noun', {}, r), (it) => /never stands for a person/.test(it.explain));
  assert.doesNotMatch(gaps(persons)[0].answer, /^wo/);
  assert.deepEqual(P.tables({ kinds: ['wrelative'] }).blocks[0].answers[0].slice(0, 2), ['woran', 'worauf']);
});
