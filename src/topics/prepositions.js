// Topic: prepositions and their cases — Akkusativ, Dativ, Wechselpräpositionen, Genitiv and verbs with fixed prepositions,
// plus the da- / wo-words that stand for a fixed preposition and its noun (darauf, worauf — or auf ihn, auf wen for people).
// Session: name the case of every preposition, then fill in the article (and adjective / noun) endings in sentences.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/cloze.js'), require('../core/declension.js'), require('../core/vocab.js'));
  } else {
    root.Etudes.topics.push(factory(root.Etudes.cloze, root.Etudes.declension, root.Etudes.vocab));
  }
})(globalThis, function (cloze, declension, vocab) {
  'use strict';

  const { gap, wordGap, capitalizeFirst, pick, pickWeighted, pickFresh, remember, shuffle, display } = cloze;
  const { CASES, CASE_LABELS, CASE_SHORT, PREPOSITIONS, CONTRACTIONS, THIRD_PERSON, contractionGap, GENDER_LABELS, ADJ_ENDINGS, DET_ENDINGS, datPlural } = declension;

  const GROUPS = ['akk', 'dat', 'wechsel', 'gen', 'fixed', 'da'];
  const GROUP_LABELS = {
    akk: 'Akkusativ', dat: 'Dativ', wechsel: 'Wechselpräpositionen', gen: 'Genitiv', fixed: 'Verbs with fixed prepositions',
    da: 'da- and wo-words',
  };

  const GROUP_DETAILS = {
    fixed: 'warten auf, Angst haben vor, sich freuen über …',
    da: 'darauf, worauf — and auf ihn, auf wen for people',
  };

  const GROUP_CASE = { akk: 'acc', dat: 'dat', gen: 'gen' };

  // Accepted table answers; the first is shown as the correction.
  const CASE_ANSWERS = {
    akk: [CASE_SHORT.acc, 'a', 'akkusativ', 'acc'],
    dat: [CASE_SHORT.dat, 'd', 'dativ'],
    wechsel: [`${CASE_SHORT.acc}/${CASE_SHORT.dat}`, 'a/d', 'ad', 'a d', 'a+d', 'a + d', 'akk dat', 'dat/akk', 'd/a', 'w', 'wechsel'],
    gen: [CASE_SHORT.gen, 'g', 'genitiv'],
  };

  // Determiner kinds a frame can allow.
  //   definite: takes ordinals / superlatives ("den nächsten"); countSg: countable singular only (ein);
  //   own: only nouns marked own (possessives); plAdj: plural with an adjective only (no article = strong declension).
  const DETS = {
    def: { key: 'def', stems: ['d'], table: 'der', variant: 'weak', weight: 4, definite: true },
    dies: { key: 'dies', stems: ['dies'], table: 'dies', variant: 'weak', weight: 1, definite: true },
    ein: { key: 'ein', stems: ['ein'], table: 'ein', variant: 'mixed', weight: 2, countSg: true },
    poss: { key: 'poss', stems: ['mein', 'dein', 'sein', 'ihr', 'unser'], table: 'ein', variant: 'mixed', weight: 3, definite: true, own: true },
    none: { key: 'none', stems: [], variant: 'strong', weight: 2, plAdj: true },
  };
  const DEFAULT_DETS = ['def', 'dies', 'ein', 'poss'];
  const PERSON_DETS = ['def', 'ein', 'poss', 'none'];

  // Ordinals and superlatives need a definite determiner ("den nächsten Urlaub", not "einen nächsten").
  const DEFINITE_ADJS = ['nächst', 'letzt', 'oberst'];

  // A noun: nominative and genitive singular, plural (null = not used in the plural), adjective stems.
  // opts: obl (n-declension form for every case but the nominative), genAlts (other accepted genitive endings), mass (no ein),
  //   own (possessives sound natural: "mit meinem Fahrrad", not "durch deinen Wald"), dets (the only determiner kinds it takes).
  function noun(g, nom, gen, pl, adjs, opts = {}) {
    return { g, lemma: nom, nom, gen, pl, adjs, ...opts };
  }

  function pluralOnly(pl, adjs, opts = {}) {
    return { g: 'pl', lemma: pl, nom: null, gen: null, pl, adjs, plOnly: true, ...opts };
  }

  // Family members take a possessive rather than an article ("für meine Mutter").
  const FAMILY = { own: true, dets: ['poss', 'none'] };
  const OWN = { own: true };

  const NOUN_LIST = [
    // People
    noun('m', 'Freund', 'Freundes', 'Freunde', ['alt', 'gut', 'neu'], OWN),
    noun('m', 'Bruder', 'Bruders', 'Brüder', ['älter', 'klein'], FAMILY),
    noun('m', 'Onkel', 'Onkels', 'Onkel', ['alt', 'reich'], FAMILY),
    noun('m', 'Kollege', 'Kollegen', 'Kollegen', ['neu', 'nett'], { ...OWN, obl: 'Kollegen' }),
    noun('m', 'Nachbar', 'Nachbarn', 'Nachbarn', ['neu', 'nett', 'alt'], { ...OWN, obl: 'Nachbarn' }),
    noun('f', 'Mutter', 'Mutter', null, ['krank', 'alt'], FAMILY),
    noun('f', 'Schwester', 'Schwester', 'Schwestern', ['älter', 'klein'], FAMILY),
    noun('f', 'Tante', 'Tante', 'Tanten', ['alt', 'reich'], FAMILY),
    noun('f', 'Oma', 'Oma', null, ['alt', 'krank'], FAMILY),
    noun('f', 'Kollegin', 'Kollegin', 'Kolleginnen', ['neu', 'nett'], OWN),
    noun('f', 'Lehrerin', 'Lehrerin', 'Lehrerinnen', ['neu', 'nett'], OWN),
    noun('n', 'Kind', 'Kindes', 'Kinder', ['klein', 'krank'], OWN),
    pluralOnly('Eltern', ['alt'], FAMILY),
    noun('m', 'Hund', 'Hundes', 'Hunde', ['klein', 'groß', 'alt'], OWN),
    noun('m', 'Arzt', 'Arztes', 'Ärzte', ['neu'], OWN),
    noun('m', 'Zahnarzt', 'Zahnarztes', 'Zahnärzte', ['neu']),
    noun('m', 'Friseur', 'Friseurs', 'Friseure', ['neu']),

    // Furniture and things at home
    noun('m', 'Tisch', 'Tisches', 'Tische', ['alt', 'neu', 'groß', 'klein', 'rund']),
    noun('m', 'Schreibtisch', 'Schreibtisches', 'Schreibtische', ['alt', 'neu', 'groß']),
    noun('m', 'Stuhl', 'Stuhls', 'Stühle', ['alt', 'neu', 'bequem']),
    noun('m', 'Schrank', 'Schranks', 'Schränke', ['alt', 'neu', 'groß', 'weiß']),
    noun('m', 'Boden', 'Bodens', 'Böden', ['kalt', 'sauber']),
    noun('m', 'Fernseher', 'Fernsehers', 'Fernseher', ['alt', 'neu', 'groß']),
    noun('m', 'Kühlschrank', 'Kühlschranks', 'Kühlschränke', ['alt', 'neu', 'groß']),
    noun('m', 'Vorhang', 'Vorhangs', 'Vorhänge', ['alt', 'dick', 'lang']),
    noun('m', 'Rucksack', 'Rucksacks', 'Rucksäcke', ['alt', 'neu', 'groß', 'klein'], OWN),
    noun('n', 'Sofa', 'Sofas', 'Sofas', ['alt', 'neu', 'groß', 'bequem']),
    noun('n', 'Bett', 'Bettes', 'Betten', ['alt', 'neu', 'groß', 'klein']),
    noun('n', 'Regal', 'Regals', 'Regale', ['alt', 'neu', 'groß', 'weiß']),
    noun('n', 'Fenster', 'Fensters', 'Fenster', ['offen', 'groß', 'klein']),
    noun('f', 'Kommode', 'Kommode', 'Kommoden', ['alt', 'neu', 'weiß']),
    noun('f', 'Lampe', 'Lampe', 'Lampen', ['alt', 'neu', 'groß', 'klein']),
    noun('f', 'Tür', 'Tür', 'Türen', ['offen', 'alt', 'braun']),
    noun('f', 'Wand', 'Wand', 'Wände', ['weiß', 'leer']),
    noun('f', 'Schublade', 'Schublade', 'Schubladen', ['oberst', 'klein']),
    noun('f', 'Tasche', 'Tasche', 'Taschen', ['alt', 'neu', 'groß', 'klein'], OWN),
    noun('f', 'Ecke', 'Ecke', 'Ecken', ['dunkl', 'leer']),
    noun('f', 'Bank', 'Bank', null, ['alt', 'neu']),
    noun('f', 'Garage', 'Garage', 'Garagen', ['alt', 'neu']),

    // Places
    noun('m', 'Park', 'Parks', 'Parks', ['groß', 'klein', 'schön']),
    noun('m', 'Wald', 'Waldes', 'Wälder', ['dunkl', 'groß']),
    noun('m', 'Garten', 'Gartens', 'Gärten', ['klein', 'schön'], OWN),
    noun('m', 'Supermarkt', 'Supermarkts', 'Supermärkte', ['neu', 'groß']),
    noun('m', 'See', 'Sees', 'Seen', ['klein', 'schön']),
    noun('m', 'Strand', 'Strandes', 'Strände', ['schön', 'leer']),
    noun('m', 'Fluss', 'Flusses', 'Flüsse', ['breit', 'klein']),
    noun('m', 'Markt', 'Marktes', 'Märkte', ['groß', 'neu']),
    noun('m', 'Spielplatz', 'Spielplatzes', 'Spielplätze', ['neu', 'groß']),
    noun('m', 'Bahnhof', 'Bahnhofs', 'Bahnhöfe', ['neu', 'alt']),
    noun('f', 'Stadt', 'Stadt', 'Städte', ['groß', 'alt', 'schön']),
    noun('f', 'Küche', 'Küche', 'Küchen', ['klein', 'neu'], OWN),
    noun('f', 'Schule', 'Schule', 'Schulen', ['neu', 'alt']),
    noun('f', 'Bibliothek', 'Bibliothek', 'Bibliotheken', ['neu', 'alt']),
    noun('f', 'Party', 'Party', 'Partys', ['groß', 'lustig'], OWN),
    noun('f', 'Kirche', 'Kirche', 'Kirchen', ['alt', 'klein']),
    noun('f', 'Apotheke', 'Apotheke', 'Apotheken', ['neu', 'klein']),
    noun('f', 'Post', 'Post', null, ['neu']),
    noun('n', 'Kino', 'Kinos', 'Kinos', ['neu', 'alt', 'klein']),
    noun('n', 'Museum', 'Museums', 'Museen', ['neu', 'groß']),
    noun('n', 'Büro', 'Büros', 'Büros', ['neu', 'klein'], OWN),
    noun('n', 'Meer', 'Meeres', 'Meere', ['blau', 'kalt']),
    noun('n', 'Haus', 'Hauses', 'Häuser', ['alt', 'neu', 'groß'], OWN),
    noun('n', 'Zentrum', 'Zentrums', 'Zentren', ['historisch']),

    // Vehicles and things
    noun('m', 'Bus', 'Busses', 'Busse', ['neu', 'alt']),
    noun('m', 'Zug', 'Zuges', 'Züge', ['schnell', 'neu'], { genAlts: ['s'] }),
    noun('n', 'Auto', 'Autos', 'Autos', ['neu', 'alt'], OWN),
    noun('n', 'Fahrrad', 'Fahrrads', 'Fahrräder', ['neu', 'alt'], OWN),
    noun('f', 'Straßenbahn', 'Straßenbahn', 'Straßenbahnen', ['neu', 'alt']),
    noun('m', 'Schirm', 'Schirms', 'Schirme', ['neu', 'alt', 'groß'], OWN),
    noun('m', 'Schlüssel', 'Schlüssels', 'Schlüssel', ['neu', 'alt'], OWN),
    noun('m', 'Baum', 'Baumes', 'Bäume', ['alt', 'groß']),
    noun('m', 'Becher', 'Bechers', 'Becher', ['groß', 'klein'], OWN),
    noun('f', 'Jacke', 'Jacke', 'Jacken', ['warm', 'neu'], OWN),
    noun('f', 'Brille', 'Brille', 'Brillen', ['neu', 'alt'], OWN),
    noun('f', 'Mauer', 'Mauer', 'Mauern', ['alt', 'hoh']),
    noun('f', 'Flasche', 'Flasche', 'Flaschen', ['groß', 'klein']),
    noun('f', 'Tasse', 'Tasse', 'Tassen', ['groß', 'klein'], OWN),
    noun('f', 'Mannschaft', 'Mannschaft', 'Mannschaften', ['stark', 'jung']),
    noun('n', 'Handy', 'Handys', 'Handys', ['neu', 'alt'], OWN),
    noun('n', 'Glas', 'Glases', 'Gläser', ['groß', 'klein']),
    noun('n', 'Feuer', 'Feuers', 'Feuer', ['warm', 'groß']),
    noun('n', 'Team', 'Teams', 'Teams', ['stark', 'neu']),

    // Events, weather, time
    noun('m', 'Film', 'Films', 'Filme', ['lang', 'spannend'], { genAlts: ['es'] }),
    noun('m', 'Kurs', 'Kurses', 'Kurse', ['neu', 'lang']),
    noun('m', 'Unterricht', 'Unterrichts', null, ['lang'], { genAlts: ['es'], mass: true }),
    noun('m', 'Urlaub', 'Urlaubs', 'Urlaube', ['nächst', 'lang'], { ...OWN, genAlts: ['es'] }),
    noun('m', 'Sommer', 'Sommers', 'Sommer', ['letzt', 'heiß']),
    noun('m', 'Besuch', 'Besuchs', 'Besuche', ['lang', 'überraschend'], { ...OWN, genAlts: ['es'] }),
    noun('m', 'Wettbewerb', 'Wettbewerbs', 'Wettbewerbe', ['groß', 'international'], { genAlts: ['es'] }),
    noun('m', 'Stau', 'Staus', 'Staus', ['lang']),
    noun('m', 'Unfall', 'Unfalls', 'Unfälle', ['schwer'], { genAlts: ['es'] }),
    noun('m', 'Streik', 'Streiks', 'Streiks', ['lang', 'groß'], { genAlts: ['es'] }),
    noun('m', 'Regen', 'Regens', null, ['stark'], { mass: true }),
    noun('m', 'Wind', 'Windes', null, ['kalt', 'stark'], { genAlts: ['s'], mass: true }),
    noun('m', 'Monat', 'Monats', 'Monate', [], { genAlts: ['es'] }),
    noun('m', 'Montag', 'Montags', 'Montage', []),
    noun('m', 'Abend', 'Abends', 'Abende', []),
    noun('n', 'Konzert', 'Konzerts', 'Konzerte', ['lang', 'laut'], { genAlts: ['es'] }),
    noun('n', 'Training', 'Trainings', 'Trainings', ['hart', 'lang']),
    noun('n', 'Spiel', 'Spiels', 'Spiele', ['lang', 'spannend'], { genAlts: ['es'] }),
    noun('n', 'Wetter', 'Wetters', null, ['schlecht', 'kalt'], { mass: true }),
    noun('n', 'Gewitter', 'Gewitters', 'Gewitter', ['stark', 'laut']),
    noun('n', 'Wochenende', 'Wochenendes', 'Wochenenden', ['nächst', 'lang']),
    noun('n', 'Jahr', 'Jahres', 'Jahre', [], { genAlts: ['s'] }),
    noun('f', 'Reise', 'Reise', 'Reisen', ['lang', 'letzt'], OWN),
    noun('f', 'Fahrt', 'Fahrt', 'Fahrten', ['lang']),
    noun('f', 'Pause', 'Pause', 'Pausen', ['kurz', 'lang']),
    noun('f', 'Kälte', 'Kälte', null, ['groß', 'eisig'], { mass: true }),
    noun('f', 'Hitze', 'Hitze', null, ['groß'], { mass: true }),
    noun('f', 'Baustelle', 'Baustelle', 'Baustellen', ['groß', 'neu']),
    noun('f', 'Woche', 'Woche', 'Wochen', []),
    noun('f', 'Stunde', 'Stunde', 'Stunden', []),
    noun('f', 'Hochzeit', 'Hochzeit', 'Hochzeiten', ['groß'], OWN),
    pluralOnly('Preise', ['hoh']),

    // Topics of fixed expressions
    noun('m', 'Bericht', 'Berichts', 'Berichte', ['lang', 'neu'], { ...OWN, genAlts: ['es'] }),
    noun('m', 'Plan', 'Plans', 'Pläne', ['neu'], OWN),
    noun('m', 'Fehler', 'Fehlers', 'Fehler', ['dumm', 'klein']),
    noun('m', 'Job', 'Jobs', 'Jobs', ['neu']),
    noun('n', 'Projekt', 'Projekts', 'Projekte', ['neu', 'groß'], { ...OWN, genAlts: ['es'] }),
    noun('n', 'Problem', 'Problems', 'Probleme', ['neu', 'groß']),
    noun('n', 'Geschenk', 'Geschenks', 'Geschenke', ['schön', 'groß'], { ...OWN, genAlts: ['es'] }),
    noun('n', 'Gespräch', 'Gesprächs', 'Gespräche', ['wichtig'], { genAlts: ['es'] }),
    noun('f', 'Antwort', 'Antwort', 'Antworten', ['schnell', 'klar'], OWN),
    noun('f', 'Nachricht', 'Nachricht', 'Nachrichten', ['gut'], OWN),
    noun('f', 'Konferenz', 'Konferenz', 'Konferenzen', ['groß', 'international']),
    noun('f', 'Aufgabe', 'Aufgabe', 'Aufgaben', ['schwer', 'neu'], OWN),
    noun('f', 'Entschuldigung', 'Entschuldigung', 'Entschuldigungen', ['offiziell']),
    noun('f', 'Geschichte', 'Geschichte', 'Geschichten', ['alt', 'spannend']),
    noun('f', 'Prüfung', 'Prüfung', 'Prüfungen', ['schwer', 'mündlich'], OWN),
    noun('f', 'Frage', 'Frage', 'Fragen', ['schwierig', 'dumm'], OWN),
    noun('f', 'Lösung', 'Lösung', 'Lösungen', ['gut', 'einfach']),
    noun('f', 'Einladung', 'Einladung', 'Einladungen', ['nett'], OWN),
    noun('f', 'Hilfe', 'Hilfe', null, ['schnell'], { ...OWN, mass: true }),
    noun('f', 'Idee', 'Idee', 'Ideen', ['neu', 'verrückt'], OWN),
    noun('f', 'E-Mail', 'E-Mail', 'E-Mails', ['lang', 'letzt'], OWN),
    noun('f', 'Stelle', 'Stelle', 'Stellen', ['neu']),
  ];
  const NOUNS = Object.fromEntries(NOUN_LIST.map((n) => [n.lemma, n]));

  const PEOPLE = ['Freund', 'Bruder', 'Onkel', 'Kollege', 'Nachbar', 'Mutter', 'Schwester', 'Tante', 'Oma', 'Kollegin', 'Lehrerin', 'Kind', 'Eltern'];
  const PEOPLE_SG = PEOPLE.filter((p) => p !== 'Eltern');

  // A frame: group, preposition, sentence templates ({PP} = the prepositional phrase) and the nouns that fit.
  // opts: case (Wechsel / fixed), why (Wechsel: motion | location | time), verb (fixed), dets, plural, adj: false, two (zwischen),
  //   kinds (which of the learner's Anki nouns fit too: person, place, vehicle, wearable, day — see vocab.js).
  function frame(group, prep, t, nouns, opts = {}) {
    const kinds = nouns.every((k) => PEOPLE.includes(k)) ? ['person'] : [];
    return { group, prep, t, nouns, case: GROUP_CASE[group], dets: DEFAULT_DETS, kinds, ...opts };
  }

  // Two-way scenes: the same nouns with a motion template (Akkusativ) and a location template (Dativ).
  function scene(byPrep, motion, location, opts = {}) {
    return Object.entries(byPrep).flatMap(([prep, nouns]) => [
      frame('wechsel', prep, motion, nouns, { case: 'acc', why: 'motion', ...opts }),
      frame('wechsel', prep, location, nouns, { case: 'dat', why: 'location', ...opts }),
    ]);
  }

  function fixed(caseKey, prep, verb, t, nouns, opts = {}) {
    return frame('fixed', prep, t, nouns, { case: caseKey, verb, ...opts });
  }

  const FRAMES = [
    // Akkusativ
    frame('akk', 'durch', ['Wir laufen {PP}.', 'Jeden Morgen jogge ich {PP}.'], ['Park', 'Wald', 'Stadt', 'Garten']),
    frame('akk', 'durch', ['Die Katze springt {PP}.', 'Er schaut {PP}.'], ['Fenster', 'Tür'], { dets: ['def', 'ein'] }),
    frame('akk', 'für', ['Das Geschenk ist {PP}.', 'Ich koche heute {PP}.', 'Sie kauft Blumen {PP}.'], PEOPLE, { dets: PERSON_DETS, plural: true }),
    frame('akk', 'gegen', ['Das Auto fährt {PP}.'], ['Baum', 'Mauer', 'Wand'], { dets: ['def', 'dies'] }),
    frame('akk', 'gegen', ['Am Samstag spielen wir {PP}.'], ['Mannschaft', 'Team'], { dets: ['def', 'dies', 'ein'] }),
    frame('akk', 'ohne', ['Ich gehe nie {PP} aus dem Haus.'], ['Schirm', 'Jacke', 'Handy', 'Brille'], { dets: ['def', 'poss'], kinds: ['wearable'] }),
    frame('akk', 'ohne', ['{PP} fahre ich nicht in den Urlaub.'], PEOPLE, { dets: ['def', 'poss'], plural: true }),
    frame('akk', 'um', ['Wir laufen {PP}.', 'Am Sonntag joggen wir {PP}.'], ['See', 'Park', 'Haus'], { dets: ['def', 'dies'] }),
    frame('akk', 'um', ['Die Kinder sitzen {PP}.'], ['Tisch', 'Feuer', 'Baum'], { dets: ['def'] }),

    // Dativ
    frame('dat', 'aus', ['Sie kommt gerade {PP}.'], ['Haus', 'Büro', 'Kino', 'Schule', 'Küche', 'Supermarkt', 'Bibliothek'], { dets: ['def'], kinds: ['place', 'room'] }),
    frame('dat', 'aus', ['Er trinkt {PP}.', 'Sie trinkt den Tee {PP}.'], ['Flasche', 'Glas', 'Tasse', 'Becher']),
    frame('dat', 'außer', ['{PP} kommen alle.', '{PP} weiß das niemand.'], PEOPLE, { dets: ['def', 'poss'], plural: true }),
    frame('dat', 'bei', ['Ich wohne zurzeit {PP}.', 'Am Wochenende bin ich {PP}.'], PEOPLE, { dets: ['poss'], plural: true }),
    frame('dat', 'bei', ['Ich bin heute Nachmittag {PP}.', 'Morgen habe ich einen Termin {PP}.'], ['Arzt', 'Zahnarzt', 'Friseur'], { dets: ['def'] }),
    frame('dat', 'gegenüber', ['Die Apotheke ist {PP}.', 'Wir wohnen direkt {PP}.'], ['Bahnhof', 'Kirche', 'Schule', 'Park', 'Supermarkt'], { dets: ['def'], kinds: ['place', 'square'] }),
    frame('dat', 'mit', ['Ich fahre {PP} zur Arbeit.', 'Wir fahren {PP} in die Stadt.'], ['Bus', 'Zug', 'Auto', 'Fahrrad', 'Straßenbahn'], { kinds: ['vehicle'] }),
    frame('dat', 'mit', ['Ich spreche oft {PP}.', 'Am Wochenende gehe ich {PP} ins Kino.'], PEOPLE, { dets: PERSON_DETS, plural: true }),
    frame('dat', 'nach', ['{PP} gehen wir essen.', 'Was machst du {PP}?'], ['Film', 'Konzert', 'Kurs', 'Training', 'Spiel', 'Pause'], { dets: ['def'] }),
    frame('dat', 'seit', ['{PP} lerne ich Deutsch.', 'Wir wohnen {PP} hier.'], ['Jahr', 'Monat', 'Woche'], { dets: ['ein'], adj: false }),
    frame('dat', 'von', ['Das Geschenk ist {PP}.', 'Ich habe eine Nachricht {PP} bekommen.'], PEOPLE, { dets: ['def', 'poss'], plural: true }),
    frame('dat', 'von', ['Ich komme gerade {PP}.'], ['Arzt', 'Bahnhof', 'Training', 'Friseur', 'Post', 'Supermarkt'], { dets: ['def'], kinds: ['place', 'square'] }),
    frame('dat', 'zu', ['Ich gehe jetzt {PP}.', 'Morgen muss ich {PP}.'], ['Arzt', 'Zahnarzt', 'Bahnhof', 'Post', 'Apotheke', 'Bank', 'Friseur'], { dets: ['def'], kinds: ['place', 'square'] }),
    frame('dat', 'zu', ['Am Wochenende fahren wir {PP}.'], PEOPLE, { dets: ['poss'], plural: true }),

    // Wechselpräpositionen: Wohin? → Akkusativ, Wo? → Dativ
    ...scene(
      { auf: ['Tisch', 'Sofa', 'Bett', 'Schreibtisch', 'Kommode', 'Stuhl'], unter: ['Sofa', 'Bett', 'Schrank'], neben: ['Lampe', 'Fernseher', 'Tasche'], in: ['Schublade', 'Tasche', 'Rucksack'] },
      ['Ich lege das Handy {PP}.', 'Sie legt den Schlüssel {PP}.'],
      ['Das Handy liegt {PP}.', 'Der Schlüssel liegt {PP}.'],
    ),
    ...scene(
      { auf: ['Tisch', 'Boden', 'Kommode', 'Regal'], neben: ['Tür', 'Sofa', 'Bett', 'Fenster', 'Schrank'], vor: ['Tür', 'Fenster', 'Schrank'], hinter: ['Tür', 'Sofa', 'Vorhang', 'Schrank'], in: ['Ecke'] },
      ['Ich stelle die Vase {PP}.', 'Er stellt den Koffer {PP}.'],
      ['Die Vase steht {PP}.', 'Der Koffer steht {PP}.'],
    ),
    ...scene({ in: ['Kühlschrank', 'Schrank'] }, ['Ich stelle die Milch {PP}.'], ['Die Milch steht {PP}.']),
    ...scene(
      { an: ['Wand', 'Tür', 'Kühlschrank'], neben: ['Fenster', 'Tür', 'Regal'] },
      ['Ich hänge das Bild {PP}.', 'Sie hängt den Kalender {PP}.'],
      ['Das Bild hängt {PP}.', 'Der Kalender hängt {PP}.'],
    ),
    ...scene({ über: ['Tisch', 'Sofa', 'Bett', 'Schreibtisch'] }, ['Wir hängen die Lampe {PP}.'], ['Die Lampe hängt {PP}.']),
    ...scene({ auf: ['Sofa', 'Stuhl', 'Bank', 'Boden'] }, ['Das Kind setzt sich {PP}.', 'Ich setze mich {PP}.'], ['Das Kind sitzt {PP}.', 'Ich sitze gern {PP}.']),
    ...scene({ neben: PEOPLE_SG }, ['Ich setze mich {PP}.'], ['Ich sitze {PP}.'], { dets: ['def', 'poss'] }),
    ...scene({ zwischen: PEOPLE_SG.filter((p) => p !== 'Kind') }, ['Das Kind setzt sich {PP}.'], ['Das Kind sitzt {PP}.'], { dets: ['poss'], adj: false, two: true, kinds: ['person'] }),
    ...scene({ zwischen: ['Sofa', 'Schrank', 'Bett', 'Fenster', 'Regal', 'Tür'] }, ['Ich stelle die Lampe {PP}.'], ['Die Lampe steht {PP}.'], { dets: ['def'], adj: false, two: true }),
    ...scene(
      { in: ['Park', 'Kino', 'Stadt', 'Garten', 'Museum', 'Küche', 'Büro', 'Supermarkt', 'Bibliothek'] },
      ['Wir gehen heute {PP}.', 'Die Kinder laufen {PP}.'],
      ['Wir sind gerade {PP}.', 'Ich warte {PP} auf dich.', 'Wir treffen uns {PP}.'],
      { dets: ['def', 'dies'], kinds: ['place', 'room'] },
    ),
    ...scene({ an: ['See', 'Meer', 'Strand', 'Fluss'] }, ['Im Sommer fahren wir {PP}.', 'Am Wochenende fahren wir {PP}.'], ['Wir machen Urlaub {PP}.', 'Die Kinder spielen {PP}.'], { dets: ['def'] }),
    ...scene({ auf: ['Markt', 'Spielplatz', 'Party'] }, ['Am Samstag gehen wir {PP}.'], ['Wir treffen uns {PP}.', 'Ich habe sie {PP} gesehen.'], { dets: ['def'], kinds: ['square'] }),
    ...scene({ hinter: ['Haus', 'Garage', 'Baum', 'Sofa'], unter: ['Tisch', 'Auto', 'Sofa'] }, ['Der Ball rollt {PP}.'], ['Der Ball liegt {PP}.'], { dets: ['def'] }),
    ...scene({ vor: ['Haus', 'Garage', 'Kirche'], in: ['Garage'] }, ['Er fährt das Auto {PP}.'], ['Das Auto steht {PP}.'], { dets: ['def', 'dies'] }),
    frame('wechsel', 'vor', ['Ich war {PP} in Berlin.', '{PP} habe ich sie zuletzt gesehen.'], ['Woche', 'Jahr', 'Monat'], { case: 'dat', why: 'time', dets: ['ein'], adj: false }),
    frame('wechsel', 'in', ['Ich bin {PP} fertig.', 'Wir sehen uns {PP}.'], ['Stunde', 'Woche', 'Monat'], { case: 'dat', why: 'time', dets: ['ein'], adj: false }),
    frame('wechsel', 'an', ['Wir treffen uns {PP}.', 'Ich habe {PP} keine Zeit.'], ['Montag', 'Abend', 'Wochenende'], { case: 'dat', why: 'time', dets: ['def'], adj: false, kinds: ['day'] }),

    // Genitiv
    frame('gen', 'während', ['{PP} schläft er immer ein.', '{PP} darf man nicht telefonieren.'], ['Film', 'Konzert', 'Unterricht', 'Fahrt', 'Reise'], { dets: ['def'] }),
    frame('gen', 'trotz', ['{PP} gehen wir spazieren.', '{PP} fahren wir mit dem Fahrrad.'], ['Regen', 'Kälte', 'Wetter', 'Hitze', 'Wind'], { dets: ['def', 'dies'] }),
    frame('gen', 'trotz', ['{PP} kaufen viele Leute dort ein.'], ['Preise'], { dets: ['def', 'none'] }),
    frame('gen', 'wegen', ['{PP} kommt der Bus zu spät.', 'Er kommt {PP} zu spät.'], ['Stau', 'Unfall', 'Streik', 'Baustelle', 'Wetter'], { dets: ['def', 'ein'] }),
    frame('gen', 'statt', ['{PP} nehme ich heute das Fahrrad.'], ['Auto', 'Bus', 'Zug'], { dets: ['def'], kinds: ['vehicle'] }),
    frame('gen', 'innerhalb', ['Sie bekommen {PP} eine Antwort.', 'Das Paket kommt {PP}.'], ['Woche', 'Monat', 'Stunde'], { dets: ['ein'], adj: false }),
    frame('gen', 'außerhalb', ['Wir wohnen {PP}.', 'Das Hotel liegt {PP}.'], ['Stadt', 'Zentrum'], { dets: ['def'] }),

    // Verbs with fixed prepositions: the verb decides the case.
    fixed('acc', 'auf', 'warten auf', ['Ich warte {PP}.', 'Wir warten schon lange {PP}.'], ['Bus', 'Zug', 'Antwort', 'Freund', 'Kollegin'], { kinds: ['person', 'vehicle'] }),
    fixed('acc', 'an', 'denken an', ['Ich denke oft {PP}.'], ['Mutter', 'Freund', 'Oma', 'Urlaub', 'Kind'], { dets: ['def', 'poss'], kinds: ['person'] }),
    fixed('acc', 'an', 'sich erinnern an', ['Erinnerst du dich {PP}?'], ['Urlaub', 'Reise', 'Sommer', 'Nachbar', 'Lehrerin'], { dets: ['def', 'poss'], kinds: ['person'] }),
    fixed('acc', 'an', 'sich gewöhnen an', ['Ich gewöhne mich langsam {PP}.'], ['Stadt', 'Wetter', 'Kälte', 'Job'], { dets: ['def', 'dies', 'poss'] }),
    fixed('dat', 'an', 'teilnehmen an', ['Sie nimmt {PP} teil.', 'Nächste Woche nehmen wir {PP} teil.'], ['Kurs', 'Wettbewerb', 'Konferenz', 'Training'], { dets: ['def', 'ein'] }),
    fixed('dat', 'an', 'arbeiten an', ['Wir arbeiten gerade {PP}.'], ['Projekt', 'Bericht', 'Aufgabe']),
    fixed('acc', 'auf', 'sich freuen auf', ['Ich freue mich schon {PP}.'], ['Urlaub', 'Wochenende', 'Party', 'Reise'], { dets: ['def', 'poss'] }),
    fixed('acc', 'über', 'sich freuen über', ['Sie freut sich sehr {PP}.'], ['Geschenk', 'Nachricht', 'Besuch']),
    fixed('acc', 'auf', 'aufpassen auf', ['Kannst du heute {PP} aufpassen?'], ['Kind', 'Hund'], { dets: ['def', 'poss'] }),
    fixed('dat', 'auf', 'bestehen auf', ['Er besteht {PP}.'], ['Antwort', 'Entschuldigung'], { dets: ['def', 'ein'] }),
    fixed('acc', 'über', 'sprechen über', ['Wir sprechen {PP}.', 'Lass uns morgen {PP} sprechen.'], ['Problem', 'Plan', 'Film', 'Reise']),
    fixed('acc', 'über', 'sich ärgern über', ['Er ärgert sich {PP}.'], ['Stau', 'Wetter', 'Fehler', 'Kollege']),
    fixed('acc', 'für', 'sich interessieren für', ['Sie interessiert sich {PP}.'], ['Projekt', 'Kurs', 'Geschichte', 'Film']),
    fixed('acc', 'um', 'sich kümmern um', ['Wer kümmert sich {PP}?'], ['Kind', 'Hund', 'Garten', 'Oma'], { dets: ['def', 'poss'], kinds: ['person'] }),
    fixed('dat', 'vor', 'Angst haben vor', ['Das Kind hat Angst {PP}.'], ['Hund', 'Gewitter', 'Prüfung'], { dets: ['def', 'dies'] }),
    fixed('dat', 'von', 'träumen von', ['Er träumt {PP}.'], ['Haus', 'Reise', 'Urlaub'], { dets: ['def', 'ein'] }),
    fixed('acc', 'in', 'sich verlieben in', ['Er hat sich {PP} verliebt.'], ['Kollegin', 'Nachbar', 'Stadt'], { dets: ['def'] }),
    fixed('dat', 'mit', 'sich beschäftigen mit', ['Ich beschäftige mich gerade {PP}.'], ['Problem', 'Projekt', 'Frage']),
    fixed('dat', 'nach', 'suchen nach', ['Ich suche schon lange {PP}.'], ['Schlüssel', 'Brille', 'Handy', 'Lösung'], { dets: ['def', 'poss'], kinds: ['wearable'] }),
    fixed('dat', 'zu', 'einladen zu', ['Sie lädt uns {PP} ein.'], ['Party', 'Hochzeit'], { dets: ['def'] }), // not "zu meiner Party"
    fixed('acc', 'für', 'sich bedanken für', ['Ich bedanke mich {PP}.'], ['Geschenk', 'Hilfe', 'Einladung'], { dets: ['def', 'poss'] }),
    fixed('dat', 'vor', 'schützen vor', ['Die Jacke schützt {PP}.'], ['Regen', 'Kälte', 'Wind'], { dets: ['def'] }),
    fixed('dat', 'von', 'halten von', ['Was hältst du {PP}?'], ['Plan', 'Idee', 'Film'], { dets: ['def', 'dies'] }),
    fixed('acc', 'auf', 'sich vorbereiten auf', ['Ich bereite mich {PP} vor.'], ['Prüfung', 'Reise', 'Gespräch'], { dets: ['def', 'poss'] }),
    fixed('acc', 'auf', 'antworten auf', ['Er antwortet nicht {PP}.'], ['E-Mail', 'Frage'], { dets: ['def', 'poss'] }),
    fixed('dat', 'bei', 'sich entschuldigen bei', ['Ich entschuldige mich {PP}.'], ['Kollegin', 'Lehrerin', 'Nachbar', 'Kollege'], { dets: ['def', 'poss'], kinds: ['person'] }),
    fixed('dat', 'mit', 'telefonieren mit', ['Ich telefoniere jeden Tag {PP}.'], PEOPLE, { dets: ['def', 'poss'], plural: true }),
    fixed('acc', 'um', 'sich bewerben um', ['Sie bewirbt sich {PP}.'], ['Stelle', 'Job'], { dets: ['def', 'ein'] }),
  ];

  // da- / wo-words: per fixed pair, a statement to answer and the question it answers ({Q} = the wo-word or "auf wen").
  // No question for "halten von" ("Was hältst du davon?" is the statement already); "sich verlieben in" takes no da-word.
  const DA_QUESTIONS = {
    'warten auf': ['Ich warte {PP}.', '{Q} wartest du?'],
    'denken an': ['Ich denke oft {PP}.', '{Q} denkst du oft?'],
    'sich erinnern an': ['Ich erinnere mich gut {PP}.', '{Q} erinnerst du dich?'],
    'sich gewöhnen an': ['Ich gewöhne mich langsam {PP}.', '{Q} gewöhnst du dich langsam?'],
    'teilnehmen an': ['Sie nimmt {PP} teil.', '{Q} nimmt sie teil?'],
    'arbeiten an': ['Wir arbeiten gerade {PP}.', '{Q} arbeitet ihr gerade?'],
    'sich freuen auf': ['Ich freue mich schon {PP}.', '{Q} freust du dich schon?'],
    'sich freuen über': ['Sie freut sich sehr {PP}.', '{Q} freut sie sich so?'],
    'aufpassen auf': ['Ich passe heute {PP} auf.', '{Q} passt du heute auf?'],
    'bestehen auf': ['Er besteht {PP}.', '{Q} besteht er?'],
    'sprechen über': ['Wir sprechen {PP}.', '{Q} sprecht ihr?'],
    'sich ärgern über': ['Er ärgert sich {PP}.', '{Q} ärgert er sich?'],
    'sich interessieren für': ['Sie interessiert sich {PP}.', '{Q} interessiert sie sich?'],
    'sich kümmern um': ['Ich kümmere mich {PP}.', '{Q} kümmerst du dich?'],
    'Angst haben vor': ['Das Kind hat Angst {PP}.', '{Q} hat das Kind Angst?'],
    'träumen von': ['Er träumt {PP}.', '{Q} träumt er?'],
    'sich beschäftigen mit': ['Ich beschäftige mich gerade {PP}.', '{Q} beschäftigst du dich gerade?'],
    'suchen nach': ['Ich suche schon lange {PP}.', '{Q} suchst du schon lange?'],
    'einladen zu': ['Sie lädt uns {PP} ein.', '{Q} lädt sie uns ein?'],
    'sich bedanken für': ['Ich bedanke mich {PP}.', '{Q} bedankst du dich?'],
    'schützen vor': ['Die Jacke schützt {PP}.', '{Q} schützt die Jacke?'],
    'halten von': ['Was hältst du {PP}?', null],
    'sich vorbereiten auf': ['Ich bereite mich {PP} vor.', '{Q} bereitest du dich vor?'],
    'antworten auf': ['Er antwortet nicht {PP}.', '{Q} antwortet er nicht?'],
    'sich entschuldigen bei': ['Ich entschuldige mich {PP}.', '{Q} entschuldigst du dich?'],
    'telefonieren mit': ['Ich telefoniere jeden Tag {PP}.', '{Q} telefonierst du jeden Tag?'],
    'sich bewerben um': ['Sie bewirbt sich {PP}.', '{Q} bewirbt sie sich?'],
  };
  const DA_FRAMES = FRAMES.filter((f) => f.group === 'fixed' && DA_QUESTIONS[f.verb]);
  // A verb in the table that matches no frame (a typo) would silently drop out of the drill.
  for (const verb of Object.keys(DA_QUESTIONS)) if (!DA_FRAMES.some((f) => f.verb === verb)) throw new Error(`no fixed frame for ${verb}`);

  // ---------- The learner's nouns ----------

  const PLACE_ADJS = ['neu', 'klein', 'schön', 'alt'];
  const KIND_ADJS = {
    person: ['alt', 'nett', 'jung'], // not neu: "zu meinen neuen Eltern"
    wearable: ['neu', 'alt', 'schön', 'schwarz'],
    vehicle: ['neu', 'alt'],
    place: PLACE_ADJS,
    room: PLACE_ADJS,
    square: PLACE_ADJS,
    day: [],
  };

  // A vocab.js noun in this topic's shape, with its note: possessives for family and things (not "bei seinen
  // Personen"), family members only with a possessive.
  function fromVocab(n) {
    const adjs = n.adjs || KIND_ADJS[n.kinds.find((k) => KIND_ADJS[k])];
    const opts = { kinds: n.kinds, mass: n.mass, own: n.own, onlyOne: n.onlyOne, note: n.note };
    if (n.family) opts.dets = ['poss', 'none'];
    if (!n.sg) return pluralOnly(n.pl[0], adjs, opts);
    return noun(n.g, n.sg[0], n.sg[3], n.pl ? n.pl[0] : null, adjs, { ...opts, obl: n.obl, genAlts: n.genAlts });
  }

  // The frame's nouns: the learner's where enough fit (and the frame takes their kind), else the built-in ones too
  // (vocab.prefer).
  // Like the built-in lists: plural-only nouns only where the frame takes plurals, and no noun the sentence already has
  // ("Das Kind setzt sich zwischen …" never gets "Kind" again).
  function candidates(fr, withAdj, source) {
    const builtin = fr.nouns.map((k) => NOUNS[k]);
    if (source !== 'anki' || !fr.kinds.length) return builtin;
    const plurals = fr.plural || builtin.some((n) => n.plOnly);
    const mine = vocab.nouns
      .filter((n) => n.kinds.some((k) => fr.kinds.includes(k) && KIND_ADJS[k]))
      .filter((n) => (plurals || n.sg) && !fr.t.some((t) => t.includes(n.lemma)))
      .map(fromVocab)
      .filter((n) => detChoices(fr, n, !!n.plOnly, withAdj).length);
    return vocab.prefer(mine, builtin);
  }

  // ---------- Building a sentence ----------

  function adjectivesFor(noun, det) {
    return noun.adjs.filter((a) => det.definite || !DEFINITE_ADJS.includes(a));
  }

  // Determiner kinds that fit the frame, this noun and number (and leave an adjective when one is wanted).
  function detChoices(fr, noun, plural, withAdj) {
    return fr.dets.map((key) => DETS[key]).filter((det) => {
      if (noun.dets && !noun.dets.includes(det.key)) return false;
      if (det.countSg && (plural || noun.mass)) return false;
      if (det.own && !vocab.possessiveFits(noun, plural)) return false;
      if (det.plAdj && !(plural && withAdj)) return false;
      return !withAdj || adjectivesFor(noun, det).length > 0;
    });
  }

  // The noun as a gap when its ending carries case: dative plural -n, n-declension, masculine / neuter genitive.
  function nounToken(noun, plural, ci) {
    const ending = (base, form, extra) => gap('noun', 'noun ending', base, form.slice(base.length), extra);
    if (plural) {
      const dat = datPlural(noun.pl);
      return dat === noun.pl ? noun.pl : ending(noun.pl, ci === 2 ? dat : noun.pl);
    }
    if (noun.obl) return ending(noun.nom, noun.obl);
    if (ci === 3 && noun.g !== 'f') return ending(noun.nom, noun.gen, { alts: noun.genAlts });
    return noun.nom;
  }

  // One noun phrase: its named gaps (det / adj / noun, each possibly absent) and its tokens, preposition not included.
  function nounPhrase(fr, noun, ci, withAdj, rnd) {
    // Plural only where a determiner still fits ("bei meinen Brüdern", but no "bei ihren Müttern").
    const plural = noun.plOnly || (!!fr.plural && !!noun.pl && rnd() < 0.3 && detChoices(fr, noun, true, withAdj).length > 0);
    const gender = plural ? 'pl' : noun.g;
    const det = pickWeighted(detChoices(fr, noun, plural, withAdj), rnd);
    const stem = det.stems.length ? pick(det.stems, rnd) : null;
    const adj = withAdj ? pick(adjectivesFor(noun, det), rnd) : null;
    const np = { noun, plural, gender, kind: det.key, tokens: [] };
    if (stem) np.det = gap('det', 'article ending', stem, DET_ENDINGS[det.table][gender][ci]);
    if (adj) np.adj = gap('adj', 'adjective ending', adj, ADJ_ENDINGS[det.variant][gender][ci]);
    const last = nounToken(noun, plural, ci);
    if (typeof last === 'object') np.nounGap = last;
    for (const t of [np.det, np.adj]) if (t) np.tokens.push(t, ' ');
    np.tokens.push(last);
    return np;
  }

  // Definite article + an/in/bei/von/zu: one gap for preposition and article, so a contraction ("im") never gives the case away.
  function contracted(prep, np) {
    if (np.kind !== 'def' || !CONTRACTIONS[prep]) return null;
    const article = np.det.prefix + np.det.answer;
    return { article, short: CONTRACTIONS[prep][article], gap: contractionGap(prep, article) };
  }

  function buildItem(group, caseKey, settings = {}, rnd = Math.random, recent = { preps: [], nouns: [] }) {
    if (group === 'da') return daItem(settings, rnd, recent);
    const frames = FRAMES.filter((f) => f.group === group && (!caseKey || f.case === caseKey));
    if (!frames.length) throw new Error(`no ${group} frames for ${caseKey}`);
    const fr = pickFresh(frames, recent.preps, (f) => f.prep, rnd);
    const ci = CASES.indexOf(fr.case);
    const withAdj = settings.adjectives !== false && fr.adj !== false;
    const pool = candidates(fr, withAdj, settings.vocab);
    const first = vocab.pickDue(pool, rnd, { recent: recent.nouns });
    const nounKey = first.lemma;
    const nps = [nounPhrase(fr, first, ci, withAdj, rnd)];
    if (fr.two) nps.push(nounPhrase(fr, vocab.pickDue(pool.filter((n) => n.lemma !== nounKey), rnd, { recent: recent.nouns }), ci, withAdj, rnd));

    // zwischen (the only two-noun frame) never contracts.
    const contraction = fr.two ? null : contracted(fr.prep, nps[0]);
    const pp = contraction
      ? nps[0].tokens.map((t) => (t === nps[0].det ? contraction.gap : t))
      : [fr.prep, ' ', ...nps.flatMap((np, i) => (i ? [' und ', ...np.tokens] : np.tokens))];

    const [before, after] = pick(fr.t, rnd).split('{PP}');
    const tokens = capitalizeFirst([before, ...pp, after].filter((t) => t !== ''));

    const item = { group, prep: fr.prep, case: fr.case, gender: nps[0].gender, noun: nounKey, frame: fr, tokens, notes: vocab.notesOf(...nps.map((np) => np.noun)) };
    item.tags = tags(item, nps);
    item.explain = explain(item, nps, contraction);
    return item;
  }

  // ---------- da- and wo-words ----------

  // People and animals: the preposition takes a pronoun ("auf ihn", "auf wen"); things become a da- / wo-word.
  const ANIMATE = new Set([...PEOPLE, 'Hund']);
  const isAnimate = (noun) => (noun.kinds ? noun.kinds.some((k) => k === 'person' || k === 'animal') : ANIMATE.has(noun.lemma));
  const QUESTION_WORDS = { acc: 'wen', dat: 'wem' };
  const { startsWithVowel, daWord, woWord } = declension;

  // The noun phrase as the prompt shows it, contraction included ("zum Arzt").
  function phraseText(prep, np) {
    const words = cloze.text({ tokens: np.tokens });
    const short = contracted(prep, np)?.short;
    return short ? `${short} ${words.split(' ').slice(1).join(' ')}` : `${prep} ${words}`;
  }

  // Nouns a da-item can take: no neuter people or animals in the singular ("auf es" is not said).
  function daCandidates(fr, source) {
    return candidates(fr, false, source).filter((n) => !(isAnimate(n) && n.g === 'n'));
  }

  // A statement with a da-word ("Ich warte darauf.") or the question to an answer ("Worauf wartest du?").
  function daItem(settings, rnd, recent) {
    const usable = DA_FRAMES.map((fr) => ({ fr, nouns: daCandidates(fr, settings.vocab) })).filter((x) => x.nouns.length);
    const { fr, nouns } = pickFresh(usable, recent.preps, (x) => x.fr.prep, rnd);
    const ci = CASES.indexOf(fr.case);
    const noun = vocab.pickDue(nouns, rnd, { recent: recent.nouns });
    // The article is not what is drilled here: a plain one where it fits ("für die Hilfe", not "für unsere Hilfe").
    const plain = { ...fr, dets: fr.dets.filter((d) => d !== 'poss') };
    const np = nounPhrase(detChoices(plain, noun, false, false).length ? plain : fr, noun, ci, false, rnd);
    const person = isAnimate(noun);
    const [statement, question] = DA_QUESTIONS[fr.verb];
    const asking = !!question && rnd() < 0.5;
    const template = asking ? statement : pick(fr.t, rnd);
    const answerSentence = template.replace('{PP}', phraseText(fr.prep, np));

    let answer;
    if (asking) answer = person ? `${fr.prep} ${QUESTION_WORDS[fr.case]}` : woWord(fr.prep);
    else answer = person ? `${fr.prep} ${THIRD_PERSON[np.gender][fr.case]}` : daWord(fr.prep);
    const [before, after] = (asking ? question.replace('{Q}', '{PP}') : template).split('{PP}');
    const tokens = capitalizeFirst([before, wordGap('da', answer, asking ? 'question word' : 'da-word or pronoun'), after].filter((t) => t !== ''));

    const item = {
      group: 'da', prep: fr.prep, case: fr.case, gender: np.gender, noun: noun.lemma, frame: fr, tokens, notes: vocab.notesOf(noun),
      prompt: { label: asking ? 'Antwort' : 'Ersetze', text: answerSentence },
    };
    item.tags = [
      { text: fr.verb, cls: 'c-da' },
      { text: CASE_LABELS[fr.case], cls: 'plain' },
      { text: person ? 'Person' : 'Sache', cls: 'plain' },
    ];
    item.explain = daExplain(fr, asking, person, np.gender);
    return item;
  }

  function daExplain(fr, asking, person, gender) {
    const { prep, verb } = fr;
    const r = startsWithVowel(prep) ? ` (with "r" because ${prep} starts with a vowel)` : '';
    if (person && asking) return `Asking about a person: ${prep} + ${QUESTION_WORDS[fr.case]} (${CASE_LABELS[fr.case]}, the case of ${verb}). wo-words are for things only.`;
    if (person) return `A person: ${prep} + pronoun in the ${CASE_LABELS[fr.case]} (${GENDER_LABELS[gender]}) → ${prep} ${THIRD_PERSON[gender][fr.case]}. da-words stand for things only.`;
    if (asking) return `Asking about a thing: wo + ${prep} → ${woWord(prep)}${r}.`;
    return `A thing: da + ${prep} → ${daWord(prep)}${r}.`;
  }

  // Wechsel: why the case is what it is.
  const WHY = {
    motion: { q: 'Wohin?', rule: (p) => `${p} + movement toward a place (Wohin?) → Akkusativ.` },
    location: { q: 'Wo?', rule: (p) => `${p} + a position (Wo?) → Dativ.` },
    time: { q: 'Wann?', rule: (p) => `Time expression with ${p} (Wann?) → Dativ.` },
  };

  function tags(item, nps) {
    let head = `${item.prep} + ${CASE_SHORT[item.case]}`;
    if (item.group === 'wechsel') head = `${item.prep} · ${WHY[item.frame.why].q}`;
    else if (item.group === 'fixed') head = item.frame.verb;
    return [
      { text: head, cls: `c-${item.group}` },
      { text: CASE_LABELS[item.case], cls: 'plain' },
      { text: [...new Set(nps.map((np) => GENDER_LABELS[np.gender]))].join(' + '), cls: `g-${item.gender}` },
    ];
  }

  function explain(item, nps, contraction) {
    const np = nps[0];
    const { prep, frame } = item;
    const caseLabel = CASE_LABELS[item.case];
    const parts = [];
    if (item.group === 'wechsel') parts.push(WHY[frame.why].rule(prep));
    else if (item.group === 'fixed') {
      const twoWay = PREPOSITIONS.wechsel.includes(prep);
      parts.push(`${frame.verb} + ${caseLabel} is a fixed pair${twoWay ? ' — the Wo?/Wohin? rule does not apply' : ''}.`);
    } else parts.push(`${prep} always takes the ${caseLabel}.`);

    if (contraction?.short) parts.push(`${prep} + ${contraction.article} → ${contraction.short}.`);

    if (np.adj) {
      const ending = display(np.adj.answer);
      if (!np.det) parts.push(`No article → the adjective shows the case: ${ending}.`);
      else {
        const detWord = np.det.prefix + np.det.answer;
        parts.push(np.det.answer ? `After "${detWord}" the adjective takes ${ending}.` : `"${detWord}" has no ending → the adjective shows it: ${ending}.`);
      }
    }

    const nounNotes = nps.filter((x) => x.nounGap).map((x) => {
      if (x.plural) return item.case === 'dat' ? 'Dative plural adds -n to the noun.' : 'The plural noun takes no ending here — only the dative plural adds -n.';
      if (x.noun.obl) return `${x.noun.nom} is an n-noun: ${x.noun.obl} in every case but the nominative.`;
      return `Masculine and neuter nouns add -(e)s in the genitive: ${x.noun.gen}.`;
    });
    return [...parts, ...new Set(nounNotes)].join(' ');
  }

  // Each selected group in turn; Wechsel counts twice (motion and location), so both sides get drilled.
  function combos(groups) {
    return groups.flatMap((g) => (g === 'wechsel' ? [{ group: g, case: 'acc' }, { group: g, case: 'dat' }] : [{ group: g, case: null }]));
  }

  function buildRound(settings, rnd = Math.random) {
    const all = combos(settings.groups);
    const recent = { preps: [], nouns: [] };
    const items = [];
    let queue = [];
    while (items.length < settings.length) {
      if (!queue.length) queue = shuffle(all, rnd);
      const { group, case: caseKey } = queue.shift();
      const item = buildItem(group, caseKey, settings, rnd, recent);
      remember(recent.preps, item.prep, 3);
      remember(recent.nouns, item.noun, 5);
      items.push(item);
    }
    return items;
  }

  // ---------- Case table ----------

  // The groups the case table holds: the chosen ones with a case of their own, or all of those when none is chosen.
  function caseGroups(groups = []) {
    const chosen = groups.filter((g) => PREPOSITIONS[g]);
    return chosen.length ? chosen : Object.keys(PREPOSITIONS);
  }

  function caseTable(settings, rnd = Math.random) {
    const preps = shuffle(caseGroups(settings.groups).flatMap((g) => PREPOSITIONS[g].map((p) => ({ p, g }))), rnd);
    const size = 6;
    const blocks = [];
    for (let i = 0; i < preps.length; i += size) {
      const chunk = preps.slice(i, i + size);
      blocks.push({
        rows: chunk.map((x) => x.p),
        cols: [{ head: 'Fall', label: 'case' }],
        answers: [chunk.map((x) => CASE_ANSWERS[x.g])],
      });
    }
    return {
      title: 'Which case?',
      lead: 'Type A (Akkusativ), D (Dativ), A/D (Wechsel) or G (Genitiv) for each preposition.',
      blocks,
    };
  }

  function tableStep(settings, rnd) {
    return { type: 'table', label: 'Case table', table: caseTable(settings, rnd) };
  }

  function drillStep(settings, rnd) {
    return {
      type: 'drill',
      label: 'Sentences',
      hint: 'Tab moves between gaps · leave a gap empty (or type -) for no ending · "in + d…": type the contraction (im, ins, zum …) or both words'
        + (settings.groups.includes('da') ? ' · da-words: type the whole word (darauf, auf ihn)' : ''),
      hideTags: !settings.hints,
      items: buildRound(settings, rnd),
    };
  }

  // n sentences in the settings' scope, for a round here and for the Daily review.
  const sentences = (settings, n, rnd = Math.random) => drillStep({ ...settings, length: n }, rnd);

  return {
    id: 'prepositions',
    title: 'Präpositionen',
    subtitle: 'Prepositions and their cases — Akk, Dat, Wechsel, Gen and fixed verb pairs.',
    intro: vocab.intro('Name the case each preposition takes, then fill in the article, adjective and noun endings the preposition forces in sentences.', (n) => n.kinds.some((k) => KIND_ADJS[k])),
    defaults: { groups: ['akk', 'dat', 'wechsel', 'fixed'], adjectives: true, hints: false, length: 10, vocab: 'anki' },
    prepare: vocab.prepare,
    options: [
      {
        key: 'groups', label: 'Prepositions', type: 'checkboxes', min: 1, table: caseGroups,
        choices: GROUPS.map((value) => ({
          value,
          label: GROUP_LABELS[value],
          detail: GROUP_DETAILS[value] || PREPOSITIONS[value].join(', '),
        })),
      },
      vocab.OPTION,
      { key: 'adjectives', label: 'Adjectives', type: 'toggle', text: 'Add an adjective to the noun phrase' },
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
          // The sentences first, so the case table's draws leave them as sentences() alone makes them.
          const drill = sentences(settings, settings.length, rnd);
          return [tableStep(settings, rnd), drill];
        },
      },
      { label: 'Case table only', build: (settings, rnd) => [tableStep(settings, rnd)] },
    ],

    PREPOSITIONS, NOUNS, FRAMES,
    detChoices, candidates, buildItem, buildRound, caseTable,
  };
});
