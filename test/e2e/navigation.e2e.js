// The real app, driven over the Chrome DevTools Protocol (harness.js): the way back to the topic list from every screen
// (← Topics, Esc, Shift+Esc). Run with `npm run test:e2e` (not part of `npm test`: it opens the app's window for a few
// seconds). ETUDES_SHOTS=<dir> also saves screenshots of the three top bars.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withApp, skip, sleep } = require('./harness.js');

const CHECKED = `!document.getElementById('btn-next').hidden`;

// Steps through a round from its options screen, on a running app.
function round({ evaluate, waitFor, screen, click, key }) {
  // Passiv's round starts with the auxiliary table; its Continue button leads to the sentences.
  async function startTable() {
    await click('#options-actions button');
    assert.equal(await screen(), 'table');
  }
  async function startDrill() {
    await startTable();
    await click('#btn-table-next');
    assert.equal(await screen(), 'drill');
  }
  async function check() {
    await key('Enter');
    await waitFor(CHECKED, 'the item to be checked');
  }
  // To the summary: checks each item (unless it already is) and moves on.
  async function finishRound() {
    while ((await screen()) === 'drill') {
      if (!(await evaluate(CHECKED))) await check();
      await key('Enter'); // next
    }
    assert.equal(await screen(), 'summary');
  }
  return { startTable, startDrill, check, finishRound };
}

