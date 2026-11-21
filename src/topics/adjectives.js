// Topic: German adjective endings (strong, weak, mixed) — data, sentence generator and session.
// Loaded as a plain script in the renderer (registers in Etudes.topics) and via require() in tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/cloze.js'), require('../core/declension.js'), require('../core/lexicon.js'), require('../core/vocab.js'),
      require('../core/verbs.js'));
  } else {
    root.Etudes.topics.push(factory(root.Etudes.cloze, root.Etudes.declension, root.Etudes.lexicon, root.Etudes.vocab, root.Etudes.verbs));
  }
})(globalThis, function (cloze, declension, lexicon, vocab, verbs) {
  'use strict';

  const { gap, fillTemplate, pick, pickWeighted, pickFresh, remember, shuffle, gaps, display } = cloze;

  const { CASES, GENDERS, CASE_LABELS, GENDER_LABELS, CASE_ROWS, GENDER_COLS, ADJ_ENDINGS, DET_ENDINGS } = declension;
  const { NOUNS, adjectivesFor, degreeStems } = lexicon;
  const VARIANTS = ['strong', 'weak', 'mixed'];

  // Degrees of comparison, and participles used as adjectives (p1: der schlafende Hund, p2: das reparierte Auto).
  // The superlative takes the definite article or a possessive ("der älteste", "mein bester"): never ein, kein or no
  // article, and "dieser älteste" sounds odd.
  // nom: an adjective used as a noun (der Bekannte, ein Bekannter) — people only, so no neuter; and no article only in the
  // plural, outside the genitive (Deutsche, mit Verwandten).
  const DEGREES = ['pos', 'comp', 'sup', 'p1', 'p2', 'nom'];
  const DEGREE_LABELS = { pos: 'Grundform', comp: 'Komparativ', sup: 'Superlativ', p1: 'Partizip I', p2: 'Partizip II', nom: 'Nominalisiert' };
  // Whether a degree fits a cell (gender and case only matter for nom, and are left out where any cell will do).
  function degreeFits(degree, variant, gender, caseKey) {
    if (degree === 'sup') return variant !== 'strong';
    if (degree !== 'nom' || !gender) return true;
    return gender !== 'n' && !(variant === 'strong' && (gender !== 'pl' || caseKey === 'gen'));
  }
  const isParticiple = (degree) => degree === 'p1' || degree === 'p2';
  const isGraded = (degree) => degree === 'comp' || degree === 'sup';

  // ---------- Participles ----------

  // One's own car, bike or motorbike — not the bus, a lorry or a plane ("der falsch geparkte Zug").
  const isVehicle = (n) => !!n.kinds?.includes('vehicle') && n.own;
  const DEVICES = new Set(['Computer', 'Uhr', 'Handy', 'Lampe', 'Armbanduhr']);
  // Things one carries about (no furniture, no part of a garment: "die vergessene Hosentasche"), and whole things. The
  // built-in things that stay at home (Computer, Lampe, Bild) are no big furniture either, hence their own list.
  const whole = (n) => !n.part;
  const CARRIED = new Set(['Mantel', 'Tasche', 'Uhr', 'Jacke', 'Buch', 'Handy']);
  const carried = (n) => (n.anki ? !n.big && whole(n) : CARRIED.has(n.lemma));
  // People one says are married: grown-ups, but not spouses, brides, parents and grandparents (onlyOne) or widows
  // ("die verheiratete Braut").
  const marries = (n) => !n.child && !n.onlyOne && !['Witwe', 'Witwer'].includes(n.lemma);
  const lemmas = (...list) => (n) => list.includes(n.lemma);
  const not = (...list) => (n) => !list.includes(n.lemma);

  // A participle and the nouns it describes. fits: which nouns of the category; ext: words that can stand before it
  // (das gestern gekaufte Buch); clash: frames it makes no sense in ("Der schlafende Hund schläft …", "Sie kauft die
  // gekaufte Jacke", "Mir gefällt der verletzte Mann").
  const partizip1 = (inf) => inf + 'd';
  const participle = (form, inf, cat, { fits = null, ext = [], clash = null } = {}) => {
    const v = verbs.verb(inf);
    if (!v) throw new Error(`Adjektivendungen: the verb module cannot conjugate "${inf}"`);
    return { form, inf, cat, fits, ext, clash, stems: form === 'p1' ? [partizip1(inf)] : v.pii };
  };
  const PARTICIPLES = [
    participle('p1', 'lachen', 'person', { ext: ['laut'], clash: /lacht|wohnt|mag|Zimmer|Haus\b|Geburtstag|spreche|danke|gehört|helfen/ }),
    participle('p1', 'weinen', 'person', { ext: ['laut'], clash: /lacht|wohnt|gefällt|mag|Haus\b|Geburtstag|gehört|spielt|Geschenk|kennen|danke/ }),
    participle('p1', 'warten', 'person', { fits: not('Baby'), ext: ['seit Stunden', 'draußen'], clash: /wartet|wohnt|lacht|gefällt|mag|Zimmer|Haus\b|Geburtstag|gehört|spielt|kennen/ }),
    participle('p1', 'schlafen', 'person', { ext: ['tief'], clash: /lacht|wohnt|gefällt|mag|Name|Haus\b|Geburtstag|spreche|danke|gehört|frage|helfen|spielt|wartet|gibt|Geschenk|kennen/ }),
    participle('p2', 'verletzen', 'person', { ext: ['schwer', 'leicht'], clash: /lacht|wohnt|gefällt|Geburtstag|spielt|Geschenk|Name|danke|gehört|Haus\b|Zimmer|mag/ }),
    participle('p2', 'einladen', 'person', { fits: (n) => !n.child, ext: ['gestern', 'zur Party'], clash: /lacht|wohnt|gehört|Name|kennen|spielt|Haus\b|Zimmer|mag/ }),
    participle('p2', 'verheiraten', 'person', { fits: marries, ext: ['glücklich'], clash: /lacht|gefällt|danke|Geschenk|spielt|helfen|gehört|Haus\b|Zimmer|mag|frage/ }),
    participle('p2', 'stressen', 'person', { fits: (n) => !n.child, ext: ['total'], clash: /lacht|gefällt|Name|Zimmer|Haus\b|Geburtstag|gehört|spielt|Geschenk|kennen|mag/ }),

    participle('p1', 'schlafen', 'animal', { ext: ['im Garten', 'tief'], clash: /schläft|füttern|spielt|Farbe|Name|wartet/ }),
    participle('p1', 'spielen', 'animal', { ext: ['im Garten'], clash: /schläft|füttern|spielt|Farbe|Name|wartet/ }),
    participle('p2', 'verletzen', 'animal', { ext: ['schwer', 'leicht'], clash: /gefällt|spielt|Geschenk|Name|Farbe|mag/ }),
    participle('p2', 'retten', 'animal', { ext: ['gestern'], clash: /schläft|Farbe/ }),

    participle('p2', 'kaufen', 'thing', { fits: (n) => whole(n) && n.lemma !== 'Taxi', ext: ['gestern', 'neu'], clash: /kauft|brauchen|Preis|Farbe/ }),
    participle('p2', 'bestellen', 'thing', { fits: whole, ext: ['online', 'gestern'], clash: /kauft|bestellt|brauchen|Farbe/ }),
    participle('p2', 'finden', 'thing', { fits: carried, ext: ['gestern', 'im Park'], clash: /sucht|kauft|brauchen|Preis|Ohne|zufrieden/ }),
    participle('p2', 'verlieren', 'thing', { fits: carried, ext: ['gestern', 'im Zug'], clash: /Hier|kauft|brauchen|Preis|Ohne|zufrieden|Was machst|Farbe/ }),
    participle('p2', 'vergessen', 'thing', { fits: carried, ext: ['im Bus', 'gestern'], clash: /Hier|kauft|brauchen|Preis|Ohne|zufrieden|Farbe/ }),
    participle('p2', 'stehlen', 'thing', { fits: (n) => carried(n) || isVehicle(n), ext: ['gestern', 'vor dem Bahnhof'], clash: /Hier|kauft|brauchen|gefällt|mag|Preis|Ohne|zufrieden|Was machst|Farbe/ }),
    participle('p2', 'reparieren', 'thing', { fits: (n) => n.big || DEVICES.has(n.lemma), ext: ['endlich', 'gerade'], clash: /kauft|Preis|Farbe/ }),
    participle('p2', 'parken', 'thing', { fits: isVehicle, ext: ['falsch', 'vor dem Haus'], clash: /kauft|brauchen|Preis|Ohne|zufrieden|Was machst/ }),

    participle('p1', 'kochen', 'food', { fits: lemmas('Wasser', 'Milch', 'Suppe'), clash: /kauft|bestellt|mag|gefällt|schmeckt|Geschmack|Preis|zufrieden/ }),
    participle('p1', 'dampfen', 'food', { fits: lemmas('Kaffee', 'Tee', 'Suppe'), clash: /kauft|Preis|Ohne/ }),
    participle('p2', 'kaufen', 'food', { fits: not('Wasser'), ext: ['frisch'], clash: /kauft|bestellt|Preis|brauchen/ }),
    participle('p2', 'kühlen', 'food', { fits: (n) => n.drink, ext: ['gut'], clash: /Preis/ }),

    participle('p1', 'anhalten', 'weather', { fits: not('Luft', 'Wetter'), clash: /kommt|Wir erwarten|wartet/ }),
    participle('p2', 'ankündigen', 'weather', { fits: not('Luft', 'Wetter'), ext: ['für heute', 'für morgen'], clash: /gefällt|mag|^Das/ }),

    participle('p1', 'wachsen', 'quality', { fits: not('Humor', 'Ehrlichkeit', 'Vernunft', 'Talent', 'Geduld'), ext: ['ständig'], clash: /^Das/ }),
  ];

  // The adjectives — or participles, for p1 / p2 — a noun takes in a degree.
  function wordsFor(noun, degree) {
    if (!isParticiple(degree)) return adjectivesFor(noun, degree);
    return PARTICIPLES.filter((p) => p.form === degree && p.cat === noun.cat && (!p.fits || p.fits(noun)));
  }

  // ---------- Adjectives used as nouns ----------

  // Built-in ones; with the Anki option, the deck's learnt ones too (der / die Verwandte) — alone where enough are learnt.
  const NOMINALS = ['Bekannt', 'Verwandt', 'Erwachsen', 'Deutsch', 'Krank', 'Arbeitslos', 'Jugendlich', 'Fremd', 'Angestellt', 'Reisend', 'Verlobt'];
  // One's own: "mein Bekannter", "unsere Verwandten" (not "sein Fremder").
  const OWN_NOMINALS = new Set(['Bekannt', 'Verwandt', 'Verlobt', 'Angestellt']);
  const MEANT = { m: 'ein Mann', f: 'eine Frau', pl: 'mehrere Leute' };

  // A stand-in noun for an adjective used as a noun, so the person frames and determiners are chosen as for any noun:
  // the deck's learnt ones where two or more fit the cell, the built-in ones too otherwise (some cells need a possessive:
  // "unserer Verwandten"). Not vocab.prefer: these carry no card, so they can't be weighted against the built-in ones.
  function nominalNoun(variant, gender, caseKey, rnd, avoid, source) {
    const asNoun = (stem) => ({ cat: 'person', g: gender === 'pl' ? 'm' : gender, lemma: stem, mass: false, own: OWN_NOMINALS.has(stem), sg: true, pl: true });
    const fitting = (words) => words.filter((w) => framesFor(variant, gender, caseKey, asNoun(w), 'nom').length);
    const mine = source === 'anki' ? fitting(vocab.nominals) : [];
    const pool = mine.length >= 2 ? mine : [...new Set([...mine, ...fitting(NOMINALS)])];
    return asNoun(pickFresh(pool, avoid, (w) => w, rnd));
  }

  // The participles of the noun that make sense in the frame (any word fits a frame in the other degrees).
  const wordsInFrame = (noun, degree, frame) => wordsFor(noun, degree).filter((p) => !p.clash?.test(frame.t));

  const VARIANT_HINTS = { strong: 'no article', weak: 'der / dieser / jeder', mixed: 'ein / kein / mein' };

  const DETERMINERS = {
    weak: [
      { stem: 'd', table: 'der', weight: 5 },
      { stem: 'dies', table: 'dies', weight: 2 },
      { stem: 'jed', table: 'dies', weight: 1, countSg: true },
      { stem: 'all', table: 'dies', weight: 1, plOnly: true },
    ],
    mixed: [
      { stem: 'ein', table: 'ein', weight: 5, countSg: true },
      { stem: 'kein', table: 'ein', weight: 3 },
      ...['mein', 'dein', 'sein', 'ihr', 'unser'].map((stem) => ({ stem, kind: 'poss', table: 'ein', weight: 1 })),
    ],
  };

  // {0} = noun phrase, {singular|plural} = form chosen by the noun phrase's number (see cloze.fillTemplate).
  // kein: the frame takes kein — elsewhere it sounds wrong ("Das Geschenk ist für keine Tante", "Kein Stuhl ist kaputt").
  // no: determiner stems that don't fit (jed: "Das ist jeder alte Topf"); count: countable nouns only ("Neues Shampoo ist kaputt").
  const FRAMES = {
    nom: [
      { t: 'Hier {ist|sind} {0}.', cats: ['person', 'animal', 'thing', 'food'], kein: true, no: ['jed'] },
      { t: 'Das {ist|sind} {0}.', cats: ['person', 'animal', 'thing', 'food', 'weather', 'quality'], kein: true, no: ['jed'] },
      { t: 'Mir {gefällt|gefallen} {0}.', cats: ['person', 'animal', 'thing', 'food', 'weather'] },
      { t: 'Wo {ist|sind} {0}?', cats: ['person', 'animal', 'thing'], no: ['jed'] },
      { t: '{0} {wohnt|wohnen} hier.', cats: ['person'] },
      { t: '{0} {lacht|lachen} viel.', cats: ['person'] },
      { t: '{0} {schläft|schlafen} im Garten.', cats: ['animal'] },
      { t: '{0} {ist|sind} kaputt.', cats: ['thing'], count: true },
      { t: '{0} {schmeckt|schmecken} gut.', cats: ['food'] },
      { t: '{0} {kommt|kommen} aus dem Norden.', cats: ['weather'] },
      { t: '{0} {ist|sind} wichtig.', cats: ['quality'] },
    ],
    acc: [
      { t: 'Ich sehe {0}.', cats: ['person', 'animal', 'thing'], kein: true },
      { t: 'Wir kennen {0}.', cats: ['person', 'animal'] },
      { t: 'Ich frage {0}.', cats: ['person'] },
      { t: 'Wir füttern {0}.', cats: ['animal'] },
      { t: 'Sie kauft {0}.', cats: ['thing', 'food'], kein: true },
      { t: 'Er sucht {0}.', cats: ['person', 'animal', 'thing'] },
      { t: 'Er bestellt {0}.', cats: ['food'], kein: true },
      { t: 'Ich mag {0}.', cats: ['person', 'animal', 'thing', 'food', 'weather'], kein: true },
      { t: 'Wir brauchen {0}.', cats: ['thing', 'food', 'quality'], kein: true },
      { t: 'Das Geschenk ist für {0}.', cats: ['person', 'animal'] },
      { t: 'Er wartet auf {0}.', cats: ['person', 'animal', 'weather'] },
      { t: 'Wir erwarten {0}.', cats: ['weather'] },
      { t: 'Sie zeigt {0}.', cats: ['quality'] },
      { t: 'Ohne {0} geht es nicht.', cats: ['thing', 'food', 'quality'] },
    ],
    dat: [
      { t: 'Ich spreche mit {0}.', cats: ['person'] },
      { t: 'Wir helfen {0}.', cats: ['person', 'animal'] },
      { t: 'Sie gibt {0} einen Apfel.', cats: ['person', 'animal'] },
      { t: 'Das Buch gehört {0}.', cats: ['person'] },
      { t: 'Ich danke {0}.', cats: ['person'] },
      { t: 'Er spielt gern mit {0}.', cats: ['person', 'animal'] },
      { t: 'Was machst du mit {0}?', cats: ['thing', 'food'] },
      { t: 'Ich bin zufrieden mit {0}.', cats: ['thing', 'food'] },
      { t: 'Wir rechnen mit {0}.', cats: ['weather'] },
      { t: 'Bei {0} bleiben wir zu Hause.', cats: ['weather'] },
      { t: 'Sie arbeitet mit {0}.', cats: ['quality'] },
      { t: 'Er antwortet mit {0}.', cats: ['quality'] },
    ],
    gen: [
      { t: 'Das ist das Haus {0}.', cats: ['person'] },
      { t: '{Der Name|Die Namen} {0} {ist|sind} schön.', cats: ['person', 'animal'] },
      { t: 'Das Zimmer {0} ist groß.', cats: ['person'] },
      { t: 'Wir feiern den Geburtstag {0}.', cats: ['person'] },
      { t: 'Die Farbe {0} gefällt mir.', cats: ['animal', 'thing'] },
      { t: 'Der Preis {0} ist hoch.', cats: ['thing', 'food'] },
      { t: 'Der Geschmack {0} ist gut.', cats: ['food'] },
      { t: 'Wegen {0} bleiben wir zu Hause.', cats: ['weather'] },
      { t: 'Trotz {0} gehen wir spazieren.', cats: ['weather'] },
      { t: 'Trotz {0} hat er keinen Erfolg.', cats: ['quality'] },
      { t: 'Wegen {0} hat sie es geschafft.', cats: ['quality'] },
    ],
  };

  const FRAME_CATS = new Set(Object.values(FRAMES).flatMap((fs) => fs.flatMap((f) => f.cats)));

  // Plural needs countable nouns; strong singular (no article) only sounds natural with mass nouns, and qualities only
  // without the definite article ("große Geduld", not "die große Geduld"). With caseKey: only nouns some frame of that
  // case takes with a determiner of the variant.
  // source 'anki': the learner's nouns (vocab.js) where enough fit, the built-in ones too otherwise.
  // degree: comparative and superlative need a gradable adjective; no superlative quality ("seine größte Geduld").
  function nounPool(variant, gender, source = 'builtin', caseKey = null, degree = 'pos') {
    const form = gender === 'pl'
      ? (n) => n.pl
      : (n) => n.g === gender && n.sg && (variant !== 'strong' || n.mass);
    const fits = (n) => FRAME_CATS.has(n.cat) && form(n) && !(variant === 'weak' && n.cat === 'quality')
      && wordsFor(n, degree).length && !(degree === 'sup' && n.cat === 'quality')
      && (!caseKey || framesFor(variant, gender, caseKey, n, degree).length);
    return vocab.pool(NOUNS, fits, source);
  }

  // countSg: singular countable nouns only — no plural "ein", and "einen großen Respekt" / "jedes frische Obst" sound unnatural.
  // No kein where the frame doesn't take it or with a quality, no possessive where it doesn't fit ("unsere Person", "sein Schnee", "ihre Mütter").
  function determinerPool(variant, gender, noun, frame, degree = 'pos') {
    const plural = gender === 'pl';
    return DETERMINERS[variant].filter((d) => (plural ? !d.countSg : !d.plOnly && !(d.countSg && noun.mass))
      && !(d.stem === 'kein' && (!frame.kein || noun.cat === 'quality')) && !frame.no?.includes(d.stem)
      && !(d.kind === 'poss' && !vocab.possessiveFits(noun, plural))
      && !(degree === 'sup' && d.stem !== 'd' && d.kind !== 'poss')
      // A comparative needs something to compare with, which jeder / alle / kein leave out ("jedem süßeren Baby").
      && !(degree === 'comp' && ['jed', 'all', 'kein'].includes(d.stem)));
  }

  // The frames of a case that take the noun, with a determiner of the variant (and, for participles, one that fits).
  function framesFor(variant, gender, caseKey, noun, degree = 'pos') {
    return FRAMES[caseKey].filter((f) => f.cats.includes(noun.cat) && !(f.count && noun.mass)
      && (variant === 'strong' || determinerPool(variant, gender, noun, f, degree).length)
      && (!isParticiple(degree) || wordsInFrame(noun, degree, f).length));
  }

  // degree 'comp' / 'sup': the adjective is typed whole, from its basic form ("alt" → "älteren"); 'p1' / 'p2': the
  // participle, from the infinitive ("schlafen" → "schlafende"), now and then with a word before it (gestern gekaufte);
  // 'nom': the adjective is the noun ("mit dem Bekannt[en]"), and the prompt says who is meant.
  function buildItem(variant, gender, caseKey, rnd = Math.random, avoidLemmas = [], source = 'builtin', degree = 'pos') {
    if (!degreeFits(degree, variant, gender, caseKey)) throw new Error(`no ${degree} with ${variant} endings for ${gender} ${caseKey}`);
    const ci = CASES.indexOf(caseKey);
    const plural = gender === 'pl';
    const nominal = degree === 'nom';
    const noun = nominal ? nominalNoun(variant, gender, caseKey, rnd, avoidLemmas, source)
      : vocab.pickDue(nounPool(variant, gender, source, caseKey, degree), rnd, { recent: avoidLemmas });
    const frame = pick(framesFor(variant, gender, caseKey, noun, degree), rnd);
    const word = nominal ? noun.lemma : pick(wordsInFrame(noun, degree, frame), rnd);
    const adj = isParticiple(degree) ? word.inf : word;
    const ext = isParticiple(degree) && word.ext.length && rnd() < 0.35 ? pick(word.ext, rnd) : null;
    const det = variant === 'strong' ? null : pickWeighted(determinerPool(variant, gender, noun, frame, degree), rnd);
    const ending = ADJ_ENDINGS[variant][gender][ci];

    const np = [];
    if (det) np.push(gap('det', 'article ending', det.stem, DET_ENDINGS[det.table][gender][ci]), ' ');
    if (ext) np.push(ext, ' ');
    if (degree === 'pos' || nominal) np.push(gap('adj', 'adjective ending', adj, ending));
    else {
      // The grey word stays as written at the start of a sentence: "alt", "schlafen" (the answer is capitalized).
      const [stem, ...others] = isParticiple(degree) ? word.stems : degreeStems(adj, degree);
      np.push(gap('adj', `${DEGREE_LABELS[degree]} of ${adj}`, '', stem + ending, { alts: others.map((o) => o + ending), placeholder: adj, keepCase: true }));
    }
    if (!nominal) np.push(' ', (plural ? noun.pl : noun.sg)[ci]);

    return {
      variant,
      gender,
      case: caseKey,
      degree,
      adj,
      ext,
      noun: noun.lemma,
      notes: vocab.notesOf(noun),
      det: det ? det.stem : null,
      frame: frame.t,
      ...(nominal && { prompt: { label: 'Gemeint', text: MEANT[gender] } }),
      tokens: fillTemplate(frame.t, [np], plural),
    };
  }

  // quick: every case × variant once, each variant covering all four genders; full: every cell.
  // degrees: rotated through each variant's sentences (the superlative skips the strong ones; superlative only = weak and mixed).
  function buildRound({ mode = 'quick', order = 'shuffle', vocab: source = 'builtin', degrees = ['pos'] } = {}, rnd = Math.random) {
    const variants = VARIANTS.filter((v) => degrees.some((d) => degreeFits(d, v)));
    let combos = [];
    for (const variant of variants) {
      if (mode === 'full') {
        for (const gender of GENDERS) for (const c of CASES) combos.push({ variant, gender, case: c });
      } else {
        const genders = shuffle(GENDERS, rnd);
        CASES.forEach((c, i) => combos.push({ variant, gender: genders[i], case: c }));
      }
    }
    if (order === 'grouped') {
      combos = variants.flatMap((v) => shuffle(combos.filter((x) => x.variant === v), rnd));
    } else {
      combos = shuffle(combos, rnd);
    }
    const turn = {};
    for (const x of combos) {
      const fitting = (g) => degrees.filter((d) => degreeFits(d, x.variant, g, x.case));
      // A cell no chosen degree fits (a neuter one with only nom) drops out; in a quick round it takes the first gender
      // that fits instead (a full round has that cell already).
      if (mode === 'quick' && !fitting(x.gender).length) x.gender = GENDERS.find((g) => fitting(g).length) ?? x.gender;
      const fit = fitting(x.gender);
      if (!fit.length) continue;
      turn[x.variant] ??= Math.floor(rnd() * fit.length);
      x.degree = fit[turn[x.variant]++ % fit.length];
    }
    const recent = [];
    return combos.filter((x) => x.degree).map((x) => {
      const item = buildItem(x.variant, x.gender, x.case, rnd, recent, source, x.degree);
      remember(recent, item.noun);
      return item;
    });
  }

  function explain(item) {
    const ending = endingRule(item);
    if (item.degree === 'pos') return ending;
    if (item.degree === 'nom') {
      return `An adjective used as a noun (der ${item.adj}e, ein ${item.adj}er): written with a capital, it keeps the adjective endings. ${ending}`;
    }
    if (isParticiple(item.degree)) {
      const word = gaps(item).find((g) => g.slot === 'adj').answer;
      const stem = item.degree === 'p1' ? `${partizip1(item.adj)} (Partizip I: the infinitive + d)` : `${verbs.verb(item.adj).pii[0]} (Partizip II)`;
      const ext = item.ext ? ` What belongs to the participle stands before it: ${item.ext} ${word}.` : '';
      return `${item.adj} → ${stem}, used as an adjective with the usual ending. ${ending}${ext}`;
    }
    const stem = degreeStems(item.adj, item.degree)[0];
    const form = `${item.adj} → ${stem}- (${DEGREE_LABELS[item.degree]})`;
    const sup = item.degree === 'sup' ? ' The superlative takes der / die / das or a possessive, never ein or kein.' : '';
    return `${form}, then the usual ending. ${ending}${sup}`;
  }

  function endingRule(item) {
    const ci = CASES.indexOf(item.case);
    const adjEnd = display(ADJ_ENDINGS[item.variant][item.gender][ci]);
    if (item.variant === 'strong') {
      // Strong endings copy the dieser-endings, except genitive m/n.
      const dies = DET_ENDINGS.dies[item.gender][ci];
      if (display(dies) !== adjEnd) {
        return `No article → strong ending, but genitive m/n is the exception: ${adjEnd} (the noun already shows the case with -(e)s).`;
      }
      return `No article → the adjective carries the case signal itself: ${adjEnd}, like dies${dies}.`;
    }
    const det = gaps(item).find((g) => g.slot === 'det');
    const detWord = det.prefix.toLowerCase() + det.answer;
    if (item.variant === 'weak') {
      return `"${detWord}" already shows case and gender → weak ending ${adjEnd} (-e for nom. singular and acc. f/n, -en everywhere else).`;
    }
    if (det.answer === '') {
      return `"${detWord}" has no ending here → the adjective must show gender and case: strong ending ${adjEnd}.`;
    }
    return `"${detWord}" already shows the case → weak ending ${adjEnd}.`;
  }

  function toCloze(item) {
    return {
      ...item,
      tags: [
        { text: item.variant, cls: item.variant },
        { text: CASE_LABELS[item.case], cls: 'plain' },
        { text: GENDER_LABELS[item.gender], cls: `g-${item.gender}` },
        ...(item.degree !== 'pos' ? [{ text: DEGREE_LABELS[item.degree], cls: 'plain' }] : []),
      ],
      explain: explain(item),
    };
  }

  function endingsTable() {
    return {
      title: 'Endings from memory',
      endings: true,
      lead: 'Adjective endings only. Each column runs Nom → Akk → Dat → Gen.',
      blocks: VARIANTS.map((variant) => ({
        title: variant,
        sub: VARIANT_HINTS[variant],
        cls: variant,
        rows: CASE_ROWS,
        cols: GENDER_COLS,
        answers: GENDERS.map((g) => ADJ_ENDINGS[variant][g]),
      })),
    };
  }

  // Comparative and predicative superlative ("am ältesten") of the round's adjectives.
  function degreesTable(items) {
    const adjs = [...new Set(items.filter((i) => isGraded(i.degree)).map((i) => i.adj))];
    return {
      title: 'Komparativ und Superlativ',
      lead: 'The comparative and the superlative with "am" of this round\'s adjectives.',
      blocks: [{
        rows: adjs,
        cols: [{ head: 'Komparativ', sub: 'älter' }, { head: 'Superlativ', sub: 'am ältesten' }],
        answers: [
          adjs.map((a) => degreeStems(a, 'comp')),
          adjs.map((a) => degreeStems(a, 'sup').map((s) => `am ${s}en`)),
        ],
      }],
    };
  }

  // Both participles of the round's participle verbs.
  function participlesTable(items) {
    const infs = [...new Set(items.filter((i) => isParticiple(i.degree)).map((i) => i.adj))];
    return {
      title: 'Partizipien',
      lead: 'Partizip I (the infinitive + d) and Partizip II of this round\'s verbs.',
      blocks: [{
        rows: infs,
        cols: [{ head: 'Partizip I', sub: 'schlafend' }, { head: 'Partizip II', sub: 'geschlafen' }],
        answers: [infs.map((inf) => [partizip1(inf)]), infs.map((inf) => verbs.verb(inf).pii)],
      }],
    };
  }

  function drillStep(settings, items, typedWhole) {
    const typed = typedWhole ? ' · Komparativ, Superlativ, Partizip: type the whole word from the grey one (älteren, schlafende)' : '';
    return {
      type: 'drill',
      label: 'Sentences',
      hint: `Tab moves between gaps · leave a gap empty (or type -) for no ending · typing the whole word also counts${typed}`,
      hideTags: !settings.hints,
      items: items.map(toCloze),
    };
  }

  function tableStep() {
    return { type: 'table', label: 'Endings table', table: endingsTable() };
  }

  // The degrees and participles tables come first when the round has them, so the forms are fresh.
  function startSteps(settings, rnd) {
    const items = buildRound(settings, rnd);
    const has = (test) => items.some((i) => test(i.degree));
    const typedWhole = has((d) => d !== 'pos' && d !== 'nom');
    return [
      ...(has(isGraded) ? [{ type: 'table', label: 'Komparativ und Superlativ', table: degreesTable(items) }] : []),
      ...(has(isParticiple) ? [{ type: 'table', label: 'Partizipien', table: participlesTable(items) }] : []),
      drillStep(settings, items, typedWhole),
      tableStep(),
    ];
  }

  return {
    id: 'adjectives',
    title: 'Adjektivendungen',
    subtitle: 'Adjective endings — strong, weak and mixed, in every case; also with the comparative, the superlative and participles.',
    intro: vocab.intro('Fill in the article and adjective endings in a sentence for every case and variant, then write out the three ending tables from memory. With Komparativ or Superlativ, type the whole adjective from its basic form; with a Partizip, the whole participle from the infinitive (schlafen → der schlafende Hund).', (n) => n.cat),
    defaults: { mode: 'quick', order: 'shuffle', hints: true, vocab: 'anki', degrees: ['pos'] },
    prepare: vocab.prepare,
    options: [
      vocab.OPTION,
      {
        key: 'mode', label: 'Round', type: 'radio', choices: [
          { value: 'quick', label: 'Quick', detail: '12 sentences — every case × variant, genders rotated' },
          { value: 'full', label: 'Full', detail: '48 sentences — every case × gender × variant' },
        ],
      },
      {
        key: 'degrees', label: 'Adjective', type: 'checkboxes', min: 1, choices: [
          { value: 'pos', label: 'Grundform', detail: 'der alte Mann' },
          { value: 'comp', label: 'Komparativ', detail: 'der ältere Mann' },
          { value: 'sup', label: 'Superlativ', detail: 'der älteste Mann · with der or a possessive' },
          { value: 'p1', label: 'Partizip I', detail: 'der schlafende Hund · die seit Stunden wartenden Gäste' },
          { value: 'p2', label: 'Partizip II', detail: 'das reparierte Auto · das gestern gekaufte Buch' },
          { value: 'nom', label: 'Nominalisiert', detail: 'der Bekannte, ein Bekannter, mit Verwandten · your deck\'s ones first' },
        ],
      },
      {
        key: 'order', label: 'Order', type: 'radio', choices: [
          { value: 'shuffle', label: 'Shuffled' },
          { value: 'grouped', label: 'Grouped', detail: 'strong → weak → mixed' },
        ],
      },
      { key: 'hints', label: 'Hints', type: 'toggle', text: 'Show case & gender before answering' },
    ],
    sessions: [
      {
        label: 'Start',
        build: startSteps,
      },
      { label: 'Endings table only', build: () => [tableStep()] },
    ],

    CASES, GENDERS, VARIANTS, DEGREES, ADJ_ENDINGS, DET_ENDINGS, FRAMES, PARTICIPLES,
    nounPool, adjectivesFor, wordsFor, buildItem, buildRound, explain, degreesTable, participlesTable,
  };
});
