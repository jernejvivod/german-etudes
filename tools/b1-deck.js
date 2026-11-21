// Builds an Anki package (.apkg) of the Goethe-Zertifikat B1 Wortliste's words that are not cards of the Langenscheidt deck:
// the headword with its forms (die Abbildung, -en; abbiegen, biegt ab, bog ab, ist abgebogen), the English (from
// tools/b1-glosses.tsv), the list's own example sentences, and where a word is regional (A, CH, D) its notes.
//
// The word list is the Goethe-Institut's PDF (copyrighted: for your own use only), read with pdftotext:
//   https://www.goethe.de/pro/relaunch/prf/da/Goethe-Zertifikat_B1_Wortliste.pdf
// Run (reads the Anki collection read-only, through a snapshot; needs pdftotext, e.g. brew install poppler):
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron tools/b1-deck.js <the PDF> [output folder, default ~/Documents]
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const cloze = require('../src/core/cloze.js');
const anki = require('./anki-import.js');

const { clean } = cloze;
const GLOSSES = path.join(__dirname, 'b1-glosses.tsv');

// ---------- The word list ----------

// Page furniture between the entries, and the notes page.
const FURNITURE = /^(WORTLISTE|ZERTIFIKAT( B1)?|VS_\d+\w*|\d{1,3}|[A-ZÄÖÜ]|INHALT)$/;
const STRAY = /Ihre Notizen|Goethe-Institut/;
// The line's pieces: words with single spaces between them (two or more spaces separate the columns).
const pieces = (line) => [...line.matchAll(/\S+(?: \S+)*/g)].filter((m) => !FURNITURE.test(m[0]));

// Where a page's right headword column starts (pdftotext -layout shifts it from page to page, 80 to 89): the most common
// start of a piece there. The left one starts at 8.
function rightColumn(lines) {
  const counts = new Map();
  for (const line of lines) for (const { index } of pieces(line)) if (index >= 70 && index < 100) counts.set(index, (counts.get(index) || 0) + 1);
  return [...counts].reduce((best, c) => (c[1] > best[1] ? c : best), [82, 0])[0];
}
// A headword's lines (indented when they go on) start at most this far into its column; the examples start further in
// (they vary within a page, 26 to 36).
const HEAD_WIDTH = 22;
// A verb's headword: the infinitive and its forms ("abbiegen, biegt ab, …", "(sich) ärgern, …").
const VERB_HEAD = /^(?:\(sich\) |sich )?\p{Ll}+n,/u;
// A region mark and what follows it: "(A, CH) → D: Geldautomat", "→ D, A: Friseur", "CH: Zivilstand".
const REGION = /\((?:D|A|CH)(?:,\s*(?:D|A|CH))*\).*|→.*|(?:^|(?<=\s))(?:A|CH|D)(?:,\s*(?:A|CH|D))*:.*/;

// The alphabetical part of the list as entries { head, examples }: two columns per page, each a headword column (with
// the forms) and an example column. A headword line continues the entry while its forms are unfinished (a trailing
// comma, a hyphen inside a word, an arrow to a regional form) or its example sentence is still running.
function parseList(text) {
  const start = text.lastIndexOf('Alphabetischer Wortschatz');
  const body = text.slice(text.indexOf('\n', start) + 1).split(/^\s*3\s+Wortgruppen/m)[0];
  const entries = [];
  const current = { L: null, R: null };
  // goesOn: an indented headword line with nothing beside it, which goes on with the regional forms above ("D: in
  // Rente" + "gehen/sein").
  const add = (side, t, isHead, goesOn) => {
    let e = current[side];
    if (!isHead) {
      e?.ex.push(t);
      return;
    }
    // A head that ran into its example ("das Spiel, -e 1. Monopoly …", "die Aprikose, -n (D, CH) → Schmecken dir …?").
    const tail = t.match(/\s(\d\.\s.*)$/) || t.match(/(?<=→)\s(\p{Lu}\p{Ll}+ .*[.!?])$/u);
    if (tail) t = t.slice(0, tail.index);
    if (!(goesOn && REGION.test(e?.head.at(-1))) && startsEntry(e, t)) {
      e = { head: [], ex: [] };
      entries.push(e);
      current[side] = e;
    }
    e.head.push(t);
    if (tail) e.ex.push(tail[1]);
  };
  for (const page of body.split('\f')) {
    const lines = page.split('\n');
    const right = rightColumn(lines);
    for (const line of lines) {
      const all = pieces(line);
      // A headword continued with an indent can start a little to the left of its column.
      for (const [side, from] of [['L', 8], ['R', right]]) {
        const own = all.filter((m) => (m.index < right - 6) === (side === 'L'));
        // A headword: the side's first piece, at its column or (a word of a family, "das Gift" → "giftig")
        // set right against its example on the same line or run into it ("die Eile 1. Ich bin …").
        own.forEach((m, i) => add(side, m[0],
          i === 0 && (m.index < from + HEAD_WIDTH || (own.length > 1 && !/^\d+\.$/.test(m[0])) || /^(?:(?:der|die|das) )?\S+ 1\.\s/.test(m[0])),
          own.length === 1 && m.index >= from + 10 && m.index < from + HEAD_WIDTH));
      }
    }
  }
  // Lines joined; a word split by a hyphen at the line end is put back together ("näm-" + "lich", "ver-" + "mietete"),
  // but not "Pro- und Contra".
  const join = (parts) => parts.join(' ').replace(/(\p{L})- (?!(?:und|oder|bis)\b)(\p{Ll})/gu, '$1$2')
    .replace(/(,\s*¨?-) (n|en|nen|e|er|s)\b/g, '$1$2'); // a plural split after its hyphen (", -" + "n")
  return entries.map((e) => ({
    head: join(e.head),
    examples: join(e.ex).split(/(?:^|\s)\d\.\s/).map((x) => x.trim()).filter(Boolean),
  })).filter((e) => !STRAY.test(e.head));
}

