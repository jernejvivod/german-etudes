'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const anki = require('../tools/anki-import.js');

test('the shared package spec: fields in order, prefixed tags, the same guids and note type id in every build', () => {
  const deck = { name: 'Test', fields: ['A', 'B'], prefix: 't', front: '\n    {{A}}\n    {{type:B}}', back: '{{B}}', css: '.a {}', about: '\n  One\n  two.' };
  const rows = [{ A: 'x', B: 'y', tags: ['one', 'two'] }, { A: 'x', tags: [] }, { A: 'z', B: 'w', tags: [] }];
  const spec = anki.packageSpec(deck, rows);
  assert.deepEqual([spec.deck, spec.front, spec.about], ['Deutsch::Test', '{{A}}\n{{type:B}}', 'One two.']);
  assert.deepEqual(spec.notes.map((n) => [n.fields, n.tags]), [[['x', 'y'], ['t::one', 't::two']], [['x', ''], []], [['z', 'w'], []]]);
  assert.equal(new Set(spec.notes.map((n) => n.guid)).size, 3, 'two notes with the same first field get guids of their own');
  assert.deepEqual(anki.packageSpec(deck, rows.slice(0, 1)).notes[0].guid, spec.notes[0].guid);
  assert.ok(Number.isSafeInteger(spec.id) && spec.id === anki.packageSpec({ ...deck, about: '' }, []).id);
});
