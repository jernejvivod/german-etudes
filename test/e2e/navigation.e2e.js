// The real app, driven over the Chrome DevTools Protocol (harness.js): the way back to the topic list from every screen
// (← Topics, Esc, Shift+Esc). Run with `npm run test:e2e` (not part of `npm test`: it opens the app's window for a few
// seconds). ETUDES_SHOTS=<dir> also saves screenshots of the three top bars.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withApp, skip, sleep } = require('./harness.js');

test('back to the topic list from every screen', { timeout: 120000, skip }, () => withApp(async (app) => {
  const { evaluate, waitFor, screen, focused, toast, click, key, shot, openTopic, said } = app;

  // Passiv's round starts with the auxiliary table; its Continue button leads to the sentences.
  async function startDrill() {
    await click('#options-actions button');
    assert.equal(await screen(), 'table');
    await click('#btn-table-next');
    assert.equal(await screen(), 'drill');
  }
  async function startPassive() {
    await openTopic('passive');
    await startDrill();
  }
  const CHECKED = `!document.getElementById('btn-next').hidden`;
  async function finishRound() {
    while ((await screen()) === 'drill') {
      await key('Enter'); // check
      await waitFor(CHECKED, 'the item to be checked');
      await key('Enter'); // next
    }
    assert.equal(await screen(), 'summary');
  }

  assert.equal(await screen(), 'home');

  // Drill: the bar, Shift+Esc twice → topic list.
  await startPassive();
  const bar = await evaluate(`[...document.querySelectorAll('#drill .bar > button')].map((b) => ({
    text: b.textContent, label: b.getAttribute('aria-label'), title: b.title, keys: b.getAttribute('aria-keyshortcuts') }))`);
  assert.deepEqual(bar, [
    { text: '← Topics', label: 'Back to topics', title: 'All topics (⇧Esc)', keys: 'Shift+Escape' },
    { text: '✕', label: 'Back to options', title: 'Back to options (Esc twice)', keys: null },
  ]);
  await shot('drill');
  await key('Escape', true);
  assert.equal(await screen(), 'drill');
  assert.equal(await toast(), 'Press ⇧Esc again to go to the topic list');
  await key('Escape', true);
  assert.equal(await screen(), 'home');
  assert.equal(await focused(), 'passive', 'focus on the topic just left');
  assert.equal(await toast(), null);

  // The other key re-arms instead of leaving; a held Esc does nothing; ✕ → options.
  await startPassive();
  await key('Escape');
  assert.equal(await toast(), 'Press Esc again to quit this round');
  await key('Escape', true);
  assert.equal(await screen(), 'drill');
  assert.equal(await toast(), 'Press ⇧Esc again to go to the topic list');
  await key('Escape');
  assert.equal(await toast(), 'Press Esc again to quit this round');
  for (let i = 0; i < 3; i++) await key('Escape', false, true);
  assert.equal(await screen(), 'drill', 'a held Esc does not leave');
  await click('#btn-quit');
  assert.equal(await screen(), 'options');
  assert.equal(await toast(), null);

  // ← Topics right after checking stops the sentence being read (fakesay with HOLD writes it after 2 s).
  await startDrill();
  await key('Enter');
  assert.ok(await evaluate(CHECKED));
  await click('#drill .to-topics');
  assert.equal(await screen(), 'home');
  await sleep(2500);
  assert.deepEqual(said(), [], 'nothing read after leaving');
  // Control: staying on the item, the sentence is read.
  await startPassive();
  await key('Enter');
  for (const end = Date.now() + 5000; !said().length && Date.now() < end; ) await sleep(100);
  assert.equal(said().length, 1, 'the sentence is read when staying');

  // Summary: ← Topics in the bar; Esc → options; Shift+Esc → topic list at once.
  await key('Enter'); // next
  await finishRound();
  assert.equal(await evaluate(`document.querySelector('#summary .bar .to-topics').getClientRects().length`), 1);
  await shot('summary');
  await key('Escape');
  assert.equal(await screen(), 'options');
  await startDrill();
  await finishRound();
  await key('Escape', true);
  assert.equal(await screen(), 'home');
  assert.equal(await toast(), null);

  // Table: adjectives' endings table (an unreadable Anki deck only switches the nouns to the built-in ones).
  await openTopic('adjectives');
  const startTable = `[...document.querySelectorAll('#options-actions button')].find((b) => b.textContent === 'Endings table only').click()`;
  await evaluate(startTable);
  assert.equal(await screen(), 'table');
  await shot('table');
  const first = await focused();
  await key('ArrowDown');
  const second = await focused();
  assert.notEqual(second, first, 'arrows still move between cells');
  await key('Escape', true);
  assert.equal(await screen(), 'table');
  assert.equal(await evaluate('document.activeElement.value'), '', 'Shift+Esc types nothing');
  assert.equal(await focused(), second);
  await key('Escape', true);
  assert.equal(await screen(), 'home');
  assert.equal(await focused(), 'adjectives');
  await openTopic('adjectives');
  await evaluate(startTable);
  await click('#table .to-topics');
  assert.equal(await screen(), 'home');

  // Options: both keys → topic list.
  await openTopic('passive');
  await key('Escape');
  assert.equal(await screen(), 'home');
  await openTopic('passive');
  await key('Escape', true);
  assert.equal(await screen(), 'home');

  assert.ok(app.ranOnTempProfile(), 'the app ran on the temp profile');
}));
