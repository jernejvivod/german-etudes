'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/core/vocab.js');
const { text, gaps } = require('../src/core/cloze.js');
const { mulberry32, isolateStorage, ankiNote } = require('./helpers.js');

// What the tests mark as shown is kept here, not in the real storage.
const STORAGE = isolateStorage(test);

// Learnt notes as anki.js hands them over.
function note(article, word, english, headings, extra = {}) {
  return { id: word, article, word, pos: 'n', english, headings, examples: [], dueIn: 3, lapses: 0, ease: 2500, ...extra };
}
const FAMILY = ['People', 'Social Relationships', 'Family'];
const CLOTHES = ['People', 'Looks', 'Clothes and Shoes'];
const NOTES = [
  note('der', 'Bruder, Brüder', 'brother', FAMILY),
  note('die', 'Tante, Tanten', 'aunt', FAMILY),
  note('der', 'Neffe', 'nephew', FAMILY),
  note('die', 'Eltern', 'parents', FAMILY, { pos: 'n m-f pl' }),
  note('der', 'Mensch, Menschen', 'man<br>human', ['People', 'Life Cycle']),
  note('der', 'Gast, Gäste', 'guest', ['People', 'Social Relationships', 'Friendship and Other Social Contacts']),
  note('die', 'Freundschaft, Freundschaften', 'friendship', ['People', 'Social Relationships', 'Friendship and Other Social Contacts']),
  note('der', 'Hut, Hüte', 'hat', ['People', 'Looks', 'Accessories']),
  note('die', 'Jacke, Jacken', 'jacket', CLOTHES),
  note('die', 'Mode, Moden', 'fashion', CLOTHES),
  note('das', 'Auto, Autos', 'car', ['Tourism and Travel', 'Private Transport']),
  note('das', 'Taxi, Taxis', 'taxi', ['Tourism and Travel', 'Private Transport']),
  note('die', 'Ampel, Ampeln', 'traffic lights', ['Tourism and Travel', 'Private Transport']),
  note('das', 'Café, Cafés', 'café', ['Restaurants and Cafes', 'Restaurants']),
  note('die', 'Kneipe, Kneipen', 'pub', ['Restaurants and Cafes', 'Restaurants']),
  note('der', 'Montag, Montage', 'Monday', ['Time', 'Days of the Week']),
  note('der', 'Freitag, Freitage', 'Friday', ['Time', 'Days of the Week']),
  note('der', 'Mut', 'courage', ['People', 'Character Traits']),
  note('die', 'Geduld', 'patience', ['People', 'Character Traits']),
  note('der', 'Erwachsene, Erwachsenen', 'adult', ['People', 'Life Cycle'], { pos: 'n m-f' }),
  note('der', 'Freund, die Freundin, Freunde', 'friend', FAMILY),
  note('die', 'Schwester, Schwestern', 'sister', FAMILY, { dueIn: null }),
  note('der', 'Herr, Herren', 'Mr', ['People', 'Personal Information']),
  note('der', 'Bus, Busse', 'bus', ['Tourism and Travel', 'Public Transport', 'Local Public Transport']),
  note('der', 'Parkplatz, Parkplätze', 'car park', ['Tourism and Travel', 'Private Transport']),
  note('das', 'Loch, Löcher', 'hole', CLOTHES),
  note('der', 'Knopf, Knöpfe', 'button', CLOTHES),
  note('der', 'Schmuck', 'jewellery', ['People', 'Looks', 'Accessories']),
  note('das', 'Kino, Kinos', 'cinema', ['Cultural Interests', 'Theatre and Film']),
  note('der', 'Topf, Töpfe', 'pot', ['Accommodation', 'Facilities', 'Housekeeping']),
  note('der', 'Haushalt', 'household', ['Accommodation', 'Facilities', 'Housekeeping']),
  note('der', 'Hund, Hunde', 'dog', ['Nature and the Environment', 'Animals and Plants']),
  note('der', 'Regen', 'rain', ['Nature and the Environment', 'Environment, Weather and Climate']),
  note('das', 'Klima', 'climate', ['Nature and the Environment', 'Environment, Weather and Climate']),
  note('der', 'Apfel, Äpfel', 'apple', ['Nutrition', 'Fruit and Vegetables']),
  note('das', 'Quadrat, Quadrate', 'square', ['Colours and Shapes', 'Shapes']),
  note('der', 'Planet, Planeten', 'planet', ['Space Opera']),
  note('die', 'Mutter, Mütter', 'mother<br>mum', FAMILY),
  note('der', 'Fisch, Fische', 'fish', ['Nutrition', 'Meat, Fish and Dairy Products']),
  note('die', 'Maus, Mäuse', 'mouse', ['Communication and Media', 'Computer and Multimedia']),
  note('die', 'Erkältung, Erkältungen', 'cold', ['Body and Health', 'Illness and Physical Impairments']),
  note('die', 'Tasche, Taschen', 'bag<br>pocket', ['People', 'Looks', 'Accessories']),
  note('die', 'Person, Personen', 'person', ['People', 'Social Relationships', 'Friendship and Other Social Contacts']),
  note('das', 'Mitglied', 'member', ['People', 'Social Relationships', 'Friendship and Other Social Contacts']),
  note('das', 'Baby, Babys', 'baby', ['People', 'Life Cycle']),
  note('die', 'Banane', 'banana', ['Nutrition', 'Fruit and Vegetables']),
  note('die', 'Küche, Küchen', 'kitchen', ['Accommodation', 'Rooms and Living Areas']),
  note('der', 'Lastwagen', 'truck', ['Tourism and Travel', 'Private Transport']),
  note('der', 'Schnee', 'snow', ['Nature and the Environment', 'Environment, Weather and Climate']),
];
V.useNotes(NOTES);
const byLemma = Object.fromEntries(V.nouns.map((n) => [n.lemma, n]));

