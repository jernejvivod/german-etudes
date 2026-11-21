'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/topics/verbforms.js');
const V = require('../src/core/vocab.js');
const verbs = require('../src/core/verbs.js');
const { gaps, text } = require('../src/core/cloze.js');
const { mulberry32, findItem, isolateStorage, ankiNote } = require('./helpers.js');
const F = T;

const ALL = ['praes', 'praet', 'perf', 'konj2'];

test('every built-in verb and Konjunktiv II sentence resolves', () => {
  assert.ok(T.BUILTIN.every((e) => e.verb), T.BUILTIN.filter((e) => !e.verb).map((e) => e.inf).join());
  const rnd = mulberry32(1);
  for (let i = 0; i < 300; i++) {
    const item = T.konj2Item(rnd, []);
    assert.doesNotMatch(text(item), /[{}]|undefined/, text(item));
    assert.match(text(item), /^[A-ZÄÖÜ]/);
  }
});

test('built-in sentences: the form of the subject\'s person, Perfekt with its auxiliary at the front and the participle last', () => {
  const rnd = mulberry32(2);
  for (let i = 0; i < 400; i++) {
    for (const tense of ['praes', 'praet', 'perf']) {
      const item = T.verbItem(tense, 'builtin', rnd, []);
      const v = item.verbData;
      const g = gaps(item);
      const s = text(item);
      assert.doesNotMatch(s, /\s{2}|undefined|\s\./, s);
      if (tense === 'perf') {
        assert.deepEqual(g.map((x) => x.slot), ['aux', 'pii']);
        assert.ok(v.pii.includes(g[1].answer), s);
        assert.ok(s.endsWith(`${g[1].answer}.`), s);
      } else {
        assert.equal(g.length, 1);
        assert.ok(v[tense === 'praes' ? 'pres' : 'pret'].some((forms) => forms.includes(g[0].answer)), s);
        if (v.particle) assert.ok(s.endsWith(` ${v.particle}.`), s);
      }
    }
  }
  // Checked by hand: du-forms with the stem change.
  const du = Array.from({ length: 300 }, () => T.verbItem('praes', 'builtin', rnd, [])).filter((i) => /^Du /.test(text(i)));
  assert.ok(du.some((i) => /^Du (fährst|liest|nimmst|gibst|sprichst|triffst|hilfst|schläfst|läufst|trägst|wäschst|vergisst|wirfst|hältst|lässt|fängst|isst|siehst|stiehlst|empfiehlst) /.test(text(i))));
});

test('deck sentences: the verb form is gapped where it stands; infinitives, imperatives and passives are left out', () => {
  const note = (word, de, extra = {}) => ({ id: word, article: '', word, pos: 'v', english: '', headings: [], examples: [{ de, en: 'English' }], dueIn: 1, lapses: 0, ease: 2500, ...extra });
  V.useNotes([
    note('fahren, fährt, fuhr, ist gefahren', 'Wir sind gestern nach Berlin gefahren.'),
    note('aufstehen', 'Ich stehe jeden Tag um sechs auf.', { pos: 'v-sep-irr' }),
    note('umziehen', 'Wo kann ich mich umziehen?', { pos: 'v-sep-irr' }),
    note('stören', 'Störe sie nicht, wenn sie arbeitet.'),
    note('reinigen', 'Sie muss gereinigt werden.'),
    note('antworten', 'Er hat eine E-Mail geschickt und sie haben sofort geantwortet.'),
    note('erwarten', 'Sie kamen früher an, als wir erwartet hatten.'),
    note('denken, denkt, dachte, hat gedacht', 'Woran denkst du?'),
  ]);
  const items = T.deckItems(ALL);
  const shown = Object.fromEntries(items.map((i) => [i.verb, i.tokens.map((t) => (typeof t === 'string' ? t : `[${t.answer}]`)).join('')]));
  assert.deepEqual(shown, {
    fahren: 'Wir [sind] gestern nach Berlin [gefahren].',
    aufstehen: 'Ich [stehe] jeden Tag um sechs auf.',
    antworten: 'Er hat eine E-Mail geschickt und sie [haben] sofort [geantwortet].',
    erwarten: 'Sie kamen früher an, als wir [erwartet] [hatten].',
    denken: 'Woran [denkst] du?',
  });
  assert.deepEqual(items.map((i) => i.tense), ['perf', 'praes', 'perf', 'plusq', 'praes']);
  assert.ok(items.every((i) => i.prompt.text === 'English' && i.tags.some((t) => t.text === 'Anki')));
  // Only the chosen tenses.
  assert.deepEqual(T.deckItems(['praes']).map((i) => i.verb), ['aufstehen', 'denken']);

  const round = T.buildRound({ tenses: ALL, vocab: 'anki', length: 10 }, mulberry32(3));
  assert.equal(round.length, 10);
  assert.equal(round.filter((i) => i.source === 'anki').length, 5);
  // Each deck sentence names its note, and no verb gives two sentences in a round.
  assert.ok(items.every((i) => i.notes.length === 1 && i.notes[0].word.startsWith(i.verb)));
  assert.equal(new Set(round.filter((i) => i.source === 'anki').map((i) => i.notes[0])).size, 5);
  V.useNotes([]);
});

