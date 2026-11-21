# Writes an Anki package (.apkg) of one deck and its note type, from the spec tools/anki-import.js sends on stdin:
#   { name, id, deck, about, fields, front, back, css, notes: [{ guid, fields, tags }] }
# It builds the deck in a new, throwaway collection — never yours — with Anki's own library, so run it with Anki's Python:
#   ~/Library/Application Support/AnkiProgramFiles/.venv/bin/python -I tools/anki-apkg.py <out.apkg> < spec.json
# The note type keeps the same id (spec.id) and each note its guid, so a later package of the deck updates the notes
# already imported instead of adding them again.
import json
import os
import sys
import tempfile

from anki.collection import Collection, DeckIdLimit, ExportAnkiPackageOptions


def note_type(col, spec):
    mm = col.models
    m = mm.new(spec['name'])
    for f in spec['fields']:
        mm.add_field(m, mm.new_field(f))
    t = mm.new_template('Card 1')
    t['qfmt'], t['afmt'] = spec['front'], spec['back']
    mm.add_template(m, t)
    m['css'] += '\n' + spec['css']
    # Anki gives a new note type a new id; it is set afterwards (the collection is empty, so nothing else refers to it).
    made = mm.add_dict(m).id
    for table, column in (('notetypes', 'id'), ('fields', 'ntid'), ('templates', 'ntid')):
        col.db.execute(f'update {table} set {column} = ? where {column} = ?', spec['id'], made)


def main(out):
    spec = json.load(sys.stdin)
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, 'collection.anki2')
        col = Collection(path)
        note_type(col, spec)
        # Reopened, so that Anki's cache of note types forgets the old id.
        col.close()
        col = Collection(path)
        m = col.models.get(spec['id'])
        assert m, f"the note type's id was not set to {spec['id']}"
        did = col.decks.id(spec['deck'])
        deck = col.decks.get(did)
        deck['desc'] = spec['about']
        col.decks.save(deck)
        for n in spec['notes']:
            note = col.new_note(m)
            note.fields[:] = n['fields']
            note.guid, note.tags = n['guid'], n['tags']
            col.add_note(note, did)
        options = ExportAnkiPackageOptions(with_scheduling=False, with_deck_configs=False, with_media=False)
        col.export_anki_package(out_path=out, options=options, limit=DeckIdLimit(did))
        col.close()


main(sys.argv[1])