test('notes that cannot be used are left out, each for its reason', () => {
  const skipped = {
    Freundschaft: 'an idea under a people heading (no gloss rule matches)',
    Mode: 'an idea under a clothes heading',
    Loch: 'not an object',
    Haushalt: 'not an object',
    Ampel: 'no rule for traffic lights',
    Klima: 'weather heading, but not weather',
    Erwachsene: 'declines like an adjective',
    Freund: 'card lists several forms',
    Schwester: 'not learnt yet',
    Parkplatz: '"car park" is no car',
    Quadrat: 'gloss "square" is the shape',
    Planet: 'unknown heading, no gloss rule',
    Erkältung: 'a "cold" outside the weather heading',
    Mitglied: 'only ever a member of something',
  };
  for (const [lemma, reason] of Object.entries(skipped)) assert.ok(!byLemma[lemma], `${lemma} should be skipped: ${reason}`);
  assert.equal(V.nouns.length, NOTES.length - Object.keys(skipped).length);
});

test('learnt nouns get categories from their gloss and heading', () => {
  // Garment parts are things, not something to go out without; jewellery is uncountable.
  assert.deepEqual(byLemma.Knopf.kinds, ['thing']);
  assert.ok(byLemma.Schmuck.mass && byLemma.Schmuck.kinds.includes('wearable'));
  assert.deepEqual(byLemma.Kino.kinds, ['place']);
  assert.deepEqual([byLemma.Hund.cat, byLemma.Regen.cat, byLemma.Apfel.cat], ['animal', 'weather', 'food']);
  assert.ok(byLemma.Regen.mass && !byLemma.Apfel.mass);
  // The heading's kind beats an animal gloss; a bag that is also a "pocket" stays something you carry.
  assert.deepEqual([byLemma.Fisch.kinds, byLemma.Maus.kinds, byLemma.Tasche.kinds], [['food'], ['thing'], ['wearable']]);
  assert.equal(byLemma.Bruder.cat, 'person');
  assert.ok(byLemma.Bruder.family && !byLemma.Gast.family);
  assert.ok(byLemma.Mutter.kinds.includes('person') && byLemma.Mutter.family);
  assert.deepEqual(byLemma.Hut.kinds, ['wearable']);
  assert.equal(byLemma.Hut.cat, 'thing');
  assert.deepEqual(byLemma.Taxi.kinds, ['vehicle']);
  assert.deepEqual(byLemma.Bus.kinds, ['vehicle']);
  assert.deepEqual(byLemma.Café.kinds, ['place']);
  assert.equal(byLemma.Café.cat, null);
  assert.deepEqual(byLemma.Montag.kinds, ['day']);
  assert.ok(byLemma.Mut.mass && byLemma.Mut.cat === 'quality');
  // A kitchen is a room (no "zur Küche"), a lorry a thing but nothing to ride to work, a banana countable without a plural.
  assert.deepEqual([byLemma.Küche.kinds, byLemma.Lastwagen.kinds, byLemma.Lastwagen.cat], [['room'], ['transport'], 'thing']);
  assert.ok(!byLemma.Banane.mass && !byLemma.Banane.pl);
});

test('possessives, plurals and adjectives that fit the person', () => {
  // "unsere Person", "sein Schnee", "unser Bus" sound wrong; "unser Gast", "ihr Baby" don't.
  assert.deepEqual([byLemma.Person, byLemma.Schnee, byLemma.Bus].map((n) => n.own), [false, false, false]);
  assert.deepEqual([byLemma.Gast, byLemma.Baby, byLemma.Bruder].map((n) => n.own), [true, true, true]);
  // One has one mother: "den Müttern", but no "ihre Mütter".
  assert.ok(byLemma.Mutter.onlyOne && byLemma.Mutter.pl);
  assert.ok(byLemma.Baby.adjs.includes('klein') && !byLemma.Baby.adjs.includes('jung'));
});

test('a heading neither list knows shows in the intro', () => {
  assert.ok(V.status({ vocab: 'anki' }).endsWith(' Not sorted yet: nouns under Space Opera.'));
  assert.equal(V.status({ vocab: 'builtin' }), '');
});

