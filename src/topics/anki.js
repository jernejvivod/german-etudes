// Topic: Anki-Sätze — article-word and adjective endings in the example sentences of your due Langenscheidt cards.
// The notes come from vocab.js (the desktop app reads the Anki collection, see anki.js); tests pass them in with useNotes().
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/cloze.js'), require('../core/declension.js'), require('../core/vocab.js'));
  } else {
    root.Etudes.topics.push(factory(root.Etudes.cloze, root.Etudes.declension, root.Etudes.vocab));
  }
})(globalThis, function (cloze, declension, vocab) {
  'use strict';

  const { gap, display, pick, shuffle, capitalizeFirst, clean } = cloze;
  const {
    CASES, GENDERS, CASE_LABELS, CASE_SHORT, GENDER_LABELS, GENDER_SHORT, ADJ_ENDINGS, DET_ENDINGS, PREPOSITIONS, CONTRACTIONS,
    contractionGap, datPlural,
  } = declension;

  // ---------- Reading the notes ----------

  // Noun forms → the genders they can be ('pl' for plural). Covers dative plural -n, genitive -(e)s and n-nouns (Junge → Jungen).
  // Every noun note counts, learnt or not: the index only says what gender a word in a sentence has.
  function nounIndex(notes) {
    const index = new Map();
    const add = (form, g) => {
      if (!form || !g || !/^[A-ZÄÖÜ]/.test(form)) return;
      if (!index.has(form)) index.set(form, new Set());
      index.get(form).add(g);
    };
    for (const note of notes) {
      const { g, sg, pl, alts, pos } = vocab.parseWord(note);
      if (!pos.startsWith('n')) continue;
      for (const [form, gender] of [[sg, g], ...alts, [pl, 'pl']]) {
        add(form, gender);
        if (form && gender === 'pl') add(datPlural(form), 'pl');
        if (form && (gender === 'm' || gender === 'n')) {
          add(vocab.genitive(form, gender), gender);
          add(form + 'es', gender);
        }
      }
      // n-declension: the plural form is also the singular in every case but the nominative.
      if (vocab.isNNoun(sg, pl, g)) add(pl, 'm');
    }
    return index;
  }

  // Adjective stems from the deck's adjective notes, incl. the e-less stem before an ending (dunkel → dunkl-, teuer → teur-, hoch → hoh-).
  function adjectiveStems(notes) {
    const stems = new Set();
    for (const note of notes) {
      if (!/\badj/.test(clean(note.pos))) continue;
      for (const word of clean(note.word).toLowerCase().split(/[,\s]+/)) {
        if (!/^[a-zäöüß]+$/.test(word)) continue;
        stems.add(word);
        if (/[^e]e[lr]$/.test(word)) stems.add(word.slice(0, -2) + word.slice(-1));
        if (word.endsWith('hoch')) stems.add(word.slice(0, -2) + 'h');
      }
    }
    return stems;
  }

  // ---------- Finding noun phrases ----------

  const WORD = /[A-Za-zÄÖÜäöüßéèàç]+(?:-[A-Za-zÄÖÜäöüß]+)*/g;
  // Contraction → [preposition, article]: "im" → ["in", "dem"].
  const EXPANDED = Object.fromEntries(Object.entries(CONTRACTIONS).flatMap(([prep, byArticle]) =>
    Object.entries(byArticle).map(([article, short]) => [short, [prep, article]])));
  // Uninflected words that may stand between the article and the adjective or noun ("ein gut aussehender Mann", "die drei Kinder").
  const SKIP = new Set('sehr ganz gut so zu besonders ziemlich wirklich extrem total recht relativ echt noch nicht zwei drei vier fünf sechs sieben acht neun zehn elf zwölf'.split(' '));
  const PRONOUNS = new Set(['Sie', 'Ihnen', 'Ich']);
  const PREP_CASES = { akk: ['acc'], dat: ['dat'], gen: ['gen'], wechsel: ['acc', 'dat'] };

  // An article word: its declension table and ending. euer drops its e before an ending (eure), so it is typed whole.
  function determiner(word) {
    const w = word.toLowerCase();
    let m;
    if (EXPANDED[w]) return { table: 'der', ending: EXPANDED[w][1].slice(1), contraction: EXPANDED[w] };
    if ((m = w.match(/^d(er|ie|as|em|en|es)$/))) return { table: 'der', ending: m[1] };
    if ((m = w.match(/^(dies|jed|jen|manch|solch|welch|all)(e|er|es|em|en)$/))) return { table: 'dies', ending: m[2] };
    if ((m = w.match(/^eu(er|re|ren|rem|rer|res)$/))) return { table: 'ein', ending: m[1] === 'er' ? '' : m[1].slice(1), whole: true };
    if ((m = w.match(/^(ein|kein|mein|dein|sein|ihr|unser)(e|er|es|em|en)?$/))) return { table: 'ein', ending: m[2] || '' };
    return null;
  }

  // A lowercase word with an adjective ending, split into stem and ending.
  function adjective(word) {
    const m = /^[a-zäöüß]/.test(word) && word.match(/(em|en|er|es|e)$/);
    if (!m || word.length - m[1].length < 2) return null;
    return { stem: word.slice(0, -m[1].length), ending: m[1] };
  }

  // Splits a sentence into words and the text between them: seps[i] precedes words[i], seps[words.length] is the tail.
  function tokenize(sentence) {
    const words = [];
    const seps = [];
    let last = 0;
    for (const m of sentence.matchAll(WORD)) {
      seps.push(sentence.slice(last, m.index));
      words.push(m[0]);
      last = m.index + m[0].length;
    }
    seps.push(sentence.slice(last));
    return { words, seps };
  }

  // Every gender × case reading that fits the endings and the preposition in front.
  function readings(np, genders) {
    const allowed = np.prep ? PREP_CASES[np.prep.group] : CASES;
    const variant = !np.det ? 'strong' : np.det.table === 'ein' ? 'mixed' : 'weak';
    const result = [];
    for (const g of genders) {
      CASES.forEach((c, ci) => {
        if (!allowed.includes(c)) return;
        if (np.det && np.det.ending !== DET_ENDINGS[np.det.table][g][ci]) return;
        if (np.adjs.some((a) => a.ending !== ADJ_ENDINGS[variant][g][ci])) return;
        result.push({ g, c });
      });
    }
    return result;
  }

  function prepGroup(word) {
    const w = word.toLowerCase();
    const group = Object.keys(PREPOSITIONS).find((k) => PREPOSITIONS[k].includes(w));
    return group ? { word: w, group } : null;
  }

  // The noun phrases worth a gap: (preposition) (article word) (adjectives) Noun, with a reading that fits.
  function nounPhrases({ words, seps }, nouns, stems) {
    const phrases = [];
    let free = 0; // words before this index belong to an earlier phrase
    const joined = (k) => k >= free && seps[k + 1] === ' '; // word k is directly followed by word k + 1
    const known = (a) => stems.has(a.stem) || stems.has(a.stem + 'e');
    for (let i = 1; i < words.length; i++) {
      if (!/^[A-ZÄÖÜ]/.test(words[i]) || PRONOUNS.has(words[i]) || !joined(i - 1)) continue;
      // Walk back over adjectives and the uninflected words between them.
      let j = i - 1;
      let lastSkip = -1;
      const adjs = [];
      while (joined(j) && !determiner(words[j])) {
        if (SKIP.has(words[j])) lastSkip = Math.max(lastSkip, j);
        else {
          const a = adjective(words[j]);
          if (!a) break;
          adjs.unshift({ index: j, ...a });
        }
        j--;
      }
      const det = joined(j) ? determiner(words[j]) : null;
      const np = { noun: i, adjs, det: det && { index: j, ...det }, prep: null };
      if (!det) {
        // Without an article only the known adjectives right before the noun count ("mit kaltem Wasser", not "haben Hunger").
        const run = adjs.filter((a) => a.index > lastSkip);
        let from = run.length;
        while (from > 0 && known(run[from - 1])) from--;
        np.adjs = run.slice(from);
        if (!np.adjs.length) continue;
      }
      if (det?.contraction) np.prep = prepGroup(det.contraction[0]);
      else {
        // The word where the walk stopped: before the article, or before the whole adjective run ("mit sehr kaltem Wasser").
        const before = det ? j - 1 : j;
        if (joined(before)) np.prep = prepGroup(words[before]);
      }

      const genders = nouns.get(words[i]);
      np.known = !!genders;
      np.readings = readings(np, genders ? [...genders] : GENDERS);
      if (!np.readings.length) continue; // the endings don't add up: probably not a noun phrase after all
      phrases.push(np);
      free = i + 1;
    }
    return phrases;
  }

  // ---------- Building an item ----------

  // [word index, gap] for the article word and each adjective of a phrase.
  function phraseGaps(np, words) {
    const entries = np.adjs.map((a) => [a.index, gap('adj', 'adjective ending', a.stem, a.ending)]);
    if (np.det) {
      const w = words[np.det.index];
      const { contraction, ending } = np.det;
      let g;
      if (contraction) g = contractionGap(...contraction);
      else if (np.det.whole) g = gap('det', 'euer', '', w.toLowerCase(), { alts: [ending], placeholder: 'euer…' });
      else g = gap('det', 'article ending', w.slice(0, w.length - ending.length), ending);
      entries.push([np.det.index, g]);
    }
    return entries;
  }

  function readingText(rs) {
    return [...Map.groupBy(rs, (r) => r.g)]
      .map(([g, list]) => `${GENDER_LABELS[g]} ${list.map((r) => CASE_LABELS[r.c]).join(' or ')}`)
      .join(' / ');
  }

  function explainPhrase(np, words) {
    const phrase = words.slice(np.det ? np.det.index : np.adjs[0].index, np.noun + 1).join(' ');
    const parts = [`${phrase}: ${readingText(np.readings)}`];
    if (np.prep) parts.push(`after "${np.prep.word}"`);
    if (np.det?.contraction) parts.push(np.det.contraction.join(' + '));
    if (np.adjs.length) {
      const ending = display(np.adjs[0].ending);
      if (!np.det) parts.push(`no article → strong ${ending}`);
      else if (np.det.table === 'ein' && np.det.ending === '') parts.push(`bare ein-word → the adjective shows it: ${ending}`);
      else parts.push(`the article shows the case → ${ending}`);
    }
    if (!np.known) parts.push('(noun not in your deck, so every gender is considered)');
    return parts.join(', ');
  }

  // A cloze item from one example sentence, or null when it has no noun phrase to gap.
  function sentenceItem(note, example, nouns, stems) {
    const tokens = tokenize(clean(example.de));
    const phrases = nounPhrases(tokens, nouns, stems);
    if (!phrases.length) return null;
    const gapAt = new Map(phrases.flatMap((np) => phraseGaps(np, tokens.words)));
    const out = [];
    tokens.words.forEach((w, i) => {
      if (tokens.seps[i]) out.push(tokens.seps[i]);
      out.push(gapAt.get(i) || w);
    });
    if (tokens.seps.at(-1)) out.push(tokens.seps.at(-1));

    const word = clean(note.word).split(',')[0];
    return {
      notes: [note],
      tokens: capitalizeFirst(out),
      prompt: example.en ? { label: 'EN', text: clean(example.en) } : null,
      tags: [
        { text: [note.article, word].filter(Boolean).join(' '), cls: 'plain' },
        ...phrases.map((np) => {
          const g = new Set(np.readings.map((r) => r.g));
          const c = [...new Set(np.readings.map((r) => CASE_SHORT[r.c]))].join('/');
          const one = g.size === 1 ? [...g][0] : null;
          return { text: `${c} · ${one ? GENDER_SHORT[one] : '?'}`, cls: one ? `g-${one}` : 'plain' };
        }),
      ],
      explain: phrases.map((np) => explainPhrase(np, tokens.words)).join(' · '),
    };
  }

  // ---------- Deck state ----------

  let deck = null; // { notes, nouns, stems, items: Map(note id → items) }

  function useNotes(notes) {
    deck = { notes, nouns: nounIndex(notes), stems: adjectiveStems(notes), items: new Map() };
  }

  function itemsOf(note) {
    if (!deck.items.has(note.id)) {
      deck.items.set(note.id, note.examples.map((ex) => sentenceItem(note, ex, deck.nouns, deck.stems)).filter(Boolean));
    }
    return deck.items.get(note.id);
  }

  // Cards in review due within the window.
  function dueNotes(windowDays) {
    return deck.notes.filter((n) => n.dueIn !== null && n.dueIn <= windowDays);
  }

  // Those of the notes with a sentence to gap.
  function usable(notes) {
    return notes.filter((n) => itemsOf(n).length);
  }

  // A round: cards drawn by weight (vocab.sample) — the ones due now and hard most often, those practised here lately
  // least — with one of their sentences each. No fixed order, so the hardest cards do not fill every round. The window
  // is what counts as soon: a card due at its far end weighs a tenth of one due today.
  function buildRound(settings, rnd = Math.random) {
    const notes = vocab.sample(usable(dueNotes(settings.window)), settings.length, rnd, { soon: settings.window });
    return shuffle(notes.map((note) => pick(itemsOf(note), rnd)), rnd);
  }

  async function prepare() {
    const error = await vocab.load();
    if (error) {
      deck = null;
      return error;
    }
    if (deck?.notes !== vocab.notes) useNotes(vocab.notes); // unchanged deck: keep the parsed sentences
    return null;
  }

  function stats(settings) {
    const due = dueNotes(settings.window);
    return { due: due.length, usable: usable(due).length };
  }

  return {
    id: 'anki',
    title: 'Anki-Sätze',
    subtitle: 'Article and adjective endings in the example sentences of your due Langenscheidt cards.',
    intro(settings) {
      if (!deck) return 'Reads your Langenscheidt deck from Anki.';
      const { due, usable } = stats(settings);
      return `${due} cards due within ${settings.window} days; ${usable} have an example sentence with endings to fill in. Each round draws other cards: those due now and hard ones (lapses, low ease) most often, those you have just practised here least.`;
    },
    defaults: { window: 7, length: 10, hints: false },
    options: [
      {
        key: 'window', label: 'Cards due within', type: 'radio', inline: true, choices: [
          { value: 3, label: '3 days' },
          { value: 7, label: '1 week' },
          { value: 14, label: '2 weeks' },
        ],
      },
      {
        key: 'length', label: 'Round', type: 'radio', inline: true, choices: [
          { value: 10, label: '10 sentences' },
          { value: 20, label: '20 sentences' },
        ],
      },
      { key: 'hints', label: 'Hints', type: 'toggle', text: 'Show case & gender before answering' },
    ],
    prepare,
    validate(settings) {
      if (!deck) return null;
      return stats(settings).usable ? null : `No due cards with usable sentences in the next ${settings.window} days — try a wider window.`;
    },
    sessions: [
      {
        label: 'Start',
        build(settings, rnd = Math.random) {
          return [{
            type: 'drill',
            label: 'Sentences',
            hint: 'Tab moves between gaps · endings of article words and adjectives · leave a gap empty (or type -) for no ending',
            hideTags: !settings.hints,
            items: buildRound(settings, rnd),
          }];
        },
      },
    ],

    nounIndex, adjectiveStems, sentenceItem, useNotes, dueNotes, buildRound,
  };
});