test('the parts table: the round\'s irregular verbs, Perfekt with either auxiliary where both are used; Konjunktiv II block', () => {
  const rnd = mulberry32(4);
  const [table] = T.sessions[0].build({ tenses: ALL, vocab: 'builtin', length: 10 }, rnd);
  const [parts, k2] = table.table.blocks;
  assert.deepEqual(parts.cols.map((c) => c.head), ['Präsens', 'Präteritum', 'Perfekt']);
  assert.ok(parts.rows.length >= 6 && parts.rows.length <= 8);
  const fahren = T.partsTable({ tenses: ['perf'] }, [{ verbData: verbs.verb('fahren') }], rnd).blocks[0];
  assert.deepEqual(fahren.answers[0][0], ['ist gefahren', 'hat gefahren']);
  assert.deepEqual(k2.answers[0], [['wäre'], ['wärst', 'wärest'], ['wäre'], ['wären'], ['wärt', 'wäret'], ['wären']]);
  assert.equal(T.partsTable({ tenses: ['konj2'] }, [], rnd).blocks.length, 1);
});

test('review fixes: both forms after an ambiguous "sie"; Perfekt without an object takes the usual auxiliary; no passive', () => {
  const rnd = mulberry32(9);
  for (let i = 0; i < 400; i++) {
    const item = T.verbItem('perf', 'builtin', rnd, []);
    const [aux] = gaps(item);
    if (item.verb === 'fahren' && /^Ich /.test(text(item))) assert.deepEqual([aux.answer, ...aux.alts], ['bin'], text(item));
    if (/^Sie /.test(text(item))) assert.ok([aux.answer, ...aux.alts].some((a) => /^(hat|ist)$/.test(a)) && [aux.answer, ...aux.alts].some((a) => /^(haben|sind)$/.test(a)), text(item));
  }
  const note = { id: 1, article: '', word: 'fahren, fährt, fuhr, ist gefahren', pos: 'v', english: '', headings: [],
    examples: [{ de: 'Das Auto ist gefahren worden.', en: '' }], dueIn: 1, lapses: 0, ease: 2500 };
  V.useNotes([note]);
  assert.equal(T.deckItems(['perf']).length, 0);
  V.useNotes([]);
});