test('case forms: genitive, n-nouns, dative plural, plural-only', () => {
  assert.deepEqual(byLemma.Bruder.sg, ['Bruder', 'Bruder', 'Bruder', 'Bruders']);
  assert.deepEqual(byLemma.Bruder.pl, ['Brüder', 'Brüder', 'Brüdern', 'Brüder']);
  assert.deepEqual(byLemma.Hut.sg, ['Hut', 'Hut', 'Hut', 'Huts']);
  assert.deepEqual(byLemma.Hut.genAlts, ['es']);
  assert.deepEqual(byLemma.Mensch.sg, ['Mensch', 'Menschen', 'Menschen', 'Menschen']);
  assert.deepEqual(byLemma.Neffe.sg, ['Neffe', 'Neffen', 'Neffen', 'Neffen']);
  assert.equal(byLemma.Eltern.sg, null);
  assert.deepEqual(byLemma.Herr.sg, ['Herr', 'Herrn', 'Herrn', 'Herrn']);
  assert.equal(byLemma.Bus.sg[3], 'Busses');
  // The -e / -at rule holds for people and animals only: der See, der Staat are no n-nouns.
  assert.ok(!V.isNNoun('See', 'Seen', 'm', false) && V.isNNoun('Junge', 'Jungen', 'm', true));
  assert.equal(byLemma.Eltern.g, 'pl');
});

test('adjectives: the learner nouns where enough fit, built-in ones otherwise', () => {
  const A = require('../src/topics/adjectives.js');
  assert.ok(A.nounPool('weak', 'm', 'anki').every((n) => V.nouns.includes(n)));
  assert.ok(!A.nounPool('weak', 'm', 'builtin').some((n) => V.nouns.includes(n)));
  // Strong feminine needs a mass noun: only Geduld is learnt, so the built-in ones join it.
  const strongF = A.nounPool('strong', 'f', 'anki');
  assert.ok(strongF.includes(byLemma.Geduld) && strongF.some((n) => !V.nouns.includes(n)));
});

test('prepositions: frames take the learner nouns of their kind; family members only with a possessive', () => {
  const P = require('../src/topics/prepositions.js');
  const zu = P.FRAMES.find((f) => f.prep === 'zu' && f.kinds.includes('place'));
  // Three learnt places are too few to carry the frame: the built-in ones join them.
  const places = P.candidates(zu, true, 'anki');
  assert.deepEqual(places.filter((n) => n.note).map((n) => n.lemma).sort(), ['Café', 'Kino', 'Kneipe']);
  assert.ok(places.some((n) => !n.note) && places.length === new Set(places.map((n) => n.lemma)).size);
  assert.deepEqual(P.candidates(zu, true, 'builtin').filter((n) => n.note), []);
  const rnd = mulberry32(3);
  let family = 0;
  for (let i = 0; i < 300; i++) {
    const item = P.buildItem('dat', null, { vocab: 'anki', adjectives: true }, rnd);
    if (!['Bruder', 'Tante', 'Eltern', 'Neffe'].includes(item.noun)) continue;
    family++;
    assert.doesNotMatch(text(item), /\b(zum|zur|dem|der|den) /, text(item));
  }
  assert.ok(family > 10, `only ${family} family items`);
});

test('determiners: rounds use the learner nouns', () => {
  const D = require('../src/topics/determiners.js');
  const round = D.buildRound({ families: ['der', 'ein'], cases: ['nom', 'acc', 'dat', 'gen'], length: 32, vocab: 'anki' }, mulberry32(5));
  const mine = new Set(V.nouns.filter((n) => n.cat).map((n) => n.lemma));
  // Auto and Jacke are built-in nouns too, so they would not show that learner nouns were used.
  assert.ok(round.filter((i) => i.nouns.some((l) => mine.has(l) && !['Auto', 'Jacke'].includes(l))).length > 5);
  for (const item of round) assert.equal(gaps(item).length, item.parts.length);
});

// ---------- What to practise ----------

const card = (id, dueIn, lapses = 0, ease = 2500) => ({ id, dueIn, lapses, ease });
const word = (lemma, note) => ({ lemma, ...(note && { note }) });
const NOW = Date.UTC(2026, 0, 15, 12);
const DAY = 24 * 3600e3;
const near = (a, b, by = 1e-9) => Math.abs(a - b) < by;

// How often pickDue takes each word of the pool: its part of n picks, by lemma.
function shares(pool, options = {}, n = 8000, seed = 31) {
  const rnd = mulberry32(seed);
  const times = Object.fromEntries(pool.map((w) => [w.lemma, 0]));
  for (let i = 0; i < n; i++) times[V.pickDue(pool, rnd, { now: NOW, ...options }).lemma]++;
  return Object.fromEntries(Object.entries(times).map(([lemma, count]) => [lemma, count / n]));
}

// A pool wide enough for the weights alone to decide: 4 words with a lapse (weight 3), 16 plain ones due today (1)
// and 8 due in a month (0.03), 28.24 in all.
const WIDE = [
  ...Array.from({ length: 4 }, (_, i) => word(`hard${i}`, card(`hard${i}`, 0, 1))),
  ...Array.from({ length: 16 }, (_, i) => word(`due${i}`, card(`due${i}`, 0))),
  ...Array.from({ length: 8 }, (_, i) => word(`later${i}`, card(`later${i}`, 30))),
];

