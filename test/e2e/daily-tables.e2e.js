'use strict';

// The real app (harness.js): tables marked learnt on Progress, and Daily tables, which goes through them. Run with
// `npm run test:e2e`. ETUDES_SHOTS=<dir> also saves screenshots of the home cards, a topic's marks, Daily tables'
// options and a table.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withApp, skip } = require('./harness.js');
const { dayOf } = require('../../src/core/daily.js');

test('marking tables learnt and Daily tables', { timeout: 120000, skip }, () => withApp(async (app) => {
  const { evaluate, screen, focused, click, text, key, shot, openTopic, choose, tickPart, tickTopic, learnt, said } = app;
  const lines = () => evaluate(`[...document.querySelectorAll('#options-marks .marks-line')].map((l) => l.textContent)`);
  const card = (id) => text(`#daily [data-topic="${id}"] .topic-sub`);
  const shown = (id) => evaluate(`!document.getElementById(${JSON.stringify(id)}).hidden`);

  await click('#speak-toggle'); // read nothing aloud

  // Nothing learnt: the card says so, and Daily tables explains how to mark a table.
  assert.equal(await card('daily-tables'), 'No table marked learnt yet');
  await openTopic('daily-tables');
  assert.equal(await text('#options-title'), 'Daily tables');
  assert.match(await text('#options-error'), /^No table is marked learnt yet\. In Progress, tick Table for Adjektivendungen, .* or Nominalisierung\.$/);
  assert.equal(await evaluate(`document.querySelector('#options-actions button').disabled`), true);
  assert.equal(await evaluate(`document.getElementById('options-marks').hidden`), true, 'no marks on Daily tables itself');
  await key('Escape');
  assert.equal(await screen(), 'home');

  // In Progress: all of Passiv's auxiliary table; Artikelwörter's ein-words table, whose cases are not part of it.
  await click('#btn-progress');
  await tickTopic('passive', 'table');
  assert.deepEqual(await learnt(), { passive: { table: {
    parts: { kinds: ['werden', 'sein', 'bekommen', 'ersatz'], tenses: ['praes', 'praet', 'perf', 'plusq', 'fut'] }, since: (await learnt()).passive.table.since,
  } } });
  await click('#progress [aria-controls="progress-parts-determiners"]');
  await tickPart('determiners', 'table', 'families', 'ein');
  assert.deepEqual((await learnt()).determiners.table.parts, { families: ['ein'] });
  assert.equal(await evaluate(`document.getElementById('progress-determiners-table-cases-dat')`), null);
  await key('Escape');

  // The options screen says what is learnt. No case ticked for a round does not keep the table out.
  await openTopic('determiners');
  assert.deepEqual(await lines(), ['Not learnt for sentences yet', 'Learnt for the table: ein-words']);
  for (const c of ['Nominativ', 'Akkusativ', 'Dativ', 'Genitiv']) await choose(c);
  assert.equal(await text('#options-error'), 'Pick at least one: cases.');
  assert.deepEqual(await lines(), ['Not learnt for sentences yet', 'Learnt for the table: ein-words']);
  await shot('tables-2-marks');
  await key('Escape');
  await openTopic('passive');
  assert.deepEqual(await lines(), ['Not learnt for sentences yet', 'Learnt for the table: the whole table']);
  await key('Escape');

  assert.equal(await card('daily-tables'), '2 learnt tables · not done yet today');
  assert.equal(await card('daily'), 'No topic marked learnt yet', 'the Daily review is apart');
  await shot('tables-1-home');

  // Passiv done yesterday, Artikelwörter never: Artikelwörter first.
  await evaluate(`Etudes.store.write('etudes-daily', { table: { seen: { passive: Date.now() - 86400000 } } })`);
  await openTopic('daily-tables');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#options-listing li b')].map((b) => b.textContent)`),
    ['Artikelwörter — Endings table', 'Passiv — Auxiliary verbs']);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#options-listing li span')].map((s) => s.textContent.split(' · learnt')[0])`),
    ['ein-words', 'the whole table']);
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