test('back to the topic list from every screen', { timeout: 120000, skip }, () => withApp(async (app) => {
  const { evaluate, screen, focused, toast, click, key, shot, openTopic, said } = app;
  const { startDrill, finishRound } = round(app);
  async function startPassive() {
    await openTopic('passive');
    await startDrill();
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

  // ← Topics right after checking (it asks first, a second click leaves) stops the sentence being read (fakesay with
  // HOLD writes it after 2 s).
  await startDrill();
  await key('Enter');
  assert.ok(await evaluate(CHECKED));
  await click('#drill .to-topics');
  assert.equal(await screen(), 'drill');
  await sleep(600);
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

test('a click asks before it ends a round', { timeout: 180000, skip }, () => withApp(async (app) => {
  const { evaluate, screen, focused, toast, leaveBar, click, text, key, type, shot, openTopic, tickTopic, said, send } = app;
  const { startTable, startDrill, check, finishRound } = round(app);
  const ASK_OPTIONS = 'Leave this round? Its score won\'t be kept.';
  const ASK_HOME = 'Leave this round for the topic list? Its score won\'t be kept.';

  // 1. Nothing answered: ✕ and ← Topics leave at once.
  await openTopic('passive');
  await startDrill();
  await click('#btn-quit');
  assert.equal(await screen(), 'options');
  assert.equal(await leaveBar(), null);
  await startDrill();
  await click('#drill .to-topics');
  assert.equal(await screen(), 'home');
  assert.equal(await leaveBar(), null);

  // 2. A cell filled: ← Topics asks, the focus on Stay; Esc stays, the focus back on the cell, its value kept.
  await openTopic('passive');
  await startTable();
  const cell = await focused();
  await type('wird');
  await click('#table .to-topics');
  assert.equal(await leaveBar(), ASK_HOME);
  assert.equal(await focused(), 'btn-stay');
  assert.equal(await screen(), 'table');
  await key('Escape');
  assert.equal(await leaveBar(), null);
  assert.equal(await toast(), null);
  assert.equal(await focused(), cell, 'the focus back on the cell');
  assert.equal(await evaluate(`document.querySelector('#tables input').value`), 'wird');

  // 3. The table done with, the fresh drill after it is clean: ✕ leaves at once.
  await click('#btn-table-next');
  assert.equal(await screen(), 'drill');
  await click('#btn-quit');
  assert.equal(await screen(), 'options');

  // 4. The bar takes the toast's place; Enter on Stay stays, the item still checked, the focus back on Next.
  await startDrill();
  await key('Escape');
  assert.equal(await toast(), 'Press Esc again to quit this round');
  await check();
  await click('#btn-quit');
  assert.equal(await leaveBar(), ASK_OPTIONS);
  assert.equal(await toast(), null, 'the toast gives way to the bar');
  assert.equal(await focused(), 'btn-stay');
  await key('Enter');
  assert.equal(await screen(), 'drill');
  assert.equal(await leaveBar(), null);
  assert.equal(await focused(), 'btn-next');
  assert.match(await text('#progress-text'), /^1 \/ \d+$/);
  assert.ok(await evaluate(CHECKED), 'the item still checked');

  // 5. A double-click only opens the bar; a later second click of the same button leaves.
  await click('#btn-quit');
  await click('#btn-quit');
  assert.equal(await screen(), 'drill', 'a double-click does not leave');
  assert.equal(await leaveBar(), ASK_OPTIONS);
  await sleep(600);
  await click('#btn-quit');
  assert.equal(await screen(), 'options');
  assert.equal(await leaveBar(), null);

  // 6. ← Topics with the bar up asks for the topic list instead; Tab to Leave, Enter leaves and stops the reading.
  await startDrill();
  await check();
  const read = said().length;
  await click('#btn-quit');
  assert.equal(await leaveBar(), ASK_OPTIONS);
  await click('#drill .to-topics');
  assert.equal(await leaveBar(), ASK_HOME);
  await key('Tab');
  assert.equal(await focused(), 'btn-leave');
  await key('Tab');
  assert.equal(await focused(), 'btn-stay');
  await key('Tab', true);
  assert.equal(await focused(), 'btn-leave');
  await key('Enter');
  assert.equal(await screen(), 'home');
  assert.equal(await focused(), 'passive');
  await sleep(2500);
  assert.equal(said().length, read, 'nothing read after leaving');

  // 7. Shift+Esc with the bar up: for the topic list it leaves, for the options it asks for the topic list instead.
  await openTopic('passive');
  await startDrill();
  await check();
  await click('#drill .to-topics');
  assert.equal(await leaveBar(), ASK_HOME);
  await key('Escape', true);
  assert.equal(await screen(), 'home');
  await openTopic('passive');
  await startDrill();
  await check();
  await click('#btn-quit');
  await key('Escape', true);
  assert.equal(await leaveBar(), ASK_HOME);
  assert.equal(await focused(), 'btn-stay');
  await key('Escape');
  assert.equal(await leaveBar(), null);
  assert.equal(await focused(), 'btn-next', 'the focus where it was before the bar');
  await key('Escape');
  assert.equal(await toast(), 'Press Esc again to quit this round', 'without the bar, Esc arms as before');
  await key('Escape');
  assert.equal(await screen(), 'options');

  // 8. A press outside the bar stays; the bar does not stop the reading.
  await startDrill();
  await check();
  const before = said().length;
  await click('#btn-quit');
  await evaluate(`document.querySelector('#drill .card').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
  assert.equal(await leaveBar(), null);
  assert.equal(await screen(), 'drill');
  for (const end = Date.now() + 5000; said().length === before && Date.now() < end; ) await sleep(100);
  assert.equal(said().length, before + 1, 'the sentence is read after staying');

  // 9. The summary: the round is over, ← Topics leaves at once.
  await finishRound();
  await click('#summary .to-topics');
  assert.equal(await screen(), 'home');
  assert.equal(await leaveBar(), null);

  // 10. The Daily review: clean, ✕ leaves at once; with an item checked, ← Topics asks, and Leave leaves without the
  // review counting as done.
  await click('#btn-progress');
  await tickTopic('passive', 'sentences');
  await tickTopic('passive', 'table');
  await key('Escape');
  assert.equal(await screen(), 'home');
  await openTopic('daily');
  await click('#options-actions button');
  assert.equal(await screen(), 'drill');
  await click('#btn-quit');
  assert.equal(await screen(), 'options');
  await click('#options-actions button');
  await check();
  await click('#drill .to-topics');
  assert.equal(await leaveBar(), ASK_HOME);
  await click('#btn-leave');
  assert.equal(await screen(), 'home');
  assert.match(await text('#daily [data-topic="daily"] .topic-sub'), /not done yet today$/);

  // 11. Daily tables: a cell filled, ← Topics asks, Stay stays. Its look, light and dark, and in a narrow window.
  await openTopic('daily-tables');
  await click('#options-actions button');
  assert.equal(await screen(), 'table');
  await type('wird');
  await click('#table .to-topics');
  assert.equal(await leaveBar(), ASK_HOME);
  const scheme = (value) => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] });
  await scheme('light');
  await shot('leave-bar-light');
  await scheme('dark');
  await shot('leave-bar-dark');
  // The narrowest the window goes (main.js).
  await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 640, deviceScaleFactor: 0, mobile: false });
  assert.ok(await evaluate(`(() => { const r = document.getElementById('confirm-leave').getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth; })()`), 'the bar fits a narrow window');
  await shot('leave-bar-720');
  await send('Emulation.clearDeviceMetricsOverride');
  await send('Emulation.setEmulatedMedia', { features: [] });
  await click('#btn-stay');
  assert.equal(await screen(), 'table');
  assert.equal(await leaveBar(), null);

  assert.ok(app.ranOnTempProfile(), 'the app ran on the temp profile');
}));
