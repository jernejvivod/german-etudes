'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../tools/b1-deck.js');

// Two columns as pdftotext -layout prints them: a headword column at 8 and its examples at 38; the right side at 82 / 112.
const row = (lh = '', le = '', rh = '', re = '') => `${' '.repeat(8)}${lh.padEnd(30)}${le.padEnd(44)}${rh.padEnd(30)}${re}`;
const PAGE = [
  '        2      Alphabetischer Wortschatz',
  '',
  row('A', '', 'abschreiben, schreibt ab,', 'Er hat die Hausaufgaben von mir'),
  row('', '', 'schrieb ab,', 'abgeschrieben.'),
  row('ab', '1. Die Fahrt kostet ab Hamburg', 'hat abgeschrieben'),
  row('', '200 Euro.', 'sich anstrengen, strengt', 'Das strengt an.'),
  row('', '', 'sich an, hat sich angestrengt'),
  row('', '2. Ab nächster Woche bleibt unser', 'der Absender, -', 'Schicken Sie das Paket an den'),
  row('', 'Geschäft geschlossen.', 'die Absenderin, -nen', 'Absender zurück.'),
  row('das Abitur (D)→A, CH:', 'Meine Tochter hat gerade Abitur'),
  row('Matura', 'gemacht.', 'aller-', 'Am allerbesten ist es so.'),
  row('vermieten, vermietet, ver-', 'Bei uns ist ein Zimmer zu', 'allerdings', 'Ich komme, allerdings später.'),
  row('mietete, hat vermietet', 'vermieten.'),
  '        3      Wortgruppen',
].join('\n');

test('the list: two columns, forms over several lines, variants, a prefix entry, regional forms', () => {
  const entries = B.parseList(PAGE);
  const heads = entries.map((e) => e.head).sort();
  assert.deepEqual(heads, ['ab', 'das Abitur (D)→A, CH: Matura', 'vermieten, vermietet, vermietete, hat vermietet',
    'abschreiben, schreibt ab, schrieb ab, hat abgeschrieben', 'sich anstrengen, strengt sich an, hat sich angestrengt',
    'der Absender, - die Absenderin, -nen', 'aller-', 'allerdings'].sort());
  assert.deepEqual(entries.find((e) => e.head === 'ab').examples, ['Die Fahrt kostet ab Hamburg 200 Euro.', 'Ab nächster Woche bleibt unser Geschäft geschlossen.']);
  assert.deepEqual(B.lemmas('der Absender, - die Absenderin, -nen'), ['Absender', 'Absenderin']);
  assert.deepEqual(B.lemmas('jdn. erschrecken, erschreckt, erschreckte, hat erschreckt'), ['erschrecken']);
  assert.deepEqual(B.splitRegion('der Gehsteig (D, A) → CH: Trottoir'), ['der Gehsteig', '(D, A) → CH: Trottoir']);
  assert.equal(B.splitRegion('das Dessert, -s → D, A: Nachspeise')[1], '→ D, A: Nachspeise');
  assert.deepEqual(B.lemmas('der/die Tote, -n'), ['Tote']);
  assert.deepEqual(B.lemmas('sich anstrengen, strengt sich an, strengte sich an, hat sich angestrengt'), ['anstrengen']);
  assert.deepEqual(B.lemmas('(sich etwas) aussuchen, sucht aus'), ['aussuchen']);
  assert.deepEqual(B.lemmas('bekannt geben, gibt bekannt'), ['bekannt geben']);
  assert.deepEqual(B.lemmas('die/das Glace/Glacé, -n (CH) → D, A: Eis'), ['Glace', 'Glacé']);
  assert.deepEqual(B.lemmas('es'), ['es']);
});

test('the list: a page shifted right, a word of a family beside its example, forms over lines that start with / or →', () => {
  const shifted = (lh = '', le = '', rh = '', re = '') => `${' '.repeat(8)}${lh.padEnd(34)}${le.padEnd(46)}${rh.padEnd(30)}${re}`;
  const page = [
    '        2      Alphabetischer Wortschatz',
    '\f' + shifted('das Gift, -e', 'Das Gift ist gefährlich.', 'der Kellner, -', 'Der Kellner kommt gleich.'),
    shifted(' '.repeat(23) + 'giftig', 'Vorsicht, giftig!', '/ die Kellnerin, -', 'Rufen Sie die Kellnerin.'),
    shifted('der Coiffeur, -e (CH)', 'Er ist Coiffeur.', 'nen'),
    shifted('→ D, A: Friseur', '', ' '.repeat(10) + 'die Eile 1. Ich bin in Eile.'),
  ].join('\n');
  const byHead = (list) => list.sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(byHead(B.parseList(page).map((e) => [e.head, e.examples])), byHead([
    ['das Gift, -e', ['Das Gift ist gefährlich.']],
    ['giftig', ['Vorsicht, giftig!']],
    ['der Coiffeur, -e (CH) → D, A: Friseur', ['Er ist Coiffeur.']],
    ['der Kellner, - / die Kellnerin, -nen', ['Der Kellner kommt gleich. Rufen Sie die Kellnerin.']],
    ['die Eile', ['Ich bin in Eile.']],
  ]));
});

test('the deck: only words that are no card (Arzt counts for Ärztin), with English and regional tags', () => {
  const entries = [
    { head: 'die Ärztin, -nen', examples: ['Sie ist Ärztin.'] },
    { head: 'die Idee, -n', examples: ['Gute Idee!'] },
    { head: 'bleiben, bleibt, blieb, ist geblieben', examples: ['Bleib hier.'] },
    { head: 'der Gehsteig (D, A) → CH: Trottoir', examples: ['Auf dem Gehsteig.'] },
  ];
  const notes = [{ word: 'Arzt, die Ärztin' }, { word: 'Ahnung, die Idee' }, { word: 'jemandem etwas leihen' }];
  assert.ok(B.deckWords(notes).has('leihen'));
  assert.ok(B.inDeck('Ärztin', B.deckWords([{ word: 'Arzt' }])));
  assert.ok(B.inDeck('leid tun', B.deckWords([{ word: 'leidtun, tut leid, tat leid, hat leidgetan' }])));
  const rows = B.buildDeck(entries, notes, B.readGlosses('# comment\nbleiben\tto stay\n'));
  assert.deepEqual(rows.map((r) => [r.Wort, r.Englisch, r.Region, r.tags]), [
    ['bleiben, bleibt, blieb, ist geblieben', 'to stay', '', ['verb']],
    ['der Gehsteig', '', '(D, A) → CH: Trottoir', ['nomen', 'regional', 'ohne-englisch']],
  ]);
  assert.deepEqual(B.parseList(['        2      Alphabetischer Wortschatz', row('die Debatte, -n', 'Pro- und Contra-Argumente'), row('', 'kamen vor.')].join('\n'))[0].examples,
    ['Pro- und Contra-Argumente kamen vor.']);
});
