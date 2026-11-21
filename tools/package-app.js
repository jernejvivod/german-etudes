// Builds German Etudes.app for this Mac (npm run package) into out/app.noindex/ (.noindex: Spotlight lists only the
// installed copy, see install-app.js). The app is signed ad hoc, enough to run on this Mac, not to be shared.
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BUNDLE_ID = 'com.jernejvivod.german-etudes';

// What goes into the app, by path from the repo root: the main-process files and the page. Tests, tools, the icon
// sources, out/ and worktrees stay out, and so does node_modules: the app has no runtime dependencies (only dev ones,
// test/packaging.test.js checks), and letting it in would bring its .bin and the empty folders of pruned scopes along.
const KEEP = /^\/(package\.json|LICENSE|[^/]+\.js|src(\/.*)?)$/;
const ignore = (p) => p !== '' && !KEEP.test(p);

const readPackage = (root = ROOT) => JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// The commit the app is built from (with -dirty for uncommitted changes), kept in its Info.plist.
function commit(root) {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  try {
    return git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain', '--untracked-files=no') ? '-dirty' : '');
  } catch {
    return 'unknown';
  }
}

function packagerOptions({ root = ROOT, arch = process.arch } = {}) {
  const pkg = readPackage(root);
  return {
    dir: root,
    out: path.join(root, 'out', 'app.noindex'),
    platform: 'darwin',
    arch,
    name: pkg.productName,
    appBundleId: BUNDLE_ID,
    appCategoryType: 'public.app-category.education',
    appVersion: pkg.version,
    buildVersion: pkg.version,
    extendInfo: { GermanEtudesCommit: commit(root) },
    icon: path.join(root, 'build', 'icon.icns'),
    ignore,
    prune: true, // for when node_modules is let in: only the runtime dependencies
    asar: true,
    overwrite: true,
  };
}

// Packages the app, signs it ad hoc (Apple Silicon runs only signed code) and resolves to its path.
async function buildApp({ root = ROOT, arch = process.arch } = {}) {
  if (process.platform !== 'darwin') throw new Error('German Etudes.app can only be built on macOS.');
  const { packager } = await import('@electron/packager'); // ESM only
  const opts = packagerOptions({ root, arch });
  const [dir] = await packager(opts);
  const app = path.join(dir, `${opts.name}.app`);
  // stdio piped: codesign's chatter ("replacing existing signature") stays out of the output, its errors in the thrown one.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'pipe' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' });
  return app;
}

module.exports = { BUNDLE_ID, ignore, readPackage, packagerOptions, buildApp };

if (require.main === module) {
  buildApp().then(
    (app) => console.log(app),
    (err) => {
      console.error(err.message);
      process.exitCode = 1;
    },
  );
}
