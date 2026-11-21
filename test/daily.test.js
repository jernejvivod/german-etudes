'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/core/daily.js');
const store = require('../src/core/store.js');
const { mulberry32, fakeStorage } = require('./helpers.js');

// Each test starts with an empty stand-in storage; nothing reaches a real one.
function fresh() {
  const storage = fakeStorage();
  store.use(storage);
  return storage;
}
test.afterEach(() => store.use(null));

const at = (day, hour, minute = 0) => new Date(2026, 10, day, hour, minute).getTime();

test('a day starts at 4:00', () => {
  assert.equal(D.dayOf(at(21, 3, 59)), '2026-11-20');
  assert.equal(D.dayOf(at(21, 4)), '2026-11-21');
  assert.equal(D.dayOf(at(21, 23, 59)), '2026-11-21');
  assert.equal(D.dayOf(new Date(2027, 0, 1, 2).getTime()), '2026-12-31');
});

test('shares: equal, the remainder to the first ones, summing to n', () => {
  assert.deepEqual(D.shares(['a', 'b', 'c'], 10), [4, 3, 3]);
  assert.deepEqual(D.shares(['a', 'b'], 10), [5, 5]);
  assert.deepEqual(D.shares(['a', 'b', 'c', 'd'], 3), [1, 1, 1, 0]);
  for (let k = 1; k <= 12; k++) {
    for (const { value } of D.LENGTHS) {
      const s = D.shares(Array.from({ length: k }, (_, i) => i), value);
      assert.equal(s.reduce((a, b) => a + b, 0), value);
      assert.ok(Math.max(...s) - Math.min(...s) <= 1);
    }
  }
});

test('shortWarning: when a topic gets fewer than 2, the length that gives each 2', () => {
  assert.equal(D.shortWarning(3, 10), null);
  assert.equal(D.shortWarning(5, 10), null);
  assert.equal(D.shortWarning(0, 10), null);
  assert.equal(D.shortWarning(6, 10), 'Short gives some topics only 1 sentence — Normal gives each at least 2.');
  assert.equal(D.shortWarning(12, 10), 'Short gives some topics no sentence — Long gives each at least 2.');
  assert.equal(D.shortWarning(11, 20), 'Normal gives some topics only 1 sentence — Long gives each at least 2.');
  assert.equal(D.shortWarning(16, 30), 'Long gives some topics only 1 sentence — mark fewer topics learnt for at least 2 each.');
});

test('interleave keeps every item and, where possible, no two neighbours from one group', () => {
  const rnd = mulberry32(7);
  for (let run = 0; run < 500; run++) {
    const k = 1 + Math.floor(rnd() * 5);
    const groups = Array.from({ length: k }, (_, g) => Array.from({ length: Math.floor(rnd() * 8) }, (_, i) => `${g}:${i}`));
    const out = D.interleave(groups, rnd);
    const n = groups.flat().length;
    assert.deepEqual([...out].sort(), groups.flat().sort());
    // Each group keeps its own order.
    for (const g of groups) assert.deepEqual(out.filter((x) => g.includes(x)), g);
    const max = Math.max(0, ...groups.map((g) => g.length));
    if (max <= Math.ceil(n / 2)) {
      for (let i = 1; i < out.length; i++) assert.notEqual(out[i].split(':')[0], out[i - 1].split(':')[0], JSON.stringify(groups));
    }
  }
  assert.deepEqual(D.interleave([[1, 2], [3, 4]], () => 0).length, 4);
});

test('marks: set, keep the first day on a new scope, remove; garbage reads as none', () => {
  const storage = fresh();
  assert.deepEqual(D.marks(), {});
  D.setMark('passive', 'sentences', { tenses: ['praes'] }, 1000);
  D.setMark('passive', 'table', { kinds: ['werden'] }, 2000);
  D.setMark('passive', 'sentences', { tenses: ['praes', 'praet'] }, 3000);
  assert.deepEqual(D.markOf('passive', 'sentences'), { settings: { tenses: ['praes', 'praet'] }, since: 1000 });
  assert.deepEqual(JSON.parse(storage.data.get('etudes-learnt')), {
    passive: { sentences: { settings: { tenses: ['praes', 'praet'] }, since: 1000 }, table: { settings: { kinds: ['werden'] }, since: 2000 } },
  });
  D.setMark('passive', 'sentences', null);
  assert.equal(D.markOf('passive', 'sentences'), null);
  D.setMark('passive', 'table', null);
  assert.deepEqual(JSON.parse(storage.data.get('etudes-learnt')), {});

  for (const junk of ['[1]', '"x"', '{"a":3,"b":{"sentences":{"settings":1,"since":2}},"c":{"sentences":{"settings":{},"since":"x"}}}', '{bad']) {
    storage.data.set('etudes-learnt', junk);
    store.use(storage);
    assert.deepEqual(D.marks(), {}, junk);
  }
  storage.data.set('etudes-learnt', '{"a":{"sentences":{"settings":{},"since":5},"other":1}}');
  store.use(storage);
  assert.deepEqual(D.marks(), { a: { sentences: { settings: {}, since: 5 } } });
});

