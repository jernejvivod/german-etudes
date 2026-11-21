'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// A stand-in for `say`, so the tests make no sound; it writes what it would read to a temp file.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'etudes-speech-'));
const said = path.join(dir, 'said.log');
process.env.ETUDES_SAY = path.join(__dirname, 'fixtures', 'fakesay.sh');
process.env.SAID = said;
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

// A fresh speech.js with the given stand-in settings (the voice lookup is kept per module).
function fresh(env = {}) {
  for (const key of ['NO_GERMAN', 'SLOW', 'HOLD']) delete process.env[key];
  Object.assign(process.env, env);
  fs.rmSync(said, { force: true });
  delete require.cache[require.resolve('../speech.js')];
  return require('../speech.js');
}
const finished = (child) => new Promise((resolve) => child.on('exit', resolve));
const read = () => (fs.existsSync(said) ? fs.readFileSync(said, 'utf8') : '');

test('reads with the German voice (Anna first), the text on stdin', async () => {
  const speech = fresh();
  assert.equal(await speech.germanVoice(), 'Anna (German (Germany))');
  await finished(await speech.speak('Ich bin müde; $(rm -rf ~) bleibt Text.'));
  assert.equal(read(), '-v Anna (German (Germany)) -r 170 | Ich bin müde; $(rm -rf ~) bleibt Text.\n');
});

test('a new sentence or stop() ends the one being read', async () => {
  const speech = fresh({ HOLD: '1' });
  const first = await speech.speak('Erster Satz.');
  const second = await speech.speak('Zweiter Satz.');
  assert.ok(first.killed, 'the first sentence is stopped');
  speech.stop();
  assert.ok(second.killed);
  await Promise.all([finished(first), finished(second)]);
  assert.equal(read(), '', 'neither got to the end');
});

test('no German voice: nothing is read', async () => {
  const speech = fresh({ NO_GERMAN: '1' });
  assert.equal(await speech.germanVoice(), null);
  assert.equal(await speech.speak('Hallo.'), null);
});

test('stop() during the voice lookup: the sentence is not read afterwards', async () => {
  const speech = fresh({ SLOW: '1' });
  const pending = speech.speak('Zu spät.');
  speech.stop();
  assert.equal(await pending, null);
});
