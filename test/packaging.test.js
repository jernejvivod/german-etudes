'use strict';

// The packaging settings (tools/package-app.js) without building anything: @electron/packager is never loaded here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ignore, packagerOptions, BUNDLE_ID } = require('../tools/package-app.js');

const ROOT = path.join(__dirname, '..');
const pkg = require('../package.json');

test('the app gets the main-process files and the page, nothing else', () => {
  for (const p of ['/main.js', '/preload.js', '/anki.js', '/speech.js', '/package.json', '/LICENSE', '/src', '/src/index.html', '/src/core/app.js']) {
    assert.equal(ignore(p), false, `${p} is kept`);
  }
  for (const p of ['/test', '/test/e2e/harness.js', '/tools', '/tools/install-app.js', '/build/icon.icns', '/.claude/worktrees/x/main.js',
    '/out', '/README.md', '/package-lock.json', '/.gitignore', '/.git', '/node_modules', '/node_modules/.bin/electron']) {
    assert.equal(ignore(p), true, `${p} is left out`);
  }
});

test('every file main.js and preload.js require is kept', () => {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const [, rel] of fs.readFileSync(file, 'utf8').matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      visit(require.resolve(path.resolve(path.dirname(file), rel)));
    }
  };
  visit(path.join(ROOT, 'main.js'));
  visit(path.join(ROOT, 'preload.js'));
  assert.ok(seen.size > 2, 'main.js requires other files');
  for (const file of seen) {
    const p = `/${path.relative(ROOT, file).split(path.sep).join('/')}`;
    assert.equal(ignore(p), false, `${p} is kept`);
  }
});

test('no runtime dependencies: node_modules stays out of the app', () => {
  assert.deepEqual(pkg.dependencies ?? {}, {}, 'a runtime dependency needs node_modules let into the app (KEEP in tools/package-app.js)');
});

test('packager options: a Mac app named after productName, in an unindexed folder', () => {
  const opts = packagerOptions({ arch: 'x64' });
  assert.equal(opts.platform, 'darwin');
  assert.equal(opts.arch, 'x64');
  assert.equal(opts.name, pkg.productName);
  assert.equal(opts.appBundleId, BUNDLE_ID);
  assert.equal(opts.appVersion, pkg.version);
  assert.equal(opts.asar, true);
  assert.equal(opts.ignore, ignore);
  assert.match(opts.out, /\.noindex$/);
  assert.match(opts.extendInfo.GermanEtudesCommit, /^([0-9a-f]+(-dirty)?|unknown)$/);
  assert.ok(fs.existsSync(opts.icon), 'the icon exists');
});

test('build/icon.icns is an icns file with the 1024 px rendition (ic10)', () => {
  const icns = fs.readFileSync(path.join(ROOT, 'build', 'icon.icns'));
  assert.equal(icns.toString('latin1', 0, 4), 'icns');
  assert.equal(icns.readUInt32BE(4), icns.length);
  const chunks = [];
  for (let at = 8, size; at < icns.length; at += size) {
    size = icns.readUInt32BE(at + 4);
    assert.ok(size >= 8, `the chunk at ${at} has a length`);
    chunks.push(icns.toString('latin1', at, at + 4));
  }
  assert.ok(chunks.includes('ic10'), `chunks: ${chunks.join(' ')}`);
});