test('my irregular verbs: eight a round in turn until all have come up, forms table, two sentences per verb', () => {
  const note = (word, de, lapses = 0) => ({ id: word, article: '', word, pos: 'v-irr', english: '', headings: [], examples: de ? [{ de, en: 'E' }] : [], dueIn: 2, lapses, ease: 2500 });
  V.useNotes([
    note('tragen, trägt, trug, hat getragen', 'Du solltest am Strand Hut und Sonnenbrille tragen.', 3),
    note('fahren, fährt, fuhr, ist gefahren', 'Wir sind gestern nach Berlin gefahren.', 2),
    note('sich anziehen', 'Normalerweise ziehe ich mich vor dem Frühstück an.', 1),
    note('gelingen, gelingt, gelang, ist gelungen', ''),
    ...['geben', 'nehmen', 'sehen', 'lesen', 'helfen', 'sprechen', 'treffen', 'schlafen'].map((inf) => note(inf, '')),
  ]);
  const all = T.irregularVerbs('anki');
  assert.equal(all.length, 12);
  assert.deepEqual(all.slice(0, 3).map((v) => v.inf), ['tragen', 'fahren', 'anziehen']);
  const session = T.sessions.find((x) => x.label === 'My irregular verbs');
  const rnd = mulberry32(5);
  const first = session.build({ ...T.defaults }, rnd);
  const second = session.build({ ...T.defaults }, rnd);
  const rows = (steps) => steps[0].table.blocks[0].rows;
  assert.equal(rows(first).length, 8);
  // The second round takes the four left, then starts the turn again.
  assert.deepEqual(rows(second).slice(0, 4).sort(), all.slice(8).map((v) => (v.reflexive ? `sich ${v.inf}` : v.inf)).sort());
  const [table, drill] = first;
  const titles = table.table.blocks.map((b) => b.title);
  assert.deepEqual(titles.slice(0, 3), ['Stammformen', 'Präsens', 'Präteritum']);
  const parts = table.table.blocks[0];
  const i = parts.rows.indexOf('sich anziehen');
  assert.deepEqual([parts.answers[0][i], parts.answers[2][i]], [['zieht an'], ['hat angezogen']]);
  // Two sentences per verb with a phrase or deck sentence; gelingen has neither.
  for (const v of rows(first)) {
    const n = drill.items.filter((it) => it.verb === v.replace('sich ', '')).length;
    assert.equal(n, v === 'gelingen' ? 0 : 2, v);
  }
  assert.ok(drill.items.some((it) => /^Wir \[?sind/.test(text(it)) || text(it) === 'Wir sind gestern nach Berlin gefahren.'));
  assert.ok(drill.items.filter((it) => it.verb === 'anziehen').every((it) => / (mich|dich|sich|uns|euch) /.test(text(it))), 'reflexive pronoun in place');
  V.useNotes([]);
});

test('phrases: reflexive pronouns in every person, pronouns before the time word', () => {
  const rnd = mulberry32(8);
  const brechen = T.entryFor(verbs.verb('brechen', { reflexive: true }));
  const leihen = T.entryFor(verbs.verb('leihen'));
  for (let i = 0; i < 200; i++) {
    for (const tense of ['praes', 'praet', 'perf']) {
      const b = text(T.sentence(brechen, tense, 'builtin', rnd));
      assert.match(b, /^\S+( \S+)? \S+ (mir|dir|sich|uns|euch) (heute |jetzt |gestern |damals |letzte Woche |heute Morgen )?das Bein( gebrochen)?\.$/, b);
      const l = text(T.sentence(leihen, tense, 'builtin', rnd));
      assert.match(l, / ihm (heute|jetzt|gestern|damals|letzte Woche|heute Morgen) mein Fahrrad/, l);
    }
  }
});

test('review fixes: two auxiliaries kept for compounds, aufstehen explained with sein, the deck only with the Anki option', () => {
  assert.deepEqual(verbs.verb('zusammenbrechen').aux, ['haben', 'sein']);
  assert.deepEqual(verbs.verb('anziehen').aux, ['haben']);
  const rnd = mulberry32(12);
  const aufstehen = Array.from({ length: 200 }, () => T.verbItem('perf', 'builtin', rnd, [])).find((i) => i.verb === 'aufstehen');
  assert.match(aufstehen.explain, /aufstehen takes sein/);
  const note = { id: 1, article: '', word: 'fahren, fährt, fuhr, ist gefahren', pos: 'v-irr', english: '', headings: [],
    examples: [{ de: 'Wir sind gestern nach Berlin gefahren.', en: 'E' }], dueIn: 1, lapses: 0, ease: 2500 };
  V.useNotes([note]);
  const fahren = verbs.verb('fahren');
  const builtinOnly = T.myVerbsSentences([fahren], 'builtin', rnd);
  assert.ok(builtinOnly.every((i) => i.source === 'builtin'), 'no deck sentences, no Anki tag');
  const anki = T.myVerbsSentences([fahren], 'anki', rnd);
  assert.deepEqual(anki.map((i) => i.source).sort(), ['anki', 'builtin']);
  // Every verb with a stem change gets its du / er pair; one fully irregular verb its whole table.
  const table = T.myVerbsTable(['können', 'müssen', 'tun', 'fahren'].map((v) => verbs.verb(v)));
  assert.deepEqual(table.blocks.find((b) => b.title === 'Präsens').rows, ['müssen', 'tun', 'fahren']);
  assert.ok(table.blocks.some((b) => b.title === 'können'));
  V.useNotes([]);
});

test('Imperativ: du keeps e → i and drops -st, no umlaut, -e after t / d; ihr- and Sie-forms; particle and reflexive in place', () => {
  const du = (inf) => verbs.imperative(verbs.verb(inf)).du;
  assert.deepEqual(['nehmen', 'lesen', 'essen', 'sehen', 'treten', 'vergessen'].map((v) => du(v)[0]), ['nimm', 'lies', 'iss', 'sieh', 'tritt', 'vergiss']);
  assert.deepEqual(du('fahren'), ['fahr', 'fahre']);
  assert.deepEqual(du('warten'), ['warte']);
  assert.deepEqual(du('halten'), ['halte', 'halt']);
  assert.deepEqual(du('lächeln'), ['lächle']);
  assert.deepEqual(verbs.imperative(verbs.verb('sein')), { du: ['sei'], ihr: ['seid'], Sie: ['seien'], rule: 'irregular' });
  assert.equal(verbs.imperative(verbs.verb('können')), null);
  assert.equal(verbs.imperative(verbs.verb('geschehen')), null);
  assert.deepEqual(du('entschuldigen'), ['entschuldige']);
  assert.deepEqual(du('atmen'), ['atme']);
  const rnd = mulberry32(14);
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const item = T.impItem(rnd, []);
    const s = text(item);
    assert.match(s, /^[A-ZÄÖÜ].*!$/, s);
    if (item.verb === 'anrufen') assert.match(s, / an!$/, s);
    if (item.verb === 'setzen') assert.match(s, /^(Setz|Setze) dich|^Setzt euch|^Setzen Sie sich/, s);
    if (item.tags[2].text === 'Sie') assert.match(s, /^\S+ Sie /, s);
    seen.add(item.tags[2].text);
  }
  assert.deepEqual([...seen].sort(), ['Sie', 'du', 'ihr']);
  // The grey hint stays the infinitive, lower-case, even at the start of the sentence.
  for (let i = 0; i < 50; i++) {
    const item = T.impItem(rnd, []);
    assert.equal(gaps(item)[0].placeholder, item.verb);
    const k2 = T.konj2Item(rnd, []);
    assert.ok(gaps(k2).every((g) => !g.placeholder || g.placeholder === g.placeholder.toLowerCase() || g.placeholder === 'haben / sein'), text(k2));
  }
  assert.match(T.impItem(() => 0.999, []).explain, /du-Imperativ|ihr-Imperativ|Sie-Imperativ/);
  const table = T.partsTable({ tenses: ['imp'] }, [{ verbData: verbs.verb('anrufen') }, { verbData: verbs.verb('können') }], rnd).blocks[0];
  assert.deepEqual(table.answers[0].slice(0, 2), [['ruf an', 'rufe an'], ['—', '']]);
});

