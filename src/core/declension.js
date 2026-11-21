// Shared declension tables: cases, genders, article and adjective endings.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Etudes ||= { topics: [] }).declension = api;
})(globalThis, function () {
  'use strict';

  const CASES = ['nom', 'acc', 'dat', 'gen'];
  const GENDERS = ['m', 'f', 'n', 'pl'];

  const CASE_LABELS = { nom: 'Nominativ', acc: 'Akkusativ', dat: 'Dativ', gen: 'Genitiv' };
  const CASE_SHORT = { nom: 'Nom', acc: 'Akk', dat: 'Dat', gen: 'Gen' };
  const GENDER_LABELS = { m: 'maskulin', f: 'feminin', n: 'neutrum', pl: 'Plural' };
  const GENDER_SHORT = { m: 'M', f: 'F', n: 'N', pl: 'Pl' };

  // Row labels and gender columns of an endings table (Nom → Gen down, M F N Pl across).
  const CASE_ROWS = CASES.map((c) => CASE_SHORT[c]);
  const GENDER_COLS = GENDERS.map((g) => ({ head: GENDER_SHORT[g], cls: `g-${g}`, label: GENDER_LABELS[g] }));

  // Adjective endings: variant → gender → [nom, acc, dat, gen].
  const ADJ_ENDINGS = {
    strong: { m: ['er', 'en', 'em', 'en'], f: ['e', 'e', 'er', 'er'], n: ['es', 'es', 'em', 'en'], pl: ['e', 'e', 'en', 'er'] },
    weak: { m: ['e', 'en', 'en', 'en'], f: ['e', 'e', 'en', 'en'], n: ['e', 'e', 'en', 'en'], pl: ['en', 'en', 'en', 'en'] },
    mixed: { m: ['er', 'en', 'en', 'en'], f: ['e', 'e', 'en', 'en'], n: ['es', 'es', 'en', 'en'], pl: ['en', 'en', 'en', 'en'] },
  };

  // Determiner endings after the stem: d-er, dies-er, ein-∅ …
  const DET_ENDINGS = {
    der: { m: ['er', 'en', 'em', 'es'], f: ['ie', 'ie', 'er', 'er'], n: ['as', 'as', 'em', 'es'], pl: ['ie', 'ie', 'en', 'er'] },
    dies: { m: ['er', 'en', 'em', 'es'], f: ['e', 'e', 'er', 'er'], n: ['es', 'es', 'em', 'es'], pl: ['e', 'e', 'en', 'er'] },
    ein: { m: ['', 'en', 'em', 'es'], f: ['e', 'e', 'er', 'er'], n: ['', '', 'em', 'es'], pl: ['e', 'e', 'en', 'er'] },
  };

  // Prepositions by the case they take; wechsel = Akkusativ (Wohin?) or Dativ (Wo?).
  const PREPOSITIONS = {
    akk: ['durch', 'für', 'gegen', 'ohne', 'um', 'bis'],
    dat: ['aus', 'außer', 'bei', 'gegenüber', 'mit', 'nach', 'seit', 'von', 'zu'],
    wechsel: ['an', 'auf', 'hinter', 'in', 'neben', 'über', 'unter', 'vor', 'zwischen'],
    gen: ['während', 'trotz', 'wegen', 'statt', 'innerhalb', 'außerhalb'],
  };

  // Standard contractions of preposition + definite article.
  const CONTRACTIONS = {
    an: { dem: 'am', das: 'ans' },
    in: { dem: 'im', das: 'ins' },
    bei: { dem: 'beim' },
    von: { dem: 'vom' },
    zu: { dem: 'zum', der: 'zur' },
  };

  // One gap for preposition + definite article, so a contraction ("im") never gives the case away by its shape.
  // Accepts the contraction or both words.
  function contractionGap(prep, article) {
    const short = CONTRACTIONS[prep]?.[article];
    const full = `${prep} ${article}`;
    return { slot: 'det', label: 'preposition and article', prefix: '', answer: short || full, alts: short ? [full] : [], placeholder: `${prep} + d…` };
  }

  // Third-person pronouns by the noun's gender: der Tisch → er / ihn / ihm.
  const THIRD_PERSON = {
    m: { nom: 'er', acc: 'ihn', dat: 'ihm' },
    f: { nom: 'sie', acc: 'sie', dat: 'ihr' },
    n: { nom: 'es', acc: 'es', dat: 'ihm' },
    pl: { nom: 'sie', acc: 'sie', dat: 'ihnen' },
  };

  // A possessive (or any ein-word stem) with its ending; euer drops its e before one (eure, eurem). endings: DET_ENDINGS.ein
  // before a noun, DET_ENDINGS.dies standing alone (meiner).
  function possessive(stem, gender, caseKey, endings = DET_ENDINGS.ein) {
    const ending = endings[gender][CASES.indexOf(caseKey)];
    return (stem === 'euer' && ending ? 'eur' : stem) + ending;
  }

  // da- / wo- + preposition, with r before a vowel: darauf, worauf; damit, womit.
  const startsWithVowel = (prep) => /^[aeiouäöü]/.test(prep);
  const daWord = (prep) => (startsWithVowel(prep) ? 'dar' : 'da') + prep;
  const woWord = (prep) => (startsWithVowel(prep) ? 'wor' : 'wo') + prep;

  // Dative plural adds -n unless the plural already ends in -n or -s.
  function datPlural(pl) {
    return /[ns]$/.test(pl) ? pl : pl + 'n';
  }

  return { CASES, GENDERS, CASE_LABELS, CASE_SHORT, GENDER_LABELS, GENDER_SHORT, CASE_ROWS, GENDER_COLS, ADJ_ENDINGS, DET_ENDINGS, PREPOSITIONS, CONTRACTIONS, THIRD_PERSON, possessive, contractionGap, datPlural, startsWithVowel, daWord, woWord };
});
