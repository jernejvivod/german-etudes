'use strict';

// The real app (harness.js): the Progress screen, every topic's parts with ✓ where marked learnt. Run with
// `npm run test:e2e`. ETUDES_SHOTS=<dir> also saves screenshots of the home screen and the checklist.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withApp, skip } = require('./harness.js');

test('the Progress checklist', { timeout: 120000, skip }, () => withApp(async (app) => {
  const { evaluate, screen, focused, toast, click, text, key, shot, openTopic, choose, said } = app;
  const marks = (id) => evaluate(`[...document.querySelectorAll('#progress [data-topic="${id}"] .check-mark')].map((m) => m.textContent)`);
  const parts = (id) => evaluate(`[...document.querySelectorAll('#progress-parts-${id} .check-part')].map((p) => p.textContent)`);
  const expanded = () => evaluate(`[...document.querySelectorAll('#progress button.check-toggle')]
    .filter((b) => b.getAttribute('aria-expanded') === 'true').map((b) => b.getAttribute('aria-controls'))`);
  const count = () => text('#progress-count');

  // Nothing learnt: every topic collapsed, the focus on the first line; Esc goes back to the link.
  await shot('progress-1-home');
  await click('#btn-progress');
  assert.equal(await screen(), 'progress');
  assert.match(await count(), /^0 of \d+ parts learnt · 0 of 10 topics marked learnt$/);
  const total = Number((await count()).split(' ')[2]);
  assert.equal(await evaluate(`document.querySelectorAll('#progress button.check-toggle').length`), 8, 'no toggle without parts');
  assert.deepEqual(await expanded(), []);
  assert.equal(await focused(), 'adjectives');
  await key('Escape');
  assert.equal(await screen(), 'home');
  assert.equal(await focused(), 'btn-progress');

  // Passiv: its sentences without Perfekt, its table with it.
  await openTopic('passive');
  await choose('Perfekt');
  await click('#options-learnt input[name="learnt-sentences"]');
  await choose('Perfekt');
  await click('#options-learnt input[name="learnt-table"]');
  await key('Escape');

  // Artikelwörter's ein-words table.
  await openTopic('determiners');
  await choose('der-words');
  await click('#options-learnt input[name="learnt-table"]');
  await key('Escape');

  await click('#btn-progress');
  assert.equal(await count(), `5 of ${total} parts learnt · 2 of 10 topics marked learnt`);
  assert.deepEqual(await marks('passive'), ['Sentences ✓', 'Table ✓ (Vorgangspassiv · Präsens, Präteritum, Perfekt)']);
  assert.deepEqual(await marks('determiners'), ['Sentences ✗', 'Table ✓ (ein-words)']);
  assert.deepEqual(await marks('verbforms'), ['Sentences ✗']);
  assert.equal(await evaluate(`document.querySelector('#progress [data-topic="passive"] .check-mark').title`),
    'The Daily review uses: Vorgangspassiv · Präsens, Präteritum');
  assert.deepEqual(await parts('passive'), ['✓ Vorgangspassiv', '✗ Zustandspassiv', '✗ Rezipientenpassiv', '✗ Passiversatz',
    '✓ Präsens', '✓ Präteritum', '✓ Perfekt · table only', '✗ Plusquamperfekt', '✗ Futur I']);
  assert.deepEqual(await parts('determiners'), ['✗ der-words', '✓ ein-words', '✗ Nominativ', '✗ Akkusativ', '✗ Dativ', '✗ Genitiv']);
  assert.deepEqual(await expanded(), ['progress-parts-passive', 'progress-parts-determiners']);
  assert.equal(await evaluate(`document.getElementById('progress-parts-verbforms').hidden`), true);
  await shot('progress-2-checklist');
  await click('#progress [aria-controls="progress-parts-verbforms"]');
  assert.equal(await evaluate(`document.getElementById('progress-parts-verbforms').hidden`), false);
  const verbforms = await parts('verbforms');
  assert.equal(verbforms.length, 10);
  assert.ok(verbforms.every((p) => p.startsWith('✗ ')));
  assert.deepEqual(await evaluate(`[...new Set([...document.querySelectorAll('#progress .tick')]
    .map((t) => t.getAttribute('role') + ':' + t.getAttribute('aria-label')))].sort()`),
  ['img:Learnt', 'img:Not yet', 'img:learnt', 'img:not yet']);
  assert.equal(await evaluate(`document.querySelectorAll('#progress input').length`), 0, 'read-only');
  await shot('progress-3-expanded');

  // A topic's line opens its options; Esc goes home, on that topic.
  await openTopic('determiners', '#progress');
  assert.equal(await text('#options-title'), 'Artikelwörter');
  assert.equal(await evaluate(`document.querySelector('#options-learnt input[name="learnt-table"]').checked`), true);
  await key('Escape');
  assert.equal(await screen(), 'home');
  assert.equal(await focused(), 'determiners');

  // ⇧Esc and ← Topics also go home at once.
  await click('#btn-progress');
  await key('Escape', true);
  assert.equal(await screen(), 'home');
  assert.equal(await focused(), 'btn-progress');
  assert.equal(await toast(), null);
  await click('#btn-progress');
  await click('#progress .to-topics');
  assert.equal(await screen(), 'home');

  assert.deepEqual(said(), [], 'nothing read aloud');
  assert.ok(app.ranOnTempProfile(), 'the app ran on the temp profile');
}));
