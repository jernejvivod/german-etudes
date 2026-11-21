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

Esc goes up one level (round → options → topic list; Progress → topic list), ⇧Esc straight to the topic list; during a round either needs a second press.

## Daily review

Once a topic sits, turn on *Sentences learnt* on its options screen: its current settings (for example Passiv with only Präsens and Präteritum) become what it brings to the **Daily review** on the home screen. The review mixes sentences from every learnt topic in equal shares, Short, Normal or Long (about 10, 20 or 30), the remainder going to the topics seen least recently, and uses *My Anki words*. Changed settings reach the review only with *Use these settings*. A day starts at 4:00. Likewise, *Table learnt* on Adjektivendungen, Artikelwörter, Passiv, Präpositionen, Pronomen and Nominalisierung puts the topic's fixed table into **Daily tables**, which has you write out every learnt table from memory, the least recently done first.

**Progress**, linked under the two daily cards, lists every topic with its parts (its checkbox options' choices, such as Passiv → Tenses → Präteritum), each ✓ where a *Sentences learnt* or *Table learnt* mark holds it, and a count of the parts and topics learnt. Each topic's line shows both marks (a table learnt only in part names its scope) and opens the topic's options, where the marks are set.

## Anki decks

`tools/` builds extra Anki packages (`.apkg`), such as Partizip II, Präpositionen and the B1 words missing from the deck. Each script's header says how to run it.

## License

MIT
