// Shared vocabulary: nouns with their case forms, grouped by category (person, animal, thing, food, weather, quality).
// Countable nouns have singular and plural forms; mass nouns only a singular and work without an article.
// A noun is { cat, g, lemma, sg: [N, A, D, G] | null, pl: [N, A, D, G] | null, adjs?, mass } — the learner's Anki nouns
// (vocab.js) have the same shape, with pl null when the card gives no plural and sg null for plural-only nouns.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./declension.js'));
  else root.Etudes.lexicon = factory(root.Etudes.declension);
})(globalThis, function (declension) {
  'use strict';

  const { datPlural } = declension;

  const CATEGORY_ADJECTIVES = {
    person: ['alt', 'jung', 'nett', 'freundlich', 'lustig', 'klug'], // klein / groß / neu clash with family ("kleine Väter")
    animal: ['alt', 'jung', 'klein', 'groß', 'schwarz', 'weiß', 'braun', 'süß', 'lustig', 'schnell'],
    thing: ['alt', 'neu', 'groß', 'klein', 'schön', 'rot', 'schwarz', 'weiß', 'blau', 'billig', 'modern', 'praktisch'],
    quality: ['groß', 'echt'],
    food: ['frisch', 'gut', 'lecker'],
    // "starker Regen", "starke Hitze" — kalt / leicht would clash with Hitze, Kälte. Weather is bad weather throughout
    // ("Bei starkem Regen bleiben wir zu Hause"), so no schön / warm.
    weather: ['stark'],
  };

  // Countable noun: singular [N, A, D, G] and plural [N, A, D, G]. opts: obl (oblique form of n-declension nouns), adjs,
  // child (a child: not the subject of grown-up sentences), mine (sounds natural with "mein": mein Kollege),
  // big (furniture, vehicles: nothing to hand over or put on a table), kinds (as the deck's nouns have them: vehicle).
  function countable(cat, g, nom, gen, pl, opts = {}) {
    const sg = opts.obl ? [nom, opts.obl, opts.obl, opts.obl] : [nom, nom, nom, gen];
    return {
      cat, g, lemma: nom, sg, pl: [pl, pl, datPlural(pl), pl], adjs: opts.adjs, mass: false, own: true, child: !!opts.child, mine: !!opts.mine,
      big: !!opts.big, ...(opts.kinds && { kinds: opts.kinds }),
    };
  }

  // Mass / uncountable noun: singular only, usable without an article (strong declension). No possessive for weather.
  const DRINKS = new Set(['Wein', 'Kaffee', 'Tee', 'Saft', 'Milch', 'Bier', 'Wasser']);
  function mass(cat, g, nom, gen, adjs) {
    return { cat, g, lemma: nom, sg: [nom, nom, nom, gen], pl: null, adjs, mass: true, own: cat !== 'weather', drink: DRINKS.has(nom) };
  }

  const NOUNS = [
    countable('person', 'm', 'Mann', 'Mannes', 'Männer'),
    countable('person', 'm', 'Lehrer', 'Lehrers', 'Lehrer'),
    countable('person', 'm', 'Freund', 'Freundes', 'Freunde', { mine: true }),
    countable('person', 'm', 'Junge', null, 'Jungen', { obl: 'Jungen', adjs: ['klein', 'nett', 'lustig', 'klug'], child: true }),
    countable('person', 'm', 'Kollege', null, 'Kollegen', { obl: 'Kollegen', adjs: ['neu', 'nett', 'jung'], mine: true }),
    countable('person', 'm', 'Student', null, 'Studenten', { obl: 'Studenten' }),
    countable('person', 'm', 'Nachbar', null, 'Nachbarn', { obl: 'Nachbarn', adjs: ['neu', 'nett', 'alt'], mine: true }),
    countable('person', 'f', 'Frau', 'Frau', 'Frauen'),
    countable('person', 'f', 'Lehrerin', 'Lehrerin', 'Lehrerinnen'),
    countable('person', 'f', 'Freundin', 'Freundin', 'Freundinnen', { mine: true }),
    countable('person', 'f', 'Kollegin', 'Kollegin', 'Kolleginnen', { mine: true }),
    countable('person', 'n', 'Kind', 'Kindes', 'Kinder', { adjs: ['klein', 'nett', 'lustig', 'klug', 'fleißig'], child: true }),
    countable('person', 'n', 'Mädchen', 'Mädchens', 'Mädchen', { adjs: ['klein', 'jung', 'nett', 'klug', 'lustig'], child: true }),
    countable('person', 'n', 'Baby', 'Babys', 'Babys', { adjs: ['klein', 'süß', 'lustig', 'neu'], child: true }),

    countable('animal', 'm', 'Hund', 'Hundes', 'Hunde'),
    countable('animal', 'm', 'Vogel', 'Vogels', 'Vögel'),
    countable('animal', 'f', 'Katze', 'Katze', 'Katzen'),
    countable('animal', 'f', 'Maus', 'Maus', 'Mäuse'),
    countable('animal', 'n', 'Pferd', 'Pferdes', 'Pferde'),
    countable('animal', 'n', 'Tier', 'Tieres', 'Tiere'),

    countable('thing', 'm', 'Tisch', 'Tisches', 'Tische', { big: true }),
    countable('thing', 'm', 'Stuhl', 'Stuhls', 'Stühle', { big: true }),
    countable('thing', 'm', 'Computer', 'Computers', 'Computer'),
    countable('thing', 'm', 'Schrank', 'Schranks', 'Schränke', { big: true }),
    countable('thing', 'm', 'Mantel', 'Mantels', 'Mäntel'),
    countable('thing', 'f', 'Lampe', 'Lampe', 'Lampen'),
    countable('thing', 'f', 'Tasche', 'Tasche', 'Taschen'),
    countable('thing', 'f', 'Uhr', 'Uhr', 'Uhren'),
    countable('thing', 'f', 'Jacke', 'Jacke', 'Jacken'),
    countable('thing', 'n', 'Buch', 'Buches', 'Bücher'),
    countable('thing', 'n', 'Auto', 'Autos', 'Autos', { big: true, kinds: ['vehicle'] }),
    countable('thing', 'n', 'Bild', 'Bildes', 'Bilder'),
    countable('thing', 'n', 'Fahrrad', 'Fahrrads', 'Fahrräder', { big: true, kinds: ['vehicle'] }),
    countable('thing', 'n', 'Handy', 'Handys', 'Handys'),
    countable('thing', 'n', 'Sofa', 'Sofas', 'Sofas', { big: true }),

    mass('food', 'm', 'Wein', 'Weines', ['gut', 'rot', 'französisch', 'billig', 'kalt']),
    mass('food', 'm', 'Kaffee', 'Kaffees', ['heiß', 'kalt', 'stark', 'gut', 'schwarz']),
    mass('food', 'm', 'Tee', 'Tees', ['heiß', 'grün', 'schwarz', 'kalt']),
    mass('food', 'm', 'Käse', 'Käses', ['frisch', 'französisch', 'alt', 'gut']),
    mass('food', 'm', 'Saft', 'Saftes', ['frisch', 'kalt', 'süß']),
    mass('food', 'f', 'Milch', 'Milch', ['kalt', 'warm', 'frisch']),
    mass('food', 'f', 'Suppe', 'Suppe', ['heiß', 'warm', 'lecker']),
    mass('food', 'f', 'Butter', 'Butter', ['frisch', 'weich']),
    mass('food', 'f', 'Schokolade', 'Schokolade', ['süß', 'gut', 'belgisch']),
    mass('food', 'n', 'Bier', 'Bieres', ['kalt', 'deutsch', 'gut', 'warm']),
    mass('food', 'n', 'Wasser', 'Wassers', ['kalt', 'warm', 'frisch', 'klar']),
    mass('food', 'n', 'Brot', 'Brotes', ['frisch', 'alt', 'gut', 'deutsch']),
    mass('food', 'n', 'Obst', 'Obstes', ['frisch', 'süß', 'reif']),

    mass('weather', 'm', 'Regen', 'Regens', ['stark', 'leicht', 'kalt']),
    mass('weather', 'm', 'Wind', 'Windes', ['stark', 'kalt', 'leicht']),
    mass('weather', 'm', 'Schnee', 'Schnees', ['frisch', 'nass']),
    mass('weather', 'm', 'Nebel', 'Nebels', ['dicht', 'stark']),
    mass('weather', 'f', 'Luft', 'Luft', ['kalt', 'feucht']),
    mass('weather', 'f', 'Kälte', 'Kälte', ['groß', 'stark']),
    mass('weather', 'n', 'Wetter', 'Wetters', ['schlecht', 'kalt']),

    mass('quality', 'm', 'Mut', 'Mutes'),
    mass('quality', 'm', 'Respekt', 'Respekts'),
    mass('quality', 'f', 'Geduld', 'Geduld'),
    mass('quality', 'f', 'Liebe', 'Liebe'),
    mass('quality', 'f', 'Energie', 'Energie', ['groß', 'neu']),
    mass('quality', 'n', 'Interesse', 'Interesses'),
    mass('quality', 'n', 'Talent', 'Talents'),
    mass('quality', 'n', 'Vertrauen', 'Vertrauens'),
  ];

  // Comparative and superlative stems of the gradable adjectives above (the first is shown, the rest also count).
  // Left out: colours and origins (blau, deutsch), echt, and nass (nasser / nässer both common).
  const COMPARISON = {
    alt: [['älter'], ['ältest']],
    billig: [['billiger'], ['billigst']],
    dicht: [['dichter'], ['dichtest']],
    feucht: [['feuchter'], ['feuchtest']],
    fleißig: [['fleißiger'], ['fleißigst']],
    freundlich: [['freundlicher'], ['freundlichst']],
    frisch: [['frischer'], ['frischest']],
    groß: [['größer'], ['größt']],
    gut: [['besser'], ['best']],
    heiß: [['heißer'], ['heißest']],
    jung: [['jünger'], ['jüngst']],
    kalt: [['kälter'], ['kältest']],
    klar: [['klarer'], ['klarst']],
    klein: [['kleiner'], ['kleinst']],
    klug: [['klüger'], ['klügst']],
    lecker: [['leckerer'], ['leckerst']],
    leicht: [['leichter'], ['leichtest']],
    lustig: [['lustiger'], ['lustigst']],
    modern: [['moderner'], ['modernst']],
    nett: [['netter'], ['nettest']],
    neu: [['neuer'], ['neuest', 'neust']],
    praktisch: [['praktischer'], ['praktischst']],
    reif: [['reifer'], ['reifst']],
    schlecht: [['schlechter'], ['schlechtest']],
    schnell: [['schneller'], ['schnellst']],
    schön: [['schöner'], ['schönst']],
    stark: [['stärker'], ['stärkst']],
    süß: [['süßer'], ['süßest']],
    warm: [['wärmer'], ['wärmst']],
    weich: [['weicher'], ['weichst']],
  };

  // degree: 'pos' (every adjective), 'comp' or 'sup' (gradable ones only).
  function adjectivesFor(noun, degree = 'pos') {
    const all = noun.adjs || CATEGORY_ADJECTIVES[noun.cat];
    return degree === 'pos' ? all : all.filter((a) => COMPARISON[a]);
  }

  // The comparative ('comp') or superlative ('sup') stems of a gradable adjective: [shown, ...also accepted].
  function degreeStems(adj, degree) {
    return COMPARISON[adj][degree === 'comp' ? 0 : 1];
  }

  return { NOUNS, CATEGORY_ADJECTIVES, COMPARISON, adjectivesFor, degreeStems };
});