// Whether a headword line t starts a new entry after entry e: not while e's forms are unfinished (a trailing comma,
// semicolon or slash, a hyphen inside a word, an arrow, "hat" without its participle, "/ die" without its noun) or its
// example is still running, nor for a line that goes on with the regional forms ("CH: Zivilstand", "→ D, A: Friseur"),
// another form ("/ die Serviceangestellte") or a plural split after its hyphen (", -" + "n (CH) …"). "aller-",
// "her/her-" are entries of their own, and so is a verb's headword.
function startsEntry(e, t) {
  if (!e) return true;
  const last = e.head.at(-1);
  const head = e.head.join(' ');
  if (REGION.exec(t)?.index === 0 || /^(\/|\(hat )/.test(t) || (/,\s*¨?-$/.test(last) && /^(n|en|nen|e|er|s)\b/.test(t))) return false;
  // An open bracket: "hat gewollt (hat wollen als" + "Modalverb)".
  if (head.split('(').length > head.split(')').length) return false;
  // "aller-", "gesamt-/Gesamt-", "was für ein-" (not "die Geschwindigkeits-" + "beschränkung").
  if (e.head.length === 1 && /^(?!(?:der|die|das) )[\p{L}/() -]+-$/u.test(last)) return true;
  // A plural marker ("das Einschreiben, -") ends a head; "es" alone is a headword.
  const unfinished = !/,\s*¨?-$/.test(last) && (/[,;:/→–-]$/.test(last) || /\s(hat|ist|es|sich|der|die|das)$/.test(last));
  // A verb's forms go on to its perfect ("sich anstrengen, strengt" + "sich an, strengte sich an, hat sich angestrengt").
  const verbForms = VERB_HEAD.test(e.head[0]) && !/\b(hat|ist)\s/.test(head);
  if (unfinished || verbForms) return false;
  const running = e.ex.length && !/[.!?…“")]$/.test(e.ex.at(-1));
  return (e.ex.length > 0 && !running) || VERB_HEAD.test(t);
}

// The words a head names, for matching: "der Absender, - die Absenderin, -nen" → Absender, Absenderin; a verb by its
// infinitive ("(sich etwas) aussuchen" → aussuchen), a phrase whole ("bekannt geben"), variants apart ("die/das
// Glace/Glacé" → Glace, Glacé). Regional notes ("(D, A) → CH: Trottoir") are left out here.
function lemmas(head) {
  const main = splitRegion(head)[0];
  const first = main.split(/[,;]/)[0].replace(/\([^)]*\)-?\s*/g, '').replace(/^(?:(?:sich|jdn\.|jdm\.|etw\.)\s+)+/, '')
    .replace(/^(?:der|die|das)(?:\/(?:der|die|das))?\s+/, '').trim();
  const out = first.includes(' ') ? [first] : first.split('/').filter(Boolean);
  for (const m of main.matchAll(/(?:^|\s)(?:der|die|das)\s+(\p{L}[\p{L}-]*)/gu)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

// The head and its regional part, from the first region mark — "(A, CH)" or an arrow to the other forms — to the end:
// [word, region].
function splitRegion(head) {
  const m = head.match(REGION);
  return m ? [head.slice(0, m.index).trim(), m[0].trim()] : [head, ''];
}

// ---------- The deck ----------

// A word with its spaces taken out, as deckWords keeps it: leid tun and leidtun are one word.
const spelling = (w) => w.replace(/ /g, '');

// Every form a deck card names: "Ahnung, die Idee" → Ahnung, Idee; "warten auf" → warten auf, warten; "jemandem etwas
// leihen" → leihen.
const FUNCTION_WORD = /^(etwas|etw\.|jemand(em|en)?|jdm\.|jdn\.|sich|es|in|im|an|am|auf|aus|bei|mit|nach|von|vor|zu|zum|zur|für|um|über|unter|nicht|kein\p{L}*|ein\p{L}*)$/u;
function deckWords(notes) {
  const words = new Set();
  for (const n of notes) {
    for (const part of clean(n.word).split(/[,;/]/)) {
      const ws = part.replace(/\(.*?\)/g, ' ').trim().replace(/^(der|die|das)\s+/, '').split(/\s+/).filter(Boolean);
      while (ws.length > 1 && FUNCTION_WORD.test(ws[0])) ws.shift();
      if (!ws.length) continue;
      words.add(spelling(ws.join(' ')));
      words.add(ws[0]);
    }
  }
  return words;
}

// A feminine -in form counts as there when the deck has the masculine one (Ärztin ↔ Arzt).
const UMLAUT = { ä: 'a', ö: 'o', ü: 'u', Ä: 'A', Ö: 'O', Ü: 'U' };
function inDeck(word, words) {
  if (words.has(spelling(word))) return true;
  if (!/in$/.test(word)) return false;
  const base = word.slice(0, -2);
  return words.has(base) || words.has(base.replace(/[äöüÄÖÜ]/, (c) => UMLAUT[c]));
}

// ---------- The notes ----------

const FIELDS = ['Wort', 'Englisch', 'Beispiel', 'Region'];

// The glosses by word, or by a whole head without its regional part ("der Kasten, ¨-") where two entries share their first
// word; a key twice is reported.
function readGlosses(text) {
  const map = new Map();
  for (const [word, english] of anki.tsvRows(text)) {
    if (map.has(word)) console.warn(`b1-glosses.tsv: "${word}" twice`);
    map.set(word, english);
  }
  return map;
}

// The list's entries none of whose words is a deck card; tags: the part of speech (noun / verb / other) and regional.
function buildDeck(entries, notes, glosses = new Map()) {
  const words = deckWords(notes);
  const seen = new Set();
  const rows = [];
  for (const e of entries) {
    if (seen.has(e.head)) continue;
    seen.add(e.head);
    const names = lemmas(e.head);
    if (!names.length) console.warn(`No word in "${e.head}": left out`);
    if (!names.length || names.some((w) => inDeck(w, words))) continue;
    const [word, reg] = splitRegion(e.head);
    // A noun has its article (der/die Tote); a verb its forms, if not at the start (jdn. erschrecken, …, hat erschreckt).
    const kind = /^(der|die|das)(\/(der|die|das))?\s/.test(e.head) ? 'nomen'
      : VERB_HEAD.test(e.head) || /,\s*(hat|ist)\s/.test(word) ? 'verb' : 'andere';
    const english = glosses.get(word) ?? glosses.get(names[0]) ?? '';
    rows.push({
      Wort: anki.html(word),
      Englisch: anki.html(english),
      Beispiel: e.examples.map(anki.html).join('<br>'),
      Region: anki.html(reg),
      tags: [kind, ...(reg ? ['regional'] : []), ...(english ? [] : ['ohne-englisch'])],
    });
  }
  return rows;
}

const DECK = {
  name: 'B1 Wortschatz', fields: FIELDS, prefix: 'b1',
  front: `
    <div class="word">{{Wort}}</div>
    {{#Region}}<div class="region">{{Region}}</div>{{/Region}}`,
  back: `
    {{FrontSide}}
    <hr id=answer>
    <div class="en">{{Englisch}}</div>
    <p class="ex">{{Beispiel}}</p>`,
  css: '.word { font-size: 1.5em; } .region, .en { color: #888; } .ex { font-size: 0.9em; }',
  about: `The Goethe B1 list's words that are not cards of the Langenscheidt deck. Tags: b1::nomen / ::verb / ::andere,
   ::regional (an Austrian, Swiss or German-only word or form; the Region field names the others).`,
};

if (require.main === module) {
  const pdf = process.argv[2];
  if (!pdf) {
    console.error('Usage: tools/b1-deck.js <Goethe-Zertifikat_B1_Wortliste.pdf> [output folder]');
    process.exit(1);
  }
  const entries = parseList(execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 << 20 }));
  const glosses = readGlosses(fs.readFileSync(GLOSSES, 'utf8'));
  anki.run(DECK, (notes) => {
    const rows = buildDeck(entries, notes, glosses);
    const regional = rows.filter((r) => r.tags.includes('regional')).length;
    const bare = rows.filter((r) => r.tags.includes('ohne-englisch')).length;
    return { rows, summary: `${rows.length} words not in your deck (${regional} regional) of the list's ${entries.length}; ${bare} without English` };
  }, process.argv[3]);
}

module.exports = { parseList, lemmas, splitRegion, deckWords, inDeck, readGlosses, buildDeck, DECK };