test('weight: due cards count most, later ones less and less but never nothing; lapses and a low ease add to it', () => {
  // Today, overdue and relearning (0) count the same; then less day by day — a tenth in a week — down to a floor.
  assert.deepEqual([0, -1, -30].map((dueIn) => V.urgency(dueIn)), [1, 1, 1]);
  assert.ok(near(V.urgency(7), 0.1) && near(V.urgency(2), 0.5, 0.02));
  assert.ok(V.urgency(1) > V.urgency(3) && V.urgency(3) > V.urgency(7) && V.urgency(7) > V.urgency(14));
  assert.equal(V.urgency(14), V.urgency(300));
  assert.ok(V.urgency(300) > 0 && V.urgency(300) < 0.05);
  // What counts as soon can be wider or narrower: the tenth is at its far end.
  assert.ok(near(V.urgency(14, 14), 0.1) && near(V.urgency(3, 3), 0.1) && near(V.urgency(7, 14), V.urgency(3.5)));

  assert.equal(V.difficulty(card(1, 0)), 1);
  assert.deepEqual([1, 2, 3].map((lapses) => V.difficulty(card(1, 0, lapses))), [3, 5, 7]);
  assert.ok(V.difficulty(card(1, 0, 0, 1300)) > 1.9 && V.difficulty(card(1, 0, 0, 3000)) < 1);
  // A card still in its learning steps has no ease yet (0), and nothing counts below Anki's lowest.
  assert.equal(V.difficulty(card(1, 0, 0, 0)), 1);
  assert.equal(V.difficulty(card(1, 0, 0, 100)), V.difficulty(card(1, 0, 0, 1300)));

  assert.ok(near(V.weight(card(1, 7, 1), NOW), 0.3) && near(V.weight(card(1, 14, 1), NOW, 14), 0.3));
  assert.ok(V.weight(card(1, 0, 2, 2000), NOW) > V.weight(card(2, 0, 2), NOW));
  assert.ok(V.weight(card(1, 30), NOW) > 0);
  // Not learnt yet, or no card at all.
  assert.equal(V.weight(card(1, null), NOW), 0);
  assert.equal(V.weight(undefined, NOW), 0);
});

test('pickDue: the deck\'s words are picked by their cards\' weight', () => {
  const got = shares(WIDE);
  for (let i = 0; i < 4; i++) assert.ok(near(got[`hard${i}`], 3 / 28.24, 0.015), JSON.stringify(got));
  for (let i = 0; i < 16; i++) assert.ok(near(got[`due${i}`], 1 / 28.24, 0.01), JSON.stringify(got));
  const later = WIDE.slice(20).reduce((sum, w) => sum + got[w.lemma], 0);
  assert.ok(later > 0 && later < 0.02, String(later));
  // With a month counting as soon, the words due in a month weigh a tenth, not the floor's 0.03.
  const wider = shares(WIDE, { soon: 30 });
  assert.ok(WIDE.slice(20).reduce((sum, w) => sum + wider[w.lemma], 0) > 2.5 * later);
});

test('pickDue: no word gets more than an eighth of the picks — or, in a small pool, twice its even share', () => {
  // Twenty words: the two hard ones due today would take 14 of 22 by weight; the rest still goes by weight.
  const twenty = Array.from({ length: 20 }, (_, i) => word(`w${i}`, card(i, i < 10 ? 0 : 30, i < 2 ? 3 : 0)));
  const big = shares(twenty);
  assert.ok(near(big.w0, 0.125, 0.015) && near(big.w1, 0.125, 0.015), JSON.stringify(big));
  assert.ok(big.w5 > 0.07 && big.w15 < 0.01 && big.w15 > 0, JSON.stringify(big));

  // Five words, one hard and due (7 of 11 by weight): two fifths, the others an even 0.15.
  const five = [word('hard', card(1, 0, 3)), ...['a', 'b', 'c', 'd'].map((l) => word(l, card(l, 0)))];
  const small = shares(five);
  assert.ok(near(small.hard, 0.4, 0.02) && near(small.a, 0.15, 0.02), JSON.stringify(small));

  // A small pool is weighted all the same: two words due today, three due in a month.
  const mixed = shares([word('now1', card(1, 0)), word('now2', card(2, 0)), ...['x', 'y', 'z'].map((l) => word(l, card(l, 30)))]);
  assert.ok(near(mixed.now1, 0.4, 0.02) && near(mixed.now2, 0.4, 0.02) && near(mixed.x, 0.2 / 3, 0.015), JSON.stringify(mixed));
  // Two words: nothing to cap.
  assert.ok(shares([word('now', card(1, 0)), word('later', card(2, 30))]).now > 0.95);
});

