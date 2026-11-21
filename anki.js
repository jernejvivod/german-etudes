// Reads the Langenscheidt deck from the local Anki collection (main process only).
// Anki may be running, so the collection is snapshotted with SQLite's backup API (consistent even mid-write) into a temp
// folder and read there; the original is only ever opened read-only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DECK = 'Langenscheidt Basic German Vocabulary';
const EXAMPLES = 5;
const ROLLOVER_HOURS = 4;

// Anki's data folder per platform; a profile is any subfolder holding a collection.
function ankiBase() {
  const home = os.homedir();
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Anki2');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Anki2');
  return path.join(home, '.local', 'share', 'Anki2');
}

// The most recently used profile's collection, or null.
function findCollection(base) {
  let entries;
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return null;
  }
  const found = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const file = path.join(base, e.name, 'collection.anki2');
    try {
      found.push({ file, mtime: fs.statSync(file).mtimeMs });
    } catch {
      // Not a profile.
    }
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return found[0]?.file || null;
}

// The deck's notes with their raw fields and, for notes that are learnt, how soon they are due and how hard they are:
//   dueIn: days until the earliest card is due (negative = overdue; 0 for cards relearning after a lapse; null = not learnt yet);
//   lapses: most lapses of a card; ease: lowest ease factor.
// Cards in a filtered deck (custom study) still belong here: their home deck is odid and their real due date odue.
function readDeck(file) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const { crt } = db.prepare('SELECT crt FROM col').get();
    // crt is the collection's first day at its rollover hour, so whole days since then = Anki's day number.
    const today = Math.floor((Date.now() / 1000 - crt) / 86400);
    const deckIds = db.prepare('SELECT id, name FROM decks').all()
      .filter((d) => d.name.split('\x1f').includes(DECK))
      .map((d) => d.id);
    if (!deckIds.length) return { error: `No "${DECK}" deck in the Anki collection.` };

    const fieldNames = new Map();
    const fieldsOf = (mid) => {
      if (!fieldNames.has(mid)) {
        fieldNames.set(mid, db.prepare('SELECT name FROM fields WHERE ntid = ? ORDER BY ord').all(mid).map((f) => f.name));
      }
      return fieldNames.get(mid);
    };

    const rows = db.prepare(`
      WITH learnt AS (
        SELECT c.*, CASE
          WHEN c.queue = 2 THEN (CASE WHEN c.odid THEN c.odue ELSE c.due END) - :today
          WHEN c.queue IN (1, 3) THEN 0
        END AS dueIn
        FROM cards c
        WHERE c.did IN (${deckIds.join(',')}) OR c.odid IN (${deckIds.join(',')})
      )
      SELECT n.id, n.mid, n.flds,
        MIN(l.dueIn) AS dueIn,
        COALESCE(MAX(CASE WHEN l.dueIn IS NOT NULL THEN l.lapses END), 0) AS lapses,
        MIN(CASE WHEN l.dueIn IS NOT NULL THEN l.factor END) AS ease
      FROM learnt l JOIN notes n ON n.id = l.nid
      GROUP BY n.id`).all({ today });

    const notes = rows.map((row) => {
      const names = fieldsOf(row.mid);
      const values = row.flds.split('\x1f');
      const field = (name) => values[names.indexOf(name)] ?? '';
      const examples = [];
      for (let i = 1; i <= EXAMPLES; i++) {
        const de = field(`Example ${i} (German)`);
        if (de) examples.push({ de, en: field(`Example ${i} (English)`) });
      }
      return {
        id: row.id,
        article: field('Article'),
        word: field('Word'),
        pos: field('Part of Speech, …'),
        english: field('English'),
        headings: [field('Heading 1'), field('Heading 2'), field('Heading 3')].filter(Boolean),
        examples,
        dueIn: row.dueIn,
        lapses: row.lapses,
        ease: row.ease,
      };
    });
    return { notes };
  } finally {
    db.close();
  }
}

// Anki declares some text columns with its own "unicase" collation, which node:sqlite cannot register; SQLite then refuses
// every query on the `fields` table ("no query solution"). In our throwaway copy the collation is dropped from the schema
// (we never search by those columns).
function dropUnicase(file) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file, { defensive: false });
  try {
    db.exec(`PRAGMA writable_schema = ON;
      UPDATE sqlite_master SET sql = replace(replace(sql, 'COLLATE unicase', ''), 'collate unicase', '') WHERE sql LIKE '%unicase%';
      PRAGMA writable_schema = OFF;`);
  } finally {
    db.close();
  }
}

// The deck's version as the renderer last saw it: the collection's and its log's modification times, plus the day
// (due dates count from today). Reviews in Anki change the files, so an unchanged stamp means nothing to resend.
function stampOf(file) {
  const mtime = (f) => {
    try {
      return fs.statSync(f).mtimeMs;
    } catch {
      return 0; // no write-ahead log right now
    }
  };
  // Anki's day starts at 4 am (its default rollover), and so do the due dates read from it.
  const day = new Date(Date.now() - ROLLOVER_HOURS * 3600e3).toDateString();
  return `${file}|${mtime(file)}|${mtime(file + '-wal')}|${day}`;
}

// Snapshots the collection into a temp folder, reads it, and removes the snapshot — unless the deck is unchanged
// since `known` (the stamp of the caller's copy).
async function loadAnki(known = null) {
  const file = findCollection(ankiBase());
  if (!file) return { error: `No Anki collection found in ${ankiBase()}.` };
  const stamp = stampOf(file);
  if (stamp === known) return { unchanged: true };
  const sqlite = require('node:sqlite');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'german-etudes-anki-'));
  try {
    const copy = path.join(dir, 'collection.anki2');
    const source = new sqlite.DatabaseSync(file, { readOnly: true });
    try {
      await sqlite.backup(source, copy);
    } finally {
      source.close();
    }
    dropUnicase(copy);
    return { ...readDeck(copy), stamp };
  } catch (err) {
    return { error: `Could not read the Anki collection: ${err.message}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { loadAnki };
