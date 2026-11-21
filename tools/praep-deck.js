// Builds an Anki package (.apkg) of verbs, adjectives and nouns with a fixed preposition (warten auf + Akk), from
// tools/praepositionen.tsv. Each note: the word with a gap for the preposition and its meaning (front), the preposition and
// case to type ("auf + Akk", back), and an example sentence — one of the Langenscheidt deck's own where a card of the verb
// has one with the preposition, the list's otherwise.
//
// Run (reads the Anki collection read-only, through a snapshot):
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron tools/praep-deck.js [output folder, default ~/Documents]
// Then open "Präpositionen.apkg" (File → Import in Anki): the deck Deutsch::Präpositionen with its own note type.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cloze = require('../src/core/cloze.js');
const declension = require('../src/core/declension.js');
const verbs = require('../src/core/verbs.js');
const vocab = require('../src/core/vocab.js');
const anki = require('./anki-import.js');

const { clean } = cloze;

const FIELDS = ['Schlüssel', 'Wort', 'Englisch', 'Antwort', 'Beispiel', 'BeispielEN'];
const LIST = path.join(__dirname, 'praepositionen.tsv');

// The preposition merged with an article: the standard forms (am, zum …) and the spoken ones (aufs, fürs, ums, übers).
const SPOKEN = { auf: ['aufs'], für: ['fürs'], um: ['ums'], über: ['übers'] };
const merged = (prep) => [...Object.values(declension.CONTRACTIONS[prep] || {}), ...(SPOKEN[prep] || [])];
const prepWords = (prep) => [prep, ...merged(prep)];
const bare = (word) => word.replace(/^sich\s+/, '');

// The list: [{ kind, pair, head, prep, case, english, example, source }]; head is the word without the preposition
// ("sich freuen", "die Angst").
function readList(text) {
  return anki.tsvRows(text).map(([kind, pair, kase, english, example, source]) => {
    const words = pair.split(' ');
    return { kind, pair, head: words.slice(0, -1).join(' '), prep: words[words.length - 1], case: kase, english, example, source };
  });
}

// What follows the preposition when it belongs to the verb: an article, a pronoun or a noun ("auf den Bus", "auf dich",
// "auf Regen") — not "zu sein", "zu gehen", "zu ängstlich", and not a fixed phrase of its own (zu Hause, am Montag).
const OBJECT = /^(d(?:er|ie|as|em|en|es)|(?:[kmd]?ein|sein\p{L}|ihr|unser|eue?r|dies|jed|all)\p{L}*|mich|dich|ihn|ihm|uns|euch|ihnen|mir|dir|sie|es|etwas|nichts|was|wen|wem|\p{Lu}\p{L}*)$/u;
const PHRASE = /^(Hause|Ende|Fuß|Anfang|Schluss|Beispiel|Glück|Mittag|Abend|Morgen|Nachmittag|Vormittag|Wochenende|ersten|letzten|Jahr|Sommer|Winter|Frühling|Herbst|(Mon|Diens|Donners|Frei|Sams|Sonn)tag|Mittwoch|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)$/u;

// The index (in splitWords' words) of the preposition used as the pair's, or -1: the preposition or its merged form,
// not first in its sentence ("Nach dem Zwischenfall …"), followed by an object and no fixed phrase; from word `from` on.
function pairAt({ parts, words }, prep, from = 0) {
  const withArticle = new Set(merged(prep));
  return words.findIndex((w, k) => {
    const next = words[k + 1]?.text || '';
    if (k < from || k === 0 || /[.!?]\s*$/.test(parts[w.i - 1]) || PHRASE.test(next)) return false;
    return withArticle.has(w.w) || (w.w === prep && OBJECT.test(next));
  });
}

// The sentence as HTML with the pair's preposition bold — after the noun or adjective it belongs to, if `after` is given
// ("warten auf eine Antwort auf meine Frage"), else the first that fits, else the first.
function bold(sentence, prep, after = null) {
  const split = cloze.splitWords(sentence);
  const all = new Set(prepWords(prep));
  const head = after ? split.words.findIndex((w) => w.w === after.toLowerCase()) : -1;
  const k = (head >= 0 && pairAt(split, prep, head + 1) >= 0) ? pairAt(split, prep, head + 1) : pairAt(split, prep);
  const at = split.words[k >= 0 ? k : split.words.findIndex((w) => all.has(w.w))]?.i;
  return split.parts.map((p, i) => (i === at ? `<b>${anki.html(p)}</b>` : anki.html(p))).join('');
}

