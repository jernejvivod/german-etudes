// Topic: Nominalisierung ↔ Verbalisierung — a subordinate clause said as a prepositional phrase and back:
// "Weil es regnet, bleiben wir zu Hause." ↔ "Wegen des Regens bleiben wir zu Hause."; "Als er ankam, …" ↔ "Bei seiner
// Ankunft …". Both take position 1, so the main clause after them is the same.
// Session: the connector ↔ preposition table (with the round's verbs and their nouns), then sentences to rewrite.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/cloze.js'), require('../core/declension.js'), require('../core/vocab.js'), require('../core/verbs.js'));
  } else {
    root.Etudes.topics.push(factory(root.Etudes.cloze, root.Etudes.declension, root.Etudes.vocab, root.Etudes.verbs));
  }
})(globalThis, function (cloze, declension, vocab, verbs) {
  'use strict';

  const { wordGap, pick, remember, shuffle, capitalizeFirst } = cloze;
  const { CASES, CASE_LABELS, DET_ENDINGS, CONTRACTIONS, possessive } = declension;

  const DIRECTIONS = ['nom', 'verb'];
  const DIRECTION_LABELS = { nom: 'Nominalisieren', verb: 'Verbalisieren' };

  // Subjects of the clause: pronoun, verb person and possessive (er → seiner Ankunft).
  const PEOPLE = {
    ich: ['ich', '1sg', 'mein'], du: ['du', '2sg', 'dein'], er: ['er', '3sg', 'sein'], sie: ['sie', '3sg', 'ihr'],
    wir: ['wir', '1pl', 'unser'], ihr: ['ihr', '2pl', 'euer'], siePl: ['sie', '3pl', 'ihr'],
  };

  // A connector and the preposition that says the same, with the case it takes. clause: {S} = the subject (one of
  // subjects, ich / er / sie / wir by default), then the verb at the end, in tense; or a fixed subject (person: its verb
  // person). np: the noun phrase — { g, noun, gen?, det: 'def' | 'poss' } built for the subject, or a fixed answer (+ alts),
  // hint: the noun shown in the gap. main: the main clause after it, verb first. vp: the verb phrase the noun comes from,
  // for the table and the explanation (default: the verb).
  const ENTRIES = [
    { conj: 'weil', prep: 'wegen', case: 'gen', clause: 'es', person: '3sg', verb: 'regnen', tense: 'praes',
      np: { g: 'm', noun: 'Regen', gen: 'Regens', det: 'def' }, main: 'bleiben wir zu Hause' },
    { conj: 'weil', prep: 'wegen', case: 'gen', clause: '{S} krank', verb: 'sein', vp: 'krank sein', tense: 'praet',
      np: { g: 'f', noun: 'Krankheit', det: 'poss' }, main: 'fiel der Unterricht aus' },
    { conj: 'obwohl', prep: 'trotz', case: 'gen', clause: '{S} müde', verb: 'sein', vp: 'müde sein', tense: 'praet',
      np: { g: 'f', noun: 'Müdigkeit', det: 'poss' }, main: 'wurde bis Mitternacht weitergearbeitet' },
    { conj: 'als', prep: 'bei', case: 'dat', clause: '{S}', verb: 'ankommen', tense: 'praet',
      np: { g: 'f', noun: 'Ankunft', det: 'poss' }, main: 'war das Hotel schon geschlossen' },
    { conj: 'bevor', prep: 'vor', case: 'dat', clause: '{S}', verb: 'abfahren', tense: 'praes',
      np: { g: 'f', noun: 'Abfahrt', det: 'poss' }, main: 'muss noch alles gepackt werden' },
    { conj: 'nachdem', prep: 'nach', case: 'dat', clause: 'wir', person: '1pl', verb: 'essen', tense: 'plusq',
      np: { g: 'n', noun: 'Essen', det: 'def' }, main: 'gab es noch einen Kaffee' },
    { conj: 'nachdem', prep: 'nach', case: 'dat', clause: '{S}', verb: 'aufstehen', tense: 'plusq',
      np: { g: 'n', noun: 'Aufstehen', det: 'def' }, main: 'gab es Frühstück' },
    { conj: 'während', prep: 'während', case: 'gen', clause: '{S}', verb: 'studieren', tense: 'praet',
      np: { g: 'n', noun: 'Studium', gen: 'Studiums', det: 'poss' }, main: 'gab es noch keine Smartphones' },
    { conj: 'seit', alts: ['seitdem'], prep: 'seit', case: 'dat', clause: '{S}', verb: 'umziehen', tense: 'perf',
      np: { g: 'm', noun: 'Umzug', det: 'poss' }, main: 'ist alles viel ruhiger' },
    { conj: 'als', prep: 'bei', case: 'dat', clause: '{S}', subjects: ['wir', 'siePl'], verb: 'heiraten', tense: 'praet',
      np: { g: 'f', noun: 'Hochzeit', det: 'poss' }, main: 'war die ganze Familie da' },
    { conj: 'als', prep: 'in', case: 'dat', clause: '{S} jung', verb: 'sein', vp: 'jung sein', tense: 'praet',
      np: { g: 'f', noun: 'Jugend', det: 'poss' }, main: 'gab es hier noch keine Autobahn' },
    { conj: 'bis', prep: 'bis zu', case: 'dat', clause: '{S}', verb: 'zurückkommen', tense: 'praes',
      np: { g: 'f', noun: 'Rückkehr', det: 'poss' }, main: 'bleibt die Wohnung leer' },
    { conj: 'ohne dass', prep: 'ohne', case: 'acc', clause: '{S}', subjects: ['du', 'er', 'sie', 'ihr'], verb: 'helfen', tense: 'praes',
      np: { g: 'f', noun: 'Hilfe', det: 'poss' }, main: 'schaffen wir das nicht' },
    { conj: 'wenn', prep: 'bei', case: 'dat', clause: 'Sie Fragen', person: '3pl', verb: 'haben', vp: 'Fragen haben', tense: 'praes',
      np: { answer: 'bei Fragen', hint: 'Fragen' }, main: 'rufen Sie mich bitte an' },
    { conj: 'wenn', prep: 'bei', case: 'dat', clause: 'es', person: '3sg', verb: 'schneien', tense: 'praes',
      np: { answer: 'bei Schnee', hint: 'Schnee' }, main: 'fahren die Busse nicht' },
    { conj: 'wenn', prep: 'bei', case: 'dat', clause: 'die Sonne', person: '3sg', verb: 'scheinen', tense: 'praes',
      np: { answer: 'bei Sonnenschein', hint: 'Sonnenschein' }, main: 'frühstücken wir auf dem Balkon' },
    { conj: 'indem', prep: 'durch', case: 'acc', clause: 'man regelmäßig', person: '3sg', verb: 'üben', tense: 'praes',
      np: { answer: 'durch regelmäßiges Üben', hint: 'Üben' }, main: 'lernt man eine Sprache am schnellsten',
      note: 'Adverb ↔ adjective: regelmäßig ↔ regelmäßiges.' },
    { conj: 'obwohl', prep: 'trotz', case: 'gen', clause: 'es stark', person: '3sg', verb: 'regnen', tense: 'praet',
      np: { answer: 'trotz des starken Regens', hint: 'Regen' }, main: 'fand das Konzert statt',
      note: 'Adverb ↔ adjective: stark ↔ des starken Regens.' },
    { conj: 'bevor', prep: 'vor', case: 'dat', clause: 'der Film', person: '3sg', verb: 'beginnen', tense: 'praes',
      np: { answer: 'vor Beginn des Films', alts: ['vor dem Beginn des Films'], hint: 'Beginn' }, main: 'gibt es Werbung',
      note: 'Subject ↔ genitive: der Film ↔ des Films.' },
    { conj: 'weil', prep: 'wegen', case: 'gen', clause: 'die Preise', person: '3pl', verb: 'steigen', tense: 'praes',
      np: { answer: 'wegen der steigenden Preise', alts: ['wegen des Anstiegs der Preise', 'aufgrund der steigenden Preise'], hint: 'Preise' },
      main: 'kaufen viele Leute weniger', note: 'Verb ↔ Partizip I: die Preise steigen ↔ die steigenden Preise.' },
    { conj: 'weil', prep: 'wegen', case: 'gen', clause: 'der Zug Verspätung', person: '3sg', verb: 'haben', vp: 'Verspätung haben', tense: 'praet',
      np: { answer: 'wegen der Verspätung des Zuges', alts: ['wegen der Verspätung des Zugs', 'aufgrund der Verspätung des Zuges'], hint: 'Verspätung' },
      main: 'kamen wir zu spät', note: 'Subject ↔ genitive: der Zug ↔ des Zuges.' },
    { conj: 'weil', prep: 'aus', case: 'dat', clause: '{S} keine Zeit', verb: 'haben', vp: 'keine Zeit haben', tense: 'praet',
      np: { answer: 'aus Zeitmangel', alts: ['wegen Zeitmangels', 'wegen Zeitmangel'], hint: 'Zeitmangel' }, main: 'fiel das Treffen aus' },
    { conj: 'falls', prep: 'bei', case: 'dat', clause: 'es', person: '3sg', verb: 'brennen', tense: 'praes',
      np: { answer: 'bei einem Brand', alts: ['im Falle eines Brandes', 'im Brandfall', 'bei Feuer'], hint: 'Brand' },
      main: 'muss man das Gebäude sofort verlassen' },
    { conj: 'bevor', prep: 'vor', case: 'dat', clause: 'ich schlafen', person: '1sg', verb: 'gehen', vp: 'schlafen gehen', tense: 'praes',
      np: { answer: 'vor dem Schlafengehen', hint: 'Schlafengehen' }, main: 'lese ich immer ein bisschen',
      note: 'A whole verb phrase ↔ one noun: schlafen gehen ↔ das Schlafengehen.' },
  ].map((e) => ({ ...e, v: verbs.verb(e.verb), noun: e.np.noun || e.np.hint, key: `${e.conj} ${e.np.noun || e.np.hint}` }));
  for (const e of ENTRIES) if (!e.v) throw new Error(`Nominalisierung: the verb module cannot conjugate "${e.verb}"`);

  // Other prepositions and connectors that say the same (wegen = aufgrund; bei … can be wenn or falls).
  const PREP_ALTS = { wegen: ['aufgrund'] };
  const CONJ_ALTS = { weil: ['da'], wenn: ['falls'], falls: ['wenn'] };

  // The connectors and their prepositions, for the table: [connector, prepositions, case].
  const CONNECTORS = [
    ['weil', ['wegen', 'aufgrund'], 'gen'], ['obwohl', ['trotz'], 'gen'], ['als (once)', ['bei'], 'dat'], ['wenn', ['bei'], 'dat'],
    ['bevor', ['vor'], 'dat'], ['nachdem', ['nach'], 'dat'], ['während', ['während'], 'gen'], ['seit(dem)', ['seit'], 'dat'],
    ['bis', ['bis zu'], 'dat'], ['indem', ['durch'], 'acc'], ['ohne dass', ['ohne'], 'acc'], ['falls', ['bei', 'im Falle'], 'dat'],
  ];

  // The verb group at the end of the clause: "ankam", "umgezogen ist", "gegessen hatten".
  function verbGroup(v, tense, person) {
    if (tense === 'perf' || tense === 'plusq') return `${v.pii[0]} ${verbs.finite(verbs.verb(v.aux[0]), tense === 'perf' ? 'pres' : 'pret', person)[0]}`;
    return v.particle + verbs.finite(v, tense === 'praes' ? 'pres' : 'pret', person)[0];
  }

  // The noun phrase with its preposition for the subject: { answer, alts, article } (the possessive or article used).
  function phraseFor(entry, who) {
    if (entry.np.answer) return { answer: entry.np.answer, alts: entry.np.alts || [] };
    const { g, noun, gen, det } = entry.np;
    const form = entry.case === 'gen' ? gen || vocab.genitive(noun, g) : noun;
    const article = det === 'poss' ? possessive(PEOPLE[who][2], g, entry.case) : 'd' + DET_ENDINGS.der[g][CASES.indexOf(entry.case)];
    const forms = [entry.prep, ...(PREP_ALTS[entry.prep] || [])].map((prep) => `${prep} ${article} ${form}`);
    const short = CONTRACTIONS[entry.prep]?.[article]; // bei dem → beim
    return short ? { answer: `${short} ${form}`, alts: forms, article } : { answer: forms[0], alts: forms.slice(1), article };
  }

  // Verbs too common to say anything about the learner's deck.
  const COMMON = new Set(['sein', 'haben', 'gehen']);

  // The note of an entry's word the learner has learnt, if any: the verb's, or the noun's (any learnt card's word,
  // Ankunft included, which the deck's noun list leaves out).
  const noteOf = (e) => (!COMMON.has(e.verb) && vocab.noteFor(e.verb)) || vocab.noteFor(e.noun);

  const ARTICLE = { m: 'der', f: 'die', n: 'das' };

  function buildItem(direction, entry, rnd, { hints = true, source = 'builtin' } = {}) {
    const who = entry.clause.includes('{S}') ? pick(entry.subjects || ['ich', 'er', 'sie', 'wir'], rnd) : null;
    const group = verbGroup(entry.v, entry.tense, who ? PEOPLE[who][1] : entry.person);
    const lead = entry.clause.replace('{S}', who ? PEOPLE[who][0] : '');
    const phrase = phraseFor(entry, who);

    let tokens;
    let prompt;
    if (direction === 'nom') {
      const placeholder = hints ? entry.noun : undefined;
      tokens = [{ ...wordGap('np', phrase.answer, 'preposition and noun phrase'), alts: phrase.alts, placeholder }, ` ${entry.main}.`];
      prompt = `${entry.conj} ${lead} ${group}, ${entry.main}.`;
    } else {
      const conj = { ...wordGap('conj', entry.conj, 'connector'), alts: [...(entry.alts || []), ...(CONJ_ALTS[entry.conj] || [])] };
      // "ihrer Hochzeit": sie can be one person or several, so both verb forms count.
      const other = { sie: 'siePl', siePl: 'sie' }[who];
      const alts = other && entry.np.det === 'poss' ? [verbGroup(entry.v, entry.tense, PEOPLE[other][1])] : [];
      const verb = { ...wordGap('verb', group, 'verb'), alts, placeholder: entry.verb, keepCase: true };
      tokens = [conj, ` ${lead} `, verb, `, ${entry.main}.`];
      prompt = `${phrase.answer} ${entry.main}.`;
    }
    const note = source === 'anki' && noteOf(entry);
    return {
      direction, key: entry.key, tokens: capitalizeFirst(tokens), entry, notes: note ? [note] : [],
      prompt: { label: DIRECTION_LABELS[direction], text: cloze.capitalize(prompt) },
      tags: [
        { text: DIRECTION_LABELS[direction], cls: `n-${direction}` },
        { text: `${entry.conj} ↔ ${entry.prep}`, cls: 'plain' },
        ...(note ? [vocab.ANKI_TAG] : []),
      ],
      explain: explain(entry, direction, who, phrase, group),
    };
  }

  function explain(entry, direction, who, phrase, group) {
    const head = `${entry.conj} ↔ ${entry.prep} + ${CASE_LABELS[entry.case]}.`;
    const note = entry.note ? ` ${entry.note}` : '';
    const poss = entry.np.det === 'poss';
    if (direction === 'nom') {
      const noun = entry.np.noun ? ` ${entry.vp || entry.verb} → ${ARTICLE[entry.np.g]} ${entry.np.noun}.` : '';
      const subject = poss ? ` The subject becomes a possessive: ${PEOPLE[who][0]} → ${phrase.article}.` : '';
      return `${head}${noun}${subject}${note} The phrase takes position 1, so the verb follows: ${cloze.capitalize(phrase.answer)} ${entry.main.split(' ')[0]} …`;
    }
    const subject = poss ? ` The possessive becomes the subject: ${phrase.article} → ${PEOPLE[who][0]}.` : '';
    return `${head} A clause with the verb at the end (${group}).${subject}${note}`;
  }

  // The round: the directions in turn; with the Anki option, entries with a learnt word come up more often — those
  // whose card is due soon and hard most of all.
  function buildRound(settings, rnd = Math.random) {
    const source = settings.vocab || 'builtin';
    const mine = source === 'anki' ? ENTRIES.filter(noteOf) : [];
    const recent = [];
    const items = [];
    let queue = [];
    while (items.length < settings.length) {
      if (!queue.length) queue = shuffle(settings.directions, rnd);
      const entry = vocab.pickPreferring(ENTRIES, mine, rnd, { recent, key: (e) => e.key, noteOf });
      const it = buildItem(queue.shift(), entry, rnd, { hints: settings.hints, source });
      remember(recent, it.key, 8);
      items.push(it);
    }
    return items;
  }

  // The connectors and their prepositions; then the round's verbs and the nouns made from them.
  function tables(items = []) {
    const blocks = [{
      title: 'Konnektor → Präposition', cls: 'n-nom', sub: 'weil → wegen + Genitiv',
      rows: CONNECTORS.map((c) => c[0]),
      cols: [{ head: 'Präposition' }, { head: 'Kasus', sub: 'Gen / Dat / Akk' }],
      answers: [CONNECTORS.map((c) => c[1]), CONNECTORS.map((c) => [CASE_LABELS[c[2]], declension.CASE_SHORT[c[2]]])],
    }];
    const seen = new Set();
    const rows = items.map((i) => i.entry).filter((e) => e.np.noun && !seen.has(e.np.noun) && seen.add(e.np.noun));
    if (rows.length) {
      blocks.push({
        title: 'Verb → Nomen', cls: 'n-verb', sub: 'ankommen → die Ankunft',
        rows: rows.map((e) => e.vp || e.verb),
        cols: [{ head: 'Nomen', sub: 'with der / die / das' }],
        answers: [rows.map((e) => [`${ARTICLE[e.np.g]} ${e.np.noun}`])],
      });
    }
    return { title: 'Nominalisierung', lead: 'Type the preposition and its case for each connector, and the noun with its article.', blocks };
  }

  function status(settings) {
    return vocab.deckStatus(settings, () => {
      const count = ENTRIES.filter(noteOf).length;
      return count ? `${count} of the sentences use a verb or noun you have learnt in Anki; they come up more often.` : '';
    }, 'sentences');
  }

  const drillStep = (items) => ({
    type: 'drill', label: 'Sentences', items,
    hint: 'Nominalisieren: type the preposition and noun phrase (wegen des Regens) · Verbalisieren: the connector and the verb at the end · Tab moves between gaps',
  });

  // n sentences in the settings' scope, for a round here (its table takes the same ones) and for the Daily review.
  const sentences = (settings, n, rnd = Math.random) => drillStep(buildRound({ ...settings, length: n }, rnd));

  function steps(settings, rnd) {
    const drill = sentences(settings, settings.length, rnd);
    return [{ type: 'table', label: 'Konnektor → Präposition', table: tables(drill.items) }, drill];
  }

  return {
    id: 'nominal',
    title: 'Nominalisierung',
    subtitle: 'Weil es regnet ↔ wegen des Regens; als er ankam ↔ bei seiner Ankunft — clause into noun phrase and back.',
    intro: vocab.intro('Rewrite a subordinate clause as a prepositional phrase (Nominalisieren) or the other way round (Verbalisieren): the preposition and its case, the noun made from the verb, and the subject as a possessive (er → seiner).', null, status),
    defaults: { directions: DIRECTIONS, vocab: 'anki', hints: true, length: 10 },
    prepare: vocab.prepare,
    options: [
      {
        key: 'directions', label: 'Direction', type: 'checkboxes', min: 1, choices: [
          { value: 'nom', label: 'Nominalisieren', detail: 'Weil es regnet, … → Wegen des Regens …' },
          { value: 'verb', label: 'Verbalisieren', detail: 'Bei seiner Ankunft … → Als er ankam, …' },
        ],
      },
      {
        key: 'vocab', label: 'Words', type: 'radio', daily: 'anki', choices: [
          { value: 'anki', label: 'My Anki words first', detail: 'sentences with a verb or noun you have learnt come up more often' },
          { value: 'builtin', label: 'Built-in' },
        ],
      },
      { key: 'hints', label: 'Hints', type: 'toggle', text: 'Show the noun in the gap when nominalising (Ankunft)' },
      {
        key: 'length', label: 'Round', type: 'radio', inline: true, round: true, choices: [
          { value: 10, label: '10 sentences' },
          { value: 20, label: '20 sentences' },
        ],
      },
    ],
    sentences,
    sessions: [
      { label: 'Start', build: (settings, rnd = Math.random) => steps(settings, rnd) },
      { label: 'Table only', build: () => [{ type: 'table', label: 'Konnektor → Präposition', table: tables() }] },
    ],

    DIRECTIONS, ENTRIES, CONNECTORS, buildItem, buildRound, phraseFor, verbGroup, tables,
  };
});
