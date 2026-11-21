// Starts the app from source on a fresh, throwaway profile (npm run start:clean), so trying a branch cannot touch the
// real settings and marks. The profile is deleted when the app quits. Extra arguments go to Electron.
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const electron = require('electron'); // the binary's path

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'german-etudes-clean-'));
console.log(`Throwaway profile: ${dir}`);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', `--user-data-dir=${dir}`, ...process.argv.slice(2)], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
});
// Ctrl+C reaches Electron too: wait for it to quit, then clean up.
process.on('SIGINT', () => {});
for (const signal of ['SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal)); // SIGHUP: the terminal closed
const done = (code) => {
  fs.rmSync(dir, { recursive: true, force: true });
  process.exitCode = code ?? 1;
};
child.on('exit', done);
child.on('error', (err) => {
  console.error(err.message); // Electron did not start
  done(1);
});
