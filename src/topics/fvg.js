// Topic: Funktionsverbgefüge — a noun and a verb that work as one verb: eine Entscheidung treffen (entscheiden), zur
// Verfügung stellen (geben), in Frage kommen (möglich sein). Which verb goes with the noun, and which preposition or article.
// Session: the noun parts of the round with the verb to add, then sentences that say the plain sentence with the pair.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/cloze.js'), require('../core/vocab.js'));
  } else {
    root.Etudes.topics.push(factory(root.Etudes.cloze, root.Etudes.vocab));
  }
})(globalThis, function (cloze, vocab) {
  'use strict';

  const { wordGap, shuffle } = cloze;

  // The pairs: pair (as listed, the verb last or before its preposition), verb (its infinitive in the pair), noun, mean (what
  // it says plainly); plain: the sentence without it; t: the sentence with it — {V} the verb (v: its form here, then other
  // accepted ones), {P} the preposition or article before the noun (p; none where the noun stands alone).
  const PAIRS = [
    { pair: 'zur Verfügung stellen', verb: 'stellen', noun: 'Verfügung', mean: 'geben, anbieten',
      plain: 'Die Firma gibt uns einen Laptop.', t: 'Die Firma {V} uns einen Laptop {P} Verfügung.', v: ['stellt'], p: 'zur' },
    { pair: 'zur Verfügung stehen', verb: 'stehen', noun: 'Verfügung', mean: 'da sein, bereit sein',
      plain: 'Ich helfe Ihnen gern, wenn Sie Fragen haben.', t: 'Ich {V} Ihnen gern {P} Verfügung, wenn Sie Fragen haben.', v: ['stehe'], p: 'zur' },
    { pair: 'eine Entscheidung treffen', verb: 'treffen', noun: 'Entscheidung', mean: 'entscheiden',
      plain: 'Wir müssen bis Freitag entscheiden.', t: 'Wir müssen bis Freitag {P} Entscheidung {V}.', v: ['treffen'], p: 'eine' },
    { pair: 'in Frage kommen', verb: 'kommen', noun: 'Frage', mean: 'möglich sein',
      plain: 'Dieser Termin ist für uns möglich.', t: 'Dieser Termin {V} für uns {P} Frage.', v: ['kommt'], p: 'in' },
    { pair: 'eine Frage stellen', verb: 'stellen', noun: 'Frage', mean: 'fragen',
      plain: 'Darf ich etwas fragen?', t: 'Darf ich {P} Frage {V}?', v: ['stellen'], p: 'eine' },
    { pair: 'Kritik üben an', verb: 'üben', noun: 'Kritik', mean: 'kritisieren',
      plain: 'Er kritisiert die Regierung.', t: 'Er {V} Kritik {P} der Regierung.', v: ['übt'], p: 'an' },
    { pair: 'in Kauf nehmen', verb: 'nehmen', noun: 'Kauf', mean: 'akzeptieren (etwas Negatives)',
      plain: 'Für die schöne Wohnung akzeptieren wir den langen Weg.', t: 'Für die schöne Wohnung {V} wir den langen Weg {P} Kauf.', v: ['nehmen'], p: 'in' },
    { pair: 'zur Sprache bringen', verb: 'bringen', noun: 'Sprache', mean: 'ansprechen',
      plain: 'Sie spricht das Problem in der Sitzung an.', t: 'Sie {V} das Problem in der Sitzung {P} Sprache.', v: ['bringt'], p: 'zur' },
    { pair: 'Rücksicht nehmen auf', verb: 'nehmen', noun: 'Rücksicht', mean: 'an andere denken',
      plain: 'Bitte denk an die Nachbarn und sei leise.', t: 'Bitte {V} Rücksicht {P} die Nachbarn und sei leise.', v: ['nimm'], p: 'auf' },
    { pair: 'in Anspruch nehmen', verb: 'nehmen', noun: 'Anspruch', mean: 'nutzen',
      plain: 'Er nutzt die Hilfe der Beratungsstelle.', t: 'Er {V} die Hilfe der Beratungsstelle {P} Anspruch.', v: ['nimmt'], p: 'in' },
    { pair: 'zum Ausdruck bringen', verb: 'bringen', noun: 'Ausdruck', mean: 'ausdrücken',
      plain: 'Sie drückt ihre Dankbarkeit aus.', t: 'Sie {V} ihre Dankbarkeit {P} Ausdruck.', v: ['bringt'], p: 'zum' },
    { pair: 'einen Antrag stellen', verb: 'stellen', noun: 'Antrag', mean: 'beantragen',
      plain: 'Wir beantragen ein Visum.', t: 'Wir {V} {P} Antrag auf ein Visum.', v: ['stellen'], p: 'einen' },
    { pair: 'eine Rolle spielen', verb: 'spielen', noun: 'Rolle', mean: 'wichtig sein',
      plain: 'Der Preis ist für mich nicht wichtig.', t: 'Der Preis {V} für mich keine Rolle.', v: ['spielt'] },
    { pair: 'einen Vorschlag machen', verb: 'machen', noun: 'Vorschlag', mean: 'vorschlagen',
      plain: 'Darf ich etwas vorschlagen?', t: 'Darf ich {P} Vorschlag {V}?', v: ['machen'], p: 'einen' },
    { pair: 'Wert legen auf', verb: 'legen', noun: 'Wert', mean: 'wichtig finden',
      plain: 'Pünktlichkeit ist ihr sehr wichtig.', t: 'Sie {V} großen Wert {P} Pünktlichkeit.', v: ['legt'], p: 'auf' },
    { pair: 'in Betracht ziehen', verb: 'ziehen', noun: 'Betracht', mean: 'überlegen, berücksichtigen',
      plain: 'Wir überlegen auch diese Möglichkeit.', t: 'Wir {V} auch diese Möglichkeit {P} Betracht.', v: ['ziehen'], p: 'in' },
    { pair: 'zur Kenntnis nehmen', verb: 'nehmen', noun: 'Kenntnis', mean: 'bemerken, wissen',
      plain: 'Ich habe Ihre Beschwerde gelesen.', t: 'Ich habe Ihre Beschwerde {P} Kenntnis {V}.', v: ['genommen'], p: 'zur' },
    { pair: 'in Erfüllung gehen', verb: 'gehen', noun: 'Erfüllung', mean: 'wahr werden',
      plain: 'Sein Traum ist wahr geworden.', t: 'Sein Traum ist {P} Erfüllung {V}.', v: ['gegangen'], p: 'in' },
    { pair: 'zu Ende bringen', verb: 'bringen', noun: 'Ende', mean: 'beenden',
      plain: 'Wir beenden das Projekt bis Juni.', t: 'Wir {V} das Projekt bis Juni {P} Ende.', v: ['bringen'], p: 'zu' },
    { pair: 'in Gefahr bringen', verb: 'bringen', noun: 'Gefahr', mean: 'gefährden',
      plain: 'Der Sturm gefährdet die alten Häuser.', t: 'Der Sturm {V} die alten Häuser {P} Gefahr.', v: ['bringt'], p: 'in' },
    { pair: 'sich Mühe geben', verb: 'geben', noun: 'Mühe', mean: 'sich anstrengen',
      plain: 'Sie strengt sich sehr an.', t: 'Sie {V} sich große Mühe.', v: ['gibt'] },
    { pair: 'Abschied nehmen von', verb: 'nehmen', noun: 'Abschied', mean: 'sich verabschieden',
      plain: 'Wir verabschieden uns von den Gästen.', t: 'Wir {V} Abschied {P} den Gästen.', v: ['nehmen'], p: 'von' },
    { pair: 'Einfluss nehmen auf', verb: 'nehmen', noun: 'Einfluss', mean: 'beeinflussen',
      plain: 'Er beeinflusst die Entscheidung.', t: 'Er {V} Einfluss {P} die Entscheidung.', v: ['nimmt'], p: 'auf' },
    { pair: 'einen Beitrag leisten', verb: 'leisten', noun: 'Beitrag', mean: 'beitragen',
      plain: 'Jeder trägt ein bisschen bei.', t: 'Jeder {V} {P} kleinen Beitrag.', v: ['leistet'], p: 'einen' },
    { pair: 'in Ordnung bringen', verb: 'bringen', noun: 'Ordnung', mean: 'reparieren, aufräumen',
      plain: 'Ich repariere das alte Fahrrad.', t: 'Ich {V} das alte Fahrrad wieder {P} Ordnung.', v: ['bringe'], p: 'in' },
    { pair: 'Platz nehmen', verb: 'nehmen', noun: 'Platz', mean: 'sich setzen',
      plain: 'Bitte setzen Sie sich.', t: 'Bitte {V} Sie Platz.', v: ['nehmen'] },
  ];

  // The note of a pair's noun, if the learner has learnt it in Anki.
  const noteOf = (e) => vocab.noteFor(e.noun);

  function buildItem(entry, source = 'builtin') {
    const tokens = cloze.fillSlots(entry.t, {
      V: [{ ...wordGap('verb', entry.v[0], 'verb'), alts: entry.v.slice(1) }],
      P: entry.p && [wordGap('prep', entry.p, 'preposition or article')],
    });
    const note = source === 'anki' && noteOf(entry);
    return {
      key: entry.pair, tokens, notes: note ? [note] : [],
      prompt: { label: 'Mit Funktionsverb', text: entry.plain },
      tags: [{ text: entry.noun, cls: 'f-noun' }, ...(note ? [vocab.ANKI_TAG] : [])],
      explain: `${entry.pair} = ${entry.mean}. The noun carries the meaning, the verb (${entry.verb}) only makes it a verb — it has to be learnt with the noun.`,
    };
  }

  // The round's pairs, none twice (unless the round is longer than the list); with the Anki option, those with a learnt
  // noun first, up to half the round — drawn by their cards' weight, so the due and hard ones most often.
  function pickRound(settings, rnd = Math.random) {
    const mine = settings.vocab === 'anki' ? vocab.sample(PAIRS, Math.ceil(settings.length / 2), rnd, { noteOf }) : [];
    const order = [...mine, ...shuffle(PAIRS.filter((e) => !mine.includes(e)), rnd)];
    const picked = Array.from({ length: settings.length }, (_, i) => order[i % order.length]);
    return shuffle(picked, rnd);
  }

  const buildRound = (settings, rnd = Math.random) => pickRound(settings, rnd).map((e) => buildItem(e, settings.vocab));

  // Which verb goes with the pairs' nouns: "eine Entscheidung …" → treffen (zur Verfügung … takes stellen or stehen).
  function table(pairs) {
    const rows = new Map();
    for (const e of pairs) {
      const row = e.pair.split(' ').map((w) => (w === e.verb ? '…' : w)).join(' ');
      if (!rows.has(row)) rows.set(row, new Set());
      rows.get(row).add(e.verb);
    }
    return {
      title: 'Funktionsverbgefüge',
      lead: 'Type the verb that goes with each noun.',
      blocks: [{ cls: 'f-noun', rows: [...rows.keys()], cols: [{ head: 'Verb', sub: 'treffen, stellen, nehmen …' }], answers: [[...rows.values()].map((v) => [...v])] }],
    };
  }

  function status(settings) {
    return vocab.deckStatus(settings, () => {
      const count = PAIRS.filter(noteOf).length;
      return count ? `${count} of the pairs have a noun you have learnt in Anki; they come up more often.` : '';
    }, 'pairs');
  }

  const tableStep = (pairs) => ({ type: 'table', label: 'Funktionsverbgefüge', table: table(pairs) });

  const drillStep = (pairs, settings) => ({
    type: 'drill', label: 'Sentences', items: pairs.map((e) => buildItem(e, settings.vocab)),
    hint: 'Say the plain sentence with the noun shown: type its verb and the preposition or article before it · Tab moves between gaps',
  });

  // n sentences in the settings' scope, for the Daily review (a round here builds its table from the same pairs).
  const sentences = (settings, n, rnd = Math.random) => drillStep(pickRound({ ...settings, length: n }, rnd), settings);

  function steps(settings, rnd) {
    const pairs = pickRound(settings, rnd);
    return [tableStep(pairs), drillStep(pairs, settings)];
  }

  return {
    id: 'fvg',
    title: 'Funktionsverbgefüge',
    subtitle: 'eine Entscheidung treffen, zur Verfügung stellen, in Frage kommen — the verb that goes with the noun.',
    intro: vocab.intro('Each sentence says a plain sentence again with a noun–verb pair: type the verb that goes with the noun and the preposition or article before it. The table first asks for the verbs.', null, status),
    defaults: { vocab: 'anki', length: 10 },
    prepare: vocab.prepare,
    options: [
      {
        key: 'vocab', label: 'Words', type: 'radio', choices: [
          { value: 'anki', label: 'My Anki words first', detail: 'pairs with a noun you have learnt come up more often' },
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
      { label: 'Verbs table only', build: (settings, rnd = Math.random) => [tableStep(pickRound(settings, rnd))] },
    ],

    PAIRS, buildItem, buildRound, table,
  };
});
