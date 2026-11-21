# German Etudes

Short daily German grammar drills in a desktop app (Electron): adjective endings, the passive voice, prepositions, articles, pronouns, verb forms, word order, nominalisation, Funktionsverbgefüge.

With the *My Anki words* option, the drills use the words you have learnt in the Anki deck *Langenscheidt Basic German Vocabulary*. They favour the hard words (many lapses, low ease) that are due today or soon. The app only reads a snapshot of the collection and never changes it.

## Run

Requires Node.js 22 or newer.

```sh
npm install
npm start   # the app
npm test    # the tests
```

On macOS, solved sentences can be read aloud with the system's German voice.

## Anki decks

`tools/` builds extra Anki packages (`.apkg`), such as Partizip II, Präpositionen and the B1 words missing from the deck. Each script's header says how to run it.

## License

MIT
