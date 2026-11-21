'use strict';

const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('node:path');
const { loadAnki } = require('./anki.js');
const speech = require('./speech.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 720,
    minHeight: 600,
    title: 'German Etudes',
    // Matches --bg in src/styles.css, so the window doesn't flash on load.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#18181b' : '#f6f5f1',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

// Checked each time a topic opens, so reviews done in Anki meanwhile are reflected.
ipcMain.handle('anki:load', (_, known) => loadAnki(known));

// Reading aloud with macOS's German voice (see speech.js).
ipcMain.handle('speech:voice', async () => !!(await speech.germanVoice()));
// Nothing is sent back (speak resolves to the `say` process, which cannot cross to the page).
ipcMain.handle('speech:speak', async (_, text) => {
  await speech.speak(String(text));
});
ipcMain.handle('speech:stop', () => speech.stop());

// One copy per profile: npm start and the installed app share one, and two copies would overwrite each other's marks.
// A second start brings the first one's window to the front instead. Each throwaway profile (start:clean, the
// end-to-end tests) has a lock of its own.
if (!app.requestSingleInstanceLock()) {
  console.error('German Etudes is already running on this profile — use npm run start:clean for a second copy.');
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    app.focus({ steal: true }); // macOS: bring the app itself to the front, not only its window
  });
  app.whenReady().then(() => {
    speech.germanVoice(); // listing the voices takes a moment: look the German one up before the first sentence
    createWindow();
  });
}

app.on('window-all-closed', () => app.quit());
// Cmd+Q skips window-all-closed: stop a sentence being read on every way out, or `say` reads on after the app.
app.on('will-quit', () => speech.stop());
