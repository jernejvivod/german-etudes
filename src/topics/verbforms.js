// Topic: Verbformen — Präsens (du fährst, er nimmt), Präteritum (fuhr, nahm), Perfekt (ist gefahren, hat genommen),
// Konjunktiv II (wäre, hätte, könnte, würde + infinitive; hätte gemacht, wäre gegangen), Imperativ (nimm!, fahr!) and
// Modalverben (hat arbeiten müssen; er muss krank sein, sie könnte es vergessen haben) and Konjunktiv I in reported
// speech (er sagt, er sei krank; sie sagen, sie hätten keine Zeit); also Plusquamperfekt (nachdem er gegessen hatte),
// Futur I (wird fahren) and Futur II (wird gefahren sein), and lassen + infinitive (hat das Auto reparieren lassen).
// Session: the principal parts of the round's verbs, then sentences. With the Anki option, the learnt verbs of the deck
// and their example sentences come first: a sentence is used when a form of its verb is found in it, gapped where it stands.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/cloze.js'), require('../core/declension.js'), require('../core/lexicon.js'), require('../core/vocab.js'),
      require('../core/verbs.js'), require('../core/store.js'));
  } else {
    root.Etudes.topics.push(factory(root.Etudes.cloze, root.Etudes.declension, root.Etudes.lexicon, root.Etudes.vocab, root.Etudes.verbs, root.Etudes.store));
  }
})(globalThis, function (cloze, declension, lexicon, vocab, verbs, store) {
  'use strict';

  const { wordGap, pick, pickFresh, remember, shuffle, capitalizeFirst, clean } = cloze;
  const { PERSONS, AUX_3SG, principalParts, baseInf } = verbs;

  const TENSES = ['praes', 'praet', 'perf', 'plusq', 'fut1', 'fut2', 'konj2', 'imp', 'modal', 'konj1'];
  const TENSE_LABELS = {
    praes: 'Präsens', praet: 'Präteritum', perf: 'Perfekt', plusq: 'Plusquamperfekt', fut1: 'Futur I', fut2: 'Futur II',
    konj2: 'Konjunktiv II', imp: 'Imperativ', modal: 'Modalverben', konj1: 'Konjunktiv I',
  };
  // The tenses with a principal-parts column.
  const PART_TENSES = ['praes', 'praet', 'perf', 'plusq', 'fut2', 'imp'];
  // The tense a sentence entry must fit for the compound ones: their verb part is the Partizip II or the infinitive.
  const ENTRY_TENSE = { plusq: 'perf', fut2: 'perf', fut1: 'praes' };
  // Futur II needs its time word ("bis morgen", "wohl": "Ihr werdet den Weg gekannt haben" says nothing) and something that
  // gets done (not "Ich werde bis Freitag sehr müde gewesen sein"); scheinen has no Futur ("wird müde zu sein scheinen").
  const NO_FUTURE = { fut1: new Set(['scheinen']), fut2: new Set(['sein', 'haben', 'werden', 'wissen', 'kennen', 'scheinen']) };
  const fitsTense = (entry, tense) => entry.tenses.includes(ENTRY_TENSE[tense] || tense) && (tense !== 'fut2' || entry.time)
    && !NO_FUTURE[tense]?.has(entry.inf);

  // ---------- Subjects ----------

  // Pronoun subjects and their verb person.
  const SUBJECTS = {
    ich: ['ich', '1sg'], du: ['du', '2sg'], er: ['er', '3sg'], sie: ['sie', '3sg'],
    wir: ['wir', '1pl'], ihr: ['ihr', '2pl'], siePl: ['sie', '3pl'], Sie: ['Sie', '3pl'],
  };
  // The Präsens stem change shows in du and er / sie / es; the Präteritum is mostly written in ich, er / sie, wir and sie.
  const TENSE_SUBJECTS = {
    praes: ['du', 'du', 'du', 'er', 'sie', 'noun', 'noun', 'ich', 'wir', 'ihr'],
    praet: ['ich', 'er', 'sie', 'noun', 'wir', 'siePl'],
    perf: ['ich', 'du', 'er', 'sie', 'noun', 'wir', 'ihr', 'siePl'],
  };
  TENSE_SUBJECTS.plusq = TENSE_SUBJECTS.fut1 = TENSE_SUBJECTS.fut2 = TENSE_SUBJECTS.perf;
  const TIMES = {
    praes: ['heute', 'jetzt'],
    praet: ['gestern', 'damals', 'letzte Woche'],
    perf: ['gestern', 'heute Morgen', 'letzte Woche'],
    plusq: ['schon vorher', 'kurz davor', 'bereits'],
    fut1: ['morgen', 'nächste Woche', 'bald'],
    // Done by then, or a guess about the past ("Er wird den Zug wohl verpasst haben").
    fut2: ['bis morgen', 'bis Freitag', 'wohl'],
  };
  // Main clauses after a nachdem-clause (Präteritum, verb first).
  const AFTER = ['ging es allen besser', 'gab es Kaffee und Kuchen', 'war alles viel einfacher', 'fuhren alle nach Hause'];

  // Adults as subjects: the deck's people, or the built-in ones ("Mein Kollege fährt …").
  function nounSubjects(source) {
    return vocab.pool(lexicon.NOUNS, (n) => n.cat === 'person' && n.sg && !n.child, source);
  }

  // sie can be singular or plural (and is Sie at the start of a sentence), so both forms count after it.
  const AMBIGUOUS_SUBJECTS = new Set(['sie', 'siePl', 'Sie']);

  // The forms for a person, and those of the other "sie" after an ambiguous one.
  function personForms(lists, pi, ambiguous) {
    if (!ambiguous) return lists[pi];
    return [...new Set([...lists[pi], ...lists[pi === 2 ? 5 : 2]])];
  }

  // { text, person, ambiguous } for a subject key, or { text, person, noun } with a noun from the pool.
  function subject(key, source, rnd) {
    if (key !== 'noun') return { text: SUBJECTS[key][0], person: SUBJECTS[key][1], ambiguous: AMBIGUOUS_SUBJECTS.has(key) };
    const noun = vocab.pickDue(nounSubjects(source), rnd);
    const plural = !!noun.pl && rnd() < 0.3;
    return { text: vocab.withArticle(noun, 'nom', plural), person: plural ? '3pl' : '3sg', noun };
  }

  // ---------- Built-in verbs ----------

  // The reflexive pronoun for {RA} (accusative) / {RD} (dative) in a phrase, for the verb person at index pi.
  const fillReflexive = (text, pi) => text.replace(/\{R([AD])\}/g, (_, k) => verbs.REFLEXIVE_PRONOUNS[k === 'A' ? 'acc' : 'dat'][pi]);
  // Pronouns at the start of a phrase ({RA} / {RD}: the reflexive pronoun in the accusative / dative).
  const LEADING = /^(?:(?:\{R[AD]\}|es|ihn|ihm|ihr|ihnen|mir|dir|uns|euch)(?: |$))+/;
  // Modal verbs: Präsens and Präteritum only (the Perfekt takes a second infinitive), with no time word.
  const MODAL = { tenses: ['praes', 'praet'], time: false };

  // A verb and what follows it in a main clause (the particle or Partizip II goes after that). tenses: where it fits
  // (modals: no Perfekt with a second infinitive); time: whether a time word fits after the verb.
  const BUILTIN = [
    ['fahren', 'mit dem Bus zur Arbeit'], ['essen', 'einen Apfel'], ['lesen', 'die Zeitung'], ['sehen', 'einen Film'],
    ['nehmen', 'den Zug'], ['geben', 'dem Kind ein Buch'], ['sprechen', 'mit dem Chef'], ['treffen', 'eine alte Freundin'],
    ['helfen', 'der Nachbarin'], ['schlafen', 'sehr lange'], ['laufen', 'durch den Park'], ['tragen', 'eine rote Jacke'],
    ['waschen', 'das Auto'], ['vergessen', 'den Schlüssel'], ['werfen', 'den Ball'], ['halten', 'eine kurze Rede'],
    ['lassen', 'das Auto in der Garage'], ['fangen', 'den Ball'], ['schreiben', 'eine E-Mail'], ['finden', 'den Schlüssel nicht'],
    ['trinken', 'einen Kaffee'], ['gehen', 'ins Kino'], ['kommen', 'zu spät'], ['bleiben', 'zu Hause'], ['fliegen', 'nach Spanien'],
    ['schwimmen', 'im See'], ['mitbringen', 'einen Kuchen'], ['denken', 'an den Urlaub'],
    ['sitzen', 'im Garten'], ['liegen', 'am Strand'], ['singen', 'ein Lied'], ['gewinnen', 'das Spiel'], ['verlieren', 'das Spiel'],
    ['beginnen', 'mit der Arbeit'], ['verstehen', 'die Frage nicht'], ['bekommen', 'eine Nachricht'], ['anrufen', 'die Ärztin'],
    ['aufstehen', 'um sieben Uhr'], ['einladen', 'die Nachbarn'], ['mitnehmen', 'einen Regenschirm'], ['fernsehen', ''],
    ['einschlafen', 'sofort'], ['anfangen', 'mit dem Kurs'], ['umsteigen', 'in Köln'], ['ankommen', 'in Berlin'],
    ['empfehlen', 'ein gutes Restaurant'], ['stehlen', 'kein Geld'], ['werden', 'schnell müde'], ['sein', 'sehr müde'],
    ['haben', 'keine Zeit'], ['arbeiten', 'im Garten'], ['reisen', 'nach Italien'], ['studieren', 'in Wien'],
    ['besuchen', 'die Oma'], ['einkaufen', 'im Supermarkt'], ['warten', 'auf den Bus'],
    ['wissen', 'die Antwort', { time: false }], ['kennen', 'den Weg', { time: false }],
    ['können', 'gut schwimmen', MODAL],
    ['müssen', 'früh aufstehen', MODAL],
    ['dürfen', 'hier nicht parken', MODAL],
    ['wollen', 'ein neues Auto kaufen', MODAL],
    ['mögen', 'keinen Fisch', MODAL],
  ].map(([inf, rest, opts]) => entryOf(inf, rest, opts));

  // A sentence entry: the verb, what follows it, the tenses it fits, whether a time word fits, and the auxiliary its
  // sentence takes when the verb has two (zerbrechen: "hat eine Tasse zerbrochen").
  // The phrase is split once: pronouns at its start stay right after the verb, before the time word ("Ich leihe ihm heute …").
  function entryOf(inf, rest, opts = {}, v = verbs.verb(inf)) {
    const lead = (rest.match(LEADING) || [''])[0];
    return {
      inf, rest, lead: lead.trim(), tail: rest.slice(lead.length), verb: v,
      tenses: opts.tenses || ['praes', 'praet', 'perf'], time: opts.time !== false, aux: opts.aux,
    };
  }

  const BUILTIN_IRREGULAR = BUILTIN.map((e) => e.verb).filter((v) => v.irregular);
  const irregularPresent = (v) => verbs.IRREGULAR_PRESENT[baseInf(v)];
  // A strong Präteritum has no ending in ich / er (kam); weak and mixed verbs end in -e (machte, dachte).
  const strong = (v) => !v.pret[0][0].endsWith('e');
  const withParticle = (v, forms) => forms.map((f) => (v.particle ? `${f} ${v.particle}` : f));
  const label = (v) => (v.reflexive ? `sich ${v.inf}` : v.inf);

  // The principal-parts block for verbs (er / sie / es) in the given tenses.
  const PART_HEADS = {
    praes: ['Präsens', 'er fährt'], praet: ['Präteritum', 'er fuhr'], perf: ['Perfekt', 'er ist gefahren'], plusq: ['Plusquamperfekt', 'er war gefahren'],
    fut2: ['Futur II', 'er wird gefahren sein'], imp: ['Imperativ', 'du: fahr!'],
  };
  // The verb's auxiliaries with its Partizip II, shaped by fmt(auxiliary, participle): "ist gefahren", "war gefahren".
  const withAux = (fmt) => (v) => v.aux.flatMap((a) => v.pii.map((pii) => fmt(a, pii)));
  const PART_ANSWERS = {
    praes: (v) => withParticle(v, v.pres[2]),
    praet: (v) => withParticle(v, v.pret[2]),
    perf: withAux((a, pii) => `${AUX_3SG[a]} ${pii}`),
    plusq: withAux((a, pii) => `${verbs.verb(a).pret[2][0]} ${pii}`),
    fut2: withAux((a, pii) => `wird ${pii} ${a}`),
    // Modal verbs have no imperative: a dash (or nothing) counts.
    imp: (v) => {
      const imp = verbs.imperative(v);
      return imp ? withParticle(v, imp.du) : ['—', ''];
    },
  };
  function stammformen(rows, tenses) {
    return {
      title: 'Stammformen', sub: 'er / sie / es',
      rows: rows.map(label),
      cols: tenses.map((t) => ({ head: PART_HEADS[t][0], sub: PART_HEADS[t][1], cls: `t-${t}` })),
      answers: tenses.map((t) => rows.map(PART_ANSWERS[t])),
    };
  }

  const HINT = 'The grey word is the infinitive · Perfekt: type the auxiliary and the Partizip II · separable verbs: only the part in the gap';
  const drillStep = (items) => ({ type: 'drill', label: 'Sentences', hint: HINT, items });

  // Whether the Präsens changes the stem (du fährst) — what the Präsens drill is about.
  function changesStem(v) {
    return v.pres[1][0] !== verbs.regularPresent(baseInf(v))[1] || !!irregularPresent(v);
  }

  // A whole-word gap for a verb form; the other accepted forms (du lasest / last) count too. The placeholder is the
  // infinitive as a hint, so it stays lower-case at the start of a sentence.
  function gapFor(slot, forms, label, placeholder) {
    return { ...wordGap(slot, forms[0], label), alts: forms.slice(1), placeholder, keepCase: true };
  }

  // A built-in verb in a main clause: "Du fährst heute mit dem Bus zur Arbeit." / "Ich bin gestern … gefahren."
  function verbItem(tense, source, rnd, recent) {
    let pool = BUILTIN.filter((e) => fitsTense(e, tense));
    if (tense === 'praes' && rnd() < 0.75) pool = pool.filter((e) => changesStem(e.verb));
    return sentence(pickFresh(pool, recent, (e) => e.inf, rnd), tense, source, rnd);
  }


  // One sentence for an entry in a tense, with a subject that fits it. The Plusquamperfekt is now and then a nachdem-clause
  // ("Nachdem ich gegessen hatte, gab es Kaffee und Kuchen.").
  function sentence(entry, tense, source, rnd, origin = 'builtin') {
    const v = entry.verb;
    const subj = subject(pick(TENSE_SUBJECTS[tense], rnd), source, rnd);
    const pi = PERSONS.indexOf(subj.person);
    const nachdem = tense === 'plusq' && rnd() < 0.4;
    const time = entry.time && !nachdem ? pick(TIMES[tense], rnd) : '';
    const middle = [fillReflexive(entry.lead, pi), time, fillReflexive(entry.tail, pi).trim()].filter(Boolean).join(' ');
    // The sentence decides the auxiliary: no object, so fahren takes sein; only liegen / sitzen / stehen allow both.
    const auxes = entry.aux ? [entry.aux] : verbs.regional(v) ? v.aux : v.aux.slice(0, 1);
    const forms = (inf, key) => personForms(verbs.verb(inf)[key], pi, subj.ambiguous);
    const pii = gapFor('pii', v.pii, 'Partizip II', v.inf);

    // The finite verb, and what closes the clause.
    let finite;
    let end;
    switch (tense) {
      case 'perf':
      case 'plusq':
        finite = gapFor('aux', auxes.flatMap((a) => forms(a, tense === 'perf' ? 'pres' : 'pret')), 'auxiliary', 'haben / sein');
        end = [pii];
        break;
      case 'fut1':
      case 'fut2':
        finite = gapFor('fin', forms('werden', 'pres'), 'werden', 'werden');
        end = tense === 'fut1' ? [gapFor('inf', [v.inf], 'infinitive', v.inf)] : [pii, ' ', gapFor('aux', auxes, 'haben or sein', 'haben / sein')];
        break;
      default:
        finite = gapFor('fin', personForms(v[tense === 'praes' ? 'pres' : 'pret'], pi, subj.ambiguous), `${TENSE_LABELS[tense]} of ${v.inf}`, v.inf);
        end = v.particle ? [v.particle] : [];
    }
    const tokens = nachdem
      ? ['Nachdem ', subj.text, middle ? ` ${middle} ` : ' ', ...end, ' ', finite, `, ${pick(AFTER, rnd)}.`]
      : capitalizeFirst([subj.text, ' ', finite, middle ? ` ${middle}` : '', ...(end.length ? [' ', ...end] : []), '.']);
    return item(v, tense, tokens, null, origin, vocab.notesOf(subj.noun, entry));
  }

  // ---------- My irregular verbs ----------

  // What follows the learnt irregular verbs of the deck that have no built-in sentence. Verbs without a person as subject
  // (gelingen, betreffen, schwellen) have none: they get their table row and the deck's sentences.
  const PHRASES = {
    umziehen: ['nach Berlin'], zugestehen: ['ihr das Recht'], befehlen: ['es ihm'], vorhersehen: ['das Problem', { time: false }],
    großziehen: ['drei Kinder', { time: false }], leihen: ['ihm mein Fahrrad'], verzeihen: ['ihm den Fehler'], anhaben: ['eine rote Jacke'],
    bitten: ['den Kellner um die Rechnung'], erkennen: ['den Fehler sofort'],
    nachsehen: ['im Wörterbuch'], herkommen: ['zu Fuß'], ertragen: ['den Lärm nicht'],
    zusammenstoßen: ['mit einem Radfahrer'], nennen: ['den Hund Bello'], zurückweisen: ['das Angebot'],
    hervorheben: ['die wichtigsten Punkte'], nachdenken: ['über das Problem'],
    aussehen: ['sehr müde'], wachsen: ['sehr schnell', { time: false }], schließen: ['die Tür'],
    ausleihen: ['ein Buch in der Bibliothek'], ziehen: ['den Koffer', { aux: 'haben' }], behalten: ['das Geld'], bringen: ['ihr Blumen'],
    verbieten: ['das Rauchen'], zerbrechen: ['eine Tasse', { aux: 'haben' }], schieben: ['das Fahrrad'], rufen: ['den Kellner'],
    hinnehmen: ['die Kritik'], verlassen: ['das Haus'], scheinen: ['müde zu sein', { tenses: ['praes', 'praet'] }],
    riechen: ['den Kaffee'], ausziehen: ['die Schuhe', { aux: 'haben' }], stinken: ['nach Rauch'], streiten: ['mit dem Nachbarn'],
    besitzen: ['ein Haus am Meer', { time: false }], annehmen: ['die Einladung'], versprechen: ['es ihr'], vorhaben: ['nichts'],
    erhalten: ['einen Brief'], verschreiben: ['ihm Tabletten'], fallen: ['vom Fahrrad'],
    hochheben: ['die Kiste'], erfahren: ['die Wahrheit'], leiden: ['an Kopfschmerzen'], übertreiben: ['immer', { time: false }],
    zurückgeben: ['das Buch'], wiedererkennen: ['ihn nicht'], stehen: ['an der Haltestelle'], wiederfinden: ['den Schlüssel'],
    vorschlagen: ['einen Spaziergang'], überlassen: ['ihm die Entscheidung'], raten: ['ihm zur Vorsicht'],
    sterben: ['fast vor Langeweile'], verbinden: ['die zwei Kabel'], anziehen: ['eine warme Jacke'], schreien: ['sehr laut'],
    wegnehmen: ['ihm das Handy'], abbiegen: ['nach links'], tun: ['nichts'], lügen: ['nie', { time: false }],
    heißen: ['wirklich so', { time: false }], zwingen: ['ihn zu nichts'], schweigen: ['sehr lange'],
  };

  // The reflexive ones: {RA} / {RD} is the reflexive pronoun in the accusative / dative ("Ich breche mir das Bein").
  const REFLEXIVE_PHRASES = {
    umziehen: ['{RA} schnell'], anschließen: ['{RA} der Gruppe'], befinden: ['{RA} im Büro'], brechen: ['{RD} das Bein'],
    entscheiden: ['{RA} für das rote Auto'], unterhalten: ['{RA} mit den Nachbarn'], verbrennen: ['{RD} die Finger'],
    anziehen: ['{RA} warm'],
  };

  // A sentence entry for a deck verb: the built-in one, or its phrase (a reflexive one for a reflexive card).
  function entryFor(v) {
    const builtin = BUILTIN.find((e) => e.inf === v.inf);
    if (builtin && !v.reflexive) return { ...builtin, verb: v };
    const phrase = (v.reflexive ? REFLEXIVE_PHRASES : PHRASES)[v.inf];
    return phrase ? entryOf(v.inf, phrase[0], phrase[1], v) : null;
  }

  // The rotation: verbs already practised since the last full turn, kept between sessions (store).
  // One rotation per verb source; it moves on when a session is built.
  const seenKey = (source) => `etudes-verbforms-seen-${source}`;
  function seenVerbs(source) {
    const list = store.read(seenKey(source), []);
    return Array.isArray(list) ? list : [];
  }
  const saveSeen = (source, list) => store.write(seenKey(source), list);

  // The verbs to practise: the deck's learnt irregular ones (hardest first), or the built-in irregular ones.
  function irregularVerbs(source) {
    const mine = source === 'anki' ? deckVerbs().map((x) => x.verb).filter((v) => v.irregular) : [];
    return mine.length ? mine : BUILTIN_IRREGULAR;
  }

  // The next `size` verbs not practised yet, in order; after a full turn the rotation starts again.
  function nextVerbs(list, source, size = 8) {
    const seen = new Set(seenVerbs(source));
    let picked = list.filter((v) => !seen.has(v.inf)).slice(0, size);
    let done = [...seen];
    if (picked.length < size) {
      done = [];
      picked = [...picked, ...list.filter((v) => !picked.includes(v))].slice(0, size);
    }
    saveSeen(source, [...done, ...picked.map((v) => v.inf)]);
    return picked;
  }


  // The forms of the round's verbs: principal parts, the Präsens du / er where the stem changes, ich / wir in the
  // Präteritum of strong verbs, and the whole Präsens and Präteritum of a fully irregular verb.
  function myVerbsTable(round) {
    const blocks = [stammformen(round, ['praes', 'praet', 'perf'])];
    // One fully irregular verb gets its whole Präsens and Präteritum; every other one with a stem change (müssen, tun
    // included) its du / er pair.
    const irregular = round.find(irregularPresent);
    const changing = round.filter((v) => changesStem(v) && v !== irregular);
    if (changing.length) {
      blocks.push({
        title: 'Präsens', sub: 'the stem changes for du and er',
        rows: changing.map(label),
        cols: [{ head: 'du', cls: 't-praes' }, { head: 'er / sie / es', cls: 't-praes' }],
        answers: [changing.map((v) => withParticle(v, v.pres[1])), changing.map((v) => withParticle(v, v.pres[2]))],
      });
    }
    const strongOnes = round.filter(strong);
    if (strongOnes.length) {
      blocks.push({
        title: 'Präteritum', sub: 'no ending for ich and er; -en for wir',
        rows: strongOnes.map(label),
        cols: [{ head: 'ich', cls: 't-praet' }, { head: 'wir', cls: 't-praet' }],
        answers: [strongOnes.map((v) => withParticle(v, v.pret[0])), strongOnes.map((v) => withParticle(v, v.pret[3]))],
      });
    }
    if (irregular) {
      blocks.push({
        title: label(irregular), sub: 'the whole Präsens and Präteritum',
        rows: verbs.PERSON_LABELS,
        cols: [{ head: 'Präsens', cls: 't-praes' }, { head: 'Präteritum', cls: 't-praet' }],
        answers: [irregular.pres.map((f) => withParticle(irregular, f)), irregular.pret.map((f) => withParticle(irregular, f))],
      });
    }
    return {
      title: 'My irregular verbs',
      lead: 'Type each form, the separable particle included (er steht auf); for the Perfekt, the auxiliary and the Partizip II.',
      wide: true,
      blocks,
    };
  }

  // Two sentences per verb in different tenses: one of its deck sentences where it has one (two if it has no phrase),
  // and built sentences for the rest. Only the Anki option brings in the deck's sentences.
  function myVerbsSentences(round, source, rnd) {
    const tenses = ['praes', 'praet', 'perf'];
    const fromDeck = source === 'anki' ? deckItems(tenses) : [];
    const tenseOf = (i) => ENTRY_TENSE[i.tense] || i.tense;
    const items = [];
    for (const v of round) {
      // With the Anki option a deck verb's entry carries its card, so answering it right here marks it as shown (a miss
      // releases it).
      const fromCard = source === 'anki' && deck().entries.find((e) => e.verb.inf === v.inf && !!e.verb.reflexive === !!v.reflexive);
      const entry = fromCard || entryFor(v);
      const mine = [];
      for (const own of shuffle(fromDeck.filter((i) => i.verb === v.inf), rnd)) {
        if (mine.length >= (entry ? 1 : 2)) break;
        if (!mine.some((i) => tenseOf(i) === tenseOf(own))) mine.push(own);
      }
      if (entry) {
        const used = new Set(mine.map(tenseOf));
        const fresh = shuffle(tenses, rnd).filter((t) => !used.has(t) && entry.tenses.includes(t)).slice(0, 2 - mine.length);
        mine.push(...fresh.map((t) => sentence(entry, t, source, rnd)));
      }
      items.push(...mine);
    }
    return shuffle(items, rnd);
  }

  function myVerbsSteps(settings, rnd) {
    const source = settings.vocab || 'builtin';
    const round = nextVerbs(irregularVerbs(source), source);
    return [
      { type: 'table', label: 'My irregular verbs', table: myVerbsTable(round) },
      drillStep(myVerbsSentences(round, source, rnd)),
    ];
  }

  // ---------- Imperativ ----------

  // Requests and what follows the verb ({RA} / {RD}: the reflexive pronoun of du / ihr / Sie).
  const IMPERATIVES = [
    ['nehmen', 'den Zug'], ['geben', 'mir bitte das Salz'], ['lesen', 'den Text laut'], ['sprechen', 'bitte langsamer'],
    ['helfen', 'mir bitte'], ['vergessen', 'den Schlüssel nicht'], ['essen', 'nicht so schnell'], ['sehen', 'mal'],
    ['werfen', 'den Ball zu mir'], ['fahren', 'vorsichtig'], ['schlafen', 'gut'], ['laufen', 'schneller'],
    ['tragen', 'bitte die Tasche'], ['waschen', '{RD} die Hände'], ['lassen', 'mich in Ruhe'], ['halten', 'bitte hier'],
    ['kommen', 'bitte pünktlich'], ['gehen', 'nach Hause'], ['bleiben', 'ruhig'], ['warten', 'einen Moment'],
    ['arbeiten', 'nicht so viel'], ['öffnen', 'bitte das Fenster'], ['anrufen', 'mich morgen'], ['aufstehen', 'jetzt'],
    ['mitnehmen', 'einen Regenschirm'], ['zumachen', 'bitte die Tür'], ['sein', 'leise'], ['haben', 'keine Angst'],
    ['lächeln', 'mal'], ['antworten', 'bitte schnell'], ['setzen', '{RA} bitte'], ['empfehlen', 'mir ein Restaurant'],
    ['einladen', 'die Nachbarn'], ['treffen', 'eine Entscheidung'],
  ].map(([inf, rest]) => entryOf(inf, rest));
  const ADDRESSEES = ['du', 'du', 'du', 'ihr', 'Sie'];

  // "Nimm den Zug!", "Nehmt den Zug!", "Nehmen Sie den Zug!" — the separable particle at the end ("Ruf mich morgen an!").
  function impItem(rnd, recent) {
    const entry = pickFresh(IMPERATIVES, recent, (e) => e.inf, rnd);
    const v = entry.verb;
    const to = pick(ADDRESSEES, rnd);
    const imp = verbs.imperative(v);
    const pi = PERSONS.indexOf(SUBJECTS[to][1]);
    const words = [to === 'Sie' ? 'Sie' : '', fillReflexive(entry.lead, pi), fillReflexive(entry.tail, pi).trim(), v.particle].filter(Boolean).join(' ');
    const tokens = capitalizeFirst([gapFor('imp', imp[to], `Imperativ of ${v.inf}`, v.inf), ' ', words, '!']);
    const it = item(v, 'imp', tokens, null, 'builtin', [], impExplain(v, to, imp));
    return { ...it, tags: [...it.tags, { text: to, cls: 'plain' }] };
  }

  function impExplain(v, to, imp) {
    const sep = v.particle ? ` The particle goes to the end (${imp[to][0]}${to === 'Sie' ? ' Sie' : ''} … ${v.particle}!).` : '';
    if (to === 'ihr') return `ihr-Imperativ: the ihr-form without "ihr" (ihr ${imp.ihr[0]} → ${imp.ihr[0]}!).${sep}`;
    if (to === 'Sie') return `Sie-Imperativ: the Sie-form, then "Sie" (${imp.Sie[0]} Sie …!).${sep}`;
    const du = verbs.finite(v, 'pres', '2sg')[0];
    const forms = imp.du.join(' / ');
    const rule = {
      irregular: `${baseInf(v)} is irregular: ${forms}!`,
      eToI: `the e → i change of "du ${du}" stays, -st goes: ${forms}!`,
      eln: `-eln verbs drop the e of -el: ${forms}!`,
      ern: `-ern verbs: ${forms}!`,
      e: `the stem + e after t / d, a consonant + m / n or -ig: ${forms}!`,
      optional: changesStem(v) ? `no umlaut, unlike "du ${du}": ${forms}!` : `the stem, -e is optional: ${forms}!`,
    }[imp.rule];
    return `du-Imperativ: ${rule}${sep}`;
  }

  // ---------- Modalverben ----------

  const MODALS = ['können', 'müssen', 'dürfen', 'sollen', 'wollen', 'mögen'];
  // Verbs that take no modal before them here: the modals themselves, the auxiliaries, and what nobody sets out or is
  // made to do ("hat den Weg kennen müssen", "hat nach Rauch stinken wollen", "hat den Schlüssel vergessen müssen").
  const NO_MODAL = new Set([...MODALS, 'sein', 'haben', 'werden', 'wissen', 'kennen', 'scheinen', 'heißen', 'aussehen', 'stinken',
    'riechen', 'befinden', 'leiden', 'bekommen', 'erhalten', 'vergessen', 'fallen', 'sterben', 'wachsen', 'besitzen', 'stehen',
    'zusammenstoßen', 'erfahren', 'verbrennen', 'brechen', 'übertreiben', 'lügen', 'liegen', 'sitzen', 'einschlafen', 'anhaben',
    'verlieren', 'stehlen']);
  const NEGATED = /\b(nicht|nie|nichts|kein\w*)\b/;

  // The sentence entries that fit: with the Anki option the deck's verbs (each with its note, so the due and hard ones
  // are picked most), and the built-in ones too where only a few of the deck's fit (vocab.prefer); else the built-in ones.
  function entriesWhere(source, fits) {
    const builtin = BUILTIN.filter(fits);
    return source === 'anki' ? vocab.prefer(deck().entries.filter(fits), builtin, (e) => e.inf) : builtin;
  }

  // The entries a modal can go before.
  const modalEntries = (source) => entriesWhere(source, (e) => !NO_MODAL.has(e.inf) && e.tenses.includes('perf'));

  // A modal with a second verb in the Perfekt: haben + infinitive + the modal's infinitive, not its Partizip II
  // ("Ich habe gestern die Ärztin anrufen müssen"). The prompt is the Präteritum. Now and then the modal alone, as the
  // main verb, with its Partizip II ("Ich habe das nicht gewollt").
  const MODAL_ALONE = [['wollen', 'das nicht'], ['mögen', 'den Film nicht'], ['können', 'früher gut Französisch'], ['müssen', 'das nicht'],
    ['dürfen', 'das als Kind nicht']];
  function ersatzItem(source, rnd, recent) {
    const subj = subject(pick(TENSE_SUBJECTS.perf, rnd), source, rnd);
    const pi = PERSONS.indexOf(subj.person);
    // modal, what follows the finite verb (the second verb's infinitive last: it stays the same in both tenses), the last gap.
    let modal;
    let middle;
    let last;
    let why;
    let key;
    let entry = null;
    if (rnd() < 0.2) {
      [modal, middle] = pick(MODAL_ALONE, rnd);
      key = modal;
      const pii = verbs.verb(modal).pii;
      last = gapFor('pii', pii, 'Partizip II', modal);
      why = `Without a second verb, ${modal} is the main verb and has a Partizip II: hat ${pii[0]}.`;
    } else {
      entry = vocab.pickDue(modalEntries(source), rnd, { recent, key: (e) => e.inf });
      modal = NEGATED.test(entry.rest) ? 'können' : pick(['müssen', 'müssen', 'können', 'wollen', 'dürfen'], rnd);
      key = entry.inf;
      const time = entry.time ? pick(TIMES.perf, rnd) : '';
      middle = [fillReflexive(entry.lead, pi), time, fillReflexive(entry.tail, pi).trim(), entry.verb.inf].filter(Boolean).join(' ');
      last = gapFor('modal', [modal], 'modal verb', modal);
      why = `A modal with a second verb: haben + infinitive + the modal's infinitive (hat ${entry.verb.inf} ${modal}), not "${verbs.verb(modal).pii[0]}". Always haben, whatever the other verb takes.`;
    }
    return perfectWithInfinitive('Perfekt', subj, modal, middle, last, why, key, entry);
  }

  // "Ich habe … anrufen müssen" / "… reparieren lassen": haben, the middle, the last gap; the prompt is the Präteritum of
  // the modal or lassen ("Ich musste … anrufen"). entry: the second verb's sentence entry, if it has one.
  function perfectWithInfinitive(kind, subj, verb, middle, last, why, key, entry = null) {
    const pi = PERSONS.indexOf(subj.person);
    const aux = gapFor('aux', personForms(verbs.verb('haben').pres, pi, subj.ambiguous), 'auxiliary', 'haben / sein');
    const pret = personForms(verbs.verb(verb).pret, pi, subj.ambiguous)[0];
    return {
      ...modalItem(kind, capitalizeFirst([subj.text, ' ', aux, ' ', middle, ' ', last, '.']), why, key, vocab.notesOf(subj.noun, entry)),
      prompt: { label: 'Präteritum', text: cloze.capitalize(`${subj.text} ${pret} ${middle}.`) },
    };
  }

  // Modals that say how sure the speaker is. {S}: a person (er / sie, or someone from the deck); {M}: the modal;
  // {H}: haben / sein after a Partizip II — the past is the Partizip II + haben / sein (es vergessen haben, gegangen sein).
  const SUBJECTIVE = [
    { p: 'Ich bin sicher, dass {S} krank ist.', t: '{S} {M} krank sein.', m: ['muss'], how: 'sure' },
    { p: 'Ich bin sicher, dass {S} den Zug verpasst hat.', t: '{S} {M} den Zug verpasst {H}.', m: ['muss'], h: 'haben', how: 'sure' },
    { p: 'Ich bin sicher, dass {S} schon gegangen ist.', t: '{S} {M} schon gegangen {H}.', m: ['muss'], h: 'sein', how: 'sure' },
    { p: 'Vielleicht ist {S} schon zu Hause.', t: '{S} {M} schon zu Hause sein.', m: ['könnte', 'kann'], how: 'possible' },
    { p: 'Vielleicht hat {S} es vergessen.', t: '{S} {M} es vergessen {H}.', m: ['könnte', 'kann'], h: 'haben', how: 'possible' },
    { p: 'Vielleicht ist {S} krank geworden.', t: '{S} {M} krank geworden {H}.', m: ['könnte', 'kann'], h: 'sein', how: 'possible' },
    { p: 'Wahrscheinlich stimmt das.', t: 'Das {M} stimmen.', m: ['dürfte', 'müsste'], how: 'probable' },
    { p: 'Wahrscheinlich ist das Paket schon angekommen.', t: 'Das Paket {M} schon angekommen {H}.', m: ['dürfte', 'müsste'], h: 'sein', how: 'probable' },
    { p: 'Wahrscheinlich hat {S} viel zu tun.', t: '{S} {M} viel zu tun haben.', m: ['dürfte', 'müsste'], how: 'probable' },
    { p: 'Es ist unmöglich, dass {S} das gesagt hat.', t: '{S} {M} das nicht gesagt {H}.', m: ['kann'], h: 'haben', how: 'impossible' },
    { p: 'Es ist unmöglich, dass {S} schon da ist.', t: '{S} {M} noch nicht da sein.', m: ['kann'], how: 'impossible' },
    { p: 'Man sagt, dass {S} sehr reich ist.', t: '{S} {M} sehr reich sein.', m: ['soll'], how: 'hearsay' },
    { p: 'Man sagt, dass das Restaurant sehr gut ist.', t: 'Das Restaurant {M} sehr gut sein.', m: ['soll'], how: 'hearsay' },
    { p: 'In der Zeitung steht, dass der Minister zurückgetreten ist.', t: 'Der Minister {M} zurückgetreten {H}.', m: ['soll'], h: 'sein', how: 'hearsay' },
    { p: 'Man sagt, dass {S} früher in Wien gewohnt hat.', t: '{S} {M} früher in Wien gewohnt {H}.', m: ['soll'], h: 'haben', how: 'hearsay' },
    { p: '{S} behauptet, dass er das allein gemacht hat.', t: '{S} {M} das allein gemacht {H}.', m: ['will'], h: 'haben', how: 'claim', he: true },
    { p: '{S} behauptet, dass sie nichts gewusst hat.', t: '{S} {M} nichts gewusst {H}.', m: ['will'], h: 'haben', how: 'claim', she: true },
    { p: '{S} behauptet, dass er krank war.', t: '{S} {M} krank gewesen {H}.', m: ['will'], h: 'sein', how: 'claim', he: true },
  ];
  const SUBJECTIVE_WHY = {
    sure: 'muss: the speaker is sure (= bestimmt).',
    possible: 'könnte or kann: it is possible (= vielleicht).',
    probable: 'dürfte or müsste: it is probable (= wahrscheinlich).',
    impossible: 'kann … nicht: it is impossible.',
    hearsay: 'soll: others say so (= man sagt, angeblich).',
    claim: 'will: the subject says so about themselves (= behauptet).',
  };

  // A person for {S}, as { text, noun? }: er / sie, or a grown-up from the deck. he / she: the template's "er" / "sie"
  // must match.
  function subjectivePerson(entry, source, rnd) {
    const nouns = nounSubjects(source).filter((n) => (entry.he ? n.g === 'm' : entry.she ? n.g === 'f' : n.g !== 'n'));
    if (nouns.length && rnd() < 0.5) {
      const noun = vocab.pickDue(nouns, rnd);
      return { text: vocab.withArticle(noun, 'nom'), noun };
    }
    return { text: entry.he ? 'er' : entry.she ? 'sie' : pick(['er', 'sie'], rnd) };
  }

  function subjectiveItem(source, rnd, recent) {
    const entry = pickFresh(SUBJECTIVE, recent, (e) => e.t, rnd);
    const who = entry.p.includes('{S}') ? subjectivePerson(entry, source, rnd) : { text: '' };
    const tokens = cloze.fillSlots(entry.t, {
      S: [who.text],
      M: [gapFor('modal', entry.m, 'modal verb', 'Modalverb')],
      H: entry.h && [gapFor('aux', [entry.h], 'haben or sein', 'haben / sein')],
    });
    const past = entry.h ? ` The past: Partizip II + ${entry.h} at the end (Infinitiv Perfekt).` : '';
    return {
      ...modalItem('subjektiv', tokens, `${SUBJECTIVE_WHY[entry.how]}${past}`, entry.t, vocab.notesOf(who.noun)),
      prompt: { label: 'Mit Modalverb', text: cloze.capitalize(entry.p.replace('{S}', who.text)) },
    };
  }

  // lassen + infinitive: having something done ("Ich lasse das Auto reparieren"); in the Perfekt, like a modal, the
  // infinitive lassen ("Ich habe das Auto reparieren lassen", not "gelassen").
  const LASSEN = [['das Auto', 'reparieren'], ['die Haare', 'schneiden'], ['den Anzug', 'reinigen'], ['die Wohnung', 'streichen'],
    ['die Heizung', 'prüfen'], ['das Essen', 'liefern'], ['einen Schlüssel', 'nachmachen'], ['die Fotos', 'ausdrucken'],
    ['ein Taxi', 'kommen'], ['den Fernseher', 'abholen']];
  const LASSEN_SUBJECTS = ['ich', 'du', 'du', 'er', 'sie', 'noun', 'wir', 'ihr'];
  function lassenItem(source, rnd, recent) {
    const [object, inf] = pickFresh(LASSEN, recent, (e) => e[1], rnd);
    const subj = subject(pick(LASSEN_SUBJECTS, rnd), source, rnd);
    const pi = PERSONS.indexOf(subj.person);
    if (rnd() < 0.4) {
      const tokens = capitalizeFirst([subj.text, ' ', gapFor('fin', personForms(verbs.verb('lassen').pres, pi, subj.ambiguous), 'lassen', 'lassen'), ` ${object} ${inf}.`]);
      return modalItem('lassen', tokens, `lassen + infinitive: someone else does it. lassen changes its vowel like fahren: du lässt, er lässt.`, inf,
        vocab.notesOf(subj.noun));
    }
    return perfectWithInfinitive('lassen', subj, 'lassen', `${object} ${inf}`, gapFor('modal', ['lassen'], 'lassen', 'lassen'),
      `With an infinitive, lassen behaves like a modal in the Perfekt: hat … ${inf} lassen (not "gelassen").`, inf);
  }

  // notes: the Anki notes of the deck's words in the sentence.
  function modalItem(kind, tokens, why, key, notes = []) {
    return {
      source: 'builtin', verb: key, tense: 'modal', tokens, notes,
      tags: [{ text: TENSE_LABELS.modal, cls: 't-modal' }, { text: kind, cls: 'plain' }],
      explain: why,
    };
  }


  // ---------- Konjunktiv I ----------

  // Reported speech: what someone said („Ich bin müde.") → "Meine Tante sagt, sie sei müde." Phrases with a word of the
  // speaker's own (mein, mir, uns) would change in reported speech too, so they are left out.
  const OWN_WORDS = /\b(mein|dein|unser|euer|mir|mich|dir|dich|uns|euch)\w*/;
  const SAYS = { '3sg': ['sagt', 'erzählt', 'meint', 'hat gesagt', 'sagte'], '3pl': ['sagen', 'erzählen', 'meinen', 'haben gesagt', 'sagten'] };

  // Things that happen at a moment, which nobody reports in the Präsens ("Er sagt, er breche sich das Bein").
  const EVENTS = new Set(['sterben', 'brechen', 'verbrennen', 'zusammenstoßen', 'fallen', 'ziehen', 'zerbrechen', 'verlieren', 'vergessen']);

  // perfect: entries for the Perfekt (any), else the Präsens (no events).
  function reportEntries(source, perfect = false) {
    // No mögen: its Konjunktiv II möchte means something else ("sie möchten keinen Fisch").
    return entriesWhere(source, (e) => !OWN_WORDS.test(e.rest) && verbs.konj1(e.verb) && baseInf(e.verb) !== 'mögen'
      && (perfect ? e.tenses.includes('perf') : !EVENTS.has(e.inf)));
  }

  // The speaker: a person from the deck (or built-in), now and then several; they are "ich" / "wir" in what they said
  // and er / sie / es / sie in the report.
  function speaker(source, rnd) {
    const s = subject('noun', source, rnd);
    return { ...s, own: s.person === '3pl' ? '1pl' : '1sg', pronoun: declension.THIRD_PERSON[s.person === '3pl' ? 'pl' : s.noun.g].nom };
  }

  function konj1Item(source, rnd, recent) {
    const perfect = rnd() < 0.4;
    const entry = vocab.pickDue(reportEntries(source, perfect), rnd, { recent, key: (e) => e.inf });
    const v = entry.verb;
    const who = speaker(source, rnd);
    // A time word only in the Perfekt: "Ich leide heute an Kopfschmerzen" sounds odd, "Ich habe gestern …" does not.
    const time = perfect && entry.time ? pick(TIMES.perf, rnd) : '';
    const middle = (pi) => [fillReflexive(entry.lead, pi), time, fillReflexive(entry.tail, pi).trim()].filter(Boolean).join(' ');
    const own = PERSONS.indexOf(who.own);
    const pi = PERSONS.indexOf(who.person);
    const aux = perfect ? verbs.verb(entry.aux || v.aux[0]) : null;
    const said = perfect
      ? [verbs.finite(aux, 'pres', who.own)[0], middle(own), v.pii[0]]
      : [verbs.finite(v, 'pres', who.own)[0], middle(own), v.particle];
    const report = verbs.reported(aux || v, who.person);
    const finite = gapFor('fin', report.forms, TENSE_LABELS.konj1, perfect ? 'haben / sein' : v.inf);
    // würde + infinitive: the infinitive goes to the end, and is a gap too (otherwise it gives the würde away).
    const end = perfect ? v.pii[0] : report.kind === 'wuerde' ? gapFor('inf', [v.inf], 'infinitive', v.inf) : v.particle;
    const tokens = [`${who.text} ${pick(SAYS[who.person], rnd)}, ${who.pronoun} `, finite, middle(pi) ? ` ${middle(pi)}` : '', end ? ' ' : '', end || '', '.']
      .filter((t) => t !== '');
    const prompt = { label: cloze.capitalize(who.text), text: `„${cloze.capitalize([who.own === '1sg' ? 'ich' : 'wir', ...said].filter(Boolean).join(' '))}.“` };
    return item(v, 'konj1', capitalizeFirst(tokens), prompt, 'builtin', vocab.notesOf(who.noun, entry), konj1Explain(aux || v, who, report, perfect));
  }

  function konj1Explain(v, who, report, perfect) {
    const form = report.forms[0];
    const head = perfect ? `Perfekt in reported speech: the auxiliary in the Konjunktiv I, the Partizip II stays. ` : '';
    const ind = verbs.finite(v, 'pres', who.person)[0];
    const k1 = verbs.konj1(v)?.[PERSONS.indexOf(who.person)][0];
    if (report.kind === 'konj1') {
      const rule = baseInf(v) === 'sein' ? 'sein is irregular: er sei, sie seien' : `the infinitive's stem + e: ${who.pronoun} ${form}`;
      return `${head}Indirekte Rede: Konjunktiv I — ${rule} (not "${ind}").`;
    }
    const same = `The Konjunktiv I "${who.pronoun} ${k1}" looks like the Indikativ`;
    if (report.kind === 'konj2') return `${head}${same}, so the Konjunktiv II takes over: ${who.pronoun} ${form}.`;
    return `${head}${same} and ${v.inf} has no Konjunktiv II in use, so würde + infinitive: ${who.pronoun} ${form} … ${v.inf}.`;
  }

  // ---------- Konjunktiv II ----------

  // {S} = the subject (one of `subj`), {K:verb} = its Konjunktiv II form (würde for werden), {P:verb} = Partizip II,
  // {A:verb} = the Konjunktiv II of the verb's auxiliary (hätte / wäre).
  const KONJ2_SENTENCES = [
    { t: '{K:können} {S} mir bitte helfen?', subj: ['du', 'ihr', 'Sie'], why: 'A polite request: könnte instead of kann.' },
    { t: '{K:haben} {S} kurz Zeit?', subj: ['du', 'ihr', 'Sie'], why: 'A polite question: hätte instead of hat.' },
    { t: '{K:werden} {S} bitte das Fenster schließen?', subj: ['du', 'ihr', 'Sie'], why: 'A polite request: würde + infinitive.' },
    { t: '{S} {K:mögen} einen Kaffee, bitte.', subj: ['ich', 'wir'], why: 'Ordering politely: möchte.' },
    { t: '{S} {K:sollen} mehr schlafen.', subj: ['du', 'er', 'sie', 'ihr', 'Sie'], why: 'Advice: sollte + infinitive.' },
    { t: 'Wenn {S} mehr Zeit {K:haben}, {K:werden} {S} öfter reisen.', subj: ['ich', 'du', 'er', 'sie', 'wir', 'ihr', 'siePl'], why: 'Unreal now: hätte in the wenn-clause, würde + infinitive for the result.' },
    { t: 'Wenn {S} reich {K:sein}, {K:werden} {S} ein Haus am Meer kaufen.', subj: ['ich', 'du', 'er', 'sie', 'wir', 'ihr', 'siePl'], why: 'Unreal now: wäre, and würde + infinitive for other verbs.' },
    { t: 'Wenn {S} die Antwort {K:wissen}, {K:werden} {S} es dir sagen.', subj: ['ich', 'er', 'sie', 'wir', 'siePl'], why: 'Unreal now: wüsste (wissen keeps its own form), würde + infinitive.' },
    { t: '{S} {K:sein} jetzt gern am Strand.', subj: ['ich', 'du', 'er', 'sie', 'wir', 'ihr', 'siePl'], why: 'A wish: wäre gern.' },
    { t: '{S} {K:haben} gern einen Hund.', subj: ['ich', 'du', 'er', 'sie', 'wir', 'ihr', 'siePl'], why: 'A wish: hätte gern.' },
    { t: 'An deiner Stelle {K:werden} {S} den Arzt anrufen.', subj: ['ich'], why: 'Advice: an deiner Stelle würde ich …' },
    { t: 'Wenn {S} früher {P:aufstehen} {A:aufstehen}, {A:verpassen} {S} den Zug nicht {P:verpassen}.', subj: ['ich', 'du', 'er', 'sie', 'wir', 'ihr', 'siePl'], why: 'Unreal past: wäre / hätte + Partizip II — aufstehen takes sein, verpassen haben.' },
    { t: 'Wenn {S} das {P:wissen} {A:wissen}, {A:kommen} {S} früher {P:kommen}.', subj: ['ich', 'du', 'er', 'sie', 'wir', 'ihr', 'siePl'], why: 'Unreal past: hätte / wäre + Partizip II — wissen takes haben, kommen sein.' },
    { t: '{S} {A:gehen} gern mit ins Kino {P:gehen}.', subj: ['ich', 'du', 'er', 'sie', 'wir', 'ihr', 'siePl'], why: 'A wish about the past: wäre + Partizip II (gehen takes sein).' },
    { t: '{S} {A:kaufen} das Auto fast {P:kaufen}.', subj: ['ich', 'du', 'er', 'sie', 'wir', 'ihr', 'siePl'], why: 'Almost happened: hätte + Partizip II.' },
  ];

  function konj2Item(rnd, recent) {
    const entry = pickFresh(KONJ2_SENTENCES, recent, (e) => e.t, rnd);
    const key = pick(entry.subj, rnd);
    const [pronoun, person] = SUBJECTS[key];
    const pi = PERSONS.indexOf(person);
    const ambiguous = AMBIGUOUS_SUBJECTS.has(key);
    const tokens = [];
    let last = 0;
    const re = /\{S\}|\{([KPA]):([a-zäöüß]+)\}/g;
    let m;
    while ((m = re.exec(entry.t))) {
      if (m.index > last) tokens.push(entry.t.slice(last, m.index));
      if (m[0] === '{S}') tokens.push(pronoun);
      else {
        const v = verbs.verb(m[2]);
        if (m[1] === 'K') tokens.push(gapFor('k2', personForms(v.konj2, pi, ambiguous), `Konjunktiv II of ${m[2]}`, m[2]));
        else if (m[1] === 'P') tokens.push(gapFor('pii', v.pii, 'Partizip II', m[2]));
        else tokens.push(gapFor('aux', personForms(verbs.verb(v.aux[0]).konj2, pi, ambiguous), 'hätte or wäre', 'haben / sein'));
      }
      last = re.lastIndex;
    }
    if (last < entry.t.length) tokens.push(entry.t.slice(last));
    return {
      source: 'builtin', verb: entry.t, tense: 'konj2', tokens: capitalizeFirst(tokens),
      tags: [{ text: TENSE_LABELS.konj2, cls: 't-konj2' }],
      explain: entry.why,
    };
  }

  // ---------- The deck ----------

  // The learner's verbs (learnt, hardest first) with their notes, once per verb, and the sentence entries of those
  // that have one, each with its verb's note; recomputed when the deck changes.
  let deckCache = { verbs: null, list: [], entries: [], items: new Map() };
  function deck() {
    if (deckCache.verbs !== vocab.verbs) {
      const seen = new Set();
      const list = vocab.learntVerbs
        .sort((a, b) => vocab.hardestFirst(a.note, b.note))
        .filter((x) => !seen.has(x.verb.inf) && seen.add(x.verb.inf));
      const entries = list.map((x) => {
        const entry = entryFor(x.verb); // a copy of its own, or none
        return entry && Object.assign(entry, { note: x.note });
      }).filter(Boolean);
      deckCache = { verbs: vocab.verbs, list, entries, items: new Map() };
    }
    return deckCache;
  }
  const deckVerbs = () => deck().list;

  // Auxiliaries and the verbs that are one: their Präsens / Präteritum in a sentence may belong to another verb.
  const AUXILIARIES = new Set(['haben', 'sein', 'werden']);
  const { CLAUSE_END } = cloze;
  const lower = (s) => s.toLowerCase();

  // The forms of a verb in a sentence (cloze.splitWords): the part indexes to gap with their slots, and the tense, or null.
  function findForms({ parts, words }, v, tenses) {
    const clauseOf = (i) => parts.slice(0, i).filter((p, k) => k % 2 === 0 && CLAUSE_END.test(p)).length;
    // A finite form: joined with the particle ("ankam") or the form with the particle closing the clause ("kam … an.").
    // Not the infinitive ("Kann ich mich umziehen?"), nor an imperative ("Störe sie nicht.").
    const imperative = (i) => i === words[0].i && !/\?\s*$/.test(parts.join(''));
    const finite = (forms) => {
      for (const { i, w } of words) {
        if (w === v.inf || imperative(i)) continue;
        if (v.particle && w.startsWith(v.particle) && forms.has(w.slice(v.particle.length))) return i;
        if (!forms.has(w)) continue;
        if (!v.particle) return i;
        const closes = (x) => x.i > i && x.w === v.particle && clauseOf(x.i) === clauseOf(i) && CLAUSE_END.test(parts[x.i + 1] || '.');
        if (words.some(closes)) return i;
      }
      return -1;
    };
    const set = (lists) => new Set(lists.flat(Infinity).map(lower));
    const pii = set([v.pii]);
    const pres = set(v.pres);
    const pret = set(v.pret);
    const konj2 = v.konj2 ? set(v.konj2) : new Set();

    if (tenses.includes('perf') || tenses.includes('plusq')) {
      const p = words.find((x) => pii.has(x.w));
      // "ist … gefahren worden" is the passive, not the Perfekt.
      if (p && words.some((x) => x.w === 'worden' && clauseOf(x.i) === clauseOf(p.i))) return null;
      if (p) {
        const auxPres = set(v.aux.map((a) => verbs.verb(a).pres));
        const auxPret = set(v.aux.map((a) => verbs.verb(a).pret));
        // The auxiliary of the same clause closest to the participle ("Er hat … geschickt und sie haben … geantwortet").
        const a = words
          .filter((x) => x.i !== p.i && clauseOf(x.i) === clauseOf(p.i) && (auxPres.has(x.w) || auxPret.has(x.w)))
          .sort((x, y) => Math.abs(x.i - p.i) - Math.abs(y.i - p.i))[0];
        if (!a) return null; // a Partizip II without its auxiliary: passive or an adjective
        // With the Perfekt chosen, the deck's Plusquamperfekt counts too (it is the same drill); alone, only itself — a
        // Perfekt sentence then goes on to the other chosen tenses.
        const tense = auxPres.has(a.w) ? 'perf' : 'plusq';
        if (tense === 'plusq' || tenses.includes('perf')) return { tense, gaps: [{ i: a.i, slot: 'aux' }, { i: p.i, slot: 'pii' }] };
      }
    }
    const without = (a, ...others) => new Set([...a].filter((f) => !others.some((o) => o.has(f)) && f !== v.inf));
    if (tenses.includes('konj2') && konj2.size) {
      const i = finite(without(konj2, pret, pres));
      if (i >= 0) return { tense: 'konj2', gaps: [{ i, slot: 'k2' }] };
    }
    if (AUXILIARIES.has(v.inf)) return null;
    if (tenses.includes('praet')) {
      // sollte is Präteritum and Konjunktiv II alike, so it drops out here (mostly it is advice: "du solltest …").
      const i = finite(without(pret, pres, pii, konj2));
      if (i >= 0) return { tense: 'praet', gaps: [{ i, slot: 'fin' }] };
    }
    if (tenses.includes('praes')) {
      const i = finite(without(pres, pret, pii));
      if (i >= 0) return { tense: 'praes', gaps: [{ i, slot: 'fin' }] };
    }
    return null;
  }

  const SLOT_LABELS = { aux: 'auxiliary', pii: 'Partizip II', fin: 'verb', k2: 'Konjunktiv II' };

  // The deck's example sentences with a form of their verb, as items (at most one per sentence) that name their note;
  // kept per tense choice.
  function deckItems(tenses) {
    const { list, items: memo } = deck();
    const key = tenses.join();
    if (memo.has(key)) return memo.get(key);
    const items = [];
    for (const { note, verb: v } of list) {
      for (const ex of note.examples) {
        const split = cloze.splitWords(clean(ex.de));
        const found = findForms(split, v, tenses);
        if (!found) continue;
        const tokens = split.parts.map((p, i) => {
          const g = found.gaps.find((x) => x.i === i);
          if (!g) return p;
          return { ...wordGap(g.slot, p, SLOT_LABELS[g.slot]), placeholder: g.slot === 'aux' ? 'haben / sein' : v.inf };
        }).filter((t) => t !== '');
        const en = clean(ex.en);
        items.push(item(v, found.tense, tokens, en ? { label: 'English', text: en } : null, 'anki', [note]));
      }
    }
    memo.set(key, items);
    return items;
  }

  // ---------- Items ----------

  // The rule of each tense with a Partizip II.
  const COMPOUND_RULES = {
    perf: 'Perfekt: haben / sein + Partizip II',
    plusq: 'Plusquamperfekt: hatte / war + Partizip II (the past before the past; nachdem + Plusquamperfekt, then Präteritum)',
    fut2: 'Futur II: werden … Partizip II + haben / sein (done by then, or with "wohl" a guess about the past)',
  };

  function explain(v, tense) {
    const parts = principalParts(v);
    if (tense === 'praes') {
      const rule = irregularPresent(v) ? `Präsens: ${baseInf(v)} is irregular (${irregularPresent(v).slice(0, 3).join(', ')} …).`
        : changesStem(v) ? 'Präsens: the stem changes in the du and er / sie / es forms only.' : 'Präsens: stem + -e, -st, -t, -en, -t, -en.';
      return `${parts}. ${rule}`;
    }
    if (tense === 'praet') {
      return `${parts}. Präteritum: ich and er / sie / es have the same form (ich ${v.pret[0][0]})${strong(v) ? ' — no ending' : ''}.`;
    }
    if (tense === 'konj2') return `${parts}. Konjunktiv II: ${v.konj2?.[2][0] || 'würde + infinitive'}.`;
    if (tense === 'fut1') return `${parts}. Futur I: werden + infinitive (wird ${v.inf}).`;
    return `${parts}. ${COMPOUND_RULES[tense]} — ${verbs.auxNote(v)}.`;
  }

  // notes: the Anki notes of the deck's words in the sentence (a deck sentence's own note; a noun subject's, a verb entry's).
  // why: the explanation, unless the verb and tense give it (the Imperativ and Konjunktiv I explain it with the person).
  function item(v, tense, tokens, prompt, source, notes = [], why = explain(v, tense)) {
    const tags = [{ text: TENSE_LABELS[tense], cls: `t-${tense}` }, { text: v.inf, cls: 'plain' }];
    if (source === 'anki') tags.push(vocab.ANKI_TAG);
    return { source, verb: v.inf, verbData: v, tense, tokens, ...(prompt && { prompt }), tags, explain: why, notes };
  }

  // The tenses with their own sentences; the others are the built-in verbs in a main clause (verbItem).
  const OWN_ITEMS = {
    konj2: (source, rnd, recent) => konj2Item(rnd, recent),
    imp: (source, rnd, recent) => impItem(rnd, recent),
    modal: (source, rnd, recent) => {
      const r = rnd();
      return (r < 0.45 ? ersatzItem : r < 0.8 ? subjectiveItem : lassenItem)(source, rnd, recent);
    },
    konj1: konj1Item,
  };

  // Half the round (or what there is) from the deck's sentences when the Anki option is on — of the verbs due soon and
  // hard most often, see vocab.deckShare; built-in sentences for the rest.
  function buildRound(settings, rnd = Math.random) {
    const source = settings.vocab || 'builtin';
    const mine = source === 'anki' ? vocab.deckShare(deckItems(settings.tenses), settings.length, rnd) : [];
    const recent = [];
    const items = [...mine];
    let queue = [];
    while (items.length < settings.length) {
      if (!queue.length) queue = shuffle(settings.tenses, rnd);
      const tense = queue.shift();
      const make = OWN_ITEMS[tense] || ((s, r, rec) => verbItem(tense, s, r, rec));
      const it = make(source, rnd, recent);
      remember(recent, it.verb, 6);
      items.push(it);
    }
    return shuffle(items, rnd);
  }

  // ---------- Tables ----------

  // The principal parts of the round's verbs (the deck's first), in the chosen tenses.
  function partsTable(settings, items, rnd = Math.random) {
    const cols = settings.tenses.filter((t) => PART_TENSES.includes(t));
    const blocks = [];
    if (cols.length) {
      const fromItems = items.filter((i) => i.verbData).map((i) => i.verbData);
      const rows = [];
      for (const v of [...fromItems.filter((x) => x.irregular), ...shuffle(BUILTIN_IRREGULAR, rnd)]) {
        if (rows.length >= 8) break;
        if (!rows.some((r) => r.inf === v.inf)) rows.push(v);
      }
      blocks.push(stammformen(rows, cols));
    }
    // The whole Konjunktiv of sein, haben, werden and können, by person.
    const KS = ['sein', 'haben', 'werden', 'können'];
    const konjBlock = (tense, title, sub, formsOf) => ({
      title, sub, rows: verbs.PERSON_LABELS, cols: KS.map((k) => ({ head: k, cls: `t-${tense}` })), answers: KS.map((k) => formsOf(verbs.verb(k))),
    });
    if (settings.tenses.includes('konj2')) blocks.push(konjBlock('konj2', 'Konjunktiv II', 'wäre · hätte · würde · könnte', (v) => v.konj2));
    if (settings.tenses.includes('konj1')) blocks.push(konjBlock('konj1', 'Konjunktiv I', 'er sei · er habe · er werde · er könne', verbs.konj1));
    if (settings.tenses.some((t) => t === 'fut1' || t === 'fut2')) {
      blocks.push({
        title: 'werden', sub: 'Futur: werden + infinitive', rows: verbs.PERSON_LABELS,
        cols: [{ head: 'Präsens', sub: 'ich werde', cls: 't-fut1' }], answers: [verbs.verb('werden').pres],
      });
    }
    if (settings.tenses.includes('modal')) {
      const rows = [...MODALS, 'lassen'];
      const modals = rows.map((m) => verbs.verb(m));
      blocks.push({
        title: 'Modalverben und lassen', sub: 'er / sie / es',
        rows,
        cols: [{ head: 'Präsens', sub: 'er kann', cls: 't-praes' }, { head: 'Präteritum', sub: 'er konnte', cls: 't-praet' },
          { head: 'Konjunktiv II', sub: 'er könnte', cls: 't-konj2' }],
        answers: ['pres', 'pret', 'konj2'].map((t) => modals.map((v) => v[t][2])),
      });
    }
    return {
      title: 'Verb forms from memory',
      lead: 'Type each form; for the Perfekt, the auxiliary and the Partizip II (ist gefahren).',
      wide: true,
      blocks,
    };
  }

  // ---------- Topic ----------

  function status(settings) {
    return vocab.deckStatus(settings, () => {
      const count = deckVerbs().length;
      if (!count) return 'None of your learnt verbs could be read yet, so the built-in ones are used.';
      const sentences = deckItems(settings.tenses).length;
      return `Using ${count} learnt verbs from your Anki deck (${sentences} of their example sentences fit these tenses) — those due soon and hard most often — and built-in ones for the rest.`;
    }, 'verbs');
  }

  // n sentences in the settings' scope, for a round here (its table takes the same ones) and for the Daily review.
  const sentences = (settings, n, rnd = Math.random) => drillStep(buildRound({ ...settings, length: n }, rnd));

  function steps(settings, rnd) {
    const drill = sentences(settings, settings.length, rnd);
    return [{ type: 'table', label: 'Verb forms', table: partsTable(settings, drill.items, rnd) }, drill];
  }

  return {
    id: 'verbforms',
    title: 'Verbformen',
    subtitle: 'Präsens, Präteritum, Perfekt, Konjunktiv I and II, Imperativ and Modalverben — fährt, fuhr, ist gefahren, würde fahren, fahr!, hat fahren müssen, er sagt, er fahre',
    intro: vocab.intro('Write the principal parts of the round\'s verbs, then the verb forms in sentences: the vowel change in the Präsens, the Präteritum, haben or sein in the Perfekt, the Plusquamperfekt and Futur, the Konjunktiv II, the Imperativ, the modal verbs and lassen (hat arbeiten müssen; er muss krank sein; hat das Auto reparieren lassen) and the Konjunktiv I of reported speech (er sagt, er sei krank). "My irregular verbs" goes through all your learnt irregular verbs, eight a round: their forms first, then two sentences each.', null, status),
    defaults: { tenses: ['praes', 'praet', 'perf'], vocab: 'anki', length: 10 },
    prepare: vocab.prepare,
    options: [
      {
        key: 'tenses', label: 'Tenses', type: 'checkboxes', min: 1, choices: [
          { value: 'praes', label: 'Präsens', detail: 'du fährst, er nimmt — the stem change' },
          { value: 'praet', label: 'Präteritum', detail: 'ich fuhr, sie nahm, er dachte' },
          { value: 'perf', label: 'Perfekt', detail: 'ist gefahren, hat genommen' },
          { value: 'plusq', label: 'Plusquamperfekt', detail: 'war gefahren, hatte genommen · nachdem er gegessen hatte, …' },
          { value: 'fut1', label: 'Futur I', detail: 'wird fahren, werden anrufen' },
          { value: 'fut2', label: 'Futur II', detail: 'wird gefahren sein, wird es wohl vergessen haben' },
          { value: 'konj2', label: 'Konjunktiv II', detail: 'wäre, hätte, könnte, würde fahren; hätte gemacht' },
          { value: 'imp', label: 'Imperativ', detail: 'nimm!, lies!, fahr!, sei!, ruf mich an!' },
          { value: 'modal', label: 'Modalverben', detail: 'hat arbeiten müssen · er muss krank sein · sie könnte es vergessen haben · lässt das Auto reparieren' },
          { value: 'konj1', label: 'Konjunktiv I', detail: 'reported speech: er sagt, er sei krank · sie sagen, sie hätten keine Zeit' },
        ],
      },
      {
        key: 'vocab', label: 'Verbs', type: 'radio', choices: [
          { value: 'anki', label: 'My Anki verbs', detail: 'learnt verbs and their example sentences, built-in ones for the rest' },
          { value: 'builtin', label: 'Built-in' },
        ],
      },
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
      { label: 'My irregular verbs', build: (settings, rnd = Math.random) => myVerbsSteps(settings, rnd) },
      { label: 'Verb forms only', build: (settings, rnd = Math.random) => [steps(settings, rnd)[0]] },
    ],

    TENSES, BUILTIN, KONJ2_SENTENCES,
    buildRound, verbItem, konj2Item, impItem, ersatzItem, subjectiveItem, lassenItem, modalEntries, SUBJECTIVE, konj1Item, reportEntries, IMPERATIVES, deckItems, deckVerbs, findForms, partsTable, changesStem,
    PHRASES, REFLEXIVE_PHRASES, entryFor, sentence, irregularVerbs, nextVerbs, myVerbsTable, myVerbsSentences,
  };
});
