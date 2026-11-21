// Builds an Anki package (.apkg) of the Partizip II of the Langenscheidt deck's verbs — learnt or not — with the auxiliary
// (ist gefahren, hat genommen). Plain regular verbs (machen → hat gemacht) are left out: one rule covers them all.
// Each note: the infinitive and its meaning (front), the auxiliary + Partizip II to type (back), the rule it follows, and
// one of the card's own Perfekt example sentences. Verbs whose forms the app cannot tell for sure go to a list to check.
//
// Run (reads the Anki collection read-only, through a snapshot):
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron tools/partizip-deck.js [output folder, default ~/Documents]
// Then open "Partizip II.apkg" (File → Import in Anki): the deck Deutsch::Partizip II with its own note type.
'use strict';

const cloze = require('../src/core/cloze.js');
const verbs = require('../src/core/verbs.js');
const vocab = require('../src/core/vocab.js');
const verbforms = require('../src/topics/verbforms.js');
const anki = require('./anki-import.js');

const { clean } = cloze;

// The note fields, in the note type's order.
const FIELDS = ['Infinitiv', 'Englisch', 'Partizip', 'Regel', 'Beispiel', 'BeispielEN'];

// The patterns a verb's Partizip II follows (pr: verbs.participleRule), as tags: strong, mixed, sein, both (haben and sein),
// and how ge- goes on (separable, inseparable, ieren). A plain regular verb has none.
function patterns(v, { strength, ge }) {
  return [
    ...(strength === 'weak' ? [] : [strength]),
    ...(v.aux.length > 1 ? ['both'] : v.aux[0] === 'sein' ? ['sein'] : []),
    ...(ge === 'ge' ? [] : [ge]),
  ];
}

// The answer to type: the usual auxiliary (haben for liegen / sitzen / stehen) + the Partizip II.
const answer = (v) => `${verbs.AUX_3SG[verbs.regional(v) ? 'haben' : v.aux[0]]} ${v.pii[0]}`;

const RULES = {
  strong: () => 'strong: -en, often with a vowel change',
  mixed: () => 'mixed: a vowel change, but -t',
  ieren: () => '-ieren: no ge-',
  inseparable: () => 'inseparable prefix: no ge-',
  // Between the parts — none where the rest takes none itself (an + vertraut, an + probiert).
  separable: (v, pr) => {
    const rest = v.pii[0].slice(v.particle.length);
    const why = pr.ieren ? ' (-ieren: no ge-)' : rest.startsWith('ge') ? '' : ' (inseparable prefix: no ge-)';
    return `separable: ${v.particle} + ${rest}${why}`;
  },
};

// The rule note on the back: the pattern, which auxiliary and when (for sein and both), other accepted forms.
function rule(v, tags, pr) {
  const parts = tags.filter((t) => RULES[t]).map((t) => RULES[t](v, pr));
  if (tags.includes('sein') || tags.includes('both')) parts.push(verbs.auxNote(v));
  if (v.pii.length > 1) parts.push(`also: ${v.pii.slice(1).join(', ')}`);
  return parts.join(' · ');
}

// The first of the card's example sentences with the verb in the Perfekt (or Plusquamperfekt), the two verb parts bold.
function example(note, v) {
  for (const ex of note.examples) {
    const split = cloze.splitWords(clean(ex.de));
    const found = verbforms.findForms(split, v, ['perf']);
    if (!found) continue;
    const bold = new Set(found.gaps.map((g) => g.i));
    return { de: split.parts.map((p, i) => (bold.has(i) ? `<b>${anki.html(p)}</b>` : anki.html(p))).join(''), en: anki.html(clean(ex.en)) };
  }
  return { de: '', en: '' };
}

// The card's English, its meanings apart ("to drive, to go", not "to drive to go").
const meaning = (html) => String(html || '').split(/<br\s*\/?>|;/i).map(clean).filter(Boolean).join(', ');

// The notes to import and the verb cards to check by hand: { rows, unsure }. A row: the FIELDS and tags.
// Learnt verbs come first (hardest first), then the new ones; a verb appears once ("sich anziehen" apart from "anziehen").
function buildDeck(notes) {
  const all = verbs.fromNotes(notes, clean);
  const read = new Set(all.map((x) => x.note));
  const unsure = notes.filter((n) => verbs.isVerbCard(n, clean) && !read.has(n)).map((n) => clean(n.word));
  const learntVerbs = all.filter((x) => x.note.dueIn !== null).sort((a, b) => vocab.hardestFirst(a.note, b.note));
  const seen = new Set();
  const rows = [];
  for (const { note, verb: v } of [...learntVerbs, ...all.filter((x) => x.note.dueIn === null)]) {
    const label = v.reflexive ? `sich ${v.inf}` : v.inf;
    const pr = verbs.participleRule(v);
    const tags = patterns(v, pr);
    if (seen.has(label) || !tags.length) continue; // a plain regular verb, or one already in
    seen.add(label);
    const ex = example(note, v);
    rows.push({
      Infinitiv: label, Englisch: anki.html(meaning(note.english)), Partizip: answer(v), Regel: rule(v, tags, pr), Beispiel: ex.de, BeispielEN: ex.en,
      tags: [...tags, note.dueIn === null ? 'neu' : 'gelernt'],
    });
  }
  return { rows, unsure };
}

const DECK = {
  name: 'Partizip II', fields: FIELDS, prefix: 'partizip',
  front: `
    <div class="inf">{{Infinitiv}}</div>
    <div class="en">{{Englisch}}</div>
    {{type:Partizip}}`,
  back: `
    {{FrontSide}}
    <hr id=answer>
    <div class="rule">{{Regel}}</div>
    {{#Beispiel}}<p>{{Beispiel}}<br><i>{{BeispielEN}}</i></p>{{/Beispiel}}`,
  css: '.inf { font-size: 1.6em; } .en { color: #888; margin-bottom: 1em; } .rule { color: #888; }',
  about: `Type the auxiliary and the Partizip II: "ist gefahren". Verbs learnt in the main deck come first. Tags:
   partizip::strong, ::mixed, ::sein, ::both, ::ieren, ::inseparable, ::separable, and ::gelernt or ::neu.`,
};

if (require.main === module) {
  anki.run(DECK, (notes) => {
    const { rows, unsure } = buildDeck(notes);
    return {
      rows,
      files: { check: `Verb cards whose Partizip II the app cannot tell for sure — not in the import:\n\n${unsure.join('\n')}\n` },
      summary: `${rows.length} notes (${rows.filter(anki.learnt).length} learnt in the main deck), ${unsure.length} verbs to check`,
    };
  }, process.argv[2]);
}

module.exports = { buildDeck, DECK };
