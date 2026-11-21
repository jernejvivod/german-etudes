// The learner's own vocabulary: learnt nouns from the Langenscheidt deck in Anki, in the shape of the built-in lexicon.
// The desktop app loads the deck through the preload bridge (window.etudesHost); tests call useNotes() directly.
//
// A noun: { cat, kinds, g, lemma, sg: [N, A, D, G] | null, pl: [N, A, D, G] | null, mass, family, own, obl?, genAlts?, adjs?,
//   anki: true, note }
//   note  — the card it comes from: when it is due and how hard it is decide how often it is picked (see weight)
//   cat   — the built-in lexicon category it can stand in for (person, thing, animal, food, weather, quality), or null
//   kinds — finer groups the preposition frames ask for: person, place, square, room, vehicle, wearable, day (also thing, transport,
//           animal, food, weather, quality)
//   own   — a possessive fits (false for places, weather and people that are not family: "unsere Person")
//   onlyOne — a relative one has one of: no possessive in the plural ("ihre Mütter")
//   drink — a beverage (gekühltes Bier, not gekühltes Brot); part — part of a garment (Hosentasche, Reißverschluss)
//   obl   — the n-noun form used in every case but the nominative (der Neffe → den Neffen)
// The deck gives article, singular and (often) plural; genitive and n-declension follow the usual rules.
//
// Which of the deck's cards a round uses is decided here as well, for every topic: by weight (how soon the card is due,
// how hard it has been, how lately it was answered right here — see weight, pickDue, sample), not in a fixed order.
(function (root, factory) {
  const deps = typeof module === 'object' && module.exports
    ? [require('./cloze.js'), require('./declension.js'), require('./verbs.js'), require('./store.js')]
    : [root.Etudes.cloze, root.Etudes.declension, root.Etudes.verbs, root.Etudes.store];
  const api = factory(...deps, typeof module === 'object' && module.exports ? null : root.etudesHost);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Etudes.vocab = api;
})(globalThis, function (cloze, declension, verbs, store, host) {
  'use strict';

  const { clean } = cloze;
  const { datPlural } = declension;

  const ARTICLE_GENDER = { der: 'm', die: 'f', das: 'n' };

  // n-nouns: masculine, plural = singular + (e)n, and one of these endings — plus the ones the endings miss.
  const N_ENDING = /(e|ent|ant|ist|af|at|oge)$/;
  const N_NOUNS = new Set(['Mensch', 'Herr', 'Held', 'Bär', 'Nachbar', 'Bauer', 'Prinz', 'Graf', 'Fürst', 'Narr', 'Christ']);
  // Mixed declension: -n like an n-noun, but the genitive adds -ns.
  const MIXED_GENITIVE = new Set(['Name', 'Gedanke', 'Wille', 'Glaube', 'Buchstabe', 'Friede', 'Funke', 'Same']);

  // Forms that differ from the plural: der Herr → den Herrn (plural Herren).
  const OBLIQUE = { Herr: 'Herrn' };
  const SIBILANT = /(s|ß|x|z|sch)$/;

  // animate: the ending rule only holds for people and animals (der Junge, der Löwe — not der See, der Staat).
  function isNNoun(sg, pl, g, animate = true) {
    if (g !== 'm' || !pl || (pl !== sg + 'n' && pl !== sg + 'en')) return false;
    return N_NOUNS.has(sg) || (animate && N_ENDING.test(sg));
  }

  // The genitive singular; one-syllable nouns may also take -es (des Mannes), accepted where the ending is a gap.
  function genitive(sg, g, pl = null) {
    if (g === 'f') return sg;
    if (MIXED_GENITIVE.has(sg)) return sg + 'ns';
    if (pl === sg + 'se') return sg + 'ses'; // der Bus, die Busse → des Busses
    return SIBILANT.test(sg) ? sg + 'es' : sg + 's';
  }

  function monosyllabic(word) {
    return (word.toLowerCase().match(/[aeiouäöüy]+/g) || []).length === 1;
  }

  // A noun note's "Word" field, read: "Kind, Kinder" (singular, plural), "Fahrer, die Fahrerin" (alternative with its own
  // article), "die Eltern" with part of speech "n pl" (plural only). messy: anything else, e.g. regional notes or phrases.
  function parseWord(note) {
    const pos = clean(note.pos);
    const article = clean(note.article);
    const [sg, ...rest] = clean(note.word).split(',').map((x) => x.trim());
    const pluralOnly = !rest.length && article === 'die' && /\bpl\b/.test(pos);
    const parsed = { g: pluralOnly ? 'pl' : ARTICLE_GENDER[article], sg, pl: pluralOnly ? sg : null, alts: [], messy: false, pos };
    for (const part of rest) {
      const alt = part.match(/^(der|die|das) ([A-ZÄÖÜ]\S*)$/);
      if (alt) parsed.alts.push([alt[2], ARTICLE_GENDER[alt[1]]]);
      else if (/^[A-ZÄÖÜ][a-zäöüßéèà-]*$/.test(part) && !parsed.pl) parsed.pl = part;
      else parsed.messy = true;
    }
    return parsed;
  }

  // English glosses that make a noun a person, place, vehicle and so on, whatever its heading. A gloss alternative must
  // match whole ("car park" is no car), allowing "(pair of) …" in front and a BE / AE mark after.
  const gloss = (words) => new RegExp(`^(\\(.*\\) )?(${words})( (BE|AE))?$`, 'i');
  const KIND_GLOSS = {
    person: gloss('mr|mrs|ms|man|woman|boy|girl|child|baby|mother|father|son|daughter|brother|sister|uncle|aunt|cousin|grand\\w*|nephew|niece|husband|wife|(boy|girl)?friend|neighbour|guest|person|people|parents?|mum|mom|dad|widow(er)?|bride|groom|partner|spouse|citizen|senior citizen|twins?|ancestor|member|companion|driver|car driver|guy|\\w+-in-law|in-laws|siblings?|brothers and sisters|relative|single parent|pedestrian|adult|human'
      + '|teacher|doctor|nurse|baker|butcher|hairdresser|mechanic|secretary|manager|boss|colleague|employee|employer|worker|assistant|shop assistant|customer|tourist|passenger|student|pupil|patient|policeman|waiter|waitress|cook|farmer|soldier|king|queen|president|priest'),
    place: gloss('restaurant|café|cafeteria|pub|bar|snack bar|shop|store|department store|supermarket|bakery|butcher’s( shop)?|shopping centre|cinema|theatre|museum|gallery|church|cathedral|castle|palace|hotel|guest house|youth hostel|school|university|college|hospital|clinic|library|station|railway station|airport|post office|bank|office|house|home|flat|building|village|town|city|town centre|city centre|park|zoo|gym|swimming pool|stadium|disco|night club|garden|pizzeria|cake shop|ice cream parlour'),
    // Open places: auf den Markt, not "in den Markt".
    square: gloss('market|square|campsite'),
    // Rooms: you come out of the kitchen, but don't go "zur Küche" or live "gegenüber der Küche".
    room: gloss('kitchen|room|living room|dining room|bedroom|bathroom|cellar'),
    // Vehicles you ride to work; the others are things to see or buy ("transport"), not "mit dem Waggon zur Arbeit".
    vehicle: gloss('car|hybrid car|motorbike|taxi|bicycle|bus|train|tram|scooter'),
    transport: gloss('truck|lorry|van|caravan|vehicle|plane|ship|boat|ferry|helicopter'),
    animal: gloss('animal|dog|cat|horse|bird|cow|bull|calf|pig|mouse|fish|sheep|rabbit|hen|duck|goat|insect|fly|bee|snake|lion|elephant|monkey'),
    weather: gloss('rain|wind|storm|snow|fog|heat|cold|thunderstorm|hail|ice|frost|sunshine'),
  };

  // Headings whose (concrete, countable) nouns all share a kind; elsewhere only the gloss decides. The gloss wins over the
  // heading: a heading kind applies only to nouns no gloss rule matched.
  const HEADING_KIND = {
    'Accommodation › Facilities › Furnishings': 'thing',
    'Accommodation › Facilities › Housekeeping': 'thing',
    'Body and Health › Personal Hygiene': 'thing',
    'Career › Office Activities and Equipment': 'thing',
    'Communication and Media › Computer and Multimedia': 'thing',
    'Communication and Media › Post': 'thing',
    'Nutrition › Beverages': 'food',
    'Nutrition › Bread, Pastries and Cereals': 'food',
    'Nutrition › Fruit and Vegetables': 'food',
    'Nutrition › Meat, Fish and Dairy Products': 'food',
    'Nutrition › Spices, Herbs and Other Ingredients': 'food',
    'Nutrition › Sweets, Snacks and Tobacco': 'food',
    'People › Character Traits': 'quality',
    'People › Looks › Accessories': 'wearable',
    'People › Looks › Clothes and Shoes': 'wearable',
    'Perceptions, Communication and Activities › Actions and Behaviour › Help, Duty and Reliability': 'quality',
    'Restaurants and Cafes › Dishes and Snacks': 'food',
    'Time › Days of the Week': 'day',
  };
  // Every other heading of the Langenscheidt deck. A heading in neither list is reported in the intro (see status),
  // so a new section is noticed rather than silently left to the gloss.
  const OTHER_HEADINGS = new Set([
    'Accommodation › Houses and Apartments',
    'Accommodation › Rooms and Living Areas',
    'Body and Health › Body Parts and Organs',
    'Body and Health › Emergencies',
    'Body and Health › Illness and Physical Impairments',
    'Body and Health › Medical Examinations and Hospital',
    'Career › Application, Recruitment and Termination',
    'Career › Conditions of Employment',
    'Career › Occupations',
    'Career › Professional Life',
    'Categorisation — General Concepts › Cause, Effect and Manner',
    'Categorisation — General Concepts › Differences and Classifications',
    'Colours and Shapes › Colours',
    'Colours and Shapes › Shapes',
    'Communication and Media › Print Media and Broadcasting',
    'Communication and Media › Telephone, Mobile Phones and the Internet',
    'Countries',
    'Countries › Countries, Languages and People',
    'Cultural Interests › Art',
    'Cultural Interests › Music',
    'Cultural Interests › Reading',
    'Cultural Interests › Theatre and Film',
    'Education › Language',
    'Education › Learning',
    'Education › School, University and Training',
    'Industry, Technology and Research › Agriculture',
    'Industry, Technology and Research › Manufacturing, Trade and Services',
    'Industry, Technology and Research › Money, Banking and Financial Markets',
    'Industry, Technology and Research › Natural Resources and Commodities',
    'Industry, Technology and Research › Technology, Energy und Research',
    'Leisure Time › Celebrations',
    'Leisure Time › Going Out and Recreation',
    'Leisure Time › Hobbies',
    'Leisure Time › Public Holidays',
    'Leisure Time › Shopping › Choosing and Paying',
    'Leisure Time › Shopping › Shops',
    'Leisure Time › Sport',
    'Nature and the Environment › Animals and Plants',
    'Nature and the Environment › Compass Directions',
    'Nature and the Environment › Environment, Weather and Climate',
    'Nature and the Environment › Landscape',
    'Nature and the Environment › Space',
    'Numbers and Units of Measurement › Cardinal Numbers',
    'Numbers and Units of Measurement › Categories',
    'Numbers and Units of Measurement › Quantities',
    'Numbers and Units of Measurement › Weights and Measurements',
    'Nutrition › General Terms',
    'People › Life Cycle',
    'People › Looks › Appearance',
    'People › Personal Information',
    'People › Social Relationships › Family',
    'People › Social Relationships › Friendship and Other Social Contacts',
    'People › Social Relationships › Partnership and Marriage',
    'Perceptions, Communication and Activities › Actions and Behaviour › Endeavours and Plans',
    'Perceptions, Communication and Activities › Actions and Behaviour › General Activities',
    'Perceptions, Communication and Activities › Actions and Behaviour › Owning, Giving and Taking',
    'Perceptions, Communication and Activities › Speaking Situations › Conflicts',
    'Perceptions, Communication and Activities › Speaking Situations › Conversations',
    'Perceptions, Communication and Activities › Speaking Situations › Discussions and Agreements',
    'Perceptions, Communication and Activities › Speaking Situations › Orders and Prohibitions',
    'Perceptions, Communication and Activities › Speaking Situations › Questions, Requests and Answers',
    'Perceptions, Communication and Activities › Thinking and Feeling › Feelings',
    'Perceptions, Communication and Activities › Thinking and Feeling › Sensory Impressions',
    'Perceptions, Communication and Activities › Thinking and Feeling › Thoughts',
    'Restaurants and Cafes › Restaurants',
    'Restaurants and Cafes › Serving, Ordering and Paying',
    'Society and State › Defence and Security',
    'Society and State › History',
    'Society and State › Law and Jurisprudence',
    'Society and State › Politics',
    'Society and State › Religion und Morality',
    'Society and State › Society',
    'Society and State › State Institutions and Administration',
    'Time › More Expressions of Time › Chronology',
    'Time › More Expressions of Time › Duration and Frequency',
    'Time › More Expressions of Time › Present, Past and Future',
    'Time › Names of the Months',
    'Time › Telling Time',
    'Time › Times of the Day',
    'Time › Times of the Year',
    'Tourism and Travel › Location Information',
    'Tourism and Travel › Places of Interest',
    'Tourism and Travel › Private Transport',
    'Tourism and Travel › Public Transport › Air and Sea Transportation',
    'Tourism and Travel › Public Transport › Local Public Transport',
    'Tourism and Travel › Public Transport › Railway Transportation',
    'Tourism and Travel › Staying Overnight',
    'Tourism and Travel › Travel',
    'Where and Whereabouts › Expressing Location',
    'Where and Whereabouts › Movement, Speed and Rest',
  ]);
  const headingOf = (note) => note.headings.map((h) => clean(h).replace(/\u200b/g, '').trim()).filter(Boolean).join(' › ');
  const WEATHER_HEADING = 'Nature and the Environment › Environment, Weather and Climate';
  const isKnownHeading = (heading) => heading in HEADING_KIND || OTHER_HEADINGS.has(heading);
  const FAMILY_HEADING = 'People › Social Relationships › Family';
  // Nouns in object headings that are not objects you would see, buy or wear: ideas, parts of clothes, events.
  const NOT_OBJECT = gloss('fashion|size|clothes|clothing|pattern|hole|men’s clothing|women’s clothing|household|dishes|furniture|postage|postcode|delivery|data|software|hardware|program'
    + '|file|password|e-mail|website|appointment|attachment|cursor|internet|link|download|folder|document');
  // Tobacco shares a heading with sweets.
  const NOT_FOOD = gloss('cigarette|tobacco|(smoking )?pipe|cigar');
  // Parts of clothes: things, but not something to go out "ohne".
  const GARMENT_PART = gloss('collar|sleeve|button|zip|zipper|(trouser|pants) pocket|pocket|lining|hem');
  const MASS_GLOSS = gloss('jewellery|costume jewellery|make-up|toothpaste|shampoo|shower gel|soap|perfume|paper|toilet paper|underwear');
  // Food that is countable although the card gives no plural: singular only, with an article ("eine Banane", not "gute Banane").
  const COUNT_FOOD = gloss('olive|pea|chickpea|bean|legume|banana|lime|pineapple|aubergine|eggplant|courgette|zucchini|grape|nut|peanut|walnut'
    + '|almond|(honeydew |water)?melon|chop|cutlet|egg white|spice|soft drink|dish|meal|course|omelette|pasty|side dish|pancake');
  const ABSTRACT = /(ung|heit|keit|schaft|ion|tät|nis|tum|ismus)$/;
  // Nouns no frame fits although their gloss or heading says otherwise: misleading glosses (Sender "station", Quadrat
  // "square", Waggon "car"), people only ever "of" someone (Mitglied, Elternteil) or not a person (Volk), qualities that are not ones
  // (Garantie, Pflicht) or take other adjectives (gute Laune, starker Charakter), and fish bones and chicken wings.
  const NOT_KIND = new Set(['Sender', 'Quadrat', 'Waggon', 'Mitglied', 'Elternteil', 'Volk', 'Garantie', 'Pflicht', 'Laune', 'Charakter',
    'Gräte', 'Flügel', 'Keule']);
  // People besides family that a possessive fits ("unser Gast", "ihr Baby"; not "unsere Person", "seine Touristen").
  const OWN_PERSON = gloss('husband|wife|bride|groom|partner|spouse|(boy|girl)?friend|guest|neighbour|colleague|boss|teacher|doctor'
    + '|child|baby|boy|girl|grandchild');
  // Nor do buses and trains ("mit meiner Straßenbahn").
  const PUBLIC_TRANSPORT = gloss('bus|train|tram|taxi');
  // Relatives one has only one of: no plural with a possessive ("ohne ihre Väter"; "den Müttern" is fine).
  const ONLY_ONE = gloss('mother|father|mum|mom|dad|grandmother|grandfather|grandma|grandpa|husband|wife|mother-in-law|father-in-law|bride|groom');
  // Too big to hand over or put on a table (with vehicles): "das Bett, das auf dem Tisch liegt" makes no sense.
  const BIG = gloss('furniture|piece of furniture|table|chair|armchair|office chair|sofa|couch|cupboard|wardrobe|shelf|bookshelf'
    + '|bed|bath|bathtub|shower|fridge|refrigerator|cooker|stove|dishwasher|washing machine|desk|photocopier|air conditioning');
  // Children take their own adjectives ("das kleine Baby", not "das junge Baby").
  const CHILD = gloss('child|baby|boy|girl|grandchild');
  const CHILD_ADJS = ['klein', 'lustig', 'süß', 'nett'];

  // The built-in lexicon category a kind stands in for (adjectives and determiners pick nouns by category):
  // most kinds are categories themselves, wearables and vehicles are things, places, squares, rooms and days have none.
  const CATEGORIES = new Set(['person', 'thing', 'animal', 'food', 'weather', 'quality']);
  const THING_KINDS = { wearable: 'thing', vehicle: 'thing', transport: 'thing' };
  const categoryOf = (kind) => THING_KINDS[kind] || (CATEGORIES.has(kind) ? kind : null);

  // The kind a noun gets from its heading: none for ideas filed under object headings, "thing" for parts of clothes
  // (only when every meaning is one: "Tasche — bag; pocket" is still something you carry).
  function headingKind(heading, glossIs, glossAll, sg) {
    const kind = HEADING_KIND[heading] || null;
    if (kind === 'food') return glossIs(NOT_FOOD) ? null : kind;
    if (kind !== 'thing' && kind !== 'wearable') return kind;
    if (glossIs(NOT_OBJECT) || ABSTRACT.test(sg)) return null;
    return kind === 'wearable' && glossAll(GARMENT_PART) ? 'thing' : kind;
  }

  // One learnt noun note → a lexicon noun, or null when it can't be declined reliably or fits no frame.
  function fromNote(note) {
    if (note.dueIn === null) return null;
    const { g, sg, pl: given, alts, messy, pos } = parseWord(note);
    if (!pos.startsWith('n') || !g || messy || alts.length || !/^[A-ZÄÖÜ][a-zäöüßéèà]+(-[A-ZÄÖÜa-zäöüß]+)?$/.test(sg)) return null;
    if (NOT_KIND.has(sg)) return null;
    // Nominalized adjectives ("der Erwachsene, die Erwachsene") decline like adjectives.
    if (/\bm[/-]f\b/.test(pos) && g !== 'pl' && /e$/.test(sg)) return null;

    const alternatives = String(note.english || '').split(/<br\s*\/?>|[,;]/i).map(clean).filter(Boolean);
    const glossIs = (re) => alternatives.some((a) => re.test(a));
    const glossAll = (re) => alternatives.length > 0 && alternatives.every((a) => re.test(a));
    const heading = headingOf(note);

    // Under a heading with a kind, the heading says what the noun is: Fisch under Nutrition is food, Maus under Computer
    // a thing, Eis under Sweets ice cream. Weather words only count under the weather heading (Erkältung is a "cold" too).
    const fromHeading = headingKind(heading, glossIs, glossAll, sg);
    const kinds = Object.keys(KIND_GLOSS).filter((k) => glossIs(KIND_GLOSS[k])
      && !(fromHeading && (k === 'animal' || k === 'weather'))
      && (k !== 'weather' || heading === WEATHER_HEADING));
    if (!kinds.length && fromHeading) kinds.push(fromHeading);
    const person = kinds.includes('person');
    // A masculine person in -e is an n-noun (der Neffe → die Neffen), even when the card gives no plural.
    const pl = given || (g === 'm' && /e$/.test(sg) && person ? sg + 'n' : null);
    // Ideas and household things only when countable ("einen Topf"), qualities only when not ("große Geduld").
    if ((kinds[0] === 'thing' && !pl && !glossIs(MASS_GLOSS)) || (kinds[0] === 'quality' && pl)) return null;
    if (!kinds.length) return null;
    const cat = kinds.map(categoryOf).find(Boolean) || null;
    const mass = kinds.includes('quality') || glossIs(MASS_GLOSS)
      || (kinds.some((k) => k === 'food' || k === 'weather') && !pl && !glossIs(COUNT_FOOD));

    const family = person && heading === FAMILY_HEADING;
    const noun = {
      cat, kinds, g, lemma: sg, anki: true, note, mass,
      family, drink: heading === 'Nutrition › Beverages', part: HEADING_KIND[heading] === 'wearable' && glossAll(GARMENT_PART),
      // A possessive sounds natural: "mein Bruder", "unser Auto", but not "unsere Person", "sein Schnee", "durch deinen Park".
      own: (!person || family || glossIs(OWN_PERSON)) && !kinds.includes('weather')
        && !(kinds.includes('vehicle') && glossIs(PUBLIC_TRANSPORT)) && kinds.some((k) => !['place', 'square', 'day'].includes(k)),
      sg: null,
      pl: pl ? [pl, pl, datPlural(pl), pl] : null,
    };
    if (person && g !== 'pl' && glossIs(ONLY_ONE)) noun.onlyOne = true;
    if (person && glossAll(CHILD)) Object.assign(noun, { adjs: CHILD_ADJS, child: true });
    noun.big = kinds.includes('vehicle') || kinds.includes('transport') || glossIs(BIG);
    if (g !== 'pl') {
      const animate = kinds.includes('person') || kinds.includes('animal');
      if (MIXED_GENITIVE.has(sg)) {
        noun.obl = pl || sg + 'n';
        noun.sg = [sg, noun.obl, noun.obl, genitive(sg, g)];
      } else if (isNNoun(sg, pl, g, animate)) {
        noun.obl = OBLIQUE[sg] || pl;
        noun.sg = [sg, noun.obl, noun.obl, noun.obl];
      } else {
        noun.sg = [sg, sg, sg, genitive(sg, g, pl)];
        // des Hut(e)s: both are right for one-syllable nouns ending in a consonant.
        if (g !== 'f' && monosyllabic(sg) && /[^aeiouäöüy]$/.test(sg) && !SIBILANT.test(sg)) noun.genAlts = ['es'];
      }
    }
    return noun;
  }

  // ---------- State ----------

  let notes = [];
  let nouns = [];
  let deckVerbs = []; // [{ note, verb }] for every verb card whose forms are certain
  let error = null;
  let stamp = null; // the deck version last loaded (collection file times and day); unchanged decks are not resent
  let unknownHeadings = []; // headings of learnt nouns that neither heading list knows
  let nominals = []; // learnt nominalised adjectives ("der / die Verwandte"): [{ stem: 'Verwandt', note }], one per stem
  let learntWords = new Map(); // a learnt card's word (its first form, a verb's infinitive) → its note, see noteFor

  function useNotes(list) {
    notes = list;
    unknownHeadings = [...new Set(list
      .filter((n) => n.dueIn !== null && clean(n.pos).startsWith('n'))
      .map(headingOf)
      .filter((h) => h && !isKnownHeading(h)))];
    const seen = new Set();
    nouns = list.map(fromNote).filter((n) => n && !seen.has(n.lemma) && seen.add(n.lemma));
    deckVerbs = verbs.fromNotes(list, clean);
    // Cards for a person in m/f with the same word for both ("Verwandte, die Verwandte"): adjectives used as nouns
    // (not der Vorfahre, die Vorfahrin).
    const cards = learnt(list);
    const parsed = cards.map(parseWord);
    // Several cards for a word: the first one counts, which is the hardest (learnt's order).
    learntWords = new Map();
    const learn = (word, note) => {
      if (!learntWords.has(word)) learntWords.set(word, note);
    };
    cards.forEach((note, i) => learn(parsed[i].sg, note));
    const cardVerbs = new Map(deckVerbs.map((x) => [x.note, x.verb]));
    for (const note of cards) if (cardVerbs.has(note)) learn(cardVerbs.get(note).inf, note);
    // One entry per stem, with its first card, as for learntWords.
    const stems = new Map();
    parsed.forEach((w, i) => {
      if (!/\bm[/-]f\b/.test(w.pos) || !/^[A-ZÄÖÜ][a-zäöüß]+e$/.test(w.sg) || !w.alts.some(([alt, g]) => alt === w.sg && g === 'f')) return;
      const stem = w.sg.slice(0, -1);
      if (!stems.has(stem)) stems.set(stem, { stem, note: cards[i] });
    });
    nominals = [...stems.values()];
  }

  // The hardest cards first: most lapses, then lowest ease, then soonest due. The order of lists only — which cards a
  // round uses is drawn by weight (see below).
  function hardestFirst(a, b) {
    return b.lapses - a.lapses || (a.ease ?? 0) - (b.ease ?? 0) || a.dueIn - b.dueIn;
  }

  // The learnt notes (in review or relearning), hardest first.
  function learnt(list = notes) {
    return list.filter((n) => n.dueIn !== null).sort(hardestFirst);
  }

  // ---------- What was shown lately ----------

  // The cards the learner has just got right: note id → when it was last checked (ms). Kept between sessions like the
  // settings (store.js), so the next round — today or after a
  // restart — brings other cards. A card counts SHOWN_WEIGHT right after and its full weight again RECOVERY later;
  // entries older than that are dropped with the next write, which keeps the list to the last few days' practice.
  // A card answered wrong leaves the list (markMissed): it is not held back, so it can come back in the next round.
  const SHOWN_KEY = 'etudes-shown';
  const SHOWN_WEIGHT = 0.05;
  const DAY = 24 * 3600e3;
  const RECOVERY = 3 * DAY;
  let shown = null; // Map(id as stored, a string → time), read on first use

  // Whatever the storage holds that is not { id: time } counts as nothing shown.
  function shownCards() {
    if (shown) return shown;
    const saved = store.read(SHOWN_KEY, null);
    shown = new Map(saved && typeof saved === 'object' ? Object.entries(saved).filter(([, at]) => Number.isFinite(at)) : []);
    return shown;
  }

  // Stores the list, without the entries that have recovered by now.
  function saveShown(times, now) {
    for (const [id, at] of times) if (now - at >= RECOVERY) times.delete(id);
    store.write(SHOWN_KEY, Object.fromEntries(times));
  }

  // Remembers the notes of an item the learner has just got right.
  function markShown(checked, now = Date.now()) {
    if (!checked?.length) return;
    const times = shownCards();
    for (const note of checked) times.set(String(note.id), now);
    saveShown(times, now);
  }

  // Releases the notes of an item the learner has just got wrong: they count in full again, whenever they were shown.
  function markMissed(checked, now = Date.now()) {
    if (!checked?.length) return;
    const times = shownCards();
    for (const note of checked) times.delete(String(note.id));
    saveShown(times, now);
  }

  // How much a card counts after it was shown: SHOWN_WEIGHT right after, rising evenly back to 1 over RECOVERY.
  function freshness(id, now) {
    const at = shownCards().get(String(id));
    if (at === undefined) return 1;
    return SHOWN_WEIGHT + (1 - SHOWN_WEIGHT) * Math.min(1, Math.max(0, now - at) / RECOVERY);
  }

  // Forgets what was shown, here and in the storage.
  function forget() {
    shown = new Map();
    store.remove(SHOWN_KEY);
  }

  // Tests: another storage (store.use); the list is read afresh from it, as after a restart.
  function useStorage(other) {
    store.use(other);
    shown = null;
  }

  // ---------- What to practise ----------

  const SOON = 7; // days ahead that still count as soon
  const SOON_WEIGHT = 0.1;
  const URGENCY_FLOOR = 0.03;
  const LAPSE_WEIGHT = 2;
  const START_EASE = 2500; // Anki's ease of a new card; it falls with every lapse and "hard", down to 1300
  const LOWEST_EASE = 1300;

  // How pressing a card is: 1 when it is due (today, overdue or relearning), falling evenly to SOON_WEIGHT for a card
  // due in `soon` days (with a week: half in two days, 0.37 in three), and never under URGENCY_FLOOR — a card not due
  // for weeks still turns up now and then.
  function urgency(dueIn, soon = SOON) {
    return Math.max(URGENCY_FLOOR, dueIn <= 0 ? 1 : SOON_WEIGHT ** (dueIn / soon));
  }

  // How hard a card has been: every lapse adds LAPSE_WEIGHT plain cards, and a low ease raises it further (1 at Anki's
  // starting ease, 1.9 at its lowest; a card still in its first learning steps has none and counts as plain).
  function difficulty(note) {
    return (1 + LAPSE_WEIGHT * (note.lapses || 0)) * (START_EASE / Math.max(note.ease || START_EASE, LOWEST_EASE));
  }

  const isLearnt = (note) => note?.dueIn != null;

  // A card's weight in a pick: how pressing × how hard × how long since the learner last worked on it here.
  // 0 for a card not learnt yet (or none).
  function weight(note, now = Date.now(), soon = SOON) {
    if (!isLearnt(note)) return 0;
    return urgency(note.dueIn, soon) * difficulty(note) * freshness(note.id, now);
  }

  // Two limits keep a few words from filling a round, however due and hard they are:
  //   MAX_SHARE — the most one deck word gets of the picks that go to the deck's words; among fewer than
  //               2 / MAX_SHARE of them, twice its even share. Below the limit the weights decide, in every pool.
  //   MIN_OWN   — the deck words a pool needs to do without the built-in ones (prefer). With fewer, the built-in words
  //               join, and m deck words get m in MIN_OWN of the picks between them (builtinWeight).
  // Together: where the built-in words are in, no deck word gets more than a quarter of the picks.
  const MAX_SHARE = 1 / 8;
  const MIN_OWN = 8;

  // The weights with the heaviest lowered until none is more than its share of the total (see MAX_SHARE): k words at
  // the limit leave the others — rest, their sum — 1 - k × share of the picks.
  function capped(weights) {
    const share = Math.max(MAX_SHARE, 2 / weights.length);
    let rest = weights.reduce((sum, w) => sum + w, 0);
    let limit = Infinity;
    let k = 0;
    for (const w of [...weights].sort((a, b) => b - a)) {
      limit = (share * rest) / (1 - k * share);
      if (w <= limit) break;
      rest -= w;
      k++;
    }
    return weights.map((w) => Math.min(w, limit));
  }

  // What each of a pool's built-in words weighs next to its deck words (own: their weights): together they get what
  // the deck words leave of the picks (see MIN_OWN), evenly. A pool without deck words: 1 each.
  function builtinWeight(own, count) {
    if (!own.length) return 1;
    const deck = Math.min(1, own.length / MIN_OWN);
    return (own.reduce((sum, w) => sum + w, 0) * (1 - deck)) / (deck * count);
  }

  // A word's card: its `note` when that is a deck note (some built-in lists use `note` for an explanation text).
  const cardOf = (x) => (x?.note && typeof x.note === 'object' ? x.note : undefined);

  // One of the pool, avoiding the keys used recently as cloze.pickFresh does. The deck's words (noteOf: their card)
  // are picked by weight, so those due and hard come up most; built-in words evenly.
  // key: what `recent` holds (a noun's lemma, unless given); soon: see urgency.
  function pickDue(pool, rnd, { recent = [], key = (x) => x.lemma, noteOf = cardOf, soon = SOON, now = Date.now() } = {}) {
    const words = cloze.freshOf(pool, recent, key).map((x) => ({ x, note: noteOf(x) }));
    const mine = words.filter((w) => w.note);
    const others = words.filter((w) => !w.note);
    const own = capped(mine.map((w) => weight(w.note, now, soon)));
    mine.forEach((w, i) => { w.weight = own[i]; });
    if (others.length) {
      const each = builtinWeight(own, others.length);
      for (const w of others) w.weight = each;
    }
    return cloze.pickWeighted(words, rnd)?.x;
  }

  // Up to `count` of the items, each picked like any other (pickDue) from those not drawn yet: a round differs from
  // the last one, and the due and hard cards still come up most. noteOf: an item's card (the item itself, unless given).
  function sample(items, count, rnd, { noteOf = (x) => x, ...options } = {}) {
    const cards = items.filter((x) => isLearnt(noteOf(x)));
    const drawn = [];
    while (drawn.length < Math.min(count, cards.length)) {
      drawn.push(pickDue(cards, rnd, { ...options, noteOf, recent: drawn, key: (x) => x }));
    }
    return drawn;
  }

  // The notes of the deck's words among the given nouns, verb entries and the like: what an item built from them
  // names as its notes, to be marked as shown (markShown) or missed (markMissed) once it is checked.
  function notesOf(...words) {
    return words.map(cardOf).filter(Boolean);
  }

  // The learnt card of a word — its first form ("Ankunft") or, for a verb, the infinitive ("anziehen" for the card
  // "sich anziehen") — or undefined: for topics with their own word lists.
  function noteFor(word) {
    return learntWords.get(word);
  }

  // Picks from the learner's part of a list half the time (when it has any), from the whole list otherwise.
  // Only fresh ones count as the learner's: one learnt entry must not fill the round. Among them the pick goes by
  // weight (pickDue; noteOf: an entry's card).
  function pickPreferring(all, mine, rnd, { recent = [], key, noteOf } = {}) {
    const fresh = cloze.freshOf(mine, recent, key, []);
    if (!fresh.length || rnd() >= 0.5) return cloze.pickFresh(all, recent, key, rnd);
    return pickDue(fresh, rnd, { noteOf });
  }

  // The tag of an item that uses the learner's words.
  const ANKI_TAG = { text: 'Anki', cls: 'plain' };

  // The deck's part of a round: up to half of it. The items are example sentences that name their card (notes[0]):
  // the cards are drawn by weight, and each gives one of its sentences.
  function deckShare(items, length, rnd) {
    const byNote = Map.groupBy(items, (it) => it.notes[0]);
    return sample([...byNote.keys()], Math.ceil(length / 2), rnd).map((note) => cloze.pick(byNote.get(note), rnd));
  }

  // Loads the deck, or keeps it when Anki has not changed it since. Resolves to an error message or null.
  async function load() {
    let result;
    try {
      result = host?.loadAnki ? await host.loadAnki(stamp) : { error: 'Anki is only available in the desktop app (npm start).' };
    } catch (err) {
      result = { error: `Could not read the Anki collection: ${err.message || err}` };
    }
    if (result.unchanged) return error;
    error = result.error || null;
    stamp = result.stamp || null;
    useNotes(result.error ? [] : result.notes);
    return error;
  }

  // The learner's words where at least MIN_OWN fit, otherwise the built-in ones too — so every slot has words enough
  // that a handful of the deck's do not come up in every sentence (pickDue gives both their share).
  function prefer(mine, builtin, key = (n) => n.lemma) {
    if (mine.length >= MIN_OWN) return mine;
    const own = new Set(mine.map(key));
    return [...mine, ...builtin.filter((x) => !own.has(key(x)))];
  }

  // Whether a possessive fits the noun: "mein Bruder", but not "unsere Person", nor "ihre Mütter" in the plural.
  function possessiveFits(noun, plural) {
    return !!noun.own && !(plural && noun.onlyOne);
  }

  // The noun with its article in a case: der / die / das, or "mein" for family and friends (mine) — "meiner Tante",
  // "mein Kollege", but "die Mütter".
  function withArticle(noun, caseKey, plural = false) {
    const ci = declension.CASES.indexOf(caseKey);
    const gender = plural ? 'pl' : noun.g;
    const mine = (noun.family || noun.mine) && possessiveFits(noun, plural);
    const det = mine ? declension.possessive('mein', gender, caseKey) : 'd' + declension.DET_ENDINGS.der[gender][ci];
    return `${det} ${(plural ? noun.pl : noun.sg)[ci]}`;
  }

  function pool(builtin, fits, source) {
    return source === 'anki' ? prefer(nouns.filter(fits), builtin.filter(fits)) : builtin.filter(fits);
  }

  // What a topic drawing nouns from the deck shares: the option, the default, loading, and a line in the intro.
  const OPTION = {
    key: 'vocab', label: 'Nouns', type: 'radio', choices: [
      { value: 'anki', label: 'My Anki words', detail: 'learnt nouns from your Langenscheidt deck, those due soon and hard most often; built-in ones where few fit' },
      { value: 'builtin', label: 'Built-in' },
    ],
  };

  // usable: which of the learner's nouns the topic can place (adjectives need a category, prepositions a kind).
  // The intro line of a topic drawing on the deck: nothing for built-in words, the load error, or line().
  function deckStatus(settings, line, builtin = 'words') {
    if (settings.vocab !== 'anki') return '';
    if (error) return `${error} Using the built-in ${builtin}.`;
    return line();
  }

  function status(settings, usable = () => true) {
    return deckStatus(settings, () => nounStatus(usable));
  }

  function nounStatus(usable) {
    const count = nouns.filter(usable).length;
    const shown = unknownHeadings.slice(0, 3).join('; ') + (unknownHeadings.length > 3 ? ` and ${unknownHeadings.length - 3} more` : '');
    const unknown = unknownHeadings.length ? ` Not sorted yet: nouns under ${shown}.` : '';
    if (!count) return `None of your learnt nouns fit these sentences yet, so the built-in words are used.${unknown}`;
    return `Using ${count} learnt nouns from your Anki deck — those due soon and hard most often — and built-in ones where few fit.${unknown}`;
  }

  // A topic intro: the text, then the deck line — of the nouns (usable: the nouns the topic can place), or line(settings).
  function intro(text, usable, line = (settings) => status(settings, usable)) {
    return (settings) => [text, line(settings)].filter(Boolean).join(' ');
  }

  async function prepare() {
    await load();
  }

  return {
    OPTION, ARTICLE_GENDER, parseWord, isNNoun, genitive, useNotes, load, prepare, intro, prefer, pool, possessiveFits, withArticle,
    status, deckStatus, hardestFirst, learnt, deckShare, pickPreferring, ANKI_TAG,
    urgency, difficulty, weight, sample, pickDue, notesOf, noteFor, markShown, markMissed, forget, useStorage, SHOWN_KEY,
    get notes() { return notes; },
    get verbs() { return deckVerbs; },
    // The verb cards in review or relearning.
    get learntVerbs() { return deckVerbs.filter((x) => x.note.dueIn !== null); },
    get error() { return error; },
    get nouns() { return nouns; },
    get nominals() { return nominals; },
  };
});
