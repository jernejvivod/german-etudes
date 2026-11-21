'use strict';

// The real app (harness.js): marking tables learnt, and Daily tables, which goes through them. Run with `npm run test:e2e`.
// ETUDES_SHOTS=<dir> also saves screenshots of the home cards, the learnt switches, Daily tables' options and a table.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withApp, skip } = require('./harness.js');
const { dayOf } = require('../../src/core/daily.js');

test('marking tables learnt and Daily tables', { timeout: 120000, skip }, () => withApp(async (app) => {
  const { evaluate, screen, focused, click, text, key, shot, openTopic, said } = app;
  // A choice on the options screen by its label (der-words …).
  const choose = (label) => evaluate(`[...document.querySelectorAll('#options label.radio')]
    .find((l) => l.querySelector('b').textContent === ${JSON.stringify(label)}).querySelector('input').click()`);
  const learnt = () => evaluate(`JSON.parse(localStorage.getItem('etudes-learnt'))`);
  const notes = () => evaluate(`[...document.querySelectorAll('#options-learnt .learnt-note')].map((n) => n.textContent)`);
  const card = (id) => text(`#daily [data-topic="${id}"] .topic-sub`);
  const shown = (id) => evaluate(`!document.getElementById(${JSON.stringify(id)}).hidden`);

  await click('#speak-toggle'); // read nothing aloud

  // Nothing learnt: the card says so, and Daily tables explains how to mark a table.
  assert.equal(await card('daily-tables'), 'No table marked learnt yet');
  await openTopic('daily-tables');
  assert.equal(await text('#options-title'), 'Daily tables');
  assert.match(await text('#options-error'), /^No table is marked learnt yet\. Open Adjektivendungen, .* and turn on Table learnt on its options screen\.$/);
  assert.equal(await evaluate(`document.querySelector('#options-actions button').disabled`), true);
  assert.equal(await evaluate(`document.getElementById('options-learnt').hidden`), true, 'no switch on Daily tables itself');
  await key('Escape');
  assert.equal(await screen(), 'home');

  // Passiv's auxiliary table, as it is.
  await openTopic('passive');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#options-learnt input')].map((i) => i.name)`), ['learnt-sentences', 'learnt-table']);
  await click('#options-learnt input[name="learnt-table"]');
  assert.deepEqual(await learnt(), { passive: { table: { settings: { kinds: ['werden'], tenses: ['praes', 'praet', 'perf'] }, since: (await learnt()).passive.table.since } } });
  await shot('tables-2-switches');
  await key('Escape');

  // Artikelwörter's ein-words table only; the cases are not part of it.
  await openTopic('determiners');
  await choose('der-words');
  await click('#options-learnt input[name="learnt-table"]');
  assert.deepEqual((await learnt()).determiners.table.settings, { families: ['ein'] });
  await choose('Dativ');
  assert.deepEqual(await notes(), [], 'the cases are not part of the table');
  await choose('Dativ');
  await choose('der-words');
  assert.deepEqual(await notes(), ['Daily tables use: ein-words.Use these settings']);
  await choose('der-words');
  assert.deepEqual(await notes(), []);
  await key('Escape');

  assert.equal(await card('daily-tables'), '2 learnt tables · not done yet today');
  assert.equal(await card('daily'), 'No topic marked learnt yet', 'the Daily review is apart');
  await shot('tables-1-home');

  // Passiv done yesterday, Artikelwörter never: Artikelwörter first.
  await evaluate(`Etudes.store.write('etudes-daily', { table: { seen: { passive: Date.now() - 86400000 } } })`);
  await openTopic('daily-tables');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#options-listing li b')].map((b) => b.textContent)`),
    ['Artikelwörter — Endings table', 'Passiv — Auxiliary verbs']);
  await shot('tables-3-options');
  await key('Enter');
  assert.equal(await screen(), 'table');
  assert.equal(await shown('table-source'), true);
  assert.equal(await text('#table-source'), 'Artikelwörter');
  assert.equal(await evaluate(`document.querySelectorAll('#tables .block').length`), 1);
  assert.equal(await text('#btn-table-next'), 'Continue: Passiv — Auxiliary verbs →');
  await shot('tables-4-table');
  await click('#btn-table-check');
  assert.equal(await shown('table-score'), true);
  await click('#btn-table-next');
  assert.equal(await screen(), 'table');
  assert.equal(await text('#table-source'), 'Passiv');
  assert.equal(await text('#btn-table-next'), 'New round');
  await click('#btn-table-check');
  assert.equal(await shown('table-score'), true);

  await key('Escape');
  await key('Escape');
  assert.equal(await screen(), 'options');
  assert.equal(await text('#options-title'), 'Daily tables');
  await key('Escape');
  assert.equal(await screen(), 'home');
  assert.equal(await card('daily-tables'), 'Done today ✓');
  const log = await evaluate(`JSON.parse(localStorage.getItem('etudes-daily'))`);
  assert.equal(log.table.done, dayOf(Date.now()));
  assert.deepEqual(Object.keys(log.table.seen).sort(), ['determiners', 'passive']);
  assert.equal(log.sentences, undefined);

  // ⇧Esc twice from a new round: home, on the Daily tables card.
  await openTopic('daily-tables');
  await key('Enter');
  assert.equal(await screen(), 'table');
  await key('Escape', true);
  await key('Escape', true);
  assert.equal(await screen(), 'home');
  assert.equal(await focused(), 'daily-tables');

  // A topic's own table shows no source.
  await openTopic('passive');
  await click('#options-actions button:nth-child(2)'); // Auxiliary tables only
  assert.equal(await screen(), 'table');
  assert.equal(await shown('table-source'), false);

  assert.deepEqual(said(), [], 'nothing read aloud');
  assert.ok(app.ranOnTempProfile(), 'the app ran on the temp profile');
}));