// The deck's learnt verb cards by infinitive (without sich; "(sich) …" cards included), hardest first: all of them, so
// "freuen" and "sich freuen" can both lend an example.
function deckVerbs(notes) {
  const byInf = new Map();
  for (const note of vocab.learnt(notes).filter((n) => verbs.isVerbCard(n, clean))) {
    const inf = verbs.readCard(clean(note.word))?.inf;
    if (inf) byInf.set(inf, [...(byInf.get(inf) || []), note]);
  }
  return byInf;
}

// A deck example of the verb with the preposition used that way: { de, en }, or null.
function deckExample(cards, prep) {
  for (const note of cards) {
    const ex = note.examples.find((e) => pairAt(cloze.splitWords(clean(e.de)), prep) >= 0);
    if (ex) return { de: clean(ex.de), en: clean(ex.en) };
  }
  return null;
}

// The notes to import: the learnt verbs' first (hardest first), then the list's order. Wort, the first field (Anki's key),
// is the whole pair with its case, hidden on the card: "sich freuen ___" alone would be three notes in one.
// Tags: the kind, the case, the source, gelernt, and "paar" where the same word takes another preposition (sich freuen
// auf / über).
function buildDeck(list, notes) {
  const deck = deckVerbs(notes);
  const heads = new Map();
  for (const e of list) heads.set(e.head, (heads.get(e.head) || 0) + 1);
  const rows = list.map((e) => {
    const cards = e.kind === 'Verb' ? deck.get(bare(e.head)) || [] : [];
    const own = deckExample(cards, e.prep);
    const ex = own || { de: e.example, en: '' };
    return {
      Schlüssel: `${e.pair} + ${e.case}`, Wort: `${e.head} ___`, Englisch: anki.html(e.english), Antwort: `${e.prep} + ${e.case}`,
      Beispiel: bold(ex.de, e.prep, e.kind === 'Verb' ? null : e.head.split(' ').pop()), BeispielEN: anki.html(ex.en), note: cards[0],
      tags: [e.kind.toLowerCase(), e.case.toLowerCase(), e.source.replace('*', ''), ...(own ? ['anki-beispiel'] : []),
        ...(heads.get(e.head) > 1 ? ['paar'] : []), ...(cards.length ? ['gelernt'] : [])],
    };
  });
  const learnt = rows.filter(anki.learnt).sort((a, b) => vocab.hardestFirst(a.note, b.note));
  return [...learnt, ...rows.filter((r) => !anki.learnt(r))];
}

const DECK = {
  name: 'Präpositionen', fields: FIELDS, prefix: 'praep',
  front: `
    <div class="word">{{Wort}}</div>
    <div class="en">{{Englisch}}</div>
    <div class="hint">Präposition + Akk / Dat</div>
    {{type:Antwort}}`,
  back: `
    {{FrontSide}}
    <hr id=answer>
    <p>{{Beispiel}}{{#BeispielEN}}<br><i>{{BeispielEN}}</i>{{/BeispielEN}}</p>`,
  css: '.word { font-size: 1.6em; } .en { color: #888; } .hint { color: #aaa; font-size: 0.8em; margin-bottom: 1em; }',
  about: `Type the answer as "auf + Akk" (or "mit + Dat"). Tags: praep::verb / ::adjektiv / ::nomen, ::akk / ::dat, ::paar
   (the same word with another preposition, e.g. sich freuen auf / über), ::gelernt (the verb is learnt in the main deck;
   these come first), ::anki-beispiel (the example is your deck's), and the source: ::quillbot (quillbot.com's list of
   190 verbs) or ::added.`,
};

if (require.main === module) {
  anki.run(DECK, (notes) => {
    const rows = buildDeck(readList(fs.readFileSync(LIST, 'utf8')), notes);
    const own = rows.filter((r) => r.tags.includes('anki-beispiel')).length;
    return { rows, summary: `${rows.length} notes (${rows.filter(anki.learnt).length} with a learnt verb, ${own} with your deck's example)` };
  }, process.argv[2]);
}

module.exports = { readList, buildDeck, bold, DECK };
