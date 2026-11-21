// Builds German Etudes.app (package-app.js) and puts it in /Applications, replacing an older copy: npm run install-app.
// Run it again after pulling to update. A running copy is quit first and opened again afterwards. ETUDES_INSTALL_DIR
// installs into another folder (for trying it out).
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { BUNDLE_ID, buildApp, readPackage } = require('./package-app.js');

const NAME = readPackage().productName;
const LSREGISTER = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A key of an Info.plist, or null if it has none.
function plistValue(plist, key) {
  try {
    return execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', plist], { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

// What installing to dest means: 'fresh' (nothing there) or 'replace' (an older German Etudes). Throws for anything
// else at that path, which is left alone.
function checkTarget(dest, readBundleId = (plist) => plistValue(plist, 'CFBundleIdentifier')) {
  let stat;
  try {
    stat = fs.lstatSync(dest);
  } catch (err) {
    if (err.code === 'ENOENT') return 'fresh';
    throw err;
  }
  const refuse = (why) => new Error(`${dest} ${why}; not replacing it. Move it away and run again.`);
  if (!stat.isDirectory()) throw refuse(stat.isSymbolicLink() ? 'is a symlink' : 'is not an app');
  const plist = path.join(dest, 'Contents', 'Info.plist');
  if (!fs.existsSync(plist)) throw refuse('has no Info.plist');
  const id = readBundleId(plist);
  if (id !== BUNDLE_ID) throw refuse(`is another app (${id || 'no bundle id'})`);
  return 'replace';
}

// The pids of the app at dest running now (its main process, not the helpers).
function running(dest) {
  const binary = path.join(dest, 'Contents', 'MacOS', NAME).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return execFileSync('pgrep', ['-f', `^${binary}( |$)`], { encoding: 'utf8' }).split('\n').filter(Boolean).map(Number);
  } catch {
    return []; // pgrep exits 1 when nothing matches
  }
}

// Quits the running app as Cmd+Q would, then with SIGTERM if it is still there after 5 s (osascript failed, or quit
// another copy with the same bundle id). Gives up after 10 s in all. Never kills it.
async function quit(pids) {
  const alive = (pid) => {
    try {
      return process.kill(pid, 0); // signal 0: only checks that it exists
    } catch {
      return false;
    }
  };
  const gone = async (ms) => {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) if (!pids.some(alive)) return true;
    return false;
  };
  let asked = true;
  try {
    execFileSync('osascript', ['-e', `tell application id "${BUNDLE_ID}" to quit`], { stdio: 'pipe', timeout: 5000 });
  } catch {
    asked = false;
  }
  if (asked && (await gone(5000))) return;
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Gone already.
    }
  }
  if (await gone(5000)) return;
  throw new Error(`${NAME} did not quit. Quit ${NAME} and run again.`);
}

// Replaces dest with the app at src on the same volume, so that dest is never half copied: the copy goes to a hidden
// .new beside it, the old app moves to .old, the new one into place, and the old one is restored if that fails.
function swap(src, dest, replace) {
  const fresh = path.join(path.dirname(dest), `.${NAME}.app.new`);
  const old = path.join(path.dirname(dest), `.${NAME}.app.old`);
  if (fs.existsSync(old) && !fs.existsSync(dest)) {
    throw new Error(`${old} is the app a failed install left; rename it back to ${NAME}.app and run again.`);
  }
  for (const stale of [fresh, old]) fs.rmSync(stale, { recursive: true, force: true });
  try {
    execFileSync('ditto', ['--clone', src, fresh], { stdio: 'pipe' }); // a copy-on-write clone: no second 250 MB
    if (replace) fs.renameSync(dest, old);
    try {
      fs.renameSync(fresh, dest);
    } catch (err) {
      if (replace) {
        try {
          fs.renameSync(old, dest);
        } catch {
          err.message += `; the previous app is at ${old}`;
        }
      }
      throw err;
    }
  } finally {
    fs.rmSync(fresh, { recursive: true, force: true });
  }
  fs.rmSync(old, { recursive: true, force: true });
}

async function install() {
  const dest = path.join(process.env.ETUDES_INSTALL_DIR || '/Applications', `${NAME}.app`);
  checkTarget(dest); // before the build, so a refusal comes at once
  const app = await buildApp();
  const replace = checkTarget(dest) === 'replace'; // again: the build takes a while
  const pids = running(dest);
  if (pids.length) await quit(pids);
  try {
    swap(app, dest, replace);
    // Spotlight and Launchpad pick it up now rather than at their next scan.
    for (const [cmd, args] of [[LSREGISTER, ['-f', dest]], ['mdimport', [dest]]]) {
      try {
        execFileSync(cmd, args, { stdio: 'pipe' });
      } catch (err) {
        console.warn(`${path.basename(cmd)} failed: ${err.message}`);
      }
    }
    const plist = path.join(dest, 'Contents', 'Info.plist');
    console.log(`Installed ${NAME} ${plistValue(plist, 'CFBundleShortVersionString')} (${plistValue(plist, 'GermanEtudesCommit')}) → ${dest}`);
  } finally {
    if (pids.length && fs.existsSync(dest)) execFileSync('open', [dest]); // quit for the install: open it again, new or old
  }
}

module.exports = { checkTarget };

if (require.main === module) {
  install().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
