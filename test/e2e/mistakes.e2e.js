'use strict';

// The real app (harness.js): a drill's mistakes review, which brings back the sentences answered wrong until each has
// been answered right, in a topic's round and in the Daily review. Run with `npm run test:e2e`. ETUDES_SHOTS=<dir> also
// saves screenshots of the review's first item and of the summary, light and dark.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withApp, skip } = require('./harness.js');
const { dayOf } = require('../../src/core/daily.js');

const SENTENCES = ['Das Haus {wird} gebaut.', 'Die Tür {ist} offen.', '{Der} Brief {wurde} geschrieben.', 'Es {regnet}.'];
const RIGHT = [['wird'], ['ist'], ['Der', 'wurde'], ['regnet']];
// How each sentence reads with its gaps empty, to tell which one is on screen.
const BARE = SENTENCES.map((s) => s.replace(/\{[^}]*\}/g, ''));

test('the mistakes review', { timeout: 180000, skip }, () => withApp(async (app) => {
  const { evaluate, screen, focused, leaveBar, click, text, key, send, shot, openTopic, tickPart, shown, fill, check, verdictOk, reviewing, sentence,
    useSentences, said } = app;
  const fillWidth = () => evaluate(`document.getElementById('progress-fill').style.width`);
  const reviewTag = () => evaluate(`(() => { const t = document.querySelector('#tags .tag'); return t?.classList.contains('review') ? t.textContent : null; })()`);
  const which = async () => BARE.indexOf(await sentence());
  const shownCards = () => evaluate(`Etudes.store.read('etudes-shown', null)`);
  const dailyLog = () => evaluate(`Etudes.store.read('etudes-daily', null)`);
  // Screenshots, light and dark.
  async function shots(name) {
    for (const value of ['light', 'dark']) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
      await shot(`${name}-${value}`);
    }
    await send('Emulation.setEmulatedMedia', { features: [] });
  }
  async function answer(values) {
    await fill(values);
    await check();
  }
  // A round's items as they come: the sentences in wrong answered so (with empty gaps unless given), the others right.
  async function answerRound(wrong) {
    while ((await screen()) === 'drill' && !(await reviewing())) {
      const i = await which();
      await answer(i in wrong ? wrong[i] : RIGHT[i]);
      await key('Enter'); // next
    }
  }

  await click('#speak-toggle'); // read nothing aloud
  await useSentences('passive', SENTENCES);

  // Passiv's round: sentences 1 and 3 wrong (3 partly), 2 and 4 right; their Anki notes count as shown.
  await openTopic('passive');
  await click('#options-actions button');
  assert.equal(await screen(), 'drill');
  assert.equal(await text('#progress-text'), '1 / 4');
  assert.equal(await shown('drill-note'), false);
  assert.equal(await reviewTag(), null);
  assert.equal(await shown('source'), false);
  await answerRound({ 0: [''], 2: ['Der', ''] });
  const shownAfterRound = await shownCards();
  assert.deepEqual(Object.keys(shownAfterRound).sort(), ['e2e-2', 'e2e-4']);

  // The review: its note, its tag, its counter, the bar from 0; sentence 1 again, its gap empty and open.
  assert.equal(await screen(), 'drill');
  assert.equal(await text('#drill-note'), 'Now the ones you missed (2)');
  assert.equal(await shown('drill-note'), true);
  assert.equal(await reviewTag(), 'Mistakes');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#tags .tag')].map((t) => t.textContent)`), ['Mistakes', 'E2E']);
  assert.equal(await text('#progress-text'), 'Mistakes · 2 left');
  assert.equal(await fillWidth(), '0%');
  assert.equal(await which(), 0);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#sentence input')].map((i) => [i.value, i.disabled, i.className])`), [['', false, 'word']]);
  assert.equal(await shown('feedback'), false);
  assert.equal(await shown('btn-check'), true);
  assert.equal(await focused(), 'gap 1');
  await shots('mistakes-review');

  // Leaving asks: the round has answers. Esc stays, the focus back in the gap.
  await click('#btn-quit');
  assert.equal(await leaveBar(), 'Leave this round? Its score won\'t be kept.');
  await key('Escape');
  assert.equal(await leaveBar(), null);
  assert.equal(await screen(), 'drill');
  assert.equal(await focused(), 'gap 1');

  // Sentence 1 wrong again: to the end of the queue, sentence 3 next, the note gone.
  await answer(['']);
  assert.equal(await verdictOk(), false);
  assert.equal(await fillWidth(), '0%');
  await key('Enter');
  assert.equal(await which(), 2);
  assert.equal(await text('#progress-text'), 'Mistakes · 2 left');
  assert.equal(await shown('drill-note'), false);
  assert.equal(await reviewTag(), 'Mistakes');
  // Sentence 3 partly right is wrong: sentence 1 next.
  await answer(['Der', '']);
  assert.equal(await verdictOk(), false);
  await key('Enter');
  assert.equal(await which(), 0);
  // Sentence 1 right: the bar half full; sentence 3 is the last one left.
  await answer(['wird']);
  assert.equal(await verdictOk(), true);
  assert.equal(await fillWidth(), '50%');
  await key('Enter');
  assert.equal(await which(), 2);
  assert.equal(await text('#progress-text'), 'Mistakes · 1 left');
  assert.equal(await fillWidth(), '50%');
  await answer(['Der', 'wurde']);
  assert.equal(await fillWidth(), '100%');
  await key('Enter');

  // The summary: the first tries' score and mistakes, and how the review went. The review marked no card.
  assert.equal(await screen(), 'summary');
  assert.equal(await text('#summary-score'), '2 / 4 sentences correct');
  assert.equal(await shown('summary-review'), true);
  assert.equal(await text('#summary-review'), '2 missed, answered right in 4 tries');
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#mistakes li')].map((li) => [li.querySelector('.sent').textContent, li.querySelector('.given').textContent])`),
    [['Das Haus wird gebaut.', '∅'], ['Der Brief wurde geschrieben.', '∅']]);
  assert.deepEqual(await shownCards(), shownAfterRound);
  await shots('mistakes-summary');

  // A new round all right: straight to the summary, no review.
  assert.equal(await text('#btn-summary-next'), 'New round');
  await click('#btn-summary-next');
  const counters = [];
  while ((await screen()) === 'drill') {
    counters.push(await text('#progress-text'));
    await answer(RIGHT[await which()]);
    await key('Enter');
  }
  assert.deepEqual(counters, ['1 / 4', '2 / 4', '3 / 4', '4 / 4']);
  assert.equal(await screen(), 'summary');
  assert.equal(await text('#summary-score'), '4 / 4 sentences correct');
  assert.equal(await shown('summary-review'), false);
  assert.equal(await shown('mistakes'), false);

  // Leaving in the middle of a review: ✕ asks, Leave goes to the options.
  await click('#btn-summary-next');
  await answerRound({ 3: [''] });
  assert.equal(await text('#progress-text'), 'Mistakes · 1 left');
  await click('#btn-quit');
  assert.equal(await leaveBar(), 'Leave this round? Its score won\'t be kept.');
  await click('#btn-leave');
  assert.equal(await screen(), 'options');
  await key('Escape');
  assert.equal(await screen(), 'home');

  // The Daily review on the same sentences: Passiv's Präsens marked learnt.
  await click('#btn-progress');
  await click('#progress [aria-controls="progress-parts-passive"]');
  await tickPart('passive', 'sentences', 'kinds', 'werden');
  await tickPart('passive', 'sentences', 'tenses', 'praes');
  await key('Escape');
  const card = () => text('#daily [data-topic="daily"] .topic-sub');
  assert.equal(await card(), '1 learnt topic · not done yet today');

  // Left in the middle of its review, it isn't done.
  await openTopic('daily');
  await click('#options-actions button');
  await answerRound({ 1: [''] });
  assert.equal(await text('#progress-text'), 'Mistakes · 1 left');
  await click('#drill .to-topics');
  await click('#btn-leave');
  assert.equal(await screen(), 'home');
  assert.equal(await card(), '1 learnt topic · not done yet today');
  assert.notEqual((await dailyLog()).sentences.done, dayOf(Date.now()));

  // Done once its review is: the review's checks don't count as seeing the topic again.
  await openTopic('daily');
  await click('#options-actions button');
  const sourceMargin = () => evaluate(`getComputedStyle(document.getElementById('source')).marginTop`);
  assert.equal(await sourceMargin(), '-12px', 'the source as before, without the note');
  await answerRound({ 0: [''] });
  assert.equal(await text('#drill-note'), 'Now the ones you missed (1)');
  assert.equal(await text('#source'), 'Passiv');
  assert.equal(await sourceMargin(), '0px', 'the source below the note');
  assert.equal(await reviewTag(), 'Mistakes');
  const before = await dailyLog();
  assert.notEqual(before.sentences.done, dayOf(Date.now()));
  assert.equal(typeof before.sentences.seen.passive, 'number');
  await answer(['wird']);
  await key('Enter');
  assert.equal(await screen(), 'summary');
  assert.equal(await text('#summary-review'), '1 missed, answered right in 1 try');
  const after = await dailyLog();
  assert.equal(after.sentences.done, dayOf(Date.now()));
  assert.equal(after.sentences.seen.passive, before.sentences.seen.passive);

  assert.deepEqual(said(), [], 'nothing read aloud');
  assert.ok(app.ranOnTempProfile(), 'the app ran on the temp profile');
}));
