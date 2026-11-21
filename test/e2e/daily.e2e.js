'use strict';

// The real app (harness.js): marking topics learnt, and the Daily review that mixes them. Run with `npm run test:e2e`.
// ETUDES_SHOTS=<dir> also saves screenshots of the home card, the learnt switch, the review's options, a sentence and
// the summary.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withApp, skip } = require('./harness.js');
const { dayOf } = require('../../src/core/daily.js');

test('marking topics learnt and the Daily review', { timeout: 120000, skip }, () => withApp(async (app) => {
  const { evaluate, waitFor, screen, focused, click, text, key, shot, openTopic, said } = app;
  // A choice on the options screen by its label (Perfekt, Short …).
  const choose = (label) => evaluate(`[...document.querySelectorAll('#options label.radio')]
    .find((l) => l.querySelector('b').textContent === ${JSON.stringify(label)}).querySelector('input').click()`);
  const learnt = () => evaluate(`JSON.parse(localStorage.getItem('etudes-learnt'))`);
  const note = () => evaluate(`document.querySelector('#options-learnt .learnt-note')?.textContent ?? null`);
  const card = () => text('#daily [data-topic="daily"] .topic-sub');
  const tagsShown = () => evaluate(`document.getElementById('tags').childElementCount > 0`);
  const CHECKED = `!document.getElementById('btn-next').hidden`;

  await click('#speak-toggle'); // read nothing aloud
  assert.equal(await evaluate(`document.getElementById('speak-toggle').checked`), false);

  // Nothing learnt: the card says so, and the review explains how to mark a topic.
  assert.equal(await card(), 'No topic marked learnt yet');
  await openTopic('daily');
  assert.equal(await text('#options-title'), 'Daily review');
  assert.equal(await evaluate(`document.querySelector('#options-actions button').disabled`), true);
  assert.equal(await text('#options-error'), 'No topic is marked learnt yet. Open a topic, choose the parts you know and turn on Sentences learnt.');
  assert.equal(await evaluate(`document.getElementById('options-learnt').hidden`), true, 'no switch on the review itself');
  await key('Escape');
  assert.equal(await screen(), 'home');

  // Passiv without the Perfekt, marked learnt: that scope is saved.
  await openTopic('passive');
  await choose('Perfekt');
  await click('#options-learnt input[name="learnt-sentences"]');
  const passive = (await learnt()).passive.sentences;
  assert.deepEqual(passive.settings, { kinds: ['werden'], tenses: ['praes', 'praet'] });
  assert.equal(await note(), null);
  // Other settings show which ones the review uses, until they are taken over or undone.
  await choose('Perfekt');
  assert.equal(await note(), 'The Daily review uses: Vorgangspassiv · Präsens, Präteritum.Use these settings');
  await shot('daily-2-learnt-switch');
  await choose('Perfekt');
  assert.equal(await note(), null);
  await choose('20 sentences');
  assert.equal(await note(), null, 'the length is not part of the scope');
  await key('Escape');

  await openTopic('prepositions');
  await click('#options-learnt input[name="learnt-sentences"]');
  assert.deepEqual(Object.keys(await learnt()), ['passive', 'prepositions']);
  await key('Escape');
  assert.equal(await card(), '2 learnt topics · not done yet today');
  await shot('daily-1-home');

  // The review: both topics listed; Short gives 10 sentences, 5 each, taking turns.
  await openTopic('daily');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#options-listing li b')].map((b) => b.textContent)`), ['Passiv', 'Präpositionen']);
  await choose('Short');
  await shot('daily-3-options');
  await key('Enter');
  assert.equal(await screen(), 'drill');
  assert.equal(await text('#progress-text'), '1 / 10');
  await shot('daily-4-sentence');
  const seen = [];
  while ((await screen()) === 'drill') {
    const item = { source: await text('#source'), before: await tagsShown(), hint: await text('#drill-hint') };
    await key('Enter'); // check
    await waitFor(CHECKED, 'the item to be checked');
    item.after = await tagsShown();
    seen.push(item);
    await key('Enter'); // next
  }
  assert.equal(seen.length, 10);
  for (const topic of ['Passiv', 'Präpositionen']) assert.equal(seen.filter((s) => s.source === topic).length, 5, topic);
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i].source, seen[i - 1].source, 'the topics take turns');
  for (const s of seen) {
    // Präpositionen hides its tags until checked (Hints off); Passiv always shows them.
    assert.equal(s.before, s.source === 'Passiv', s.source);
    assert.equal(s.after, true);
  }
  const hints = new Set(seen.map((s) => s.hint));
  assert.equal(hints.size, 2, 'each topic\'s own hint');

  assert.equal(await screen(), 'summary');
  assert.match(await text('#mistakes .meta'), /^(Passiv|Präpositionen) · /, 'the mistakes name their topic');
  await shot('daily-5-summary');
  await key('Escape');
  assert.equal(await screen(), 'options');
  assert.equal(await text('#options-title'), 'Daily review');
  await key('Escape', true);
  assert.equal(await screen(), 'home');
  assert.equal(await focused(), 'daily');
  assert.equal(await card(), 'Done today ✓');
  const log = await evaluate(`JSON.parse(localStorage.getItem('etudes-daily'))`);
  assert.equal(log.sentences.done, dayOf(Date.now()));
  assert.deepEqual(Object.keys(log.sentences.seen).sort(), ['passive', 'prepositions']);

  // Esc twice in a new review: back to its options.
  await openTopic('daily');
  await key('Enter');
  assert.equal(await screen(), 'drill');
  await key('Escape');
  await key('Escape');
  assert.equal(await screen(), 'options');
  assert.equal(await text('#options-title'), 'Daily review');

  assert.deepEqual(said(), [], 'nothing read aloud');
  assert.ok(app.ranOnTempProfile(), 'the app ran on the temp profile');
}));
