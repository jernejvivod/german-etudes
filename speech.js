// Reading German sentences aloud with macOS's own `say` (main process; the preload offers it on macOS only). Chromium's
// speechSynthesis in Electron ignores the chosen voice on macOS and reads with the system default (often an English
// one), so the app uses `say` there; elsewhere the renderer uses speechSynthesis.
'use strict';

const { execFile, spawn } = require('node:child_process');

const RATE = 170; // words per minute, a little under say's default
// The command to read with: `say`, or a stand-in (ETUDES_SAY, see test/speech.test.js), so a test run makes no sound.
const SAY = process.env.ETUDES_SAY || 'say';
let lookup = null; // the promise of the German voice's name (or null), looked up once — again after a failed lookup
let current = null; // the `say` process reading now
let generation = 0; // bumped by stop(): a speak() still waiting for the voice lookup then gives up

// The German voice to read with: Anna where installed, else the first de_DE one, else null.
function germanVoice() {
  lookup ||= new Promise((resolve) => {
    execFile(SAY, ['-v', '?'], (err, out) => {
      if (err) lookup = null; // a failed lookup (say busy right after login …) is tried again next time
      const german = err ? [] : out.split('\n')
        .map((line) => line.match(/^(.+?)\s+de_DE\s+#/))
        .filter(Boolean)
        .map((m) => m[1].trim());
      resolve(german.find((name) => name.startsWith('Anna')) || german[0] || null);
    });
  });
  return lookup;
}

function stop() {
  generation++;
  if (current) current.kill();
  current = null;
}

// Reads text with the German voice, stopping whatever is being read. The text goes in on stdin, never as an argument.
// Resolves to the process (for tests), or null without a German voice or when stop() came during the voice lookup.
async function speak(text) {
  stop();
  const mine = generation;
  const name = await germanVoice();
  if (!name || mine !== generation) return null;
  const child = spawn(SAY, ['-v', name, '-r', String(RATE)], { stdio: ['pipe', 'ignore', 'ignore'] });
  child.on('error', () => {});
  child.stdin.on('error', () => {}); // say killed (or missing) before it read the text: nothing to do
  child.on('exit', () => {
    if (current === child) current = null;
  });
  child.stdin.end(text);
  current = child;
  return child;
}

module.exports = { germanVoice, speak, stop };
