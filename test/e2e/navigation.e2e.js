'use strict';

// The real app, driven over the Chrome DevTools Protocol: the way back to the topic list from every screen (← Topics,
// Esc, Shift+Esc). Run with `npm run test:e2e` (not part of `npm test`: it opens the app's window for a few seconds).
// The app runs on a temp profile (--user-data-dir), never the real one, and reads aloud with the stand-in for `say`
// (test/fixtures/fakesay.sh), so nothing is spoken. ETUDES_SHOTS=<dir> also saves screenshots of the three top bars.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const electron = require('electron'); // the binary's path

const ROOT = path.join(__dirname, '..', '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Starts the app and resolves to its DevTools address once it listens.
function launch(dir, saidPath) {
  const env = { ...process.env, ETUDES_SAY: path.join(ROOT, 'test', 'fixtures', 'fakesay.sh'), SAID: saidPath, HOLD: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electron, ['.', '--remote-debugging-port=0', `--user-data-dir=${path.join(dir, 'ud')}`], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const ready = new Promise((resolve, reject) => {
    let err = '';
    child.stderr.on('data', (chunk) => {
      err += chunk;
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(new URL(m[1]).port);
    });
    child.on('exit', (code) => reject(new Error(`Electron exited (${code}): ${err}`)));
    setTimeout(() => reject(new Error(`Electron did not start: ${err}`)), 20000).unref();
  });
  return { child, ready };
}

// A minimal CDP client on the page target: send(method, params) → result.
async function connect(port) {
  let page;
  for (let i = 0; i < 100 && !page; i++) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = targets.find((t) => t.type === 'page' && t.url.endsWith('index.html'));
    if (!page) await sleep(100);
  }
  assert.ok(page, 'the app window has a page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    const call = pending.get(msg.id);
    if (!call) return;
    pending.delete(msg.id);
    if (msg.error) call.reject(new Error(msg.error.message));
    else call.resolve(msg.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { send, close: () => ws.close() };
}

// macOS only: elsewhere the app reads aloud with speechSynthesis, not the stand-in for `say`.
const skip = process.platform !== 'darwin' && 'macOS only';

test('back to the topic list from every screen', { timeout: 120000, skip }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'etudes-e2e-'));
  const saidPath = path.join(dir, 'said.log');
  const { child, ready } = launch(dir, saidPath);
  let cdp;
  try {
    cdp = await connect(await ready);
    const { send } = cdp;
    // Keys reach the page even while the window is not in front.
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });

    async function evaluate(expression) {
      const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (exceptionDetails) throw new Error(`${expression}: ${exceptionDetails.exception?.description || exceptionDetails.text}`);
      return result.value;
    }
    async function waitFor(expression, what = expression, ms = 5000) {
      for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (await evaluate(expression)) return;
      assert.fail(`timed out waiting for ${what}`);
    }
    const screen = () => evaluate(`document.querySelector('.screen:not([hidden])').id`);
    // The focused element: a topic card by its topic, an input by its label, anything else by its id.
    const focused = () => evaluate(`(() => { const a = document.activeElement; return a.dataset.topic || a.getAttribute('aria-label') || a.id; })()`);
    const toast = () => evaluate(`(() => { const t = document.getElementById('toast'); return t.hidden ? null : t.textContent; })()`);
    const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const KEYS = { Escape: 27, Enter: 13, ArrowDown: 40 };
    async function key(name, shift = false, autoRepeat = false) {
      const base = { key: name, code: name, windowsVirtualKeyCode: KEYS[name], modifiers: shift ? 8 : 0, autoRepeat };
      // Enter carries text, so that on a button it clicks it as a real key would.
      await send('Input.dispatchKeyEvent', { ...base, type: name === 'Enter' ? 'keyDown' : 'rawKeyDown', ...(name === 'Enter' && { text: '\r' }) });
      await send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
    }
    async function shot(name) {
      if (!process.env.ETUDES_SHOTS) return;
      await evaluate('window.scrollTo(0, 0)'); // the bar is at the top; focus may have scrolled down to a button
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(process.env.ETUDES_SHOTS, { recursive: true });
      fs.writeFileSync(path.join(process.env.ETUDES_SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
    }
    async function openTopic(id) {
      await click(`[data-topic="${id}"]`);
      assert.equal(await screen(), 'options');
      await waitFor(`!document.querySelector('#options-actions button').disabled`, `${id}'s options to be ready`, 15000);
    }
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
    const said = () => (fs.existsSync(saidPath) ? fs.readFileSync(saidPath, 'utf8').split('\n').filter(Boolean) : []);

    await waitFor(`document.querySelectorAll('#topics .topic').length > 0`, 'the topic list');
    await waitFor(`!document.getElementById('speak-setting').hidden`, 'the German voice (fakesay)');
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

    assert.ok(fs.existsSync(path.join(dir, 'ud', 'Local Storage')), 'the app ran on the temp profile');
  } finally {
    cdp?.close();
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