test('pickDue: built-in words join a few deck words, which get an eighth of the picks each to share by weight', () => {
  V.forget();
  const a = card('a', 0, 5);
  const c = card('c', 0);
  const builtin = ['p', 'q', 'r', 's', 't'].map((l) => word(l));
  const few = [word('a', a), word('b', card('b', 30)), word('c', c), ...builtin];
  const deck = (got) => got.a + got.b + got.c;

  // The hard one would take all three eighths: it gets two thirds of them, the one due in a month hardly anything.
  const got = shares(few);
  assert.ok(near(deck(got), 3 / 8, 0.02), JSON.stringify(got));
  assert.ok(near(got.a, 0.25, 0.02) && near(got.c, 0.121, 0.015) && got.b < 0.01, JSON.stringify(got));
  for (const w of builtin) assert.ok(near(got[w.lemma], 0.125, 0.015), JSON.stringify(got));

  // Once the two due ones have been checked, the third gets more of the deck's part, which stays what it was.
  V.markShown([a, c], NOW);
  const after = shares(few);
  assert.ok(near(deck(after), 3 / 8, 0.02) && after.b > 0.03 && after.c < got.c, JSON.stringify(after));
  V.forget();

  // Eight deck words carry a pool alone, whatever else is in it.
  const eight = [...Array.from({ length: 8 }, (_, i) => word(`w${i}`, card(i, 0))), ...builtin];
  const full = shares(eight, {}, 2000);
  assert.equal(builtin.reduce((sum, w) => sum + full[w.lemma], 0), 0);
});

test('pickDue: recent keys are left out; built-in words alone are picked evenly, as by cloze.pickFresh', () => {
  const few = [word('a', card('a', 0)), word('b', card('b', 0)), ...['p', 'q', 'r'].map((l) => word(l))];
  const fresh = shares(few, { recent: ['a', 'p'] }, 2000);
  assert.ok(fresh.a === 0 && fresh.p === 0 && fresh.b > 0 && fresh.q > 0, JSON.stringify(fresh));
  // Nothing else left: the whole pool again.
  assert.equal(V.pickDue([few[0]], mulberry32(1), { recent: ['a'] }).lemma, 'a');
  // Other things than nouns say what `recent` holds.
  const entries = [{ inf: 'gehen', note: card(1, 0) }, { inf: 'essen', note: card(2, 0) }];
  assert.equal(V.pickDue(entries, mulberry32(1), { recent: ['gehen'], key: (e) => e.inf }).inf, 'essen');

  // No deck words: the same pick as cloze.pickFresh makes with the same random numbers.
  const builtin = ['p', 'q', 'r', 's'].map((l) => word(l));
  const { pickFresh } = require('../src/core/cloze.js');
  const [r1, r2] = [mulberry32(9), mulberry32(9)];
  for (let i = 0; i < 50; i++) assert.equal(V.pickDue(builtin, r1, { recent: ['q'] }), pickFresh(builtin, ['q'], (w) => w.lemma, r2));
  assert.equal(V.pickDue([], mulberry32(1)), undefined);
});

test('sample: picks without putting back — no card twice, never one not learnt, the same pick as pickDue makes', () => {
  const cards = [...WIDE.map((w) => w.note), card('new', null)];
  const rnd = mulberry32(11);
  const times = { hard: 0, due: 0, later: 0 };
  for (let i = 0; i < 300; i++) {
    const drawn = V.sample(cards, 5, rnd, { now: NOW });
    assert.equal(new Set(drawn).size, 5);
    for (const c of drawn) times[c.id.replace(/\d+$/, '')]++;
  }
  // Per card: the 4 hard ones far ahead of the 16 due ones, those ahead of the 8 due in a month; the new one never.
  assert.ok(times.hard / 4 > 2 * (times.due / 16) && times.due / 16 > 5 * (times.later / 8) && times.later > 0, JSON.stringify(times));
  // More asked for than there is: every learnt card, each once.
  assert.deepEqual(V.sample(cards, 100, rnd, { now: NOW }).map((c) => c.id).sort(), WIDE.map((w) => w.lemma).sort());
  assert.deepEqual(V.sample([], 3, rnd), []);
  assert.deepEqual(V.sample([card('new', null)], 3, rnd), []);

  // One path: a draw is pickDue's pick from what is left, so a card weighs the same either way.
  for (let seed = 1; seed <= 30; seed++) {
    const [first, second] = V.sample(cards, 2, mulberry32(seed), { now: NOW });
    const r = mulberry32(seed);
    const options = { now: NOW, noteOf: (x) => x, key: (x) => x };
    assert.equal(first, V.pickDue(WIDE.map((w) => w.note), r, options));
    assert.equal(second, V.pickDue(WIDE.map((w) => w.note), r, { ...options, recent: [first] }));
  }
  // Items with their card elsewhere; what counts as soon is passed on.
  const items = cards.map((c) => ({ of: c }));
  assert.equal(V.sample(items, 100, rnd, { noteOf: (x) => x.of, now: NOW }).length, 28);
  const later = (soon) => {
    const r = mulberry32(12);
    let n = 0;
    for (let i = 0; i < 300; i++) n += V.sample(cards, 5, r, { now: NOW, soon }).filter((c) => c.dueIn === 30).length;
    return n;
  };
  assert.ok(later(30) > 2 * later(7), `${later(30)} after ${later(7)}`);
});

