// What the deck tools share: writing an Anki package (.apkg) of a deck with its note type, and running a tool — load the
// collection, write the files. A deck: { name (the note type; the deck is Deutsch::name), fields, prefix (of the tags),
// front, back, css (the card's templates and styling), about (the deck's description) }. A row: { [field]: HTML, tags }.
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Anki's Python, with its library: the package is written by tools/anki-apkg.py.
const PYTHON = process.env.ANKI_PYTHON || path.join(os.homedir(), 'Library/Application Support/AnkiProgramFiles/.venv/bin/python');
const APKG = path.join(__dirname, 'anki-apkg.py');

// The fields are HTML: text from the cards (decoded by clean) goes in escaped; the tools add their own <b> around it.
const html = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hash = (...parts) => crypto.createHash('sha1').update(parts.join('\0')).digest();

// The package's notes: [{ guid, fields, tags }]. The guid comes from the deck and the first field (with its count, where
// two notes share it), so the same note gets the same guid in every build and a re-import updates it.
function notes({ name, fields, prefix }, rows) {
  const seen = new Map();
  return rows.map((r) => {
    const key = String(r[fields[0]] ?? '');
    seen.set(key, (seen.get(key) || 0) + 1);
    return {
      guid: hash(name, key, seen.get(key)).toString('base64url').slice(0, 12),
      fields: fields.map((f) => String(r[f] ?? '')),
      tags: r.tags.map((t) => `${prefix}::${t}`),
    };
  });
}

// What tools/anki-apkg.py reads: the note type (with an id of its own, the same in every build) and the notes.
function packageSpec(deck, rows) {
  const { name, fields, front, back, css, about } = deck;
  const trim = (s) => s.trim().split('\n').map((l) => l.trim()).join('\n');
  return {
    name, id: 1e12 + (hash(name).readUInt32BE(0) % 1e9), deck: `Deutsch::${name}`, about: about.trim().replace(/\s*\n\s*/g, ' '),
    fields, front: trim(front), back: trim(back), css, notes: notes(deck, rows),
  };
}

function writePackage(deck, rows, file) {
  if (!fs.existsSync(PYTHON)) throw new Error(`Anki's Python is not at ${PYTHON}: set ANKI_PYTHON to it`);
  execFileSync(PYTHON, ['-I', APKG, file], { input: JSON.stringify(packageSpec(deck, rows)), stdio: ['pipe', 'inherit', 'inherit'] });
}

// Runs a tool: reads the collection, builds the rows (build(notes) → { rows, files?: { suffix: text }, summary }), writes
// "<name>.apkg" and any further files ("<name> – suffix.txt") to the folder `out` (default ~/Documents).
function run(deck, build, out) {
  out ||= path.join(os.homedir(), 'Documents');
  (async () => {
    const { loadAnki } = require('../anki.js');
    const result = await loadAnki();
    if (result.error) throw new Error(result.error);
    const { rows, files = {}, summary } = build(result.notes);
    writePackage(deck, rows, path.join(out, `${deck.name}.apkg`));
    for (const [suffix, text] of Object.entries(files)) fs.writeFileSync(path.join(out, `${deck.name} – ${suffix}.txt`), text);
    console.log(`${summary} → ${out}`);
  })().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

const learnt = (row) => row.tags.includes('gelernt');

// The rows of a tab-separated data file, its fields split; blank lines and "#" comments left out.
const tsvRows = (text) => text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.split('\t'));

module.exports = { packageSpec, run, learnt, html, tsvRows };
