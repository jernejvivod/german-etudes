// Topic: Artikelwörter — der-words (dieser, jeder, welcher, alle …) and ein-words (ein, kein, mein …) in every case.
// Session: fill in the determiner endings in sentences, then write out both ending tables from memory.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/cloze.js'), require('../core/declension.js'), require('../core/lexicon.js'), require('../core/vocab.js'));
  } else {
    root.Etudes.topics.push(factory(root.Etudes.cloze, root.Etudes.declension, root.Etudes.lexicon, root.Etudes.vocab));
  }
})(globalThis, function (cloze, declension, lexicon, vocab) {
  'use strict';

  const { gap, fillTemplate, pick, pickWeighted, pickFresh, remember, shuffle } = cloze;
  const { CASES, GENDERS, CASE_LABELS, CASE_SHORT, GENDER_LABELS, GENDER_SHORT, CASE_ROWS, GENDER_COLS, DET_ENDINGS } = declension;
  const { NOUNS } = lexicon;

  const FAMILIES = ['der', 'ein'];
  const FAMILY = {
    der: { label: 'der-words', detail: 'dieser, jeder, jener, mancher, solche, alle, welcher', table: 'dies', sub: 'dieser · jeder · welcher · alle' },
    ein: { label: 'ein-words', detail: 'ein, kein, mein, dein, sein, ihr, unser, euer', table: 'ein', sub: 'ein · kein · mein · unser (plural: kein- / mein-)' },
  };

  // kind: what a slot's `no` list names (else the stem); countSg: countable singular only; plOnly: plural only; cases: where it can stand
  // (kein not in the genitive: "das Auto keines Lehrers"; jeder not as an object: "Ich sehe jede Badehose");
  // stemBefore: the stem before an ending (euer → eur-e).
  const POSSESSIVES = ['mein', 'dein', 'sein', 'ihr', 'unser', 'euer'];
  const DETS = {
    der: [
      { stem: 'dies', weight: 5 },
      { stem: 'jed', weight: 2, countSg: true, cases: ['nom', 'dat', 'gen'] },
      { stem: 'all', weight: 2, plOnly: true },
      { stem: 'manch', weight: 1, plOnly: true },
      { stem: 'jen', weight: 1 },
      { stem: 'solch', weight: 1, plOnly: true },
    ],
    ein: [
      { stem: 'ein', weight: 4, countSg: true },
      { stem: 'kein', weight: 2, cases: ['nom', 'acc', 'dat'] },
      ...POSSESSIVES.map((stem) => ({ stem, kind: 'poss', weight: 1, ...(stem === 'euer' && { stemBefore: 'eur' }) })),
    ],
  };
  const WELCH = { stem: 'welch', weight: 1 };

  // A slot: the case, the noun categories that fit, and options —
  //   welch: a question word (der-words only); no: determiner kinds that sound wrong here ('kein', 'poss', 'jed'); except: nouns that don't fit;
  //   noKinds: learner noun kinds that don't fit; owned: only nouns a possessive fits.
  function slot(caseKey, cats, opts = {}) {
    return { case: caseKey, cats, no: [], except: [], noKinds: [], ...opts };
  }

  // The subject of giving / buying / helping: a person old enough, and not "kein" ("Kein Lehrer gibt …" sounds odd).
  const AGENT = slot('nom', ['person'], { no: ['kein'], except: ['Baby'] });
  // What one gives, shows or buys someone: something one can own (no bus), and no lorry.
  const GIFT = (cats) => slot('acc', cats, { noKinds: ['transport'], owned: true });

  // {0}, {1} … = slots; {singular|plural} = verb form chosen by the nominative slot's number.
  const FRAMES = [
    // One gap
    { t: '{0} {ist|sind} kaputt.', slots: [slot('nom', ['thing'])] },
    { t: '{0} {wohnt|wohnen} hier.', slots: [slot('nom', ['person'])] },
    { t: '{0} {schläft|schlafen} im Garten.', slots: [slot('nom', ['animal'])] },
    { t: 'Wo {ist|sind} {0}?', slots: [slot('nom', ['person', 'animal', 'thing'], { no: ['kein', 'jed'] })] },
    { t: '{0} {schmeckt|schmecken} gut.', slots: [slot('nom', ['food'], { no: ['kein'] })] },
    { t: '{0} {gefällt|gefallen} dir?', slots: [slot('nom', ['thing', 'animal'], { welch: true })] },
    { t: 'Ich sehe {0}.', slots: [slot('acc', ['person', 'animal', 'thing'])] },
    { t: 'Wir kaufen {0}.', slots: [slot('acc', ['thing', 'food'])] },
    { t: 'Kennst du {0}?', slots: [slot('acc', ['person', 'animal'])] },
    { t: '{0} kaufst du?', slots: [slot('acc', ['thing', 'food'], { welch: true })] },
    { t: 'Ich helfe {0}.', slots: [slot('dat', ['person'])] },
    { t: 'Wir sprechen mit {0}.', slots: [slot('dat', ['person'])] },
    { t: 'Das Buch gehört {0}.', slots: [slot('dat', ['person'])] },
    { t: 'Mit {0} sprichst du?', slots: [slot('dat', ['person'], { welch: true })] },
    { t: 'Das ist das Auto {0}.', slots: [slot('gen', ['person'])] },
    { t: 'Das Haus {0} ist alt.', slots: [slot('gen', ['person'])] },
    { t: 'Der Preis {0} ist hoch.', slots: [slot('gen', ['thing', 'food'])] },
    { t: 'Die Farbe {0} gefällt mir.', slots: [slot('gen', ['animal', 'thing'])] },
    { t: 'Wegen {0} bleiben wir zu Hause.', slots: [slot('gen', ['weather'])] },

    // Several gaps in different cases
    { t: '{0} {gibt|geben} {1} {2}.', slots: [AGENT, slot('dat', ['person']), GIFT(['thing'])] },
    { t: '{0} {zeigt|zeigen} {1} {2}.', slots: [AGENT, slot('dat', ['person']), GIFT(['thing'])] },
    { t: '{0} {kauft|kaufen} {1} {2}.', slots: [AGENT, slot('dat', ['person']), GIFT(['thing', 'food'])] },
    { t: 'Ich bringe {0} {1}.', slots: [slot('dat', ['person']), GIFT(['thing', 'food'])] },
    { t: '{0} {sucht|suchen} {1}.', slots: [AGENT, slot('acc', ['animal', 'thing'])] },
    { t: '{0} {füttert|füttern} {1}.', slots: [AGENT, slot('acc', ['animal'])] },
    { t: '{0} {hilft|helfen} {1}.', slots: [AGENT, slot('dat', ['person'])] },
    { t: '{0} {gehört|gehören} {1}.', slots: [slot('nom', ['thing', 'animal']), slot('dat', ['person'])] },
    { t: '{0} {gefällt|gefallen} {1}.', slots: [slot('nom', ['thing', 'animal']), slot('dat', ['person'])] },
  ].map((f) => (f.slots.length > 1 ? { ...f, slots: f.slots.map(noKein) } : f));

  // One kein in a sentence with several gaps already sounds odd ("Jede Oma gibt keinen Neffen ein Taxi").
  function noKein(sl) {
    return sl.no.includes('kein') ? sl : { ...sl, no: [...sl.no, 'kein'] };
  }

  // ---------- Building a sentence ----------

  // Determiners of a family that fit the slot, number and noun.
  function detsFor(sl, family, gender, noun) {
    if (sl.welch) return family === 'der' ? [WELCH] : [];
    const plural = gender === 'pl';
    return DETS[family].filter((d) => {
      if (d.countSg && (plural || noun.mass)) return false;
      if (d.plOnly && !plural) return false;
      if (d.cases && !d.cases.includes(sl.case)) return false;
      if (d.kind === 'poss' && !vocab.possessiveFits(noun, plural)) return false;
      return !sl.no.includes(d.kind || d.stem);
    });
  }

  // Nouns that fit a slot with at least one determiner of the family; memo holds them for one round.
  function usable(sl, gender, family, source, memo) {
    if (!memo.has(sl)) memo.set(sl, {});
    const bySlot = memo.get(sl);
    const fits = (n) => sl.cats.includes(n.cat) && !sl.except.includes(n.lemma) && !n.kinds?.some((k) => sl.noKinds.includes(k)) && (!sl.owned || n.own)
      && (gender === 'pl' ? n.pl : n.g === gender && n.sg) && detsFor(sl, family, gender, n).length;
    return (bySlot[gender + family + source] ||= vocab.pool(NOUNS, fits, source));
  }

  // The determiner gap. A stem that changes before an ending (euer → eure) is typed as a whole word.
  function detGap(det, ending) {
    if (!det.stemBefore) return gap('det', 'ending', det.stem, ending);
    // Typing just the ending (or nothing, for no ending) also counts, as for every other gap.
    return gap('det', det.stem, '', ending ? det.stemBefore + ending : det.stem, { alts: [ending], placeholder: `${det.stem}…` });
  }

  // inSentence: nouns already used in this sentence (never repeated); recent: nouns of the last items (avoided if possible).
  function fill(sl, gender, family, source, memo, rnd, inSentence, recent) {
    const ci = CASES.indexOf(sl.case);
    const all = usable(sl, gender, family, source, memo);
    const unused = all.filter((n) => !inSentence.includes(n.lemma));
    const noun = vocab.pickDue(unused.length ? unused : all, rnd, { recent });
    const det = pickWeighted(detsFor(sl, family, gender, noun), rnd);
    const ending = DET_ENDINGS[FAMILY[family].table][gender][ci];
    const g = detGap(det, ending);
    return { case: sl.case, ci, gender, family, noun, det, ending, gap: g, tokens: [g, ' ', (gender === 'pl' ? noun.pl : noun.sg)[ci]] };
  }

  // target = { case, gender, family }: one slot is built for it, the others get any combination the settings allow.
  function buildItem(target, settings, rnd = Math.random, recent = { frames: [], nouns: [] }, memo = new Map()) {
    const source = settings.vocab || 'builtin';
    const free = (sl) => GENDERS.flatMap((gender) => settings.families.map((family) => ({ gender, family })))
      .filter((x) => usable(sl, x.gender, x.family, source, memo).length);
    const fits = (sl) => sl.case === target.case && usable(sl, target.gender, target.family, source, memo).length;
    const pool = FRAMES.filter((f) => f.slots.some(fits) && f.slots.every((sl) => settings.cases.includes(sl.case) && free(sl).length));
    if (!pool.length) throw new Error(`no frame for ${target.family} ${target.case} ${target.gender}`);
    const fr = pickFresh(pool, recent.frames, (f) => f.t, rnd);
    const targetSlot = pick(fr.slots.filter(fits), rnd);

    const inSentence = [];
    const nps = fr.slots.map((sl) => {
      const { gender, family } = sl === targetSlot ? target : pick(free(sl), rnd);
      const np = fill(sl, gender, family, source, memo, rnd, inSentence, recent.nouns);
      inSentence.push(np.noun.lemma);
      return np;
    });
    const nom = nps.find((np) => np.case === 'nom');

    return {
      target,
      frame: fr.t,
      nouns: nps.map((np) => np.noun.lemma),
      notes: vocab.notesOf(...nps.map((np) => np.noun)),
      // One entry per gap, in gap order.
      parts: nps.map(({ case: c, gender, family, det }) => ({ case: c, gender, family, stem: det.stem })),
      tokens: fillTemplate(fr.t, nps.map((np) => np.tokens), nom?.gender === 'pl'),
      tags: nps.map((np) => ({ text: `${CASE_SHORT[np.case]} · ${GENDER_SHORT[np.gender]}`, cls: `g-${np.gender}` })),
      explain: nps.map(explain).join(' · '),
    };
  }

  // "diesem — like dem (Dat, maskulin)"; ein-words without an ending get the rule instead.
  function explain(np) {
    const word = np.gap.prefix + np.gap.answer;
    const articleEnding = DET_ENDINGS.der[np.gender][np.ci];
    const where = `${CASE_SHORT[np.case]}, ${GENDER_LABELS[np.gender]}`;
    // die → diese, das → dieses: the only places where the ending differs from the article's.
    const shift = articleEnding !== np.ending ? `, -${articleEnding} → -${np.ending}` : '';
    let text;
    if (!np.ending) text = `${word} — no ending: ein-words stay bare in Nom maskulin and Nom/Akk neutrum`;
    else text = `${word} — like d${articleEnding} (${where}${shift})`;
    if (np.det.stemBefore && np.ending) text += `, and ${np.det.stem} becomes ${np.det.stemBefore}- before an ending`;
    return text;
  }

  // Every case × gender × family once (in the chosen cases and families), shuffled, repeated to the round length.
  function buildRound(settings, rnd = Math.random) {
    const cells = settings.families.flatMap((family) => settings.cases.flatMap((c) => GENDERS.map((gender) => ({ case: c, gender, family }))));
    const recent = { frames: [], nouns: [] };
    const memo = new Map(); // noun pools per slot, for this round
    const items = [];
    let queue = [];
    while (items.length < settings.length) {
      if (!queue.length) queue = shuffle(cells, rnd);
      const item = buildItem(queue.shift(), settings, rnd, recent, memo);
      remember(recent.frames, item.frame, 4);
      for (const lemma of item.nouns) remember(recent.nouns, lemma, 6);
      items.push(item);
    }
    return items;
  }

  // ---------- Endings table ----------

  function endingsTable(settings) {
    return {
      title: 'Endings from memory',
      endings: true,
      lead: 'Determiner endings only. Each column runs Nom → Akk → Dat → Gen.',
      blocks: settings.families.map((family) => ({
        title: FAMILY[family].label,
        sub: FAMILY[family].sub,
        rows: CASE_ROWS,
        cols: GENDER_COLS,
        answers: GENDERS.map((g) => DET_ENDINGS[FAMILY[family].table][g]),
      })),
    };
  }

  function drillStep(settings, rnd) {
    return {
      type: 'drill',
      label: 'Sentences',
      hint: 'Tab moves between gaps · type the ending or the whole word · leave a gap empty (or type -) for no ending',
      hideTags: !settings.hints,
      items: buildRound(settings, rnd),
    };
  }

  function tableStep(settings) {
    return { type: 'table', label: 'Endings table', table: endingsTable(settings) };
  }

  // n sentences in the settings' scope, for a round here and for the Daily review.
  const sentences = (settings, n, rnd = Math.random) => drillStep({ ...settings, length: n }, rnd);

  return {
    id: 'determiners',
    title: 'Artikelwörter',
    subtitle: 'der-words and ein-words — dieser, jeder, kein, mein … in every case.',
    intro: vocab.intro('Fill in the endings of dieser / jeder / welcher and ein / kein / mein in sentences, then write out both ending tables from memory.', (n) => n.cat),
    defaults: { families: ['der', 'ein'], cases: [...CASES], hints: false, length: 10, vocab: 'anki' },
    prepare: vocab.prepare,
    options: [
      {
        key: 'families', label: 'Determiners', type: 'checkboxes', min: 1, table: true,
        choices: FAMILIES.map((value) => ({ value, label: FAMILY[value].label, detail: FAMILY[value].detail })),
      },
      {
        key: 'cases', label: 'Cases', type: 'checkboxes', inline: true, min: 1,
        choices: CASES.map((value) => ({ value, label: CASE_LABELS[value] })),
      },
      vocab.OPTION,
      { key: 'hints', label: 'Hints', type: 'toggle', text: 'Show case & gender before answering' },
      {
        key: 'length', label: 'Round', type: 'radio', inline: true, round: true, choices: [
          { value: 10, label: '10 sentences' },
          { value: 20, label: '20 sentences' },
        ],
      },
    ],
    sentences,
    table: tableStep,
    sessions: [
      {
        label: 'Start',
        build(settings, rnd = Math.random) {
          return [sentences(settings, settings.length, rnd), tableStep(settings)];
        },
      },
      { label: 'Endings table only', build: (settings) => [tableStep(settings)] },
    ],

    FAMILIES, buildItem, buildRound,
  };
});