test('shown cards count a twentieth right after, and their full weight again three days later', () => {
  V.forget();
  const c = card('seen', 0, 1);
  assert.equal(V.weight(c, NOW), 3);
  V.markShown([c], NOW);
  assert.ok(near(V.weight(c, NOW), 3 * 0.05));
  assert.ok(near(V.weight(c, NOW + 1.5 * DAY), 3 * (0.05 + 0.95 / 2)));
  assert.ok(V.weight(c, NOW + DAY / 24) < V.weight(c, NOW + DAY) && V.weight(c, NOW + DAY) < V.weight(c, NOW + 2 * DAY));
  assert.equal(V.weight(c, NOW + 3 * DAY), 3);
  assert.equal(V.weight(c, NOW + 30 * DAY), 3);
  // A clock set back does not make it count more.
  assert.ok(near(V.weight(c, NOW - DAY), 3 * 0.05));
  // Other cards are not touched; nothing to mark is fine.
  assert.equal(V.weight(card('other', 0, 1), NOW), 3);
  V.markShown(undefined, NOW);
  V.markShown([], NOW);

  // The picks go to the others: 0.15 of 16.15 by weight, where it was 3 of 19.
  const pool = [word('seen', c), ...Array.from({ length: 16 }, (_, i) => word(`w${i}`, card(i, 0)))];
  assert.ok(shares(pool, {}, 2000).seen < 0.03);
  V.forget();
  assert.equal(V.weight(c, NOW), 3);
  assert.ok(shares(pool, {}, 2000).seen > 0.09);
});

// A storage that fails at everything, as a full or blocked one does.
const BROKEN = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('denied'); } };

test('what was shown is kept in the storage, survives a restart, and old entries are dropped', (t) => {
  const storage = STORAGE;
  t.after(() => V.useStorage(storage));
  V.forget();
  assert.equal(storage.data.size, 0);
  V.markShown([card(101, 0), card('word', 0)], NOW);
  V.markShown([card(102, 0)], NOW + 2 * DAY);
  assert.deepEqual([...storage.data.keys()], [V.SHOWN_KEY]);
  assert.deepEqual(JSON.parse(storage.data.get(V.SHOWN_KEY)), { 101: NOW, word: NOW, 102: NOW + 2 * DAY });

  // A restart: the list is read from the storage again.
  V.useStorage(storage);
  assert.ok(near(V.weight(card(102, 0), NOW + 2 * DAY), 0.05));
  assert.ok(V.weight(card(101, 0), NOW + 2 * DAY) < 1 && V.weight(card('word', 0), NOW + 2 * DAY) < 1);

  // Marking again moves the time on; entries past the three days go with the next write.
  V.markShown([card(102, 0)], NOW + 4 * DAY);
  assert.deepEqual(JSON.parse(storage.data.get(V.SHOWN_KEY)), { 102: NOW + 4 * DAY });

  // Unreadable or odd contents count as nothing shown, and are replaced by the next write.
  for (const junk of ['{nonsense', '[true]', '"text"', 'null', '7', '{"103":"yesterday"}', '{"103":null}']) {
    storage.data.set(V.SHOWN_KEY, junk);
    V.useStorage(storage);
    assert.equal(V.weight(card(103, 0), NOW), 1, junk);
  }
  V.markShown([card(104, 0)], NOW);
  assert.deepEqual(JSON.parse(storage.data.get(V.SHOWN_KEY)), { 104: NOW });

  // A storage that fails: what was shown is still remembered while the app runs.
  V.useStorage(BROKEN);
  V.markShown([card(105, 0)], NOW);
  assert.ok(near(V.weight(card(105, 0), NOW), 0.05));
  V.forget();
  assert.equal(V.weight(card(105, 0), NOW), 1);

  // forget removes the key.
  V.useStorage(storage);
  V.forget();
  assert.equal(storage.data.size, 0);
});

test('a card answered wrong is not held back: it counts in full at once; the last answer wins', () => {
  V.forget();
  const missed = card('missed', 0, 1);
  const right = card('right', 0, 1);
  V.markShown([missed, right], NOW);
  V.markMissed([missed], NOW);
  assert.equal(V.weight(missed, NOW), 3);
  assert.ok(near(V.weight(right, NOW), 3 * 0.05));
  // Nothing to mark is fine; a card never shown stays as it was.
  V.markMissed(undefined, NOW);
  V.markMissed([], NOW);
  V.markMissed([card('new', 0)], NOW);
  assert.equal(V.weight(card('new', 0), NOW), 1);
  assert.ok(near(V.weight(right, NOW), 3 * 0.05));

  // Right after wrong: held back again; wrong after right: released again — every card of the item.
  V.markShown([missed], NOW + DAY);
  assert.ok(near(V.weight(missed, NOW + DAY), 3 * 0.05));
  V.markMissed([missed, right], NOW + DAY);
  assert.deepEqual([V.weight(missed, NOW + DAY), V.weight(right, NOW + DAY)], [3, 3]);
  V.forget();
});

test('a card answered wrong leaves the storage as well; old entries are dropped with that write too', (t) => {
  const storage = STORAGE;
  t.after(() => V.useStorage(storage));
  V.forget();
  V.markShown([card(101, 0), card(102, 0)], NOW);
  V.markMissed([card(101, 0)], NOW);
  assert.deepEqual(JSON.parse(storage.data.get(V.SHOWN_KEY)), { 102: NOW });

  // A restart: the miss is remembered.
  V.useStorage(storage);
  assert.equal(V.weight(card(101, 0), NOW), 1);
  assert.ok(near(V.weight(card(102, 0), NOW), 0.05));

  V.markShown([card(103, 0)], NOW + 2 * DAY);
  V.markMissed([card(104, 0)], NOW + 4 * DAY);
  assert.deepEqual(JSON.parse(storage.data.get(V.SHOWN_KEY)), { 103: NOW + 2 * DAY });

  // A storage that fails: the miss still counts while the app runs.
  V.useStorage(BROKEN);
  V.markShown([card(105, 0), card(106, 0)], NOW);
  V.markMissed([card(105, 0)], NOW);
  assert.equal(V.weight(card(105, 0), NOW), 1);
  assert.ok(near(V.weight(card(106, 0), NOW), 0.05));
  V.forget();
});