test('Modalverben: the Perfekt takes haben and the modal\'s infinitive; alone, its Partizip II', () => {
  const rnd = mulberry32(31);
  for (let i = 0; i < 200; i++) {
    const it = F.ersatzItem('builtin', rnd, []);
    const g = gaps(it);
    assert.equal(g[0].slot, 'aux');
    assert.ok(g[0].answer.startsWith('ha'), text(it));
    if (g[1].slot === 'modal') assert.ok(['müssen', 'können', 'wollen', 'dürfen'].includes(g[1].answer), text(it));
    else assert.match(g[1].answer, /^ge\w+t$/, text(it));
    assert.match(it.prompt.text, /^\S+( \S+)? (musste|konnte|wollte|durfte|mochte)/, it.prompt.text);
    assert.doesNotMatch(text(it), /undefined|\{|\s{2}/);
  }
  assert.ok(F.modalEntries('builtin').every((e) => !['können', 'sein', 'wissen'].includes(e.inf)));
});

test('Modalverben: the subjective meaning, with haben / sein after a Partizip II', () => {
  const rnd = mulberry32(32);
  for (let i = 0; i < 100; i++) {
    const it = F.subjectiveItem('builtin', rnd, []);
    assert.doesNotMatch(text(it) + it.prompt.text, /\{|undefined/);
    assert.match(text(it), /^[A-ZÄÖÜ]/);
    const aux = gaps(it).find((g) => g.slot === 'aux');
    if (aux) assert.match(text(it), new RegExp(`\\S+ ${aux.answer}\\.$`));
  }
  const vergessen = findItem((r) => F.subjectiveItem('builtin', r, []), (it) => it.prompt.text.startsWith('Vielleicht hat'));
  assert.deepEqual(gaps(vergessen).map((g) => [g.answer, ...g.alts]), [['könnte', 'kann'], ['haben']]);
});

test('Konjunktiv I: the stem + e, sein irregular; Konjunktiv II or würde where it looks like the Indikativ', () => {
  assert.deepEqual(verbs.reported(verbs.verb('kommen'), '3sg'), { kind: 'konj1', forms: ['komme'] });
  assert.deepEqual(verbs.reported(verbs.verb('sein'), '3pl'), { kind: 'konj1', forms: ['seien'] });
  assert.deepEqual(verbs.reported(verbs.verb('haben'), '3pl'), { kind: 'konj2', forms: ['hätten'] });
  assert.deepEqual(verbs.reported(verbs.verb('fahren'), '3pl'), { kind: 'wuerde', forms: ['würden'] });
  assert.equal(verbs.konj1(verbs.verb('lächeln')), null);
  const rnd = mulberry32(33);
  for (let i = 0; i < 200; i++) {
    const it = F.konj1Item('builtin', rnd, []);
    const [fin, inf] = gaps(it);
    assert.ok(/(sagt|erzählt|meint|gesagt|sagte|sagen|erzählen|meinen|sagten), (er|sie|es) $/.test(it.tokens[0]), it.tokens[0]);
    assert.doesNotMatch(text(it), /\b(ich|wir|mich|uns)\b|\s{2}|undefined/, text(it));
    assert.match(it.prompt.text, /^„(Ich|Wir) .+\.“$/, it.prompt.text);
    if (fin.answer.startsWith('würde') && it.verb !== 'werden') assert.equal(inf.slot, 'inf', text(it));
    else assert.equal(inf, undefined);
  }
});

test('Konjunktiv I: the sentence\'s own auxiliary (hat eine Tasse zerbrochen), and no mögen', () => {
  assert.ok(F.reportEntries('builtin').every((e) => e.inf !== 'mögen'));
  const entry = F.entryFor(verbs.verb('zerbrechen'));
  assert.equal(entry.aux, 'haben');
  V.useNotes([{ word: 'zerbrechen, zerbricht, zerbrach, ist/hat zerbrochen', pos: 'v', dueIn: 1, lapses: 0, ease: 2500, english: '', article: '', headings: [], examples: [] },
    ...['nehmen', 'geben', 'sehen', 'lesen'].map((w) => ({ word: w, pos: 'v', dueIn: 1, lapses: 0, ease: 2500, english: '', article: '', headings: [], examples: [] }))]);
  const it = findItem((r) => F.konj1Item('anki', r, []), (i) => i.verb === 'zerbrechen' && /zerbrochen/.test(text(i)));
  assert.match(it.prompt.text, /^„Ich habe|^„Wir haben/);
  V.useNotes([]);
});

test('Plusquamperfekt, Futur I and II: the auxiliary and the verb parts; nachdem-clauses', () => {
  const rnd = mulberry32(81);
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    for (const tense of ['plusq', 'fut1', 'fut2']) {
      const it = F.verbItem(tense, 'builtin', rnd, []);
      const g = gaps(it);
      const t = text(it);
      assert.doesNotMatch(t, /\s{2}|undefined|\s[,.]/, t);
      if (tense === 'plusq') {
        assert.ok(g.some((x) => /^(hatte|war)/.test(x.answer)), t);
        if (t.startsWith('Nachdem')) seen.add('nachdem'), assert.match(t, /(hatte|hattest|hatten|hattet|war|warst|waren|wart), \S+/, t);
      } else {
        assert.match(g[0].answer, /^(werde|wirst|wird|werden|werdet)$/, t);
        if (tense === 'fut2') assert.ok(['haben', 'sein'].includes(g[g.length - 1].answer), t);
      }
    }
  }
  assert.ok(seen.has('nachdem'));
  const table = F.partsTable({ tenses: ['plusq', 'fut2'] }, [], rnd);
  assert.deepEqual(table.blocks.map((b) => b.title), ['Stammformen', 'werden']);
});

test('lassen + infinitive: lässt in the Präsens, hat … lassen (not gelassen) in the Perfekt', () => {
  const rnd = mulberry32(82);
  for (let i = 0; i < 100; i++) {
    const it = F.lassenItem('builtin', rnd, []);
    const g = gaps(it);
    if (it.prompt) assert.deepEqual([g[0].answer.slice(0, 2), g[1].answer], ['ha', 'lassen']);
    else assert.match(g[0].answer, /^(lasse|lässt|lassen|lasst)$/);
  }
});

test('the Anki option: sentences name the notes of the deck\'s words in them; a hard verb due today is not left out', (t) => {
  isolateStorage(t);
  t.after(() => V.useNotes([]));
  // Three verbs with an example sentence (machen has lapsed), and ten more with a built-in sentence entry.
  const withSentence = ['machen', 'kaufen', 'spielen'];
  const withEntry = ['fahren', 'essen', 'lesen', 'sehen', 'nehmen', 'geben', 'sprechen', 'treffen', 'helfen', 'schlafen'];
  const notes = [
    ...withSentence.map((inf) => ankiNote(inf, { pos: 'v', lapses: inf === 'machen' ? 3 : 0, examples: [{ de: `Er ${inf.slice(0, -2)}t das oft.`, en: 'E' }] })),
    ...withEntry.map((inf) => ankiNote(inf, { pos: 'v-irr' })),
  ];
  V.useNotes(notes);
  const noteOf = (inf) => notes.find((n) => n.id === inf);

  // Deck sentences: their verb's note; a round with room has all three verbs, the hard one too.
  assert.deepEqual(T.deckItems(['praes']).map((it) => it.notes), withSentence.map((inf) => [noteOf(inf)]));
  const round = T.buildRound({ tenses: ['praes'], vocab: 'anki', length: 10 }, mulberry32(91));
  assert.deepEqual(round.filter((it) => it.source === 'anki').map((it) => it.verb).sort(), [...withSentence].sort());

  // Built sentences: the verb entries are the deck's (ten are enough to do without the built-in ones), with their notes.
  assert.deepEqual(T.reportEntries('anki').map((e) => e.note).sort((a, b) => a.id.localeCompare(b.id)), withEntry.map(noteOf).sort((a, b) => a.id.localeCompare(b.id)));
  const rnd = mulberry32(92);
  for (let i = 0; i < 30; i++) {
    const reported = T.konj1Item('anki', rnd, []);
    assert.deepEqual(reported.notes, [noteOf(reported.verb)]);
    const modal = T.ersatzItem('anki', rnd, []);
    assert.deepEqual(modal.notes, withEntry.includes(modal.verb) ? [noteOf(modal.verb)] : []);
    assert.deepEqual(T.verbItem('praes', 'builtin', rnd, []).notes, []);
    assert.deepEqual(T.konj1Item('builtin', rnd, []).notes, []);
  }
  // Fewer deck verbs with an entry: the built-in entries join them.
  V.useNotes(notes.slice(0, 6));
  const entries = T.reportEntries('anki');
  assert.deepEqual(entries.filter((e) => e.note).map((e) => e.inf).sort(), ['essen', 'fahren', 'lesen']);
  assert.ok(entries.some((e) => !e.note) && new Set(entries.map((e) => e.inf)).size === entries.length);
});
