'use strict';

// The packaging settings (tools/package-app.js) without building anything: @electron/packager is never loaded here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
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

test('install-app replaces only an earlier German Etudes', (t) => {
  const { checkTarget } = require('../tools/install-app.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'etudes-install-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const app = (name, plist = true) => {
    const dest = path.join(dir, name);
    fs.mkdirSync(path.join(dest, 'Contents'), { recursive: true });
    if (plist) fs.writeFileSync(path.join(dest, 'Contents', 'Info.plist'), '');
    return dest;
  };
  const ours = () => BUNDLE_ID;
  assert.equal(checkTarget(path.join(dir, 'none.app'), ours), 'fresh');
  assert.equal(checkTarget(app('ours.app'), ours), 'replace');
  assert.throws(() => checkTarget(app('other.app'), () => 'com.example.other'), /another app \(com\.example\.other\)/);
  assert.throws(() => checkTarget(app('bare.app', false), ours), /no Info\.plist/);
  const file = path.join(dir, 'file.app');
  fs.writeFileSync(file, '');
  assert.throws(() => checkTarget(file, ours), /is not an app/);
  const link = path.join(dir, 'link.app');
  fs.symlinkSync(app('target.app'), link);
  assert.throws(() => checkTarget(link, ours), /is a symlink/);
});