test('pickDue: cards answered wrong are picked like cards not checked yet, those answered right hardly at all', () => {
  V.forget();
  // Sixteen cards due today; eight checked, two of them wrong: 8 + 2 unchecked or missed ones (1) and 6 right (0.05).
  const due = Array.from({ length: 16 }, (_, i) => word(`d${i}`, card(`d${i}`, 0)));
  V.markShown(due.slice(0, 8).map((w) => w.note), NOW);
  V.markMissed(due.slice(0, 2).map((w) => w.note), NOW);
  const got = shares(due);
  for (const lemma of ['d0', 'd1', 'd8', 'd15']) assert.ok(near(got[lemma], 1 / 10.3, 0.015), JSON.stringify(got));
  for (let i = 2; i < 8; i++) assert.ok(got[`d${i}`] < 0.01, JSON.stringify(got));

  // A hard card answered wrong is back at once, but still gets no more than an eighth.
  const hard = word('hard', card('hard', 0, 5));
  V.markShown([hard.note], NOW);
  V.markMissed([hard.note], NOW);
  assert.ok(near(shares([hard, ...due]).hard, 1 / 8, 0.015));
  V.forget();
});

test('pools: the deck\'s words alone from eight up, with the built-in ones below', () => {
  const mine = (n) => Array.from({ length: n }, (_, i) => word(`M${i}`, card(i, 0)));
  const builtin = [word('B1'), word('B2'), word('M0')];
  assert.deepEqual(V.prefer(mine(8), builtin).map((n) => n.lemma), mine(8).map((n) => n.lemma));
  // Below that the built-in ones join, without the words the deck has too.
  assert.deepEqual(V.prefer(mine(7), builtin).map((n) => n.lemma), [...mine(7).map((n) => n.lemma), 'B1', 'B2']);
  assert.deepEqual(V.prefer([], builtin), builtin);
  // Other things than nouns: by their own key.
  assert.deepEqual(V.prefer([{ inf: 'gehen' }], [{ inf: 'gehen' }, { inf: 'essen' }], (e) => e.inf), [{ inf: 'gehen' }, { inf: 'essen' }]);
});

test('the deck\'s nouns carry their note; noteFor finds a learnt card by its word', (t) => {
  t.after(() => V.useNotes(NOTES));
  const bruder = NOTES.find((n) => n.word.startsWith('Bruder'));
  assert.equal(byLemma.Bruder.note, bruder);
  assert.deepEqual(V.notesOf(byLemma.Bruder, word('Mann'), null, undefined, byLemma.Hut), [bruder, byLemma.Hut.note]);
  // Any learnt card's first form, also where it makes no noun for the drills; not a card still to be learnt.
  assert.equal(V.noteFor('Bruder'), bruder);
  assert.ok(V.noteFor('Freundschaft') && !V.noteFor('Schwester') && !V.noteFor('Zebra'));

  // A verb by its infinitive, also for a reflexive card; of two cards for a word, the harder one.
  const cards = [
    ankiNote('sich anziehen', { pos: 'v' }),
    ankiNote('Bank, Bänke', { id: 'bench' }),
    ankiNote('Bank, Banken', { id: 'bank', lapses: 2 }),
    ankiNote('fahren, fährt, fuhr, ist gefahren', { pos: 'v', dueIn: null }),
  ];
  V.useNotes(cards);
  assert.equal(V.noteFor('anziehen'), cards[0]);
  assert.equal(V.noteFor('Bank'), cards[2]);
  assert.equal(V.noteFor('fahren'), undefined);
});

test('deck share: half the round, one sentence per card, the cards drawn by weight', () => {
  V.forget();
  const of = (w) => NOTES.find((n) => n.word.startsWith(w));
  const sentences = ['Bruder', 'Bruder', 'Bruder', 'Tante', 'Tante', 'Hut', 'Jacke', 'Auto', 'Taxi', 'Café'].map((w, i) => ({ text: `${w} ${i}`, notes: [of(w)] }));
  const rnd = mulberry32(41);
  const texts = new Set();
  for (let i = 0; i < 200; i++) {
    const share = V.deckShare(sentences, 10, rnd);
    assert.equal(share.length, 5);
    assert.equal(new Set(share.map((x) => x.notes[0])).size, 5, 'a card gives one sentence a round');
    for (const x of share) texts.add(x.text);
  }
  assert.equal(texts.size, sentences.length);
  // Fewer cards than half the round: what there is.
  assert.equal(V.deckShare(sentences.slice(0, 5), 10, rnd).length, 2);
  assert.deepEqual(V.deckShare([], 10, rnd), []);
  // A card shown a moment ago mostly stays out.
  V.markShown([of('Bruder')]);
  let bruder = 0;
  for (let i = 0; i < 200; i++) bruder += V.deckShare(sentences, 4, rnd).filter((x) => x.text.startsWith('Bruder')).length;
  assert.ok(bruder < 30, String(bruder));
  V.forget();
});

