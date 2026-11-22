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

Esc goes up one level (round → options → topic list; Progress → topic list), ⇧Esc straight to the topic list; during a round either needs a second press. ← Topics and ✕ ask first once something in the round is answered.

## Install as a Mac app

```sh
npm run install-app
```

builds *German Etudes.app* for this Mac and puts it in `/Applications`, so it opens from Spotlight. Run it again after pulling or merging to update; it quits a running copy first. The app keeps its data where `npm start` does (`~/Library/Application Support/German Etudes`), so both see the same marks, and only one copy runs per profile. The app is signed ad hoc, for this Mac only.

- `npm run package` only builds the app, into `out/`.
- `npm run start:clean` runs the source on a throwaway profile, deleted on quit: for trying a branch without touching your data. Plain `npm start` uses the real data.
- `npm run icon` regenerates the icon (`build/icon.icns`, `build/icon.png`) from `build/icon.svg`.

## Daily review

What you have learnt is marked on **Progress**, linked under the two daily cards. It lists every topic with its parts (its checkbox options' choices, such as Passiv → Tenses → Präteritum), each with a *Sentences* box and, where the topic's fixed table holds that part, a *Table* box. Each topic's line has a switch per kind that ticks or clears all its parts at once; for a topic without parts (Funktionsverbgefüge, Anki-Sätze, the tables of Adjektivendungen and Nominalisierung) the switch is the mark itself. Changes save at once, and a count shows the parts and topics learnt. A topic needs a part ticked in each of its options (Passiv: a kind and a tense), and the parts have to make sense together; otherwise its line says what is missing and the daily exercises leave it out. Marks from before parts could be ticked show the parts they held.

The **Daily review** on the home screen mixes sentences from every topic with parts ticked for Sentences, in equal shares, Short, Normal or Long (about 10, 20 or 30), the remainder going to the topics seen least recently. It uses exactly the ticked parts, the topic's current settings for the rest (hints, "with adjectives" …) and *My Anki words*. A day starts at 4:00. Likewise, **Daily tables** has you write out every table with parts ticked for Table (Adjektivendungen, Artikelwörter, Passiv, Präpositionen, Pronomen and Nominalisierung) from memory, the least recently done first.

A topic's options screen only sets the next round. It says what the topic is marked learnt for, links to it on Progress (*Edit in Progress*), and has two quick buttons: *Practise what's new* ticks the parts not learnt yet, *Practise what's learnt* those learnt for either kind.

## Anki decks

`tools/` builds extra Anki packages (`.apkg`), such as Partizip II, Präpositionen and the B1 words missing from the deck. Each script's header says how to run it.

## License

MIT
