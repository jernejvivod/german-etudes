// Topic: Pronomen — personal pronouns in the accusative and dative (mich / mir, ihn / ihm), reflexive pronouns
// (ich wasche mich / ich wasche mir die Hände), relative pronouns (der Mann, dem ich helfe; deren, denen) and possessives:
// the owner picks the word (Anna sucht ihren Schlüssel, Tom seinen) and standing alone (Das ist meiner); and the relative
// words was, wo(r)- and wer (alles, was ich weiß; das Einzige, worauf ich warte; die Stadt, wo ich wohne; Wer …, der …).
// Session: the pronoun tables of the chosen kinds, then sentences. Nouns come from the Anki deck where enough fit.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/cloze.js'), require('../core/declension.js'), require('../core/lexicon.js'),
      require('../core/vocab.js'), require('../core/verbs.js'));
  } else {
    root.Etudes.topics.push(factory(root.Etudes.cloze, root.Etudes.declension, root.Etudes.lexicon, root.Etudes.vocab, root.Etudes.verbs));
  }
})(globalThis, function (cloze, declension, lexicon, vocab, verbs) {
  'use strict';

  const { wordGap, fillTemplate, pick, pickFresh, remember, shuffle, capitalize } = cloze;
  const { CASES, CASE_LABELS, CASE_SHORT, GENDER_LABELS, CASE_ROWS, GENDER_COLS, THIRD_PERSON, DET_ENDINGS, possessive, woWord, startsWithVowel } = declension;
  const { NOUNS } = lexicon;

  const KINDS = ['personal', 'reflexive', 'relative', 'possessive', 'wrelative'];
  const KIND_LABELS = {
    personal: 'Personalpronomen', reflexive: 'Reflexivpronomen', relative: 'Relativpronomen', possessive: 'Possessivpronomen',
    wrelative: 'was, wo(r)-, wer',
  };

  // ---------- Personal pronouns ----------

  // Persons: nominative, accusative, dative, the verb person (verbs.PERSONS), how the prompt names it, and the possessive
  // (the owner picks the word: Anna → ihr, Tom → sein).
  const PERSONS = {
    ich: { nom: 'ich', acc: 'mich', dat: 'mir', verb: '1sg', label: 'ich', poss: 'mein' },
    du: { nom: 'du', acc: 'dich', dat: 'dir', verb: '2sg', label: 'du', poss: 'dein' },
    er: { nom: 'er', acc: 'ihn', dat: 'ihm', verb: '3sg', label: 'er', poss: 'sein' },
    sie: { nom: 'sie', acc: 'sie', dat: 'ihr', verb: '3sg', label: 'sie (Sg.)', poss: 'ihr' },
    es: { nom: 'es', acc: 'es', dat: 'ihm', verb: '3sg', label: 'es', poss: 'sein' },
    wir: { nom: 'wir', acc: 'uns', dat: 'uns', verb: '1pl', label: 'wir', poss: 'unser' },
    ihr: { nom: 'ihr', acc: 'euch', dat: 'euch', verb: '2pl', label: 'ihr', poss: 'euer' },
    siePl: { nom: 'sie', acc: 'sie', dat: 'ihnen', verb: '3pl', label: 'sie (Pl.)', poss: 'ihr' },
    Sie: { nom: 'Sie', acc: 'Sie', dat: 'Ihnen', verb: '3pl', label: 'Sie', poss: 'Ihr' },
  };
  const ALL_PERSONS = Object.keys(PERSONS);
  const OBJECT_PERSONS = ALL_PERSONS.filter((k) => k !== 'es');


  // A person given in the nominative, to be put in the frame's case. subj: the sentence's subject (never the object too:
  // that would be reflexive); why: what sets the case.
  const GIVEN = [
    { t: 'Kannst du {0} morgen abholen?', case: 'acc', subj: 'du', why: '"abholen" takes an accusative object' },
    { t: 'Er besucht {0} am Wochenende.', case: 'acc', subj: 'er', why: '"besuchen" takes an accusative object' },
    { t: 'Ich rufe {0} heute Abend an.', case: 'acc', subj: 'ich', why: '"anrufen" takes an accusative object' },
    { t: 'Wir sehen {0} morgen im Büro.', case: 'acc', subj: 'wir', why: '"sehen" takes an accusative object' },
    { t: 'Habt ihr {0} gestern gesehen?', case: 'acc', subj: 'ihr', why: '"sehen" takes an accusative object' },
    { t: 'Das Geschenk ist für {0}.', case: 'acc', subj: null, why: '"für" takes the Akkusativ' },
    { t: 'Ohne {0} fahre ich nicht in den Urlaub.', case: 'acc', subj: 'ich', why: '"ohne" takes the Akkusativ' },
    { t: 'Kannst du {0} bitte helfen?', case: 'dat', subj: 'du', why: '"helfen" takes the Dativ' },
    { t: 'Das Auto gehört {0}.', case: 'dat', subj: null, why: '"gehören" takes the Dativ' },
    { t: 'Ich schreibe {0} eine E-Mail.', case: 'dat', subj: 'ich', why: 'the person you write to is the dative object' },
    { t: 'Er dankt {0} für die Hilfe.', case: 'dat', subj: 'er', why: '"danken" takes the Dativ' },
    { t: 'Wir gratulieren {0} zum Geburtstag.', case: 'dat', subj: 'wir', why: '"gratulieren" takes the Dativ' },
    { t: 'Der Film hat {0} gut gefallen.', case: 'dat', subj: null, why: '"gefallen" takes the Dativ' },
    { t: 'Ich komme morgen mit {0}.', case: 'dat', subj: 'ich', why: '"mit" takes the Dativ' },
  ];

  // A noun phrase to replace with a pronoun: frames by case, with the noun categories that fit.
  const REPLACE = {
    nom: [
      { t: '{0} {ist|sind} kaputt.', cats: ['thing'], count: true },
      { t: '{0} {wohnt|wohnen} nebenan.', cats: ['person'] },
      { t: '{0} {schmeckt|schmecken} sehr gut.', cats: ['food'] },
      { t: '{0} {schläft|schlafen} im Garten.', cats: ['animal'] },
      { t: '{0} {gefällt|gefallen} mir.', cats: ['thing', 'animal'] },
    ],
    acc: [
      { t: 'Ich sehe {0} jeden Tag.', cats: ['person', 'animal', 'thing'] },
      { t: 'Kennst du {0}?', cats: ['person', 'animal'] },
      { t: 'Wir kaufen {0} morgen.', cats: ['thing', 'food'] },
      { t: 'Ich besuche {0} am Sonntag.', cats: ['person'] },
      { t: 'Er sucht {0} schon lange.', cats: ['thing', 'animal'] },
    ],
    dat: [
      { t: 'Ich helfe {0} gern.', cats: ['person'] },
      { t: 'Das Buch gehört {0}.', cats: ['person'] },
      { t: 'Wir danken {0} für alles.', cats: ['person'] },
      { t: 'Ich glaube {0} kein Wort.', cats: ['person'] },
      { t: 'Der Film gefällt {0} nicht.', cats: ['person'] },
    ],
  };

  // Two objects, both replaced: the accusative pronoun comes first ("Ich gebe ihn ihr").
  const DOUBLE = [
    'Ich gebe {0} {1}.',
    'Sie zeigt {0} {1}.',
    'Wir schenken {0} {1}.',
    'Er bringt {0} {1}.',
    'Ich leihe {0} {1}.',
  ];

  // ---------- Reflexive pronouns ----------

  // Reflexive pronouns by subject key (from verbs.REFLEXIVE_PRONOUNS): ich → mich / mir, er → sich …
  const REFLEXIVE = Object.fromEntries(Object.entries(PERSONS).filter(([k]) => k !== 'es').map(([k, p]) => {
    const i = verbs.PERSONS.indexOf(p.verb);
    return [k, { acc: verbs.REFLEXIVE_PRONOUNS.acc[i], dat: verbs.REFLEXIVE_PRONOUNS.dat[i] }];
  }));
  // ich and du are where accusative and dative differ (mich / mir, dich / dir), so they come up most.
  const REFLEXIVE_SUBJECTS = ['ich', 'ich', 'ich', 'du', 'du', 'du', 'er', 'sie', 'wir', 'ihr', 'siePl', 'Sie'];

  // case acc: the reflexive is the only object; dat: there is another (accusative) object, so the reflexive is dative.
  const REFLEXIVE_VERBS = [
    { inf: 'freuen', rest: 'auf das Wochenende', case: 'acc' },
    { inf: 'beeilen', rest: 'heute', case: 'acc' },
    { inf: 'setzen', rest: 'neben das Fenster', case: 'acc' },
    { inf: 'erinnern', rest: 'gut an den Urlaub', case: 'acc' },
    { inf: 'ärgern', rest: 'über den Stau', case: 'acc' },
    { inf: 'ausruhen', rest: 'am Wochenende', case: 'acc' },
    { inf: 'anziehen', rest: 'schnell', case: 'acc' },
    { inf: 'duschen', rest: 'jeden Morgen', case: 'acc' },
    { inf: 'interessieren', rest: 'für Musik', case: 'acc' },
    { inf: 'entschuldigen', rest: 'für den Fehler', case: 'acc' },
    { inf: 'gewöhnen', rest: 'langsam an die Stadt', case: 'acc' },
    { inf: 'vorstellen', rest: 'kurz', case: 'acc', note: 'sich vorstellen = to introduce oneself' },
    { inf: 'waschen', rest: 'schnell', case: 'acc' },
    { inf: 'waschen', rest: 'die Hände', case: 'dat' },
    { inf: 'putzen', rest: 'die Zähne', case: 'dat' },
    { inf: 'kaufen', rest: 'ein neues Fahrrad', case: 'dat' },
    { inf: 'wünschen', rest: 'einen Hund', case: 'dat' },
    { inf: 'merken', rest: 'die Telefonnummer', case: 'dat' },
    { inf: 'ansehen', rest: 'den Film', case: 'dat' },
    { inf: 'vorstellen', rest: 'das Leben in Berlin', case: 'dat', note: 'sich etwas vorstellen = to imagine something' },
    { inf: 'anziehen', rest: 'den Mantel', case: 'dat' },
    { inf: 'machen', rest: 'Sorgen', case: 'dat' },
    { inf: 'nehmen', rest: 'ein Stück Kuchen', case: 'dat' },
  ].map((e) => ({ ...e, verb: verbs.verb(e.inf) }));

  // ---------- Relative pronouns ----------

  // der / die / das / die, except dative plural denen and the genitive dessen / deren.
  const RELATIVE = {
    m: ['der', 'den', 'dem', 'dessen'],
    f: ['die', 'die', 'der', 'deren'],
    n: ['das', 'das', 'dem', 'dessen'],
    pl: ['die', 'die', 'denen', 'deren'],
  };

  // Main clauses: the noun's own case there (it has nothing to do with the relative pronoun's case).
  const MAIN = [
    { t: 'Das {ist|sind} {0}, {1}.', case: 'nom' },
    { t: 'Kennst du {0}, {1}?', case: 'acc' },
    { t: 'Wo {ist|sind} {0}, {1}?', case: 'nom' },
    { t: 'Ich denke oft an {0}, {1}.', case: 'acc' },
    { t: 'Wir sprechen über {0}, {1}.', case: 'acc' },
  ];

  // Relative clauses: {R} = the pronoun, the case it takes and why; {sg|pl} = the verb's number.
  const CLAUSES = [
    { t: '{R} nebenan {wohnt|wohnen}', case: 'nom', cats: ['person'], why: 'it is the subject of the clause' },
    { t: '{R} mir gestern geholfen {hat|haben}', case: 'nom', cats: ['person'], why: 'it is the subject of the clause' },
    { t: '{R} im Garten {schläft|schlafen}', case: 'nom', cats: ['animal'], why: 'it is the subject of the clause' },
    { t: '{R} auf dem Tisch {liegt|liegen}', case: 'nom', cats: ['thing'], small: true, why: 'it is the subject of the clause' },
    { t: '{R} so gut {schmeckt|schmecken}', case: 'nom', cats: ['food'], why: 'it is the subject of the clause' },
    { t: '{R} ich gestern getroffen habe', case: 'acc', cats: ['person'], why: '"treffen" takes an accusative object' },
    { t: '{R} wir eingeladen haben', case: 'acc', cats: ['person'], why: '"einladen" takes an accusative object' },
    { t: '{R} ich gekauft habe', case: 'acc', cats: ['thing', 'food'], why: '"kaufen" takes an accusative object' },
    { t: '{R} du suchst', case: 'acc', cats: ['thing', 'animal'], why: '"suchen" takes an accusative object' },
    { t: '{R} ich geholfen habe', case: 'dat', cats: ['person'], why: '"helfen" takes the Dativ' },
    { t: '{R} das Auto gehört', case: 'dat', cats: ['person'], why: '"gehören" takes the Dativ' },
    { t: '{R} ich vertraue', case: 'dat', cats: ['person'], why: '"vertrauen" takes the Dativ' },
    { t: 'mit {R} ich oft telefoniere', case: 'dat', cats: ['person'], why: '"mit" takes the Dativ' },
    { t: 'von {R} ich das Geschenk habe', case: 'dat', cats: ['person'], why: '"von" takes the Dativ' },
    { t: 'von {R} du erzählt hast', case: 'dat', cats: ['thing', 'animal', 'person'], why: '"von" takes the Dativ' },
    { t: 'auf {R} ich warte', case: 'acc', cats: ['person', 'thing'], why: '"warten auf" takes the Akkusativ' },
    { t: 'für {R} ich viel Geld bezahlt habe', case: 'acc', cats: ['thing', 'animal'], why: '"für" takes the Akkusativ' },
    { t: '{R} Auto vor dem Haus steht', case: 'gen', cats: ['person'], why: 'whose → Genitiv' },
    { t: '{R} Namen ich vergessen habe', case: 'gen', cats: ['person', 'animal'], why: 'whose → Genitiv' },
    { t: '{R} Farbe mir gefällt', case: 'gen', cats: ['thing', 'animal'], why: 'whose → Genitiv' },
  ];

  // ---------- was, wo(r)-, wer ----------

  // was after alles, nichts, etwas, vieles, das, a superlative or das Einzige, and for the whole clause before it.
  const WAS = [
    { t: 'Das ist alles, {R} ich weiß.', ante: 'alles' },
    { t: 'Es gibt nichts, {R} mich mehr freut.', ante: 'nichts' },
    { t: 'Ich habe etwas gehört, {R} dich interessieren wird.', ante: 'etwas' },
    { t: 'Er erzählt vieles, {R} nicht stimmt.', ante: 'vieles' },
    { t: 'Das ist das Beste, {R} ich je gegessen habe.', ante: 'das Beste' },
    { t: 'Das war das Schönste, {R} wir im Urlaub gesehen haben.', ante: 'das Schönste' },
    { t: 'Das ist das Einzige, {R} ich nicht verstehe.', ante: 'das Einzige' },
    { t: 'Das, {R} du sagst, stimmt nicht.', ante: 'das' },
    { t: 'Sie hat die Prüfung bestanden, {R} mich sehr freut.', ante: null },
    { t: 'Er kommt immer zu spät, {R} mich ärgert.', ante: null },
    { t: 'Es hat die ganze Woche geregnet, {R} niemand erwartet hatte.', ante: null },
  ];

  // Verbs with a fixed preposition in a relative clause ({R} = the relative word): after alles / etwas / das Einzige or a
  // clause it is wo(r)- + preposition (worauf); after a noun, the preposition + der / die / das (auf den). cats: the nouns
  // that fit; clause: a sentence it can refer to as a whole.
  const PREP_CLAUSES = [
    { prep: 'auf', case: 'acc', verb: 'warten auf', t: 'ich schon lange warte', cats: ['thing', 'person'] },
    { prep: 'auf', case: 'acc', verb: 'sich freuen auf', t: 'ich mich am meisten freue', cats: ['thing', 'person'] },
    { prep: 'über', case: 'acc', verb: 'sich freuen über', t: 'ich mich sehr gefreut habe', cats: ['thing'], clause: 'Er hat endlich angerufen' },
    { prep: 'für', case: 'acc', verb: 'sich interessieren für', t: 'er sich interessiert', cats: ['thing', 'animal'] },
    { prep: 'an', case: 'acc', verb: 'denken an', t: 'ich oft denke', cats: ['person', 'thing'] },
    { prep: 'von', case: 'dat', verb: 'träumen von', t: 'sie schon lange träumt', cats: ['thing'] },
    { prep: 'über', case: 'acc', verb: 'sprechen über', t: 'wir gestern gesprochen haben', cats: ['person', 'thing', 'animal'] },
    { prep: 'mit', case: 'dat', verb: 'rechnen mit', t: 'niemand gerechnet hat', cats: [], clause: 'Im Mai hat es geschneit' },
    { prep: 'vor', case: 'dat', verb: 'Angst haben vor', t: 'er Angst hat', cats: ['animal', 'person'] },
    { prep: 'um', case: 'acc', verb: 'sich kümmern um', t: 'du dich kümmern musst', cats: ['person', 'animal'] },
    { prep: 'über', case: 'acc', verb: 'sich ärgern über', t: 'sie sich geärgert hat', cats: ['thing'], clause: 'Der Zug hatte zwei Stunden Verspätung' },
  ];
  // What wo(r)- refers to: [the start of the sentence, the word it stands for].
  const WO_HEADS = [['Das ist alles', 'alles'], ['Es gibt vieles', 'vieles'], ['Das ist etwas', 'etwas'], ['Das ist das Einzige', 'das Einzige']];

  // wo for a place: it can stand for in + der / dem (die Stadt, wo / in der ich wohne); after a city's name, only wo.
  const PLACES = [['f', 'Stadt'], ['n', 'Dorf'], ['n', 'Café'], ['n', 'Restaurant'], ['n', 'Hotel']]
    .map(([g, lemma]) => ({ g, lemma, sg: [lemma, lemma, lemma, lemma], kinds: ['place'] }));
  const PLACE_CLAUSES = ['meine Schwester arbeitet', 'wir uns zum ersten Mal getroffen haben', 'wir letzten Sommer waren'];
  const CITIES = ['Wien', 'Berlin', 'Hamburg', 'Zürich'];
  // Places one is "an" or "auf" rather than "in" (am Bahnhof, im Park is fine but "an der Imbissbude"): no "in dem" there.
  const NOT_IN = /(bahnhof|hafen|park|zoo|stadion|bad|bude|platz|station|haltestelle)$/i;

  // wer / wen / wem …, der / den / dem …: each clause's verb sets its own case; der can go when both are nominative.
  const WER = [
    { t: '{W} viel arbeitet, {D} braucht auch Urlaub.', a: 'nom', b: 'nom' },
    { t: '{W} zu spät kommt, {D} muss draußen warten.', a: 'nom', b: 'nom' },
    { t: '{W} Hunger hat, {D} soll etwas essen.', a: 'nom', b: 'nom' },
    { t: '{W} das Essen nicht schmeckt, {D} kann etwas anderes bestellen.', a: 'dat', b: 'nom', why: '"schmecken" takes the Dativ' },
    { t: '{W} das nicht interessiert, {D} kann gehen.', a: 'acc', b: 'nom', why: '"interessieren" takes an accusative object' },
    { t: '{W} der Lärm stört, {D} sollte das Fenster schließen.', a: 'acc', b: 'nom', why: '"stören" takes an accusative object' },
    { t: '{W} mir hilft, {D} helfe ich auch.', a: 'nom', b: 'dat', why: '"helfen" takes the Dativ' },
    { t: '{W} lügt, {D} glaube ich nicht.', a: 'nom', b: 'dat', why: '"glauben" (someone) takes the Dativ' },
    { t: '{W} ich vertraue, {D} erzähle ich alles.', a: 'dat', b: 'dat', why: '"vertrauen" and "erzählen" (someone) take the Dativ' },
    { t: '{W} du mitbringst, {D} lernen wir gern kennen.', a: 'acc', b: 'acc', why: '"mitbringen" and "kennenlernen" take an accusative object' },
  ];
  const WER_FORMS = { nom: 'wer', acc: 'wen', dat: 'wem' };

  // An item of this kind; tag: what the sentence drills; noun: the noun it is about, if any (for its note).
  const wItem = (sub, tag, key, tokens, explain, noun = null) => ({
    kind: 'wrelative', sub, key, tokens, tags: [{ text: KIND_LABELS.wrelative, cls: 'k-wrelative' }, { text: tag, cls: 'plain' }], explain,
    notes: vocab.notesOf(noun),
  });

  function wasItem(rnd, recent) {
    const entry = pickFresh(WAS, recent, (e) => e.t, rnd);
    const why = entry.ante ? `After "${entry.ante}" the relative pronoun is was, not das.` : 'The clause refers to the whole sentence before it, so it starts with was.';
    return wItem('was', 'was', entry.t, fillTemplate(entry.t.replace('{R}', '{0}'), [[wordGap('rel', 'was', 'relative pronoun')]], false), why);
  }

  // The gap for a fixed preposition's relative word, with the preposition as the hint.
  const prepGap = (clause, answer, label) => ({ ...wordGap('rel', answer, label), placeholder: `${clause.prep} …` });

  // "Das ist alles, worauf ich warte." / "Er hat endlich angerufen, worüber ich mich gefreut habe."
  function woItem(rnd, recent) {
    const clause = pickFresh(PREP_CLAUSES, recent, (c) => c.t, rnd);
    const whole = clause.clause && rnd() < 0.5;
    const [head, ante] = whole ? [clause.clause, 'the whole clause before it'] : pick(WO_HEADS, rnd).map((x, i) => (i ? `"${x}"` : x));
    const answer = woWord(clause.prep);
    const r = startsWithVowel(clause.prep) ? ' (with r before a vowel)' : '';
    return wItem('wo', 'wo(r)-', clause.t, [`${head}, `, prepGap(clause, answer, 'relative word'), ` ${clause.t}.`],
      `"${clause.verb}": the relative word for ${ante} is wo + ${clause.prep} → ${answer}${r}.`);
  }

  // "Das ist der Bus, auf den ich warte." — after a noun, the preposition + der / die / das; for people never wo(r)-.
  function prepNounItem(source, rnd, recent) {
    const clause = pickFresh(PREP_CLAUSES.filter((c) => nounsFor(c.cats, { source }).length), recent, (c) => c.t, rnd);
    const noun = vocab.pickDue(nounsFor(clause.cats, { source }), rnd, { recent });
    const plural = choosePlural(noun, rnd);
    const gender = plural ? 'pl' : noun.g;
    const answer = `${clause.prep} ${RELATIVE[gender][CASES.indexOf(clause.case)]}`;
    const tokens = fillTemplate(`Das {ist|sind} ${phrase(noun, 'nom', plural)}, {0}.`, [[prepGap(clause, answer, 'preposition and relative pronoun'), ` ${clause.t}`]], plural);
    const note = noun.cat === 'person' ? ' wo(r)- never stands for a person.' : ` A wo-word (${woWord(clause.prep)}) is for alles, etwas or a whole clause.`;
    return wItem('wo-noun', 'Präposition + der', clause.t, tokens,
      `After a noun: the preposition + der / die / das (${GENDER_LABELS[gender]}, ${CASE_LABELS[clause.case]} for "${clause.verb}") → ${answer}.${note}`, noun);
  }

  // "Das ist das Café, wo / in dem wir uns getroffen haben." — after a city's name only wo.
  function whereItem(source, rnd, recent) {
    const clause = pick(PLACE_CLAUSES, rnd);
    if (rnd() < 0.25) {
      const city = pick(CITIES, rnd);
      return wItem('where', 'wo', city, [`In ${city}, `, wordGap('rel', 'wo', 'relative word'), ` ${clause}, gibt es viele Museen.`],
        'After the name of a city or country, the relative word is wo (no article to go with it).');
    }
    const noun = vocab.pickDue(vocab.pool(PLACES, (n) => n.kinds?.includes('place') && n.sg && !NOT_IN.test(n.lemma), source), rnd, { recent });
    const inDer = `in ${RELATIVE[noun.g][CASES.indexOf('dat')]}`;
    return wItem('where', 'wo', noun.lemma,
      [`Das ist ${phrase({ ...noun, family: false, mine: false }, 'nom')}, `, { ...wordGap('rel', 'wo', 'relative word'), alts: [inDer] }, ` ${clause}.`],
      `A place: wo, or in + the relative pronoun in the Dativ (${inDer}) — both are right.`, noun);
  }

  // "Wer viel arbeitet, (der) braucht auch Urlaub." / "Wem das Essen nicht schmeckt, der kann …"
  function werItem(rnd, recent) {
    const entry = pickFresh(WER, recent, (e) => e.t, rnd);
    const w = WER_FORMS[entry.a];
    const d = RELATIVE.m[CASES.indexOf(entry.b)];
    const optional = entry.a === 'nom' && entry.b === 'nom';
    const tokens = cloze.fillSlots(entry.t, {
      W: [{ ...wordGap('rel', w, 'wer, wen or wem'), placeholder: 'wer' }],
      D: [{ ...wordGap('rel', d, 'der, den or dem'), placeholder: 'der', ...(optional && { alts: [''] }) }],
    });
    const cases = entry.why ? ` (${entry.why})` : '';
    return wItem('wer', 'wer', entry.t, tokens,
      `wer = whoever. Each clause's verb sets its own case${cases}: ${w} (${CASE_LABELS[entry.a]}) …, ${d} (${CASE_LABELS[entry.b]}) …${optional ? ' Both are nominative, so der can be left out.' : ''}`);
  }

  // ---------- Possessives ----------

  const OWNER_OF_GENDER = { m: 'er', f: 'sie', n: 'es', pl: 'siePl' };
  const NAMES = [['Anna', 'f'], ['Lisa', 'f'], ['Sophie', 'f'], ['Tom', 'm'], ['Paul', 'm'], ['Jonas', 'm']];

  // Standing alone it takes the endings of dieser: meiner, meine, meins / meines (the s-form is the usual one in speech).
  function alonePronoun(stem, gender, caseKey) {
    const form = possessive(stem, gender, caseKey, DET_ENDINGS.dies);
    if (gender !== 'n' || caseKey === 'dat') return [form];
    // unser / euer: the full form first; unsres / unsers are common in speech too.
    if (stem === 'unser') return [form, 'unsers', 'unsres'];
    if (stem === 'euer') return [form, 'euers'];
    return [stem + 's', form];
  }

  // The verbs an owner does something with their own things or people to. prep: before the noun phrase.
  const OWNER_FRAMES = [
    { v: 'suchen', case: 'acc', what: 'thing' }, { v: 'verlieren', case: 'acc', what: 'thing' },
    { v: 'vergessen', case: 'acc', what: 'thing' }, { v: 'besuchen', case: 'acc', what: 'family' },
    { v: 'anrufen', case: 'acc', what: 'family' }, { v: 'helfen', case: 'dat', what: 'family' },
    { v: 'telefonieren', case: 'dat', what: 'family', prep: 'mit' }, { v: 'wohnen', case: 'dat', what: 'family', prep: 'bei' },
  ].map((f) => ({ ...f, verb: verbs.verb(f.v) }));

  // What is owned: small things, or family members and friends.
  function owned(what, source) {
    const fits = what === 'thing'
      ? (n) => n.cat === 'thing' && n.sg && !n.mass && !n.big && n.own
      : (n) => n.cat === 'person' && n.sg && (n.family || n.mine);
    return vocab.pool(NOUNS, fits, source);
  }

  // The owner: a name or a person from the deck (statements), or a pronoun — as a question for du, ihr, er / sie and
  // Sie, where the capital in the middle of the sentence tells Sie from sie.
  function owner(source, rnd) {
    const r = rnd();
    if (r < 0.4) {
      const [name, g] = pick(NAMES, rnd);
      return { text: name, key: OWNER_OF_GENDER[g], person: '3sg', who: name };
    }
    // Grown-ups only: "Das Baby vergisst seine Jacke" is no sentence anyone says.
    const people = nounsFor(['person'], { source }).filter((n) => !n.child);
    if (r < 0.6 && people.length) {
      const noun = vocab.pickDue(people, rnd);
      const plural = !!noun.pl && rnd() < 0.3;
      // The owner with der / die / das, so that only one possessive is in the sentence.
      const text = vocab.withArticle({ ...noun, family: false, mine: false }, 'nom', plural);
      return { text, key: OWNER_OF_GENDER[plural ? 'pl' : noun.g], person: plural ? '3pl' : '3sg', who: text, noun };
    }
    const key = pick([...OBJECT_PERSONS, 'Sie'], rnd);
    return { text: PERSONS[key].nom, key, person: PERSONS[key].verb, who: PERSONS[key].label, question: !['ich', 'wir'].includes(key) };
  }

  function ownerItem(caseKey, source, rnd, recent) {
    const frame = pick(OWNER_FRAMES.filter((f) => f.case === caseKey), rnd);
    const who = owner(source, rnd);
    const noun = vocab.pickDue(owned(frame.what, source).filter((n) => n.lemma !== who.noun?.lemma), rnd, { recent });
    const plural = !!noun.pl && !noun.onlyOne && rnd() < 0.3;
    const gender = plural ? 'pl' : noun.g;
    const stem = PERSONS[who.key].poss;
    const answer = possessive(stem, gender, caseKey);
    const finite = verbs.finite(frame.verb, 'pres', who.person)[0];
    const np = [...(frame.prep ? [frame.prep, ' '] : []), { ...wordGap('poss', answer, 'possessive'), exact: true }, ' ', (plural ? noun.pl : noun.sg)[CASES.indexOf(caseKey)]];
    const end = frame.verb.particle ? [' ', frame.verb.particle] : [];
    const tokens = who.question
      ? [capitalize(finite), ' ', who.text, ' ', ...np, ...end, '?']
      : [capitalize(who.text), ' ', finite, ' ', ...np, ...end, '.'];
    const ownerNote = {
      es: ` ("${who.text}" is neuter, so sein)`,
      Sie: ' (the polite Sie: Ihr, with a capital)',
      siePl: who.text !== 'sie' ? ' (plural, so ihr)' : '',
    }[who.key] || '';
    return {
      kind: 'possessive', sub: `owner-${caseKey}`, case: caseKey, gender, key: noun.lemma, tokens, notes: vocab.notesOf(noun, who.noun),
      tags: tags('possessive', caseKey, gender),
      explain: `The owner decides the word: ${who.who} → ${stem}${ownerNote}. The noun decides the ending: ${GENDER_LABELS[gender]}, ${CASE_LABELS[caseKey]} → ${answer}.`,
    };
  }

  // Standing alone: the noun is left out and the possessive takes over its ending (Ist das dein Hut? – Ja, das ist meiner).
  function aloneItem(caseKey, source, rnd, recent) {
    // The dative: travelling with someone's car or someone's relatives ("mit meinem", "mit meiner", "mit meinen").
    const vehicle = caseKey === 'dat' && rnd() < 0.4;
    const pool = vehicle
      ? vocab.pool(NOUNS, (n) => n.sg && n.kinds?.includes('vehicle') && n.own, source)
      : owned(caseKey === 'dat' ? 'family' : 'thing', source);
    const noun = vocab.pickDue(pool, rnd, { recent });
    const plural = !vehicle && !!noun.pl && !noun.onlyOne && rnd() < 0.25;
    const gender = plural ? 'pl' : noun.g;
    const form = (plural ? noun.pl : noun.sg)[CASES.indexOf(caseKey)];
    let t;
    let answerStem;
    if (caseKey === 'nom') {
      // Asking du, ihr or Sie; the answer is mine or ours.
      const [askKey, answerKey] = pick([['du', 'ich'], ['ihr', 'wir'], ['Sie', 'ich']], rnd);
      t = `{Ist|Sind} das ${possessive(PERSONS[askKey].poss, gender, 'nom')} ${form}? – Ja, das {ist|sind} {0}.`;
      answerStem = PERSONS[answerKey].poss;
    } else if (caseKey === 'acc') {
      t = `Ich habe ${possessive('mein', gender, 'acc')} ${form} vergessen. Kannst du mir {0} leihen?`;
      answerStem = 'dein';
    } else {
      t = vehicle ? `Fahren wir mit ${possessive('dein', gender, 'dat')} ${form}? – Nein, mit {0}.`
        : `Fährst du mit ${possessive('dein', gender, 'dat')} ${form} in den Urlaub? – Nein, mit {0}.`;
      answerStem = 'mein';
    }
    const forms = alonePronoun(answerStem, gender, caseKey);
    const tokens = fillTemplate(t, [[{ ...wordGap('poss', forms[0], 'possessive pronoun'), alts: forms.slice(1) }]], plural);
    const like = possessive('dies', gender, caseKey, DET_ENDINGS.dies);
    return {
      kind: 'possessive', sub: `alone-${caseKey}`, case: caseKey, gender, key: noun.lemma, tokens, notes: vocab.notesOf(noun),
      tags: tags('possessive', caseKey, gender),
      explain: `Standing alone, the possessive takes the endings of dieser: ${forms.join(' / ')} (like ${like}).${/[^e]s$/.test(forms[0]) ? ` The s-form (${forms[0]}) is the usual one in speech.` : ''}`,
    };
  }

  // Kind, case and gender, as most items show them.
  const tags = (kind, caseKey, gender) => [
    { text: KIND_LABELS[kind], cls: `k-${kind}` },
    { text: CASE_LABELS[caseKey], cls: 'plain' },
    { text: GENDER_LABELS[gender], cls: `g-${gender}` },
  ];

  // ---------- Noun phrases ----------

  const phrase = vocab.withArticle;

  // Nouns of the categories with a singular (count: countable only; gift: something small enough to hand over or put on a
  // table — no lorry or bus).
  function nounsFor(cats, { count = false, gift = false, source = 'builtin', exclude = [] } = {}) {
    const fits = (n) => cats.includes(n.cat) && n.sg && !(count && n.mass) && !exclude.includes(n.lemma)
      && !(gift && n.big);
    return vocab.pool(NOUNS, fits, source);
  }

  // Plural now and then where the noun has one.
  const choosePlural = (noun, rnd) => !!noun.pl && !noun.mass && rnd() < 0.3;

  // ---------- Building items ----------

  const SUB_KINDS = {
    personal: ['given-acc', 'given-dat', 'noun-nom', 'noun-acc', 'noun-dat', 'double'],
    reflexive: ['acc', 'dat'],
    relative: ['nom', 'acc', 'dat', 'gen'],
    possessive: ['owner-acc', 'owner-dat', 'owner-acc', 'alone-nom', 'alone-acc', 'alone-dat'],
    wrelative: ['was', 'was', 'wo', 'wo', 'wo-noun', 'where', 'wer', 'wer'],
  };

  function buildItem(kind, sub, settings = {}, rnd = Math.random, recent = []) {
    const source = settings.vocab || 'builtin';
    const [type, caseKey] = sub.split('-');
    if (type === 'double') return doubleItem(source, rnd, recent);
    if (type === 'given') return givenItem(caseKey, rnd);
    if (type === 'noun') return replaceItem(caseKey, source, rnd, recent);
    if (type === 'owner') return ownerItem(caseKey, source, rnd, recent);
    if (type === 'alone') return aloneItem(caseKey, source, rnd, recent);
    if (kind === 'wrelative') {
      if (sub === 'was') return wasItem(rnd, recent);
      if (sub === 'where') return whereItem(source, rnd, recent);
      if (sub === 'wer') return werItem(rnd, recent);
      return sub === 'wo' ? woItem(rnd, recent) : prepNounItem(source, rnd, recent);
    }
    if (kind === 'reflexive') return reflexiveItem(sub, source, rnd);
    return relativeItem(sub, source, rnd, recent);
  }

  function givenItem(caseKey, rnd) {
    const frame = pick(GIVEN.filter((f) => f.case === caseKey), rnd);
    const key = pick(OBJECT_PERSONS.filter((p) => p !== frame.subj), rnd);
    const person = PERSONS[key];
    const answer = person[caseKey];
    const tokens = fillTemplate(frame.t, [[wordGap('pron', answer, `${person.label} in the ${CASE_LABELS[caseKey]}`)]], false);
    tokens.find((t) => typeof t === 'object').placeholder = person.label;
    return {
      kind: 'personal', sub: `given-${caseKey}`, case: caseKey, key: frame.t, tokens,
      tags: [{ text: KIND_LABELS.personal, cls: 'k-personal' }, { text: CASE_LABELS[caseKey], cls: 'plain' }],
      explain: `${capitalize(frame.why)}: ${person.nom} → ${answer}.`,
    };
  }

  function replaceItem(caseKey, source, rnd, recent) {
    const frames = REPLACE[caseKey].filter((f) => nounsFor(f.cats, { count: f.count, source }).length);
    const frame = pick(frames, rnd);
    const noun = vocab.pickDue(nounsFor(frame.cats, { count: frame.count, source }), rnd, { recent });
    const plural = choosePlural(noun, rnd);
    const gender = plural ? 'pl' : noun.g;
    const answer = THIRD_PERSON[gender][caseKey];
    const np = phrase(noun, caseKey, plural);
    const tokens = fillTemplate(frame.t, [[wordGap('pron', answer, 'pronoun')]], plural);
    const thing = noun.cat !== 'person';
    const grammatical = noun.cat === 'person' && noun.g === 'n' && !plural ? ' — es for a neuter noun, even for a person' : '';
    return {
      kind: 'personal', sub: `noun-${caseKey}`, case: caseKey, gender, key: noun.lemma, tokens, notes: vocab.notesOf(noun),
      prompt: { label: 'Ersetze', text: fillTemplate(frame.t, [[np]], plural).join('') },
      tags: tags('personal', caseKey, gender),
      explain: `"${np}" is ${GENDER_LABELS[gender]}${thing && !plural ? ' — the pronoun follows the grammatical gender' : ''}${grammatical} → ${answer} in the ${CASE_LABELS[caseKey]}.`,
    };
  }

  function doubleItem(source, rnd, recent) {
    const t = pick(DOUBLE, rnd);
    const person = vocab.pickDue(nounsFor(['person'], { source }), rnd, { recent });
    const thing = vocab.pickDue(nounsFor(['thing'], { count: true, gift: true, source, exclude: [person.lemma] }), rnd);
    const personPl = choosePlural(person, rnd);
    const dat = THIRD_PERSON[personPl ? 'pl' : person.g].dat;
    const acc = THIRD_PERSON[thing.g].acc;
    const prompt = fillTemplate(t, [[phrase(person, 'dat', personPl)], [phrase(thing, 'acc', false)]], false).join('');
    // Both replaced: the accusative pronoun goes before the dative one.
    const tokens = fillTemplate(t, [[wordGap('pron', acc, 'accusative pronoun')], [wordGap('pron', dat, 'dative pronoun')]], false);
    return {
      kind: 'personal', sub: 'double', case: 'dat', key: person.lemma, tokens, notes: vocab.notesOf(person, thing),
      prompt: { label: 'Ersetze beide', text: prompt },
      tags: [{ text: KIND_LABELS.personal, cls: 'k-personal' }, { text: 'Akk + Dat', cls: 'plain' }],
      explain: `Two pronouns: the accusative comes first — ${acc} (${phrase(thing, 'acc', false)}) ${dat} (${phrase(person, 'dat', personPl)}). With nouns it is the other way round.`,
    };
  }

  function reflexiveItem(caseKey, source, rnd) {
    const entry = pick(REFLEXIVE_VERBS.filter((e) => e.case === caseKey), rnd);
    // A person from the deck now and then ("Meine Tante freut sich …"); otherwise a pronoun, mostly ich / du.
    const people = rnd() < 0.15 ? nounsFor(['person'], { source }) : [];
    const noun = people.length ? vocab.pickDue(people, rnd) : null;
    const plural = noun ? choosePlural(noun, rnd) : false;
    const key = noun ? (plural ? 'siePl' : 'er') : pick(REFLEXIVE_SUBJECTS, rnd);
    const subject = noun ? phrase(noun, 'nom', plural) : PERSONS[key].nom;
    const finite = verbs.finite(entry.verb, 'pres', PERSONS[key].verb)[0];
    const answer = REFLEXIVE[key][caseKey];
    const end = [entry.rest, entry.verb.particle].filter(Boolean).join(' ');
    const tokens = fillTemplate(`${subject} ${finite} {0}${end ? ' ' + end : ''}.`, [[wordGap('refl', answer, 'reflexive pronoun')]], false);
    const third = answer === 'sich';
    const why = caseKey === 'dat'
      ? `There is another object ("${entry.rest}"), so the reflexive pronoun is dative`
      : 'The reflexive pronoun is the only object, so it is accusative';
    return {
      kind: 'reflexive', sub: caseKey, case: caseKey, key: entry.inf, tokens, notes: vocab.notesOf(noun),
      tags: [{ text: KIND_LABELS.reflexive, cls: 'k-reflexive' }, { text: `sich ${entry.inf}`, cls: 'plain' }, { text: CASE_LABELS[caseKey], cls: 'plain' }],
      explain: `${why}: ${PERSONS[key].nom} → ${answer}${third ? ' (sich for er / sie / es, sie and Sie in both cases)' : ''}.${entry.note ? ` ${capitalize(entry.note)}.` : ''}`,
    };
  }

  function relativeItem(caseKey, source, rnd, recent) {
    const nouns = (c) => nounsFor(c.cats, { source, gift: c.small });
    const clause = pick(CLAUSES.filter((c) => c.case === caseKey && nouns(c).length), rnd);
    const noun = vocab.pickDue(nouns(clause), rnd, { recent });
    const plural = choosePlural(noun, rnd);
    const gender = plural ? 'pl' : noun.g;
    const main = pick(MAIN, rnd);
    const answer = RELATIVE[gender][CASES.indexOf(caseKey)];
    const np = phrase(noun, main.case, plural);
    const [before, after] = clause.t.split('{R}');
    const rel = fillTemplate(after, [], plural);
    const tokens = fillTemplate(main.t, [[np], [before, wordGap('rel', answer, 'relative pronoun'), ...rel].filter((t) => t !== '')], plural);
    const special = answer === 'denen' || answer === 'dessen' || answer === 'deren'
      ? ` Only ${answer === 'denen' ? 'the dative plural (denen)' : 'the genitive (dessen, deren)'} differs from the article.` : '';
    return {
      kind: 'relative', sub: caseKey, case: caseKey, gender, key: noun.lemma, tokens, notes: vocab.notesOf(noun),
      tags: tags('relative', caseKey, gender),
      explain: `Gender and number from "${phrase(noun, 'nom', plural)}" (${GENDER_LABELS[gender]}); the case from the clause — ${clause.why} → ${answer}.${special}`,
    };
  }

  function buildRound(settings, rnd = Math.random) {
    const combos = settings.kinds.flatMap((kind) => SUB_KINDS[kind].map((sub) => ({ kind, sub })));
    const recent = [];
    const items = [];
    let queue = [];
    while (items.length < settings.length) {
      if (!queue.length) queue = shuffle(combos, rnd);
      const { kind, sub } = queue.shift();
      const item = buildItem(kind, sub, settings, rnd, recent);
      remember(recent, item.key, 5);
      items.push(item);
    }
    return items;
  }

  // ---------- Tables ----------

  function tables(settings) {
    const blocks = [];
    if (settings.kinds.includes('personal')) {
      const keys = ALL_PERSONS;
      blocks.push({
        title: KIND_LABELS.personal, cls: 'k-personal',
        rows: keys.map((k) => PERSONS[k].nom),
        cols: [{ head: CASE_SHORT.acc, label: CASE_LABELS.acc }, { head: CASE_SHORT.dat, label: CASE_LABELS.dat }],
        answers: [keys.map((k) => PERSONS[k].acc), keys.map((k) => PERSONS[k].dat)],
      });
    }
    if (settings.kinds.includes('reflexive')) {
      const keys = ['ich', 'du', 'er', 'wir', 'ihr', 'siePl'];
      blocks.push({
        title: KIND_LABELS.reflexive, cls: 'k-reflexive', sub: 'ich wasche mich · ich wasche mir die Hände',
        rows: verbs.PERSON_LABELS,
        cols: [{ head: CASE_SHORT.acc, label: CASE_LABELS.acc }, { head: CASE_SHORT.dat, label: CASE_LABELS.dat }],
        answers: [keys.map((k) => REFLEXIVE[k].acc), keys.map((k) => REFLEXIVE[k].dat)],
      });
    }
    if (settings.kinds.includes('relative')) {
      blocks.push({
        title: KIND_LABELS.relative, cls: 'k-relative', sub: 'der Mann, der … · dem … · dessen …',
        rows: CASE_ROWS,
        cols: GENDER_COLS,
        answers: ['m', 'f', 'n', 'pl'].map((g) => RELATIVE[g]),
      });
    }
    if (settings.kinds.includes('possessive')) {
      const keys = ALL_PERSONS;
      blocks.push({
        title: 'Possessivartikel', cls: 'k-possessive', sub: 'whose? ich → mein … (Ihr with a capital)', exact: true,
        rows: keys.map((k) => PERSONS[k].label),
        cols: [{ head: 'mein …', label: 'possessive' }],
        answers: [keys.map((k) => PERSONS[k].poss)],
      });
      blocks.push({
        title: 'mein, standing alone', cls: 'k-possessive', sub: 'Das ist meiner.',
        rows: CASE_ROWS.slice(0, 3),
        cols: GENDER_COLS,
        answers: ['m', 'f', 'n', 'pl'].map((g) => ['nom', 'acc', 'dat'].map((c) => alonePronoun('mein', g, c))),
      });
    }
    if (settings.kinds.includes('wrelative')) {
      const preps = ['an', 'auf', 'aus', 'für', 'mit', 'über', 'um', 'von', 'vor', 'zu'];
      blocks.push({
        title: 'wo(r)- + preposition', cls: 'k-wrelative', sub: 'alles, worauf ich warte · etwas, wofür …',
        rows: preps,
        cols: [{ head: 'wo(r)-', label: 'wo-word' }],
        answers: [preps.map((p) => woWord(p))],
      });
    }
    return {
      title: 'Pronouns from memory',
      lead: 'Type each form. Each column runs top to bottom.',
      wide: blocks.length > 2,
      blocks,
    };
  }

  function tableStep(settings) {
    return { type: 'table', label: 'Pronoun tables', table: tables(settings) };
  }

  function drillStep(settings, rnd) {
    return {
      type: 'drill',
      label: 'Sentences',
      hint: 'Tab moves between gaps · type the whole pronoun · the grey word in a gap is the person to put in the right case · Ihr (polite) with a capital'
        + (settings.kinds.includes('wrelative') ? ' · with a preposition: the whole word or both words (worauf, auf den)' : ''),
      hideTags: !settings.hints,
      items: buildRound(settings, rnd),
    };
  }

  const usableNoun = (n) => ['person', 'thing', 'animal', 'food'].includes(n.cat);

  // n sentences in the settings' scope, for a round here and for the Daily review.
  const sentences = (settings, n, rnd = Math.random) => drillStep({ ...settings, length: n }, rnd);

  return {
    id: 'pronouns',
    title: 'Pronomen',
    subtitle: 'Personal, reflexive, relative and possessive pronouns — mich or mir, der or dem, sein or ihr, was or worauf.',
    intro: vocab.intro('Fill in the pronoun tables, then the pronouns in sentences: a person in the right case, a noun replaced by its pronoun, mich or mir, the relative pronoun, and the possessive that fits the owner (sein or ihr) or stands alone (meiner).', usableNoun),
    defaults: { kinds: ['personal', 'reflexive', 'relative', 'possessive'], vocab: 'anki', hints: false, length: 10 },
    prepare: vocab.prepare,
    options: [
      {
        key: 'kinds', label: 'Pronouns', type: 'checkboxes', min: 1, table: true, choices: [
          { value: 'personal', label: KIND_LABELS.personal, detail: 'mich, mir, ihn, ihm, ihnen · Ich gebe ihn ihr.' },
          { value: 'reflexive', label: KIND_LABELS.reflexive, detail: 'Ich wasche mich. · Ich wasche mir die Hände.' },
          { value: 'relative', label: KIND_LABELS.relative, detail: 'der Mann, dem ich helfe · deren, denen, dessen' },
          { value: 'possessive', label: KIND_LABELS.possessive, detail: 'sein or ihr? Anna sucht ihren Schlüssel · Das ist meiner.' },
          { value: 'wrelative', label: 'Relativ: was, wo(r)-, wer', detail: 'alles, was ich weiß · das Einzige, worauf ich warte · die Stadt, wo … · Wer …, der …' },
        ],
      },
      vocab.OPTION,
      { key: 'hints', label: 'Hints', type: 'toggle', text: 'Show the case before answering' },
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
          return [tableStep(settings), sentences(settings, settings.length, rnd)];
        },
      },
      { label: 'Tables only', build: (settings) => [tableStep(settings)] },
    ],

    KINDS, PERSONS, REFLEXIVE, RELATIVE, possessive, alonePronoun, REFLEXIVE_VERBS, CLAUSES, SUB_KINDS, WAS, PREP_CLAUSES, WER,
    buildItem, buildRound, tables, phrase,
  };
});