test('the log: seen, done and extra by kind; done counts until the next 4:00; garbage reads as none', () => {
  const storage = fresh();
  assert.deepEqual(D.log('sentences'), { done: null, seen: {}, extra: {} });
  D.noteSeen('sentences', 'passive', at(20, 22));
  D.noteDone('sentences', ['passive'], at(20, 23));
  D.noteDone('table', [], at(20, 23));
  assert.deepEqual(D.log('sentences'), { done: '2026-11-20', seen: { passive: at(20, 22) }, extra: { passive: at(20, 23) } });
  assert.deepEqual(Object.keys(JSON.parse(storage.data.get('etudes-daily'))), ['sentences', 'table']);
  assert.ok(D.doneToday('sentences', at(21, 3, 59)));
  assert.ok(!D.doneToday('sentences', at(21, 4)));

  storage.data.set('etudes-daily', '{"sentences":{"done":5,"seen":[1],"extra":{"a":"x","b":7}}}');
  store.use(storage);
  assert.deepEqual(D.log('sentences'), { done: null, seen: {}, extra: { b: 7 } });
  storage.data.set('etudes-daily', 'null');
  store.use(storage);
  assert.deepEqual(D.log('sentences'), { done: null, seen: {}, extra: {} });
});

test('byLeastRecent: earliest day seen first (never first of all), then oldest extra, then the registry', () => {
  fresh();
  const topics = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const ids = () => D.byLeastRecent('sentences', topics).map((t) => t.id);
  assert.deepEqual(ids(), ['a', 'b', 'c', 'd']);
  D.noteSeen('sentences', 'a', at(20, 10));
  D.noteSeen('sentences', 'b', at(19, 10));
  D.noteSeen('sentences', 'c', at(20, 9)); // the same day as a
  assert.deepEqual(ids(), ['d', 'b', 'a', 'c']);
  D.noteDone('sentences', ['a'], at(20, 11));
  assert.deepEqual(ids(), ['d', 'b', 'c', 'a']);

  // Three reviews of 10 over three topics: the 4th sentence goes to each in turn.
  fresh();
  const three = topics.slice(0, 3);
  const extras = [];
  for (let day = 1; day <= 3; day++) {
    const order = D.byLeastRecent('sentences', three).map((t) => t.id);
    const counts = D.shares(order, 10);
    for (const id of order) D.noteSeen('sentences', id, at(day, 10));
    const extra = order.filter((_, i) => counts[i] > Math.floor(10 / 3));
    D.noteDone('sentences', extra, at(day, 11));
    extras.push(...extra);
  }
  assert.deepEqual(extras, ['a', 'b', 'c']);
});

