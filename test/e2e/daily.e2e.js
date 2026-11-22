'use strict';

// The real app (harness.js): parts marked learnt on Progress, a topic's options screen (its marks, the quick buttons for
// a round), and the Daily review that mixes the learnt topics. Run with `npm run test:e2e`. ETUDES_SHOTS=<dir> also
// saves screenshots of the home card, the options screen, the review's options, a sentence and the summary.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withApp, skip } = require('./harness.js');
const { dayOf } = require('../../src/core/daily.js');

test('marking topics learnt and the Daily review', { timeout: 120000, skip }, () => withApp(async (app) => {
  const { evaluate, waitFor, screen, focused, click, text, key, shot, openTopic, choose, checkedChoices, tickPart, tickTopic, learnt, finishDrill, said } = app;
  const card = () => text('#daily [data-topic="daily"] .topic-sub');
  const tagsShown = () => evaluate(`document.getElementById('tags').childElementCount > 0`);
  const tags = () => evaluate(`[...document.querySelectorAll('#tags .tag')].map((t) => t.textContent)`);
  const lines = () => evaluate(`[...document.querySelectorAll('#options-marks .marks-line')].map((l) => l.textContent)`);
  const startDisabled = () => evaluate(`document.querySelector('#options-actions button').disabled`);
  const error = () => evaluate(`(() => { const e = document.getElementById('options-error'); return e.hidden ? null : e.textContent; })()`);
  const CHECKED = `!document.getElementById('btn-next').hidden`;

  await click('#speak-toggle'); // read nothing aloud
  assert.equal(await evaluate(`document.getElementById('speak-toggle').checked`), false);

  // Nothing learnt: the card says so, and the review explains how to mark a topic.
  assert.equal(await card(), 'No topic marked learnt yet');
  await openTopic('daily');
  assert.equal(await text('#options-title'), 'Daily review');
  assert.equal(await startDisabled(), true);
  assert.equal(await error(), 'No topic is marked learnt yet. Open Progress and tick the parts you know for Sentences.');
  assert.equal(await evaluate(`document.getElementById('options-marks').hidden`), true, 'no marks on the review itself');
  await key('Escape');
  assert.equal(await screen(), 'home');

  // Not learnt yet: the options screen says so, and has nothing learnt to practise.
  await openTopic('passive');
  assert.deepEqual(await lines(), ['Not learnt for sentences yet', 'Not learnt for the table yet']);
  assert.equal(await evaluate(`document.getElementById('options-practise-learnt').disabled`), true);
  assert.equal(await evaluate(`document.getElementById('options-practise-learnt').title`), 'Nothing here is marked learnt yet — mark parts in Progress');
  assert.equal(await evaluate(`document.getElementById('options-practise-new').disabled`), false);
  await key('Escape');

  // In Progress: Passiv's sentences in the Präsens, its table in the Präsens and Präteritum; all of Präpositionen.
  await click('#btn-progress');
  await click('#progress [aria-controls="progress-parts-passive"]');
  await tickPart('passive', 'sentences', 'kinds', 'werden');
  await tickPart('passive', 'sentences', 'tenses', 'praes');
  await tickPart('passive', 'table', 'kinds', 'werden');
  await tickPart('passive', 'table', 'tenses', 'praes');
  await tickPart('passive', 'table', 'tenses', 'praet');
  await tickTopic('prepositions', 'sentences');
  assert.deepEqual(Object.keys(await learnt()), ['passive', 'prepositions']);
  await key('Escape');
  assert.equal(await card(), '2 learnt topics · not done yet today');
  await shot('daily-1-home');

  // Passiv's options: what is learnt, and Edit in Progress opens it there, scrolled to and focused.
  await openTopic('passive');
  assert.deepEqual(await lines(), ['Learnt for sentences: Vorgangspassiv · Präsens', 'Learnt for the table: Vorgangspassiv · Präsens, Präteritum']);
  await click('#options-marks button.link');
  assert.equal(await screen(), 'progress');
  assert.equal(await focused(), 'passive');
  assert.equal(await evaluate(`document.getElementById('progress-parts-passive').hidden`), false);
  assert.ok(await evaluate(`(() => { const r = document.getElementById('progress-topic-passive').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; })()`), 'in view');
  await key('Escape');
  assert.equal(await screen(), 'home');

  // Practise what's new: what neither kind has, saved; Passiversatz has no Perfekt and on, so Start waits.
  await openTopic('passive');
  await click('#options-practise-new');
  assert.deepEqual(await checkedChoices('kinds'), ['Zustandspassiv', 'Rezipientenpassiv', 'Passiversatz']);
  assert.deepEqual(await checkedChoices('tenses'), ['Perfekt', 'Plusquamperfekt', 'Futur I']);
  assert.deepEqual(await evaluate(`Etudes.store.read('etudes-settings-passive', null)`),
    { kinds: ['sein', 'bekommen', 'ersatz'], tenses: ['perf', 'plusq', 'fut'], length: 10 });
  assert.equal(await error(), 'Passiversatz is practised in Präsens, Präteritum only — tick one of those tenses or untick it.');
  assert.equal(await startDisabled(), true);
  assert.equal(await focused(), 'options-practise-new', 'the focus stays');
  assert.equal(await evaluate(`document.getElementById('options-practise-learnt').disabled`), false, 'the quick buttons stay on');
  await shot('daily-2-practise-new');
  // Practise what's learnt: what either kind has.
  await click('#options-practise-learnt');
  assert.deepEqual(await checkedChoices('kinds'), ['Vorgangspassiv']);
  assert.deepEqual(await checkedChoices('tenses'), ['Präsens', 'Präteritum']);
  assert.equal(await error(), null);
  assert.equal(await startDisabled(), false);
  assert.deepEqual(await lines(), ['Learnt for sentences: Vorgangspassiv · Präsens', 'Learnt for the table: Vorgangspassiv · Präsens, Präteritum'],
    'the marks stay as they are');
  await key('Escape');

  // Präpositionen's hints, a switch on its options screen, reach the review.
  await openTopic('prepositions');
  assert.deepEqual(await lines(), ['Learnt for sentences: all', 'Not learnt for the table yet']);
  await choose('Show the case before answering');
  await key('Escape');

  // The review: both topics listed; Short gives 10 sentences, 5 each, taking turns, each with its tags before checking.
  await openTopic('daily');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#options-listing li b')].map((b) => b.textContent)`), ['Passiv', 'Präpositionen']);
  await choose('Short');
  await shot('daily-3-options');
  await key('Enter');
  assert.equal(await screen(), 'drill');
  assert.equal(await text('#progress-text'), '1 / 10');
  await shot('daily-4-sentence');
  const seen = [];
  await finishDrill(async (check) => {
    const item = { source: await text('#source'), before: await tagsShown(), hint: await text('#drill-hint') };
    await check();
    item.tags = await tags();
    seen.push(item);
  });
  assert.equal(seen.length, 10);
  for (const topic of ['Passiv', 'Präpositionen']) assert.equal(seen.filter((s) => s.source === topic).length, 5, topic);
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i].source, seen[i - 1].source, 'the topics take turns');
  for (const s of seen) assert.equal(s.before, true, `${s.source}: tags before checking`);
  for (const s of seen.filter((x) => x.source === 'Passiv')) {
    assert.ok(s.tags.every((tag) => ['Vorgangspassiv', 'Präsens'].includes(tag)), `only the ticked parts: ${s.tags}`);
  }
  assert.equal(new Set(seen.map((s) => s.hint)).size, 2, 'each topic\'s own hint');

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
  const log = await evaluate(`Etudes.store.read('etudes-daily', null)`);
  assert.equal(log.sentences.done, dayOf(Date.now()));
  assert.deepEqual(Object.keys(log.sentences.seen).sort(), ['passive', 'prepositions']);

  // Hints off again: Präpositionen hides its tags until checked. Esc twice in a new review: back to its options.
  await openTopic('prepositions');
  await choose('Show the case before answering');
  await key('Escape');
  await openTopic('daily');
  await key('Enter');
  assert.equal(await screen(), 'drill');
  if ((await text('#source')) !== 'Präpositionen') {
    await key('Enter');
    await waitFor(CHECKED, 'the item to be checked');
    await key('Enter');
  }
  assert.equal(await text('#source'), 'Präpositionen');
  assert.equal(await tagsShown(), false);
  await key('Escape');
  await key('Escape');
  assert.equal(await screen(), 'options');
  assert.equal(await text('#options-title'), 'Daily review');

  assert.deepEqual(said(), [], 'nothing read aloud');
  assert.ok(app.ranOnTempProfile(), 'the app ran on the temp profile');
}));
