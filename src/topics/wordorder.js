// Topic: Satzstellung — where the finite verb goes: last in a subordinate clause (weil ich krank bin), right after an
// adverb in position 1 (deshalb bleibe ich), unchanged after und / aber / denn (denn ich bin krank), and first in a main
// clause that follows a subordinate one (Wenn es regnet, bleibe ich zu Hause); also a modal in the Perfekt of a subordinate
// clause (weil er hat arbeiten müssen), zu + infinitive at the end (um … zu, ohne … zu, statt … zu; anzurufen), and
// je … desto; the middle field (te-ka-mo-lo, pronouns first) and where nicht goes. Each sentence shows the verb (or the
// word to place) and two gaps — its place and the usual wrong one; it is typed into one, the other stays empty.
// Two-part connectors (sowohl … als auch), nicht or kein, and als / wenn / wann, aber / sondern, seit / seitdem are typed
// into the sentence instead.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/cloze.js'), require('../core/declension.js'), require('../core/lexicon.js'),
      require('../core/vocab.js'), require('../core/verbs.js'));
  } else {
    root.Etudes.topics.push(factory(root.Etudes.cloze, root.Etudes.declension, root.Etudes.lexicon, root.Etudes.vocab, root.Etudes.verbs));
  }
})(globalThis, function (cloze, declension, lexicon, vocab, verbs) {
  'use strict';

  const { wordGap, pick, pickFresh, remember, shuffle, capitalizeFirst, clean, splitWords, CLAUSE_END } = cloze;

  const GROUPS = ['sub', 'adv', 'coord', 'modal', 'inf', 'je', 'paired', 'mittel', 'nicht', 'conj'];
  const GROUP_LABELS = {
    sub: 'Nebensätze', adv: 'Adverbs in position 1', coord: 'und, aber, oder, denn', modal: 'Modalverb im Nebensatz',
    inf: 'zu-Infinitiv', je: 'je … desto', paired: 'Zweiteilige Konnektoren', mittel: 'Mittelfeld', nicht: 'nicht / kein',
    conj: 'als / wenn / wann · aber / sondern · seit',
  };

  // ---------- Built-in sentences ----------

  // A clause: subject, finite verb, middle, and the verb parts that close it (particle, infinitive, Partizip II).
  const c = (s, v, mid = '', end = '') => ({ s, v, mid, end });

  // Pairs of clauses that go together, by how: x is the reason for y; x happens although y; when x, y.
  const REASONS = [
    [c('ich', 'bin', 'krank'), c('ich', 'bleibe', 'heute zu Hause')],
    [c('der Bus', 'kommt', 'nicht'), c('wir', 'nehmen', 'ein Taxi')],
    [c('sie', 'möchte', 'in Berlin', 'arbeiten'), c('sie', 'lernt', 'jeden Tag Deutsch')],
    [c('er', 'hat', 'schlecht', 'geschlafen'), c('er', 'ist', 'heute müde')],
    [c('ich', 'muss', 'lange', 'arbeiten'), c('ich', 'trinke', 'noch einen Kaffee')],
    [c('wir', 'haben', 'den Zug', 'verpasst'), c('wir', 'kommen', 'zu spät')],
    [c('du', 'hast', 'dein Zimmer nicht', 'aufgeräumt'), c('du', 'bekommst', 'kein Eis')],
    [c('es', 'ist', 'heute kalt'), c('er', 'zieht', 'eine warme Jacke', 'an')],
    [c('ich', 'habe', 'kein Geld mehr'), c('ich', 'kaufe', 'heute nichts')],
    [c('meine Mutter', 'hat', 'morgen', 'Geburtstag'), c('wir', 'backen', 'einen Kuchen')],
  ];
  const CONTRASTS = [
    [c('es', 'regnet', 'heute'), c('wir', 'gehen', 'im Park', 'spazieren')],
    [c('ich', 'bin', 'sehr müde'), c('ich', 'gehe', 'heute Abend', 'aus')],
    [c('er', 'hat', 'viel', 'gelernt'), c('er', 'hat', 'die Prüfung nicht', 'bestanden')],
    [c('das Wetter', 'ist', 'schlecht'), c('sie', 'fährt', 'mit dem Fahrrad zur Arbeit')],
    [c('die Wohnung', 'ist', 'sehr teuer'), c('wir', 'nehmen', 'sie')],
    [c('sie', 'kann', 'gut', 'kochen'), c('sie', 'isst', 'oft im Restaurant')],
  ];
  const TIMES = [
    [c('ich', 'komme', 'nach Hause'), c('ich', 'koche', 'etwas')],
    [c('die Sonne', 'scheint', 'am Wochenende'), c('wir', 'fahren', 'an den See')],
    [c('er', 'hat', 'Zeit'), c('er', 'liest', 'ein Buch')],
    [c('du', 'bist', 'fertig'), c('wir', 'fahren', 'sofort', 'los')],
    [c('das Baby', 'schläft', 'endlich'), c('wir', 'sehen', 'einen Film')],
  ];
  // Main clauses that take a dass- or ob-clause.
  const CONTENT = [
    ['Ich glaube, dass', '.'], ['Er sagt, dass', '.'], ['Ich hoffe, dass', '.'],
    ['Ich weiß nicht, ob', '.'], ['Weißt du, ob', '?'], ['Sie fragt, ob', '.'],
  ];

  // How each connector orders the clause after it.
  //   sub: subordinate (verb last); adv: takes position 1 (verb next, then the subject); coord: no effect (subject, verb).
  const CONNECTORS = {
    weil: { type: 'sub', pairs: REASONS, order: 'yx' }, obwohl: { type: 'sub', pairs: CONTRASTS, order: 'yx' },
    wenn: { type: 'sub', pairs: TIMES, order: 'yx' },
    deshalb: { type: 'adv', pairs: REASONS, order: 'xy' }, deswegen: { type: 'adv', pairs: REASONS, order: 'xy' },
    darum: { type: 'adv', pairs: REASONS, order: 'xy' }, trotzdem: { type: 'adv', pairs: CONTRASTS, order: 'xy' },
    dann: { type: 'adv', pairs: TIMES, order: 'xy' },
    denn: { type: 'coord', pairs: REASONS, order: 'yx' }, aber: { type: 'coord', pairs: CONTRASTS, order: 'xy' },
  };
  // Subordinate clauses that can come first, with the main clause starting with its verb.
  const FRONTED = { weil: REASONS, obwohl: CONTRASTS, wenn: TIMES };

  // Subordinate clauses with a modal in the Perfekt: [main clause, connector, subject, haben-form, middle, infinitive, modal,
  // end] — the auxiliary goes before the two infinitives ("…, weil sie länger hat arbeiten müssen").
  const MODAL_PERFECT = [
    ['Sie ist nicht gekommen', 'weil', 'sie', 'hat', 'länger', 'arbeiten', 'müssen'],
    ['Er ist sauer', 'weil', 'er', 'hat', 'nicht', 'mitkommen', 'dürfen'],
    ['Es tut mir leid', 'dass', 'ich', 'habe', 'dich nicht', 'anrufen', 'können'],
    ['Ich weiß nicht', 'ob', 'sie', 'hat', 'den Zug noch', 'erreichen', 'können'],
    ['Wir sind müde', 'weil', 'wir', 'haben', 'so früh', 'aufstehen', 'müssen'],
    ['Er erzählt', 'dass', 'er', 'hat', 'als Kind nie', 'fernsehen', 'dürfen'],
    ['Sie ist froh', 'dass', 'sie', 'hat', 'endlich nach Hause', 'gehen', 'dürfen'],
    ['Ich verstehe nicht', 'warum', 'du', 'hast', 'so lange', 'warten', 'müssen'],
    ['Er ärgert sich', 'weil', 'er', 'hat', 'das Spiel nicht', 'sehen', 'können'],
    ['Weißt du', 'ob', 'er', 'hat', 'sein Auto', 'verkaufen', 'wollen', '?'],
    ['Ich bin traurig', 'weil', 'ich', 'habe', 'nicht zur Party', 'gehen', 'können'],
    ['Sie sagt', 'dass', 'sie', 'hat', 'am Wochenende', 'arbeiten', 'müssen'],
    ['Er ist zufrieden', 'weil', 'er', 'hat', 'sein Auto', 'reparieren', 'lassen'],
    ['Sie ist froh', 'dass', 'sie', 'hat', 'die Heizung', 'prüfen', 'lassen'],
  ];

  // Infinitive clauses: [main clause, um / ohne / statt or '', middle, infinitive] — zu + infinitive at the end.
  const ZU_CLAUSES = [
    ['Ich habe vergessen', '', 'dich', 'anrufen'], ['Es ist schwer', '', 'früh', 'aufstehen'],
    ['Sie hat keine Lust', '', 'heute ins Kino', 'gehen'], ['Er versucht', '', 'jeden Tag ein bisschen Deutsch', 'lernen'],
    ['Wir haben beschlossen', '', 'nach Berlin', 'umziehen'], ['Vergiss nicht', '', 'die Tür', 'abschließen', '!'],
    ['Ich habe keine Zeit', '', 'die Wohnung', 'aufräumen'], ['Es macht Spaß', '', 'mit Freunden', 'kochen'],
    ['Er hat versprochen', '', 'morgen', 'vorbeikommen'], ['Hast du Lust', '', 'heute Abend', 'fernsehen', '?'],
    ['Ich lerne Deutsch', 'um', 'in Wien', 'arbeiten'], ['Sie spart Geld', 'um', 'ein Auto', 'kaufen'],
    ['Er geht früh ins Bett', 'um', 'morgen fit', 'sein'], ['Wir stehen früh auf', 'um', 'den ersten Zug', 'nehmen'],
    ['Er ist gegangen', 'ohne', 'sich', 'verabschieden'], ['Sie hat das Auto gekauft', 'ohne', 'eine Probefahrt', 'machen'],
    ['Er ist über die Straße gegangen', 'ohne', 'nach links', 'schauen'],
    ['Er sieht fern', 'statt', 'seine Hausaufgaben', 'machen'], ['Wir nehmen ein Taxi', 'statt', 'zu Fuß', 'gehen'],
    ['Sie schreibt eine E-Mail', 'statt', 'ihn', 'anrufen'],
  ];
  const ZU_RULES = {
    '': 'An infinitive clause: zu + infinitive goes to the end.',
    um: 'um … zu: what for (purpose) — zu + infinitive at the end.',
    ohne: 'ohne … zu: without doing it — zu + infinitive at the end.',
    statt: 'statt … zu: instead of doing it — zu + infinitive at the end.',
  };

  // je + comparative … verb last; desto + comparative + verb + subject: [je clause words, desto clause words].
  const JE_DESTO = [
    [['mehr', 'du', 'übst'], ['besser', 'sprichst', 'du', 'Deutsch']],
    [['älter', 'er', 'wird'], ['ruhiger', 'wird', 'er']],
    [['länger', 'ich', 'warte'], ['nervöser', 'werde', 'ich']],
    [['früher', 'wir', 'losfahren'], ['eher', 'sind', 'wir', 'da']],
    [['mehr', 'sie', 'arbeitet'], ['müder', 'ist', 'sie', 'am Abend']],
    [['schneller', 'du', 'fährst'], ['gefährlicher', 'ist', 'es']],
    [['später', 'es', 'wird'], ['leerer', 'sind', 'die Straßen']],
    [['mehr', 'ich', 'lese'], ['mehr', 'verstehe', 'ich']],
    [['wärmer', 'es', 'ist'], ['lieber', 'gehe', 'ich', 'schwimmen']],
    [['öfter', 'wir', 'uns', 'sehen'], ['besser', 'verstehen', 'wir', 'uns']],
  ];

  // Two-part connectors: the plain sentence, and the one to write ({A} / {B}: the connector's parts, {V}: the verb, which
  // agrees with both subjects after sowohl … als auch, with the nearer one after entweder … oder, either way after weder … noch).
  const PAIRED = [
    { plain: 'Ich spreche Deutsch und Englisch.', t: 'Ich spreche {A} Deutsch {B} Englisch.', pair: 'both' },
    { plain: 'Sie spielt Klavier und Gitarre.', t: 'Sie spielt {A} Klavier {B} Gitarre.', pair: 'both' },
    { plain: 'Anna und Tom kommen beide zur Party.', t: '{A} Anna {B} Tom {V} zur Party.', pair: 'both', v: ['kommen'] },
    { plain: 'Ich trinke keinen Kaffee und keinen Tee.', t: 'Ich trinke {A} Kaffee {B} Tee.', pair: 'neither' },
    { plain: 'Er hat keine Zeit und kein Geld.', t: 'Er hat {A} Zeit {B} Geld.', pair: 'neither' },
    { plain: 'Anna kommt nicht, und Tom kommt auch nicht.', t: '{A} Anna {B} Tom {V} zur Party.', pair: 'neither', v: ['kommt', 'kommen'] },
    { plain: 'Wir fahren mit dem Zug oder mit dem Auto – eins von beiden.', t: 'Wir fahren {A} mit dem Zug {B} mit dem Auto.', pair: 'either' },
    { plain: 'Anna oder Tom holt dich ab – einer von beiden.', t: '{A} Anna {B} Tom {V} dich ab.', pair: 'either', v: ['holt'] },
    { plain: 'Er ist klug und außerdem sehr nett.', t: 'Er ist {A} klug, {B} sehr nett.', pair: 'notOnly' },
    { plain: 'Sie spricht Spanisch und dazu auch noch Chinesisch.', t: 'Sie spricht {A} Spanisch, {B} Chinesisch.', pair: 'notOnly' },
  ];
  const PAIRS = {
    both: { a: 'sowohl', b: 'als auch', why: 'sowohl … als auch = both … and; with two subjects the verb is plural.' },
    neither: { a: 'weder', b: 'noch', why: 'weder … noch = neither … nor — it replaces nicht / kein; the verb agrees with the nearer subject or is plural.' },
    either: { a: 'entweder', b: 'oder', why: 'entweder … oder = either … or; the verb agrees with the nearer subject.' },
    notOnly: { a: 'nicht nur', b: 'sondern auch', why: 'nicht nur …, sondern auch = not only … but also (comma before sondern).' },
  };

  // Infinitives without zu: after modals, lassen, werden, sehen / hören, gehen and bleiben ([main clause, middle, infinitive]).
  const NO_ZU = [
    ['Ich muss', 'morgen früh', 'aufstehen'], ['Wir lassen', 'das Auto', 'reparieren'], ['Ich höre', 'die Kinder im Garten', 'spielen'],
    ['Sie sieht', 'ihn über die Straße', 'kommen'], ['Er geht', 'jeden Abend', 'schwimmen'], ['Wir bleiben', 'noch ein bisschen', 'sitzen'],
    ['Du sollst', 'nicht so viel', 'arbeiten'], ['Ich werde', 'dich morgen', 'anrufen'], ['Kannst du', 'mir bitte', 'helfen', '?'],
    ['Er möchte', 'nächstes Jahr nach Berlin', 'umziehen'],
  ];

  // The middle field: the head (subject and verb), the parts in their order, the end (the verb's second part). The drilled
  // part's wrong place: a pronoun at the end, as in English; place first, before time. (Time itself moves too freely —
  // "dein Auto morgen", "vor dem Kino um acht" are fine — to be drilled this way.)
  //   T time, K reason, M manner, L place (te-ka-mo-lo); P a pronoun object (right after the verb); O a noun object.
  const MITTEL = [
    { head: 'Ich fahre', parts: [['T', 'morgen'], ['K', 'wegen des Streiks'], ['M', 'mit dem Rad'], ['L', 'zur Arbeit']] },
    { head: 'Wir gehen', parts: [['T', 'heute Abend'], ['M', 'zu Fuß'], ['L', 'ins Kino']] },
    { head: 'Sie ist', parts: [['T', 'gestern'], ['K', 'wegen der Hitze'], ['M', 'mit dem Zug'], ['L', 'nach Hamburg']], end: 'gefahren' },
    { head: 'Er arbeitet', parts: [['T', 'seit Montag'], ['M', 'allein'], ['L', 'im Büro']] },
    { head: 'Ich habe', parts: [['T', 'am Wochenende'], ['K', 'aus Langeweile'], ['L', 'im Keller']], end: 'gearbeitet' },
    { head: 'Wir treffen', parts: [['P', 'uns'], ['T', 'um acht'], ['L', 'vor dem Kino']] },
    { head: 'Gibst du', parts: [['P', 'es'], ['O', 'deiner Schwester']], stop: '?' },
    { head: 'Ich habe', parts: [['P', 'ihr'], ['T', 'gestern'], ['O', 'eine E-Mail']], end: 'geschrieben' },
    { head: 'Kannst du', parts: [['P', 'mir'], ['T', 'morgen'], ['O', 'dein Auto']], end: 'leihen', stop: '?' },
    { head: 'Wir zeigen', parts: [['P', 'ihn'], ['O', 'unseren Gästen']] },
    { head: 'Sie ruft', parts: [['P', 'mich'], ['T', 'heute Abend']], end: 'an' },
  ];
  const MITTEL_RULES = {
    L: { label: 'Ort', why: 'Place comes late in the middle field — te-ka-mo-lo: temporal, kausal, modal, lokal — after time, reason and manner.' },
    P: { label: 'Pronomen', why: 'Pronouns come right after the verb (and the subject), before nouns and adverbs.' },
  };

  // Where nicht goes: [the sentence with {N} for nicht and {X} for the usual wrong place, why].
  const NICHT = [
    ['Ich habe den Film {N} gesehen {X}.', 'nicht goes before the second verb part (the Partizip II).'],
    ['Er ruft mich heute {N} an {X}.', 'nicht goes before the separable particle.'],
    ['Wir können morgen {N} kommen {X}.', 'nicht goes before the infinitive at the end.'],
    ['Ich kenne {X} den Mann {N}.', 'nicht comes after a definite object (den Mann).'],
    ['Sie ist {N} krank {X}.', 'nicht goes before a predicative adjective (krank).'],
    ['Er wohnt {N} in Berlin {X}.', 'nicht goes before a place that belongs to the verb (wohnen in).'],
    ['Das Essen schmeckt {X} mir {N}.', 'nicht comes after a pronoun object.'],
    ['Ich verstehe {X} das {N}.', 'nicht comes after das and other pronouns.'],
    ['Warum hast du mich {N} angerufen {X}?', 'nicht goes before the Partizip II.'],
    ['Er fährt {N} mit dem Bus {X}.', 'nicht goes before the adverbial of manner (mit dem Bus).'],
  ];
  // nicht or kein: [the sentence, with {0} for the noun phrase], the noun's case; kein for a noun with ein or no article,
  // nicht for a definite one.
  // cats: the nouns that fit ("Ich sehe Tee" does not).
  const NEGATE = [['Ich habe {0}.', 'acc', ['thing', 'food', 'animal']], ['Wir brauchen {0}.', 'acc', ['thing', 'food']],
    ['Ich sehe {0}.', 'acc', ['thing', 'animal']], ['Hier {ist|sind} {0}.', 'nom', ['thing', 'animal']]];

  // Connectors that are easily mixed up: {C} = the gap (cap: it starts a sentence); the gap shows the choice (CHOICE_SETS).
  const CHOICES = [
    { t: '{C} ich ein Kind war, wohnten wir in Hamburg.', a: 'als', why: 'Once, or one period, in the past: als.' },
    { t: '{C} wir in Berlin ankamen, war es schon dunkel.', a: 'als', why: 'Once, in the past: als.' },
    { t: '{C} ich nach Hause komme, koche ich zuerst einen Tee.', a: 'wenn', why: 'Every time it happens, or now / in the future: wenn.' },
    { t: 'Immer {C} es regnete, blieben wir zu Hause.', a: 'wenn', why: 'Repeated in the past (immer wenn): wenn, not als.' },
    { t: '{C} du Zeit hast, ruf mich an.', a: 'wenn', alts: ['falls'], why: 'A condition: wenn (or falls).' },
    { t: 'Weißt du, {C} der Zug kommt?', a: 'wann', why: 'A question about the time, also an indirect one: wann.' },
    { t: 'Ich frage mich, {C} sie endlich anruft.', a: 'wann', why: 'An indirect question about the time: wann.' },
    { t: 'Das ist nicht mein Auto, {C} das meines Bruders.', a: 'sondern', why: 'After nicht / kein, the correction: sondern.' },
    { t: 'Er trinkt keinen Kaffee, {C} Tee.', a: 'sondern', why: 'After nicht / kein, the correction: sondern.' },
    { t: 'Wir fahren nicht mit dem Auto, {C} mit dem Zug.', a: 'sondern', why: 'After nicht / kein, the correction: sondern.' },
    { t: 'Die Wohnung ist klein, {C} sehr schön.', a: 'aber', why: 'A contrast, no negation corrected: aber.' },
    { t: 'Er trinkt keinen Kaffee, {C} er isst gern Kuchen.', a: 'aber', why: 'A negation, but nothing is corrected — something is added: aber.' },
    { t: '{C} ich in Berlin wohne, fahre ich nur noch Fahrrad.', a: 'seit', alts: ['seitdem'], why: 'As a connector, seit or seitdem.' },
    { t: 'Ich wohne {C} drei Jahren in Berlin.', a: 'seit', why: 'Before a noun only the preposition seit (+ Dativ).' },
    { t: 'Er hatte einen Unfall. {C} fährt er nicht mehr Auto.', a: 'seitdem', cap: true, why: 'As an adverb (since then), only seitdem.' },
  ];
  const CHOICE_SETS = Object.fromEntries(['als / wenn / wann', 'aber / sondern', 'seit / seitdem'].flatMap((set) => set.split(' / ').map((w) => [w, set])));

  const words = (...parts) => parts.filter(Boolean);
  // The tag of a zu-Infinitiv item without um / ohne / statt: whether zu belongs there is the question.
  const ZU_TAG = 'zu?';
  const main = (x) => words(x.s, x.v, x.mid, x.end);

  // ---------- Building a sentence with two gaps ----------

  // Tokens from words, with gaps, joined by spaces (none before punctuation); the first word capitalized.
  function join(list) {
    const tokens = [];
    list.forEach((w, i) => {
      if (i > 0 && !(typeof w === 'string' && /^[,.?!]/.test(w))) tokens.push(' ');
      tokens.push(w);
    });
    return capitalizeFirst(tokens);
  }

  // The two gaps: the verb's place (answer = the verb) and the usual wrong place (empty).
  const place = (verb) => wordGap('verb', verb, 'verb position');
  const empty = () => wordGap('verb', '', 'verb position');

  // The drilled clause in each order: the verb in its place, the other gap where it often lands by mistake.
  const drilled = {
    sub: (x) => words(x.s, empty(), x.mid, x.end, place(x.v)), // weil ich [ ] krank [bin]
    adv: (lead, x) => words(lead, place(x.v), x.s, empty(), x.mid, x.end), // deshalb [bleibe] ich [ ] zu Hause
    coord: (x) => words(x.s, place(x.v), x.mid, x.end, empty()), // denn ich [bin] krank [ ]
  };

  // Rules shown after checking.
  const RULES = {
    sub: (conj) => `"${conj}" starts a subordinate clause: the finite verb goes to the end.`,
    adv: (adv) => `"${adv}" takes position 1, so the verb comes right after it (position 2) and the subject follows.`,
    coord: (conj) => `"${conj}" does not count as a position: subject, then verb, as usual.${conj === 'denn' ? ' (weil means the same, but sends the verb to the end.)' : ''}`,
    fronted: (conj) => `The "${conj}"-clause takes position 1 of the sentence, so the main clause starts with its verb.`,
    je: '"je" + comparative starts a subordinate clause: the verb goes to the end.',
    desto: '"desto" + comparative takes position 1 of the main clause, so the verb comes right after it, then the subject.',
  };

  function connectorItem(conj, rnd) {
    const { type, pairs, order } = CONNECTORS[conj];
    const [x, y] = pick(pairs, rnd);
    const [first, second] = order === 'xy' ? [x, y] : [y, x];
    const tail = type === 'adv' ? drilled.adv(conj, second) : [conj, ...drilled[type](second)];
    return item(join([...main(first), ',', ...tail, '.']), type, conj, second.v, RULES[type](conj));
  }

  // "Wenn es regnet, [bleibe] ich [ ] zu Hause." — or the subordinate clause's own verb at the end.
  function frontedItem(rnd) {
    const conj = pick(Object.keys(FRONTED), rnd);
    const [x, y] = pick(FRONTED[conj], rnd);
    if (rnd() < 0.5) {
      return item(join([conj, ...words(x.s, x.mid, x.end, x.v), ',', place(y.v), y.s, empty(), ...words(y.mid, y.end), '.']), 'sub', conj, y.v, RULES.fronted(conj));
    }
    return item(join([conj, ...drilled.sub(x), ',', ...words(y.v, y.s, y.mid, y.end), '.']), 'sub', conj, x.v, RULES.sub(conj));
  }

  // The own groups' sentences, built from one entry of their list (see GENERATORS).

  // "Sie ist nicht gekommen, weil sie länger [hat] arbeiten müssen [ ]."
  function modalItem([lead, conj, s, aux, mid, inf, modal, stop = '.']) {
    const rule = `Two infinitives at the end (${inf} ${modal}): in a subordinate clause the auxiliary goes in front of them, not last.`;
    return item(join([lead, ',', conj, s, mid, place(aux), inf, modal, empty(), stop]), 'modal', conj, aux, rule);
  }

  // "Ich habe vergessen, [ ] dich [anzurufen]." — the infinitive is shown, typed with zu.
  // "Ich muss [ ] morgen früh [aufstehen]." — no zu.
  function noZuItem([lead, mid, inf, stop = '.']) {
    return item(join([lead, empty(), mid, place(inf), stop]), 'inf', ZU_TAG, inf,
      `No zu after a modal verb, lassen, werden, sehen / hören, gehen or bleiben: ${lead} … ${inf}.`);
  }

  function zuItem([lead, conj, mid, inf, stop = '.']) {
    const zu = verbs.zuInfinitive(verbs.verb(inf));
    return item(join([lead, ',', ...words(conj, empty(), mid, place(zu)), stop]), 'inf', conj || ZU_TAG, inf, zuRule(conj, inf, zu));
  }
  const zuRule = (conj, inf, zu) => `${ZU_RULES[conj]}${zu.includes(' ') ? '' : ` ${inf} is separable, so zu goes between its parts: ${zu}.`}`;

  // "Je mehr du übst, desto besser [sprichst] du [ ] Deutsch." — or the je-clause's verb, last.
  function jeItem([[jc, ...je], [dc, dv, ds, ...rest]], rnd) {
    if (rnd() < 0.5) {
      const verb = je[je.length - 1];
      return item(join(['je', jc, empty(), ...je.slice(0, -1), place(verb), ',', 'desto', dc, dv, ds, ...rest, '.']), 'je', 'je', verb, RULES.je);
    }
    return item(join(['je', jc, ...je, ',', 'desto', dc, place(dv), ds, empty(), ...rest, '.']), 'je', 'desto', dv, RULES.desto);
  }

  // "Ich trinke [weder] Kaffee [noch] Tee." from "Ich trinke keinen Kaffee und keinen Tee."
  function pairedItem(entry) {
    const pair = PAIRS[entry.pair];
    const tokens = cloze.fillSlots(entry.t, {
      A: [wordGap('conj', pair.a, 'first part of the connector')],
      B: [wordGap('conj', pair.b, 'second part of the connector')],
      V: entry.v && [{ ...wordGap('verb', entry.v[0], 'verb'), alts: entry.v.slice(1), placeholder: 'verb' }],
    });
    return { ...item(tokens, 'paired', `${pair.a} … ${pair.b}`, null, pair.why), prompt: { label: 'Mit zwei Teilen', text: entry.plain } };
  }

  // "Ich fahre [morgen] wegen des Streiks mit dem Rad zur Arbeit [ ]." — the drilled part is shown, placed by the learner.
  function mittelItem(entry, rnd) {
    const k = pick(entry.parts.map((p, i) => i).filter((i) => MITTEL_RULES[entry.parts[i][0]]), rnd);
    const [type, text] = entry.parts[k];
    const slots = entry.parts.map(([, t], i) => (i === k ? place(t) : t));
    // Place early is the wrong one; time or a pronoun at the end — or, when it is the last part already, first.
    const list = type === 'L' || k === entry.parts.length - 1 ? [empty(), ...slots] : [...slots, empty()];
    const tokens = join([entry.head, ...list, ...words(entry.end), entry.stop || '.']);
    const rule = MITTEL_RULES[type];
    return { ...item(tokens, 'mittel', rule.label, null, rule.why), prompt: { label: 'Wohin?', text } };
  }

  // "Ich habe den Film [nicht] gesehen [ ]."
  function nichtItem([t, why]) {
    const tokens = cloze.fillSlots(t, { N: [place('nicht')], X: [empty()] });
    return { ...item(tokens, 'nicht', 'nicht', null, why), prompt: { label: 'Wohin?', text: 'nicht' } };
  }

  // "Ich habe [keine] Zeit." / "Ich sehe den Mantel [nicht]." from the positive sentence; nouns from the deck where enough fit.
  function negateItem(rnd, recent, vocabSetting) {
    const [frame, caseKey, cats] = pick(NEGATE, rnd);
    const nouns = vocab.pool(lexicon.NOUNS, (n) => n.sg && cats.includes(n.cat), vocabSetting);
    const noun = vocab.pickDue(nouns, rnd, { recent });
    const definite = caseKey === 'acc' && rnd() < 0.35; // "Hier ist das Kopftuch nicht" says something else
    const plural = !definite && !noun.mass && !!noun.pl && rnd() < 0.3;
    const g = plural ? 'pl' : noun.g;
    const form = (plural ? noun.pl : noun.sg)[declension.CASES.indexOf(caseKey)];
    const positive = definite ? vocab.withArticle({ ...noun, family: false, mine: false }, caseKey, plural)
      : noun.mass || plural ? form : `${declension.possessive('ein', g, caseKey)} ${form}`;
    const kein = declension.possessive('kein', g, caseKey);
    const tokens = definite
      ? cloze.fillTemplate(frame.replace('.', ' {1}.'), [[positive], [wordGap('neg', 'nicht', 'nicht or kein')]], plural)
      : cloze.fillTemplate(frame, [[wordGap('neg', kein, 'nicht or kein'), ` ${form}`]], plural);
    const rule = definite ? `A definite noun (${positive}) is negated with nicht, at the end.`
      : `A noun with ein or no article is negated with kein, which takes the endings of ein: ${kein} ${form}.`;
    return {
      // The tag must not give the answer away: "nicht / kein" either way.
      ...item(tokens, 'nicht', 'nicht / kein', null, rule, noun.anki ? 'anki' : 'builtin'),
      key: noun.lemma, prompt: { label: 'Verneinen', text: cloze.fillTemplate(frame, [[positive]], plural).join('') },
      notes: vocab.notesOf(noun),
    };
  }

  // "[Als] ich ein Kind war, …" — the gap shows the words to choose from.
  function choiceItem(entry) {
    const set = CHOICE_SETS[entry.a];
    const answer = entry.cap ? cloze.capitalize(entry.a) : entry.a;
    const tokens = cloze.fillSlots(entry.t, { C: [{ ...wordGap('conj', answer, 'connector'), alts: entry.alts || [], placeholder: set, keepCase: true }] });
    return item(tokens, 'conj', set, null, entry.why);
  }

  function contentItem(rnd) {
    const [lead, stop] = pick(CONTENT, rnd);
    const conj = lead.split(' ').pop();
    // Someone else's situation reads naturally after "Ich glaube, dass …" / "Weißt du, ob …".
    const [x] = pick([...REASONS, ...CONTRASTS, ...TIMES].filter(([a]) => !['ich', 'du', 'wir'].includes(a.s)), rnd);
    return item(join([lead, ...drilled.sub(x), stop]), 'sub', conj, x.v, RULES.sub(conj));
  }

  function item(tokens, type, conj, verb, rule, source = 'builtin') {
    return {
      source, type, conj, verb, tokens, key: conj,
      ...(verb && { prompt: { label: 'Verb', text: verb } }),
      tags: [{ text: conj, cls: `w-${type}` }, { text: GROUP_LABELS[type], cls: 'plain' }, ...(source === 'anki' ? [vocab.ANKI_TAG] : [])],
      explain: rule,
    };
  }

  // ---------- The deck's sentences ----------

  const SUBORDINATORS = ['weil', 'dass', 'ob', 'wenn', 'obwohl', 'als', 'bevor', 'nachdem', 'damit', 'während', 'bis', 'falls', 'seitdem'];
  const ADVERBS = ['deshalb', 'deswegen', 'darum', 'trotzdem', 'außerdem', 'dann', 'danach', 'sonst', 'heute', 'morgen', 'gestern',
    'jetzt', 'leider', 'vielleicht', 'normalerweise', 'sonntags', 'inzwischen', 'zuerst', 'später', 'plötzlich', 'hier', 'dort',
    'damals', 'bald', 'manchmal', 'oft', 'natürlich'];
  const COORDINATORS = ['denn', 'aber', 'und', 'oder', 'sondern'];
  const PRONOUNS = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man']);
  const DETERMINER = /^(der|die|das|ein|eine|mein|meine|dein|deine|sein|seine|ihr|ihre|unser|unsere|euer|eure)$/i;

  // Every finite form the app knows: the built-in strong verbs (once) and the deck's verbs, separable ones also joined
  // (ankam). A word counts as a verb only when it is one of them.
  const formsOf = (v, forms) => {
    for (const f of [v.pres, v.pret, v.konj2 || []].flat(2)) {
      forms.add(f.toLowerCase());
      if (v.particle) forms.add((v.particle + f).toLowerCase());
    }
    return forms;
  };
  const STRONG_FORMS = Object.keys(verbs.STRONG).reduce((forms, inf) => formsOf(verbs.verb(inf), forms), new Set());
  // What the app knows of verbs, recomputed with the deck: forms — every finite form; all — every infinitive; joined — the
  // zu-forms of the separable ones (anzurufen → anrufen).
  let verbCache = { verbs: null };
  function verbIndex() {
    if (verbCache.verbs !== vocab.verbs) {
      verbCache = {
        verbs: vocab.verbs,
        forms: vocab.verbs.reduce((forms, x) => formsOf(x.verb, forms), new Set(STRONG_FORMS)),
        all: new Set([...Object.keys(verbs.STRONG), ...vocab.verbs.map((x) => x.verb.inf)]),
        joined: new Map(vocab.verbs.filter((x) => x.verb.particle).map((x) => [verbs.zuInfinitive(x.verb), x.verb.inf])),
      };
    }
    return verbCache;
  }
  const finiteForms = () => verbIndex().forms;

  // The subject right after a connector: a pronoun, an article + noun, or a name; its last word index, or -1.
  function subjectEnd(ws, k) {
    const w = ws[k];
    if (!w) return -1;
    // "ihr Mann", "sein Auto": a determiner before a noun, not the pronoun.
    if (DETERMINER.test(w.text) && /^[A-ZÄÖÜ]/.test(ws[k + 1]?.text || '')) return k + 1;
    if (PRONOUNS.has(w.w) || w.text === 'Sie') return k;
    if (/^[A-ZÄÖÜ][a-zäöüß]+$/.test(w.text) && /^[a-zäöüß]/.test(ws[k + 1]?.text || '')) return k;
    return -1;
  }

  // One item from a deck sentence, or null: the first subordinate clause, adverb in position 1 or und / aber / denn clause.
  function deckItem(de, groups) {
    const { parts, words: ws } = splitWords(de);
    const forms = finiteForms();
    const before = (k) => parts[ws[k].i - 1] || ''; // the text before word k
    const clauseEnd = (k) => { // the last word of the clause that starts at word k
      let e = k;
      while (ws[e + 1] && !CLAUSE_END.test(parts[ws[e].i + 1] || '')) e++;
      return e;
    };
    // The verb's word becomes its gap; the empty gap goes after word gapAfterK.
    const build = (verbK, gapAfterK, rule, type, conj) => {
      const tokens = [];
      parts.forEach((p, i) => {
        tokens.push(i === ws[verbK].i ? place(p) : p);
        if (i === ws[gapAfterK].i) tokens.push(' ', empty());
      });
      return item(tokens.filter((t) => t !== ''), type, conj, ws[verbK].text, rule, 'anki');
    };

    for (let k = 0; k < ws.length; k++) {
      const w = ws[k];
      const atStart = k === 0;
      const afterComma = /,\s*$/.test(before(k));
      if (groups.includes('inf') && afterComma) {
        const found = zuClause(ws, k, clauseEnd(k), parts);
        if (found) return found;
      }
      if (groups.includes('je') && (w.w === 'desto' || w.w === 'umso') && afterComma && ws[0].w === 'je') {
        const s = subjectEnd(ws, k + 3);
        if (ws[k + 2] && forms.has(ws[k + 2].w) && s >= 0 && clauseEnd(k) >= s) return build(k + 2, s, RULES.desto, 'je', w.w);
      }
      if (groups.includes('sub') && SUBORDINATORS.includes(w.w) && (atStart || afterComma)) {
        const s = subjectEnd(ws, k + 1);
        const e = clauseEnd(k);
        // Verb last, the subject before it, at least one word between them, no "zu" infinitive at the end, and no other
        // finite verb or second clause in between ("Als Kind wollte ich …", "weil … hatte und sie … musste").
        if (s < 0 || e - s < 2 || !forms.has(ws[e].w) || ws[e - 1].w === 'zu' || /^[A-ZÄÖÜ]/.test(ws[e].text)) continue;
        const middle = ws.slice(s + 1, e);
        if (middle.some((x) => (forms.has(x.w) && !/n$/.test(x.w)) || x.w === 'und' || x.w === 'oder')) continue;
        if (!CLAUSE_END.test(parts[ws[e].i + 1] || '.')) continue;
        return build(e, s, RULES.sub(w.w), 'sub', w.w);
      }
      if (groups.includes('adv') && ADVERBS.includes(w.w) && (atStart || /[.!?]\s*$/.test(before(k)))) {
        const v = ws[k + 1];
        const s = subjectEnd(ws, k + 2);
        if (!v || !forms.has(v.w) || s !== k + 2 || clauseEnd(k) <= s) continue;
        return build(k + 1, s, RULES.adv(w.text.toLowerCase()), 'adv', w.w);
      }
      if (groups.includes('coord') && COORDINATORS.includes(w.w) && afterComma) {
        const s = subjectEnd(ws, k + 1);
        const v = ws[s + 1];
        const e = clauseEnd(k);
        if (s !== k + 1 || !v || !forms.has(v.w) || e <= s + 1) continue;
        return build(s + 1, e, RULES.coord(w.w), 'coord', w.w);
      }
    }
    return null;
  }

  // An infinitive clause starting at word k (after a comma) and ending at word e with zu + infinitive ("…, um früh
  // aufzustehen."), as an item: the zu-infinitive is its gap, the empty one goes before the first word after um / ohne / statt.
  function zuClause(ws, k, e, parts) {
    const { all, joined, forms } = verbIndex();
    const conj = ['um', 'ohne', 'statt', 'anstatt'].includes(ws[k].w) ? ws[k].w : '';
    const start = conj ? k + 1 : k;
    let from = e;
    let inf = joined.get(ws[e].w);
    if (!inf && ws[e - 1]?.w === 'zu' && all.has(ws[e].text)) inf = ws[e].text, from = e - 1;
    // At least one word between the start and zu, a clause that ends the sentence or its part, and no finite verb or
    // subordinator before zu ("…, weil ich keine Lust habe zu arbeiten" is a subordinate clause).
    if (!inf || from <= start || !CLAUSE_END.test(parts[ws[e].i + 1] || '.')) return null;
    // Case-sensitive: "das Essen" is no verb.
    if (ws.slice(start, from).some((x) => forms.has(x.text) || SUBORDINATORS.includes(x.w))) return null;
    const zu = from === e ? ws[e].text : `zu ${inf}`;
    const tokens = [];
    parts.forEach((p, i) => {
      if (i === ws[start].i) tokens.push(empty(), ' ');
      if (i > ws[from].i && i <= ws[e].i) return; // inside the zu-infinitive's gap
      tokens.push(i === ws[from].i ? place(zu) : p);
    });
    const rule = zuRule(conj === 'anstatt' ? 'statt' : conj, inf, zu);
    return item(tokens.filter((t) => t !== ''), 'inf', conj || ZU_TAG, inf, rule, 'anki');
  }

  // The learnt notes' example sentences that fit the chosen groups, as items that name their note; kept per deck and
  // group choice. A round takes those of cards due soon and hard most often (vocab.deckShare).
  let itemsCache = { notes: null, byGroups: new Map() };
  function deckItems(groups) {
    if (itemsCache.notes !== vocab.notes) itemsCache = { notes: vocab.notes, byGroups: new Map() };
    const key = groups.join();
    if (!itemsCache.byGroups.has(key)) {
      const items = [];
      for (const note of vocab.learnt()) {
        for (const ex of note.examples) {
          const found = deckItem(clean(ex.de), groups);
          if (found) items.push({ ...found, english: clean(ex.en), notes: [note] });
        }
      }
      itemsCache.byGroups.set(key, items);
    }
    return itemsCache.byGroups.get(key);
  }

  // ---------- Round ----------

  // An entry of the list, picked fresh (recent holds the last items' keys — the entries themselves), made into an item.
  const fromList = (list, make) => (rnd, recent) => {
    const entry = pickFresh(list, recent, (e) => e, rnd);
    return { ...make(entry, rnd), key: entry };
  };
  // A group's connectors, picked fresh.
  const fromConnectors = (group) => {
    const conjs = Object.keys(CONNECTORS).filter((k) => CONNECTORS[k].type === group);
    return (rnd, recent) => connectorItem(pickFresh(conjs, recent, (k) => k, rnd), rnd);
  };
  const zuOrNot = [fromList(ZU_CLAUSES, zuItem), fromList(NO_ZU, noZuItem)];
  const subConnectors = fromConnectors('sub');
  const ownNicht = fromList(NICHT, nichtItem);

  // Each group's built-in items: (rnd, recent, vocabSetting) → item.
  const GENERATORS = {
    sub: (rnd, recent) => {
      const r = rnd();
      return r < 0.25 ? frontedItem(rnd) : r < 0.45 ? contentItem(rnd) : subConnectors(rnd, recent);
    },
    adv: fromConnectors('adv'),
    coord: fromConnectors('coord'),
    modal: fromList(MODAL_PERFECT, modalItem),
    // With and without zu, in proportion to their lists.
    inf: (rnd, recent) => zuOrNot[rnd() < NO_ZU.length / (NO_ZU.length + ZU_CLAUSES.length) ? 1 : 0](rnd, recent),
    je: fromList(JE_DESTO, jeItem),
    paired: fromList(PAIRED, pairedItem),
    mittel: fromList(MITTEL, mittelItem),
    // Half the time where nicht goes, half whether to say nicht or kein (with the deck's nouns).
    nicht: (rnd, recent, vocabSetting) => (rnd() < 0.5 ? negateItem(rnd, recent, vocabSetting) : ownNicht(rnd, recent)),
    conj: fromList(CHOICES, choiceItem),
  };

  function buildRound(settings, rnd = Math.random) {
    const mine = settings.vocab === 'anki' ? vocab.deckShare(deckItems(settings.groups), settings.length, rnd) : [];
    const items = [...mine];
    const recent = [];
    let queue = [];
    while (items.length < settings.length) {
      if (!queue.length) queue = shuffle(settings.groups, rnd);
      const it = GENERATORS[queue.shift()](rnd, recent, settings.vocab);
      remember(recent, it.key, 6);
      items.push(it);
    }
    return shuffle(items, rnd).map((it) => (it.english ? { ...it, explain: `${it.explain} — ${it.english}` } : it));
  }

  function status(settings) {
    return vocab.deckStatus(settings, () => {
      const count = deckItems(settings.groups).length;
      if (!count) return 'None of your learnt cards\' example sentences fit these groups yet, so the built-in ones are used.';
      return `Using ${count} example sentences of your learnt Anki cards — of those due soon and hard most often — and built-in ones for the rest.`;
    }, 'sentences');
  }

  function drillStep(settings, rnd) {
    return {
      type: 'drill',
      label: 'Sentences',
      hint: 'Type the verb (or the shown word) into the gap where it belongs · leave the other gap empty · zu-Infinitiv: with zu where it needs one (anzurufen) · Tab moves between gaps',
      hideTags: !settings.hints,
      items: buildRound(settings, rnd),
    };
  }

  // n sentences in the settings' scope, for a round here and for the Daily review.
  const sentences = (settings, n, rnd = Math.random) => drillStep({ ...settings, length: n }, rnd);

  return {
    id: 'wordorder',
    title: 'Satzstellung',
    subtitle: 'Word order — weil ich krank bin, deshalb bleibe ich, dass er hat kommen müssen, um früh aufzustehen, morgen mit dem Rad zur Arbeit, nicht; and sowohl … als auch, als / wenn.',
    intro: vocab.intro('Each sentence shows its verb (or the word to place) and two gaps: type it where it belongs and leave the other gap empty. With the zu-Infinitiv, type it with or without zu (anzurufen, zu gehen; muss … gehen); with two-part connectors, nicht / kein and als / wenn / wann, type the word that fits.', null, status),
    defaults: { groups: ['sub', 'adv', 'coord'], vocab: 'anki', hints: false, length: 10 },
    prepare: vocab.prepare,
    options: [
      {
        key: 'groups', label: 'Clauses', type: 'checkboxes', min: 1, choices: [
          { value: 'sub', label: 'Nebensätze', detail: 'weil, dass, ob, wenn, obwohl … → verb last; Wenn …, [Verb] ich …' },
          { value: 'adv', label: 'Adverbs in position 1', detail: 'deshalb, trotzdem, dann … → verb next' },
          { value: 'coord', label: 'und, aber, oder, denn', detail: 'no change: subject, verb' },
          { value: 'modal', label: 'Modalverb im Nebensatz', detail: 'weil sie hat arbeiten müssen, dass er hat reparieren lassen — the auxiliary before both infinitives' },
          { value: 'inf', label: 'zu-Infinitiv', detail: 'Ich habe vergessen, dich anzurufen · um … zu, ohne … zu, statt … zu · no zu after muss, lässt, hört' },
          { value: 'je', label: 'je … desto', detail: 'Je mehr du übst, desto besser sprichst du.' },
          { value: 'paired', label: 'Zweiteilige Konnektoren', detail: 'sowohl … als auch, weder … noch, entweder … oder, nicht nur … sondern auch' },
          { value: 'mittel', label: 'Mittelfeld', detail: 'te-ka-mo-lo: morgen wegen des Streiks mit dem Rad zur Arbeit · pronouns first' },
          { value: 'nicht', label: 'nicht / kein', detail: 'Ich habe den Film nicht gesehen · Ich kenne ihn nicht · keine Zeit' },
          { value: 'conj', label: 'als / wenn / wann · aber / sondern · seit', detail: 'Als ich ein Kind war … · nicht rot, sondern blau · seit / seitdem' },
        ],
      },
      {
        key: 'vocab', label: 'Sentences', type: 'radio', daily: 'anki', choices: [
          { value: 'anki', label: 'My Anki sentences', detail: 'example sentences of your learnt cards, built-in ones for the rest' },
          { value: 'builtin', label: 'Built-in' },
        ],
      },
      { key: 'hints', label: 'Hints', type: 'toggle', text: 'Show the connector type before answering' },
      {
        key: 'length', label: 'Round', type: 'radio', inline: true, round: true, choices: [
          { value: 10, label: '10 sentences' },
          { value: 20, label: '20 sentences' },
        ],
      },
    ],
    sentences,
    sessions: [{ label: 'Start', build: (settings, rnd = Math.random) => [sentences(settings, settings.length, rnd)] }],

    GROUPS, CONNECTORS,
    connectorItem, frontedItem, contentItem, modalItem, zuItem, jeItem, pairedItem, deckItem, deckItems, buildRound,
    MODAL_PERFECT, ZU_CLAUSES, NO_ZU, JE_DESTO, PAIRED, MITTEL, NICHT, CHOICES, mittelItem, nichtItem, negateItem, choiceItem, noZuItem,
  };
});
