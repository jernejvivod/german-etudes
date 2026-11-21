'use strict';

// The renderer's only door to the machine: reading the Anki deck (see anki.js) and reading sentences aloud (speech.js).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('etudesHost', {
  // known: the stamp of the deck the page already has; the reply is { unchanged: true } if Anki has not changed it.
  loadAnki: (known) => ipcRenderer.invoke('anki:load', known),
  // macOS only: reading aloud with `say`; elsewhere the page uses speechSynthesis. hasVoice: whether macOS has a German one.
  ...(process.platform === 'darwin' && {
    hasVoice: () => ipcRenderer.invoke('speech:voice'),
    speak: (text) => ipcRenderer.invoke('speech:speak', text),
    stopSpeaking: () => ipcRenderer.invoke('speech:stop'),
  }),
});