// ---------- The Daily review ----------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A topic as the registry has them, with a sentence generator that names its items.
function stub(id, extra = {}) {
  const t = {
    id,
    title: id.toUpperCase(),
    defaults: { parts: ['a', 'b'], hints: false, length: 10 },
    options: [
      { key: 'parts', label: 'Parts', type: 'checkboxes', min: 1, choices: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
      { key: 'hints', label: 'Hints', type: 'toggle', text: 'Hints' },
      { key: 'length', label: 'Round', type: 'radio', round: true, choices: [{ value: 10, label: '10' }] },
    ],
    asked: [],
    sentences(settings, n) {
      t.asked.push({ settings, n });
      return {
        type: 'drill', label: 'Sentences', hint: `${id} hint`, hideTags: !settings.hints,
        items: Array.from({ length: n }, (_, i) => ({ tokens: ['x'], tags: [{ text: id, cls: 'plain' }], explain: '', notes: [{ id: `${id}${i}` }] })),
      };
    },
    ...extra,
  };
  return t;
}

test('the Daily review with nothing learnt explains how to mark a topic', async () => {
  fresh();
  const review = D.reviewTopic([stub('a'), stub('b')]);
  assert.equal(await review.prepare(), null);
  assert.equal(review.validate(review.defaults), 'No topic is marked learnt yet. Open a topic, choose the parts you know and turn on Sentences learnt.');
  assert.deepEqual(review.listing(review.defaults), []);
  assert.equal(review.learnt().length, 0);
  assert.equal(review.kind, 'sentences');
});

test('the Daily review loads each loader once, in turn, and leaves out the topics it cannot use', async () => {
  fresh();
  const events = [];
  let shared = 0;
  const vocabLoad = async () => {
    shared++;
    events.push('vocab start');
    await sleep(5);
    events.push('vocab end');
  };
  const deckLoad = async () => {
    events.push('deck start');
    await sleep(1);
    events.push('deck end');
    return 'Anki is not there.';
  };
  const topics = [
    stub('a', { prepare: vocabLoad }),
    stub('b', { prepare: vocabLoad }),
    stub('c', { prepare: deckLoad }),
    stub('d'),
    stub('e', { validate: (s) => (s.hints ? 'No hints here.' : null) }),
    stub('f', { sentences: undefined }),
  ];
  D.setMark('a', 'sentences', { parts: ['a'], hints: false }, at(3, 10));
  D.setMark('b', 'sentences', { parts: ['a', 'b'] }, at(4, 10));
  D.setMark('c', 'sentences', { parts: ['a'] }, at(5, 10));
  D.setMark('d', 'sentences', { parts: ['gone'] }, at(6, 10));
  D.setMark('e', 'sentences', { hints: true }, at(7, 10));
  D.setMark('f', 'sentences', {}, at(7, 10));
  D.setMark('gone', 'sentences', {}, at(7, 10));
  const review = D.reviewTopic(topics);
  assert.deepEqual(review.learnt().map((t) => t.id), ['a', 'b', 'c', 'd', 'e']);
  await review.prepare();
  assert.equal(shared, 1);
  assert.deepEqual(events, ['vocab start', 'vocab end', 'deck start', 'deck end']);
  assert.equal(review.validate(review.defaults), null);
  assert.deepEqual(review.listing(review.defaults), [
    { title: 'A', text: 'Alpha · learnt 3 Nov' },
    { title: 'B', text: 'all · learnt 4 Nov' },
  ]);
  assert.equal(review.intro({ length: 10 }), 'Every learnt topic comes up today, in equal shares, mixed. '
    + 'C: Anki is not there. '
    + 'D: its learnt settings no longer fit — open it and save them again. '
    + 'E: its learnt settings no longer fit — open it and save them again.');

  // Every learnt topic left out: Start stays off.
  fresh();
  D.setMark('c', 'sentences', { parts: ['a'] });
  await review.prepare();
  assert.equal(review.validate(review.defaults), 'None of the learnt topics can be used — see above.');
});

test('the Daily review: shares per topic, mixed, each item with its topic, hint and tags; it logs seen and done', async () => {
  fresh();
  const vocabOption = { key: 'vocab', label: 'Words', type: 'radio', choices: [{ value: 'anki', label: 'Anki' }, { value: 'builtin', label: 'Built-in' }] };
  const a = stub('a');
  const b = stub('b', { defaults: { parts: ['a'], hints: false, length: 10, vocab: 'builtin' } });
  b.options = [...b.options, vocabOption];
  const c = stub('c');
  D.setMark('a', 'sentences', { parts: ['a', 'b'], hints: true }, at(1, 10));
  D.setMark('b', 'sentences', { parts: ['b'], hints: false, vocab: 'builtin' }, at(1, 10));
  D.setMark('c', 'sentences', { parts: ['a'], hints: false }, at(1, 10));
  let now = at(21, 12);
  const review = D.reviewTopic([a, b, c], () => now);
  await review.prepare();
  assert.match(review.intro({ length: 10 }), /^Every learnt topic comes up today, in equal shares, mixed\.$/);

  const [step, ...more] = review.sessions[0].build({ length: 10 }, mulberry32(3));
  assert.equal(more.length, 0);
  assert.equal(step.type, 'drill');
  assert.equal(step.label, 'Daily review');
  assert.equal(step.items.length, 10);
  assert.deepEqual([a, b, c].map((t) => t.asked[0].n), [4, 3, 3]);
  assert.deepEqual(b.asked[0].settings, { parts: ['b'], hints: false, length: 3, vocab: 'anki' }, 'My Anki words, the scope, the share');
  assert.deepEqual(a.asked[0].settings, { parts: ['a', 'b'], hints: true, length: 4 });
  for (let i = 1; i < step.items.length; i++) assert.notEqual(step.items[i].topic, step.items[i - 1].topic);
  for (const item of step.items) {
    assert.equal(item.source, item.topic.toUpperCase());
    assert.equal(item.hint, `${item.topic} hint`);
    assert.equal(item.hideTags, item.topic !== 'a');
    assert.equal(item.tags[0].text, item.topic);
    assert.match(item.notes[0].id, new RegExp(`^${item.topic}\\d$`));
  }

  assert.ok(!D.doneToday('sentences', now));
  step.onChecked(step.items.find((i) => i.topic === 'b'));
  assert.deepEqual(D.log('sentences').seen, { b: now });
  now = at(21, 13);
  step.onDone();
  assert.deepEqual(D.log('sentences'), { done: '2026-11-21', seen: { b: at(21, 12) }, extra: { a: now } });
  assert.ok(D.doneToday('sentences', now));

  // The next review: b was seen today, so a and c come first; a had the extra, so c gets it.
  for (const t of [a, b, c]) t.asked.length = 0;
  review.sessions[0].build({ length: 10 }, mulberry32(4))[0].onDone();
  assert.deepEqual([a, b, c].map((t) => t.asked[0].n), [3, 3, 4]);
  assert.deepEqual(Object.keys(D.log('sentences').extra).sort(), ['a', 'c']);
});

test('the Daily review is shorter where a topic gives fewer sentences', async () => {
  fresh();
  const few = stub('few');
  const own = few.sentences;
  few.sentences = (s, n, rnd) => ({ ...own(s, n, rnd), items: own(s, n, rnd).items.slice(0, 1) });
  D.setMark('a', 'sentences', {});
  D.setMark('few', 'sentences', {});
  const review = D.reviewTopic([stub('a'), few]);
  await review.prepare();
  const [step] = review.sessions[0].build({ length: 10 }, mulberry32(1));
  assert.equal(step.items.length, 6);
});