test('noun drills: items name the notes of the deck nouns they use', () => {
  const D = require('../src/topics/determiners.js');
  const A = require('../src/topics/adjectives.js');
  const P = require('../src/topics/prepositions.js');
  const W = require('../src/topics/wordorder.js');
  const noteOf = new Map(V.nouns.map((n) => [n.lemma, n.note]));
  const settings = { families: ['der', 'ein'], cases: ['nom', 'acc', 'dat', 'gen'], length: 32, vocab: 'anki' };
  const round = D.buildRound(settings, mulberry32(51));
  assert.ok(round.some((item) => item.notes.length));
  for (const item of round) assert.ok(item.notes.every((n) => item.nouns.some((l) => noteOf.get(l) === n)), item.nouns.join());
  for (const item of D.buildRound({ ...settings, vocab: 'builtin' }, mulberry32(51))) assert.deepEqual(item.notes, []);

  const adjectives = A.buildRound({ mode: 'full', vocab: 'anki' }, mulberry32(52));
  assert.ok(adjectives.some((item) => item.notes.length));
  for (const item of adjectives) assert.ok(!item.notes.length || item.notes[0] === noteOf.get(item.noun), item.noun);

  const prepositions = P.buildRound({ ...P.defaults, vocab: 'anki', length: 30 }, mulberry32(53));
  assert.ok(prepositions.some((item) => item.notes.length));
  for (const item of prepositions) assert.ok(item.notes.every((n) => NOTES.includes(n)));

  const rnd = mulberry32(54);
  const negated = Array.from({ length: 30 }, () => W.negateItem(rnd, [], 'anki'));
  assert.ok(negated.some((item) => item.notes.length));
  for (const item of negated) assert.ok(!item.notes.length || item.notes[0] === noteOf.get(item.key), item.key);
});

// Sixteen masculine clothes, enough for a noun drill to do without the built-in nouns.
const GARMENTS = ['Mantel, Mäntel', 'Rock, Röcke', 'Schuh, Schuhe', 'Stiefel, Stiefel', 'Pullover, Pullover', 'Anzug, Anzüge',
  'Gürtel, Gürtel', 'Schal, Schals', 'Handschuh, Handschuhe', 'Strumpf, Strümpfe', 'Hut, Hüte', 'Regenmantel, Regenmäntel',
  'Schlips, Schlipse', 'Kittel, Kittel', 'Umhang, Umhänge', 'Overall, Overalls'];

// The nouns of n adjective drill items (weak endings, masculine accusative) on the deck's nouns.
function drillNouns(n, rnd) {
  const A = require('../src/topics/adjectives.js');
  return Array.from({ length: n }, () => A.buildItem('weak', 'm', 'acc', rnd, [], 'anki').noun);
}

test('noun drills: nouns due now come up far more than those due in a month, until they have been checked', (t) => {
  V.forget();
  t.after(() => V.useNotes(NOTES));
  // Eight due today, eight in a month.
  V.useNotes(GARMENTS.map((w, i) => note('der', w, 'garment', CLOTHES, { dueIn: i < 8 ? 0 : 30 })));
  const today = new Set(V.nouns.filter((n) => n.note.dueIn === 0).map((n) => n.lemma));
  assert.deepEqual([today.size, V.nouns.length], [8, 16]);
  const rnd = mulberry32(54);
  const count = () => {
    const times = { today: 0, later: 0 };
    for (const noun of drillNouns(400, rnd)) times[today.has(noun) ? 'today' : 'later']++;
    return times;
  };
  const before = count();
  assert.ok(before.later > 0 && before.today > 10 * before.later, JSON.stringify(before));
  // Once the eight have been checked, the others get their turn.
  V.markShown(V.nouns.filter((n) => today.has(n.lemma)).map((n) => n.note));
  assert.ok(count().later > 100);
  V.forget();
});

test('noun drills: nouns answered wrong come up far more than those answered right', (t) => {
  V.forget();
  t.after(() => V.useNotes(NOTES));
  // All due today; the first eight checked, four of them wrong.
  V.useNotes(GARMENTS.map((w) => note('der', w, 'garment', CLOTHES, { dueIn: 0 })));
  const nouns = V.nouns.slice(0, 8);
  assert.equal(V.nouns.length, 16);
  V.markShown(nouns.map((n) => n.note));
  V.markMissed(nouns.slice(0, 4).map((n) => n.note));
  const missed = new Set(nouns.slice(0, 4).map((n) => n.lemma));
  const right = new Set(nouns.slice(4).map((n) => n.lemma));
  const times = { missed: 0, right: 0 };
  for (const noun of drillNouns(400, mulberry32(55))) {
    if (missed.has(noun)) times.missed++;
    else if (right.has(noun)) times.right++;
  }
  assert.ok(times.missed > 80 && times.missed > 8 * times.right, JSON.stringify(times));
  V.forget();
});
