'use strict';

// Runs the real app for an end-to-end test, driven over the Chrome DevTools Protocol. The app runs on a temp profile
// (--user-data-dir), never the real one, and reads aloud with the stand-in for `say` (test/fixtures/fakesay.sh), so
// nothing is spoken. ETUDES_SHOTS=<dir> also saves the screenshots a test takes (shot). ETUDES_APP=<binary> runs a
// packaged app (…/German Etudes.app/Contents/MacOS/German Etudes) instead of the source.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const electron = require('electron'); // the binary's path

const ROOT = path.join(__dirname, '..', '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// macOS only: elsewhere the app reads aloud with speechSynthesis, not the stand-in for `say`.
const skip = process.platform !== 'darwin' && 'macOS only';

// Starts the app and resolves to its DevTools address once it listens.
function launch(dir, saidPath) {
  const env = { ...process.env, ETUDES_SAY: path.join(ROOT, 'test', 'fixtures', 'fakesay.sh'), SAID: saidPath, HOLD: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = process.env.ETUDES_APP && path.resolve(process.env.ETUDES_APP);
  const args = ['--remote-debugging-port=0', `--user-data-dir=${path.join(dir, 'ud')}`];
  const child = spawn(app || electron, app ? args : ['.', ...args], {
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

// What a test drives the app with, on the page of a running app.
function driver(send, dir, saidPath) {
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
  // The bar a click on ← Topics or ✕ brings up in a round: its question, or null when it is not shown.
  const leaveBar = () => evaluate(`(() => { const b = document.getElementById('confirm-leave'); return b.hidden ? null : b.querySelector('p').textContent; })()`);
  const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
  const KEYS = { Escape: 27, Enter: 13, ArrowDown: 40, Space: 32, Tab: 9 };
  async function key(name, shift = false, autoRepeat = false) {
    const base = { key: name === 'Space' ? ' ' : name, code: name, windowsVirtualKeyCode: KEYS[name], modifiers: shift ? 8 : 0, autoRepeat };
    // Enter carries text, so that on a button it clicks it as a real key would.
    await send('Input.dispatchKeyEvent', { ...base, type: name === 'Enter' ? 'keyDown' : 'rawKeyDown', ...(name === 'Enter' && { text: '\r' }) });
    await send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
  }
  // Types text into the focused input, as an input method would.
  const type = (text) => send('Input.insertText', { text });
  async function shot(name) {
    if (!process.env.ETUDES_SHOTS) return;
    await evaluate('window.scrollTo(0, 0)'); // the bar is at the top; focus may have scrolled down to a button
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(process.env.ETUDES_SHOTS, { recursive: true });
    fs.writeFileSync(path.join(process.env.ETUDES_SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
  }
  // Opens a topic (or a daily exercise) from the home screen, or from the screen within names (#progress), and waits
  // until its data has loaded.
  async function openTopic(id, within = '#home') {
    await click(`${within} [data-topic="${id}"]`);
    assert.equal(await screen(), 'options');
    await waitFor(`document.getElementById('options-intro').textContent !== 'Loading…'`, `${id}'s options to be ready`, 15000);
  }
  // A choice on the options screen by its label (Perfekt, der-words …).
  const choose = (label) => evaluate(`[...document.querySelectorAll('#options label.radio')]
    .find((l) => l.querySelector('b').textContent === ${JSON.stringify(label)}).querySelector('input').click()`);
  // The labels of an option's ticked choices on the options screen (Tenses: ['Präsens', …]).
  const checkedChoices = (key) => evaluate(`[...document.querySelectorAll('#options-form input[name=${JSON.stringify(key)}]:checked')]
    .map((i) => i.closest('label').querySelector('b').textContent)`);
  // On Progress: focuses and clicks a part's box for a kind (Passiv, sentences, tenses, praet), or a topic's switch.
  const press = (id) => evaluate(`(() => { const box = document.getElementById(${JSON.stringify(id)}); box.focus(); box.click(); })()`);
  const tickPart = (topicId, kind, key, value) => press(`progress-${topicId}-${kind}-${key}-${value}`);
  const tickTopic = (topicId, kind) => press(`progress-${topicId}-${kind}`);
  // The learnt marks as stored.
  const learnt = () => evaluate(`Etudes.store.read('etudes-learnt', null)`);
  const said = () => (fs.existsSync(saidPath) ? fs.readFileSync(saidPath, 'utf8').split('\n').filter(Boolean) : []);
  const ranOnTempProfile = () => fs.existsSync(path.join(dir, 'ud', 'Local Storage'));
  return { send, evaluate, waitFor, screen, focused, toast, leaveBar, click, text, key, type, shot, openTopic, choose, checkedChoices, tickPart, tickTopic, learnt, said, ranOnTempProfile };
}

// Starts the app on a throwaway profile, waits for its topic list and German voice, runs fn(app) and closes it again.
async function withApp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'etudes-e2e-'));
  const saidPath = path.join(dir, 'said.log');
  const { child, ready } = launch(dir, saidPath);
  let cdp;
  try {
    cdp = await connect(await ready);
    // Keys reach the page even while the window is not in front.
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const app = driver(cdp.send, dir, saidPath);
    await app.waitFor(`document.querySelectorAll('#topics .topic').length > 0`, 'the topic list');
    await app.waitFor(`!document.getElementById('speak-setting').hidden`, 'the German voice (fakesay)');
    await fn(app);
  } finally {
    cdp?.close();
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { withApp, skip, sleep };
