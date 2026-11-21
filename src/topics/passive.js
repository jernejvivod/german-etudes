// Topic: the German passive — Vorgangspassiv (werden), Zustandspassiv (sein), Rezipientenpassiv (bekommen), and what
// stands in for a passive with können / müssen (Passiversatz: lässt sich reparieren, ist zu reparieren, reparierbar).
// Session: conjugate the auxiliaries first, then turn active sentences into passive ones (cloze).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/cloze.js'), require('../core/verbs.js'));
  } else {
    root.Etudes.topics.push(factory(root.Etudes.cloze, root.Etudes.verbs));
  }
})(globalThis, function (cloze, verbs) {
  'use strict';

  const { pick, pickFresh, remember, shuffle, capitalize, wordGap } = cloze;

  const { PERSONS, PERSON_LABELS } = verbs;

  const TENSES = ['praes', 'praet', 'perf', 'plusq', 'fut'];
  const TENSE_LABELS = { praes: 'Präsens', praet: 'Präteritum', perf: 'Perfekt', plusq: 'Plusquamperfekt', fut: 'Futur I' };

  // Finite forms of the auxiliaries in PERSONS order (from the shared verb module).
  const finiteForms = (inf, tense) => verbs.verb(inf)[tense].map((f) => f[0]);
  const CONJ = Object.fromEntries(['werden', 'sein', 'haben', 'bekommen', 'lassen', 'können', 'müssen'].map((inf) => [inf, { praes: finiteForms(inf, 'pres'), praet: finiteForms(inf, 'pret') }]));

  // Each passive tense = finite auxiliary (verb + its tense) + Partizip II + optional trailing auxiliary.
  const KINDS = {
    werden: {
      label: 'Vorgangspassiv',
      detail: 'Das Haus wird gebaut.',
      example: 'gebaut',
      forms: {
        praes: { verb: 'werden', tense: 'praes', aux2: '' },
        praet: { verb: 'werden', tense: 'praet', aux2: '' },
        perf: { verb: 'sein', tense: 'praes', aux2: 'worden' },
        plusq: { verb: 'sein', tense: 'praet', aux2: 'worden' },
        fut: { verb: 'werden', tense: 'praes', aux2: 'werden' },
      },
    },
    sein: {
      label: 'Zustandspassiv',
      detail: 'Das Fenster ist geöffnet. (Präsens, Präteritum, Futur I)',
      example: 'geöffnet',
      forms: {
        praes: { verb: 'sein', tense: 'praes', aux2: '' },
        praet: { verb: 'sein', tense: 'praet', aux2: '' },
        fut: { verb: 'werden', tense: 'praes', aux2: 'sein' },
      },
    },
    bekommen: {
      label: 'Rezipientenpassiv',
      detail: 'Ich bekomme ein Buch geschenkt.',
      example: 'geschenkt',
      forms: {
        praes: { verb: 'bekommen', tense: 'praes', aux2: '' },
        praet: { verb: 'bekommen', tense: 'praet', aux2: '' },
        perf: { verb: 'haben', tense: 'praes', aux2: 'bekommen' },
        plusq: { verb: 'haben', tense: 'praet', aux2: 'bekommen' },
        fut: { verb: 'werden', tense: 'praes', aux2: 'bekommen' },
      },
    },
    // forms drive the tense choice and the conjugation table (lassen); the items build themselves (ersatzItem).
    ersatz: {
      label: 'Passiversatz',
      detail: 'Das lässt sich reparieren. · Das ist zu reparieren. · Das ist reparierbar. (Präsens, Präteritum)',
      example: 'sich reparieren',
      forms: {
        praes: { verb: 'lassen', tense: 'praes', aux2: '' },
        praet: { verb: 'lassen', tense: 'praet', aux2: '' },
      },
    },
  };

  // A state is the result of a completed action, so the active prompt is one step further in the past.
  const ZUSTAND_SOURCE = { praes: 'perf', praet: 'plusq', fut: 'fut2' };
  const ACTIVE_TENSE_LABELS = { ...TENSE_LABELS, fut2: 'Futur II' };

  // Passive subject: nominative, its object form in the active sentence (akk, or dat for bekommen), person.
  function np(nom, obl = nom, person = '3sg') {
    return { nom, obl, person };
  }

  // Personal pronouns (3rd person sie is left out: "man lädt sie ein" is ambiguous between sg and pl).
  const PRONOUNS_AKK = [np('ich', 'mich', '1sg'), np('du', 'dich', '2sg'), np('er', 'ihn', '3sg'), np('wir', 'uns', '1pl'), np('ihr', 'euch', '2pl')];
  const PRONOUNS_DAT = [np('ich', 'mir', '1sg'), np('du', 'dir', '2sg'), np('er', 'ihm', '3sg'), np('wir', 'uns', '1pl'), np('ihr', 'euch', '2pl')];

  // Active agent (singular) and its von-phrase in the passive; null = "man", dropped in the passive.
  function ag(nom, von) {
    return { nom, von };
  }
  const MAN = null;

  // Vorgangs- and Zustandspassiv: the active accusative object becomes the subject.
  const OBJECT_ENTRIES = [
    { verb: 'bauen', kinds: ['werden', 'sein'], subjects: [np('das Haus'), np('die Brücke'), np('die neuen Wohnungen', undefined, '3pl')], agents: [MAN, ag('die Baufirma', 'von der Baufirma')] },
    { verb: 'reparieren', kinds: ['werden', 'sein'], subjects: [np('das Auto'), np('der Fernseher', 'den Fernseher'), np('die Fahrräder', undefined, '3pl')], agents: [MAN, ag('der Mechaniker', 'vom Mechaniker')], mid: 'in der Werkstatt' },
    { verb: 'schreiben', kinds: ['werden', 'sein'], subjects: [np('der Brief', 'den Brief'), np('die E-Mails', undefined, '3pl')], agents: [MAN, ag('die Sekretärin', 'von der Sekretärin')] },
    { verb: 'einladen', kinds: ['werden', 'sein'], subjects: [...PRONOUNS_AKK, np('die Gäste', undefined, '3pl')], agents: [MAN, ag('der Chef', 'vom Chef')], mid: 'zur Party' },
    { verb: 'abholen', kinds: ['werden'], subjects: [...PRONOUNS_AKK, np('die Kinder', undefined, '3pl')], agents: [MAN, ag('mein Vater', 'von meinem Vater')], mid: 'am Bahnhof' },
    { verb: 'operieren', kinds: ['werden'], subjects: [...PRONOUNS_AKK, np('der Patient', 'den Patienten')], agents: [MAN, ag('die Ärztin', 'von der Ärztin')], mid: 'im Krankenhaus' },
    { verb: 'anrufen', kinds: ['werden'], subjects: PRONOUNS_AKK, agents: [MAN, ag('der Arzt', 'vom Arzt')] },
    { verb: 'informieren', kinds: ['werden', 'sein'], subjects: [...PRONOUNS_AKK, np('die Mitarbeiter', undefined, '3pl')], agents: [MAN, ag('die Firma', 'von der Firma')], mid: 'per E-Mail' },
    { verb: 'waschen', kinds: ['werden', 'sein'], subjects: [np('die Wäsche'), np('der Pullover', 'den Pullover')], agents: [MAN] },
    { verb: 'verkaufen', kinds: ['werden', 'sein'], subjects: [np('das alte Auto'), np('die Tickets', undefined, '3pl')], agents: [MAN, ag('der Händler', 'vom Händler')] },
    { verb: 'übersetzen', kinds: ['werden', 'sein'], subjects: [np('das Buch'), np('der Vertrag', 'den Vertrag')], agents: [MAN, ag('eine Kollegin', 'von einer Kollegin')], mid: 'ins Deutsche' },
    { verb: 'stehlen', kinds: ['werden'], subjects: [np('das Fahrrad'), np('mein Handy')], agents: [MAN], mid: 'vor dem Bahnhof' },
    { verb: 'kontrollieren', kinds: ['werden'], subjects: [np('die Fahrkarten', undefined, '3pl'), np('der Ausweis', 'den Ausweis')], agents: [MAN, ag('die Kontrolleurin', 'von der Kontrolleurin')] },
    { verb: 'renovieren', kinds: ['werden', 'sein'], subjects: [np('die Wohnung'), np('das Bad')], agents: [MAN, ag('ein Handwerker', 'von einem Handwerker')] },
    { verb: 'öffnen', kinds: ['werden', 'sein'], subjects: [np('das Fenster'), np('die Tür'), np('die Geschäfte', undefined, '3pl')], agents: [MAN] },
    { verb: 'schließen', kinds: ['werden', 'sein'], subjects: [np('die Tür'), np('das Museum'), np('die Fenster', undefined, '3pl')], agents: [MAN] },
    { verb: 'putzen', kinds: ['werden', 'sein'], subjects: [np('die Küche'), np('die Fenster', undefined, '3pl')], agents: [MAN] },
    { verb: 'aufräumen', kinds: ['werden', 'sein'], subjects: [np('das Zimmer'), np('der Keller', 'den Keller')], agents: [MAN, ag('mein Sohn', 'von meinem Sohn')] },
    { verb: 'vorbereiten', kinds: ['werden', 'sein'], subjects: [np('das Essen'), np('die Präsentation')], agents: [MAN, ag('das Team', 'vom Team')] },
    { verb: 'reservieren', kinds: ['werden', 'sein'], subjects: [np('der Tisch', 'den Tisch'), np('die Zimmer', undefined, '3pl')], agents: [MAN] },
    { verb: 'bezahlen', kinds: ['werden', 'sein'], subjects: [np('die Rechnung'), np('die Getränke', undefined, '3pl')], agents: [MAN] },
    { verb: 'erledigen', kinds: ['werden', 'sein'], subjects: [np('die Arbeit'), np('die Hausaufgaben', undefined, '3pl')], agents: [MAN] },
    { verb: 'streichen', kinds: ['werden', 'sein'], subjects: [np('die Wände', undefined, '3pl'), np('der Zaun', 'den Zaun')], agents: [MAN, ag('ein Maler', 'von einem Maler')] },
    { verb: 'kochen', kinds: ['werden', 'sein'], subjects: [np('die Suppe'), np('das Abendessen')], agents: [MAN, ag('mein Bruder', 'von meinem Bruder')] },
  ];

  // Rezipientenpassiv: the active dative object (the recipient) becomes the subject; the accusative stays.
  const RECIPIENT_ENTRIES = [
    { verb: 'schenken', subjects: [...PRONOUNS_DAT, np('das Kind', 'dem Kind'), np('die Kinder', 'den Kindern', '3pl')], object: 'ein Buch', agents: [ag('die Oma', 'von der Oma'), MAN], mid: 'zum Geburtstag' },
    { verb: 'schicken', subjects: PRONOUNS_DAT, object: 'ein Paket', agents: [ag('meine Schwester', 'von meiner Schwester')] },
    { verb: 'erklären', subjects: [np('die Studenten', 'den Studenten', '3pl'), ...PRONOUNS_DAT], object: 'die Regel', agents: [ag('der Professor', 'vom Professor')], mid: 'noch einmal' },
    { verb: 'zeigen', subjects: [np('die Gäste', 'den Gästen', '3pl'), np('der Besucher', 'dem Besucher')], object: 'die Altstadt', agents: [ag('ein Stadtführer', 'von einem Stadtführer')] },
    { verb: 'empfehlen', subjects: PRONOUNS_DAT, object: 'ein gutes Restaurant', agents: [ag('der Kellner', 'vom Kellner'), MAN] },
    { verb: 'erstatten', subjects: [...PRONOUNS_DAT, np('die Kundin', 'der Kundin')], object: 'das Geld', agents: [ag('die Versicherung', 'von der Versicherung')] },
    { verb: 'liefern', subjects: [np('die Kunden', 'den Kunden', '3pl'), ...PRONOUNS_DAT], object: 'die Möbel nach Hause', agents: [MAN] },
    { verb: 'überreichen', subjects: [np('die Siegerin', 'der Siegerin'), np('der Gewinner', 'dem Gewinner')], object: 'einen Preis', agents: [ag('der Bürgermeister', 'vom Bürgermeister')] },
    { verb: 'bezahlen', subjects: PRONOUNS_DAT, object: 'die Überstunden', agents: [ag('die Firma', 'von der Firma')] },
  ].map((e) => ({ ...e, kinds: ['bekommen'] }));

  const ENTRIES = [...OBJECT_ENTRIES, ...RECIPIENT_ENTRIES];

  // ---------- Passiversatz ----------

  // können / müssen + passive, said another way: sich lassen + infinitive (kann only), sein + zu + infinitive (kann or muss),
  // or an adjective in -bar (kann only). Things only: "Ich lasse mich einladen" means something else.
  const ERSATZ_FORMS = { lassen: 'sich lassen', zu: 'sein + zu', bar: '-bar' };
  const BAR = { reparieren: 'reparierbar', waschen: 'waschbar', übersetzen: 'übersetzbar', bezahlen: 'bezahlbar', kontrollieren: 'kontrollierbar' };
  const PERSON_VERBS = new Set(['einladen', 'abholen', 'operieren', 'anrufen', 'informieren', 'stehlen']);
  const ERSATZ_ENTRIES = OBJECT_ENTRIES.filter((e) => !PERSON_VERBS.has(e.verb))
    .map((e) => ({ ...e, subjects: e.subjects.filter((s) => s.nom.includes(' ')) }));
  // What the modal says: können → leicht, nicht mehr …; müssen → by when.
  const ERSATZ_ADVERBS = { können: ['leicht', 'nicht mehr', 'schnell', 'nicht'], müssen: ['bis Freitag', 'sofort', 'heute noch'] };

  function ersatzItem(tense, rnd, avoidVerbs) {
    const entry = pickFresh(ERSATZ_ENTRIES, avoidVerbs, (e) => e.verb, rnd);
    const subject = pick(entry.subjects, rnd);
    const pi = PERSONS.indexOf(subject.person);
    const modal = rnd() < 0.3 ? 'müssen' : 'können';
    const form = modal === 'müssen' ? 'zu' : pick(BAR[entry.verb] ? ['lassen', 'zu', 'bar'] : ['lassen', 'zu'], rnd);
    const adv = pick(ERSATZ_ADVERBS[modal], rnd);
    const mid = form !== 'bar' && entry.mid && rnd() < 0.5 ? entry.mid : '';
    const v = VERBS[entry.verb];
    const said = `${CONJ[modal][tense][pi]} ${v.pii} werden`; // "kann repariert werden", in the item's tense
    const lassen = CONJ.lassen[tense][pi];
    const sein = CONJ.sein[tense][pi];
    const zu = verbs.zuInfinitive(verbs.verb(entry.verb));

    const tokens = [capitalize(subject.nom), ' '];
    if (form === 'lassen') tokens.push(wordGap('fin', lassen, 'lassen'), ` sich ${words([adv, mid])} `, wordGap('inf', entry.verb, 'infinitive'));
    else if (form === 'zu') tokens.push(wordGap('fin', sein, 'sein'), ` ${words([adv, mid])} `, wordGap('inf', zu, 'zu + infinitive'));
    else tokens.push(`${sein} ${adv} `, wordGap('adj', BAR[entry.verb], 'adjective in -bar'));
    tokens.push('.');

    const why = {
      lassen: `können + Passiv → sich lassen + infinitive: ${lassen} sich ${entry.verb} (= ${said}). lassen agrees with the subject.`,
      zu: `sein + zu + infinitive: ${sein} ${zu} (= ${said}) — it can stand for können or müssen; the context decides.`,
      bar: `-bar makes an adjective of "können … werden": ${BAR[entry.verb]} (= ${said}).`,
    }[form];
    const separable = form === 'zu' && v.sep ? ` A separable verb takes zu between its parts: ${zu}.` : '';
    return {
      kind: 'ersatz', tense, verb: entry.verb, form,
      prompt: { label: `Mit ${ERSATZ_FORMS[form]}`, text: sentence([subject.nom, CONJ[modal][tense][pi], adv, mid, v.pii, 'werden']) },
      tokens,
      tags: [{ text: KINDS.ersatz.label, cls: 'k-ersatz' }, { text: ERSATZ_FORMS[form], cls: 'plain' }, { text: TENSE_LABELS[tense], cls: 'plain' }],
      explain: why + separable,
    };
  }
  const words = (list) => list.filter(Boolean).join(' ');

  // The entries' verbs, 3rd person singular only (the active subject is always "man" or a singular agent), from the shared
  // verb module: er-Präsens, er-Präteritum, separable particle and Partizip II.
  const VERBS = Object.fromEntries([...new Set(ENTRIES.map((e) => e.verb))].map((inf) => {
    const v = verbs.verb(inf);
    if (!v) throw new Error(`Passiv: the verb module cannot conjugate "${inf}"`);
    return [inf, { pres: v.pres[2][0], pret: v.pret[2][0], ...(v.particle && { sep: v.particle }), pii: v.pii[0] }];
  }));

  // Time adverbials that fit each tense; Zustandspassiv gets its own (state-oriented) set.
  const TIMES = {
    praes: ['heute', 'gerade', 'jetzt'],
    praet: ['gestern', 'letzte Woche', 'damals'],
    perf: ['gestern', 'letzte Woche', 'heute Morgen'],
    plusq: ['schon vorher', 'kurz davor'],
    fut: ['morgen', 'nächste Woche', 'bald'],
  };
  const STATE_TIMES = {
    praes: ['schon', 'jetzt', 'endlich'],
    praet: ['schon', 'gestern schon', 'endlich'],
    fut: ['bis morgen', 'bis Freitag', 'bald'],
  };

  function sentence(list) {
    return capitalize(words(list)) + '.';
  }

  // Active verb group for a tense: finite verb + what goes to the end of the clause.
  function activeVerb(verbKey, tense) {
    const v = VERBS[verbKey];
    switch (tense) {
      case 'praes': return [v.pres, v.sep];
      case 'praet': return [v.pret, v.sep];
      case 'perf': return ['hat', v.pii];
      case 'plusq': return ['hatte', v.pii];
      case 'fut': return ['wird', verbKey];
      case 'fut2': return ['wird', `${v.pii} haben`];
    }
  }

  function combos(kinds, tenses) {
    return kinds.flatMap((kind) => tenses.filter((t) => KINDS[kind].forms[t]).map((tense) => ({ kind, tense })));
  }

  function buildItem(kind, tense, rnd = Math.random, avoidVerbs = []) {
    const form = KINDS[kind].forms[tense];
    if (!form) throw new Error(`${kind} has no ${tense}`);
    if (kind === 'ersatz') return ersatzItem(tense, rnd, avoidVerbs);
    const pool = ENTRIES.filter((e) => e.kinds.includes(kind));
    const entry = pickFresh(pool, avoidVerbs, (e) => e.verb, rnd);
    const subject = pick(entry.subjects, rnd);
    const state = kind === 'sein';
    const agent = state ? MAN : pick(entry.agents, rnd);
    const time = pick((state ? STATE_TIMES : TIMES)[tense], rnd);
    const mid = state ? '' : entry.mid;
    const activeTense = state ? ZUSTAND_SOURCE[tense] : tense;

    const [fin, rest] = activeVerb(entry.verb, activeTense);
    // Zustand prompts are one step further in the past than the tag ("Man hat … geschlossen" → "ist geschlossen"),
    // so their label names the active tense; elsewhere it would only repeat the tag.
    const prompt = {
      label: activeTense === tense ? 'Aktiv' : `Aktiv · ${ACTIVE_TENSE_LABELS[activeTense]}`,
      text: sentence([agent ? agent.nom : 'man', fin, subject.obl, time, mid, entry.object, rest]),
    };

    const finAnswer = CONJ[form.verb][form.tense][PERSONS.indexOf(subject.person)];
    const middle = [time, agent && agent.von, mid, entry.object].filter(Boolean).join(' ');
    const tokens = [...subjectTokens(subject), ' ', wordGap('fin', finAnswer, 'auxiliary'), ' '];
    if (middle) tokens.push(middle, ' ');
    tokens.push(wordGap('pii', VERBS[entry.verb].pii, 'Partizip II'));
    if (form.aux2) tokens.push(' ', wordGap('aux2', form.aux2, 'second auxiliary'));
    tokens.push('.');

    return {
      kind,
      tense,
      verb: entry.verb,
      prompt,
      tokens,
      tags: [
        { text: KINDS[kind].label, cls: `k-${kind}` },
        { text: TENSE_LABELS[tense], cls: 'plain' },
      ],
      explain: explain(kind, tense, subject, agent, activeTense),
    };
  }

  // The subject in the nominative: its first word (article / pronoun) is always a gap, and so is every
  // other word that changes from the active object form ("den Patienten" → [Der] [Patient]).
  function subjectTokens(subject) {
    const nom = subject.nom.split(' ');
    const obl = subject.obl.split(' ');
    return nom.flatMap((word, i) => {
      const token = i === 0 || word !== obl[i] ? wordGap('subj', i === 0 ? capitalize(word) : word, 'subject') : word;
      return i === 0 ? [token] : [' ', token];
    });
  }

  function formula(kind, tense) {
    const f = KINDS[kind].forms[tense];
    const fin = f.tense === 'praet' ? `${f.verb} (Präteritum)` : f.verb;
    return `${fin} + Partizip II${f.aux2 ? ` + ${f.aux2}` : ''}`;
  }

  function explain(kind, tense, subject, agent, activeTense) {
    const parts = [`${TENSE_LABELS[tense]}: ${formula(kind, tense)}.`];
    if (kind === 'werden' && KINDS.werden.forms[tense].aux2 === 'worden') parts.push('In the passive it is "worden", not "geworden".');
    if (kind === 'sein') parts.push(`A state, the result of the action: active ${ACTIVE_TENSE_LABELS[activeTense]} → Zustand ${TENSE_LABELS[tense]}.`);
    if (kind === 'bekommen') parts.push(`The dative "${subject.obl}" becomes the subject "${subject.nom}"; the accusative object stays.`);
    else parts.push(`The accusative "${subject.obl}" becomes the subject "${subject.nom}" (nominative).`);
    if (kind !== 'sein') parts.push(agent ? `The active subject becomes "${agent.von}".` : '"man" is dropped.');
    return parts.join(' ');
  }

  function buildRound({ kinds, tenses, length }, rnd = Math.random) {
    const all = combos(kinds, tenses);
    const items = [];
    const recent = [];
    let queue = [];
    while (items.length < length) {
      if (!queue.length) queue = shuffle(all, rnd);
      const { kind, tense } = queue.shift();
      const item = buildItem(kind, tense, rnd, recent);
      remember(recent, item.verb, 5);
      items.push(item);
    }
    return items;
  }

  function auxTable({ kinds, tenses }) {
    return {
      title: 'Auxiliary verbs',
      lead: 'Type the conjugated auxiliary for each person. Each column runs ich → sie/Sie.',
      wide: true,
      blocks: kinds
        .map((kind) => ({ kind, ts: combos([kind], tenses).map((c) => c.tense) }))
        .filter(({ ts }) => ts.length)
        .map(({ kind, ts }) => {
          const k = KINDS[kind];
          return {
            title: k.label,
            sub: k.detail,
            cls: `k-${kind}`,
            rows: PERSON_LABELS,
            cols: ts.map((t) => ({
              head: TENSE_LABELS[t],
              sub: `+ ${k.example}${k.forms[t].aux2 ? ' ' + k.forms[t].aux2 : ''}`,
            })),
            answers: ts.map((t) => CONJ[k.forms[t].verb][k.forms[t].tense]),
          };
        }),
    };
  }

  // "Pick at least one" is checked by the shell (min on the options); this is the cross-field rule.
  function validate({ kinds, tenses }) {
    if (!tenses.length) return null;
    const unused = kinds.find((kind) => !combos([kind], tenses).length);
    if (unused) {
      const own = Object.keys(KINDS[unused].forms).map((t) => TENSE_LABELS[t]).join(', ');
      return `${KINDS[unused].label} is practised in ${own} only — tick one of those tenses or untick it.`;
    }
    return null;
  }

  function tableStep(settings) {
    return { type: 'table', label: 'Auxiliary verbs', table: auxTable(settings) };
  }

  function drillStep(settings, rnd) {
    return {
      type: 'drill',
      label: 'Sentences',
      hint: 'Tab moves between gaps · fill in the subject\'s article or pronoun and every verb part'
        + (settings.kinds.includes('ersatz') ? ' · Passiversatz: zu goes in the gap too (zu reparieren, abzuholen)' : ''),
      items: buildRound(settings, rnd),
    };
  }

  // n sentences in the settings' scope, for a round here and for the Daily review.
  const sentences = (settings, n, rnd = Math.random) => drillStep({ ...settings, length: n }, rnd);

  return {
    id: 'passive',
    title: 'Passiv',
    subtitle: 'The passive voice — werden, sein and bekommen; and lässt sich reparieren, ist zu reparieren, reparierbar.',
    intro: 'First conjugate the auxiliaries, then turn active sentences into passive ones: fill in the subject and the verb parts. Passiversatz turns "kann / muss … werden" into sich lassen, sein + zu or -bar.',
    defaults: { kinds: ['werden'], tenses: ['praes', 'praet', 'perf'], length: 10 },
    options: [
      {
        key: 'kinds', label: 'Kind of passive', type: 'checkboxes', min: 1,
        choices: Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label, detail: k.detail })),
      },
      {
        key: 'tenses', label: 'Tenses', type: 'checkboxes', inline: true, min: 1,
        choices: TENSES.map((value) => ({ value, label: TENSE_LABELS[value] })),
      },
      {
        key: 'length', label: 'Round', type: 'radio', inline: true, round: true, choices: [
          { value: 10, label: '10 sentences' },
          { value: 20, label: '20 sentences' },
        ],
      },
    ],
    validate,
    sentences,
    sessions: [
      {
        label: 'Start',
        build(settings, rnd = Math.random) {
          return [tableStep(settings), sentences(settings, settings.length, rnd)];
        },
      },
      { label: 'Auxiliary tables only', build: (settings) => [tableStep(settings)] },
    ],

    PERSONS, TENSES, TENSE_LABELS, KINDS, ZUSTAND_SOURCE, ACTIVE_TENSE_LABELS, CONJ, VERBS, ENTRIES, BAR, ERSATZ_ENTRIES,
    combos, buildItem, buildRound,
  };
});
