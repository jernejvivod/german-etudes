// German verb forms: Präsens, Präteritum, Perfekt (auxiliary + Partizip II) and Konjunktiv II, for the built-in strong and
// irregular verbs, the verbs derived from them by a prefix (verstehen, aufstehen) and regular (weak) verbs.
//
// A verb: { inf, particle, reflexive, irregular, pres, pret, konj2, pii, aux }
//   inf       — the infinitive without "sich" ("aufstehen")
//   particle  — the separable prefix ("auf"), or ''; pres / pret / konj2 then hold the finite stem form ("steht") and
//               the particle goes to the end of a main clause ("Ich stehe um sieben auf.")
//   pres, pret, konj2 — six persons (ich, du, er/sie/es, wir, ihr, sie/Sie), each a list of accepted forms (first = shown);
//               konj2 is null for verbs that use würde + infinitive instead
//   pii       — the Partizip II, particle included ("aufgestanden"), as a list of accepted forms
//   aux       — 'haben' and / or 'sein' (first = the usual one)
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Etudes.verbs = api;
})(globalThis, function () {
  'use strict';

  const PERSONS = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
  // Reflexive pronouns in PERSONS order (sich for er / sie / es, sie and Sie).
  const REFLEXIVE_PRONOUNS = {
    acc: ['mich', 'dich', 'sich', 'uns', 'euch', 'sich'],
    dat: ['mir', 'dir', 'sich', 'uns', 'euch', 'sich'],
  };

  // Row labels of a conjugation table, in PERSONS order.
  const PERSON_LABELS = ['ich', 'du', 'er / sie / es', 'wir', 'ihr', 'sie / Sie'];
  const AUX_3SG = { haben: 'hat', sein: 'ist' };

  // Strong, mixed and irregular verbs: infinitive | er-Präsens ('-' = regular) | er-Präteritum | Partizip II | auxiliary.
  // Alternatives with "/"; the first auxiliary is the usual one.
  const STRONG_TABLE = `
    backen|backt/bäckt|backte|gebacken|haben
    befehlen|befiehlt|befahl|befohlen|haben
    beginnen|-|begann|begonnen|haben
    beißen|-|biss|gebissen|haben
    betrügen|-|betrog|betrogen|haben
    biegen|-|bog|gebogen|haben/sein
    bieten|-|bot|geboten|haben
    binden|-|band|gebunden|haben
    bitten|-|bat|gebeten|haben
    blasen|bläst|blies|geblasen|haben
    bleiben|-|blieb|geblieben|sein
    braten|brät|briet|gebraten|haben
    brechen|bricht|brach|gebrochen|haben/sein
    brennen|-|brannte|gebrannt|haben
    bringen|-|brachte|gebracht|haben
    denken|-|dachte|gedacht|haben
    dürfen|darf|durfte|gedurft|haben
    empfehlen|empfiehlt|empfahl|empfohlen|haben
    essen|isst|aß|gegessen|haben
    fahren|fährt|fuhr|gefahren|sein/haben
    fallen|fällt|fiel|gefallen|sein
    fangen|fängt|fing|gefangen|haben
    finden|-|fand|gefunden|haben
    fliegen|-|flog|geflogen|sein/haben
    fliehen|-|floh|geflohen|sein
    fließen|-|floss|geflossen|sein
    fressen|frisst|fraß|gefressen|haben
    frieren|-|fror|gefroren|haben/sein
    geben|gibt|gab|gegeben|haben
    gehen|-|ging|gegangen|sein
    gelingen|-|gelang|gelungen|sein
    gelten|gilt|galt|gegolten|haben
    genießen|-|genoss|genossen|haben
    geschehen|geschieht|geschah|geschehen|sein
    gewinnen|-|gewann|gewonnen|haben
    gießen|-|goss|gegossen|haben
    gleichen|-|glich|geglichen|haben
    graben|gräbt|grub|gegraben|haben
    greifen|-|griff|gegriffen|haben
    haben|hat|hatte|gehabt|haben
    halten|hält|hielt|gehalten|haben
    heben|-|hob|gehoben|haben
    heißen|-|hieß|geheißen|haben
    helfen|hilft|half|geholfen|haben
    kennen|-|kannte|gekannt|haben
    klingen|-|klang|geklungen|haben
    kommen|-|kam|gekommen|sein
    können|kann|konnte|gekonnt|haben
    kriechen|-|kroch|gekrochen|sein
    laden|lädt|lud|geladen|haben
    lassen|lässt|ließ|gelassen|haben
    laufen|läuft|lief|gelaufen|sein
    leiden|-|litt|gelitten|haben
    leihen|-|lieh|geliehen|haben
    lesen|liest|las|gelesen|haben
    liegen|-|lag|gelegen|haben/sein
    lügen|-|log|gelogen|haben
    meiden|-|mied|gemieden|haben
    misslingen|-|misslang|misslungen|sein
    messen|misst|maß|gemessen|haben
    mögen|mag|mochte|gemocht|haben
    müssen|muss|musste|gemusst|haben
    nehmen|nimmt|nahm|genommen|haben
    nennen|-|nannte|genannt|haben
    pfeifen|-|pfiff|gepfiffen|haben
    raten|rät|riet|geraten|haben
    reiben|-|rieb|gerieben|haben
    reißen|-|riss|gerissen|haben/sein
    reiten|-|ritt|geritten|sein/haben
    rennen|-|rannte|gerannt|sein
    riechen|-|roch|gerochen|haben
    rufen|-|rief|gerufen|haben
    scheiden|-|schied|geschieden|haben/sein
    scheinen|-|schien|geschienen|haben
    schieben|-|schob|geschoben|haben
    schießen|-|schoss|geschossen|haben
    schlafen|schläft|schlief|geschlafen|haben
    schlagen|schlägt|schlug|geschlagen|haben
    schließen|-|schloss|geschlossen|haben
    schneiden|-|schnitt|geschnitten|haben
    schreiben|-|schrieb|geschrieben|haben
    schreien|-|schrie|geschrien|haben
    schweigen|-|schwieg|geschwiegen|haben
    schwellen|schwillt|schwoll|geschwollen|sein
    schwimmen|-|schwamm|geschwommen|sein/haben
    sehen|sieht|sah|gesehen|haben
    sein|ist|war|gewesen|sein
    singen|-|sang|gesungen|haben
    sinken|-|sank|gesunken|sein
    sitzen|-|saß|gesessen|haben/sein
    sollen|soll|sollte|gesollt|haben
    sprechen|spricht|sprach|gesprochen|haben
    springen|-|sprang|gesprungen|sein
    stechen|sticht|stach|gestochen|haben
    stehen|-|stand|gestanden|haben/sein
    stehlen|stiehlt|stahl|gestohlen|haben
    steigen|-|stieg|gestiegen|sein
    sterben|stirbt|starb|gestorben|sein
    stinken|-|stank|gestunken|haben
    stoßen|stößt|stieß|gestoßen|haben
    streichen|-|strich|gestrichen|haben
    streiten|-|stritt|gestritten|haben
    tragen|trägt|trug|getragen|haben
    treffen|trifft|traf|getroffen|haben
    treiben|-|trieb|getrieben|haben
    treten|tritt|trat|getreten|haben/sein
    trinken|-|trank|getrunken|haben
    tun|tut|tat|getan|haben
    vergessen|vergisst|vergaß|vergessen|haben
    verlieren|-|verlor|verloren|haben
    verschwinden|-|verschwand|verschwunden|sein
    verzeihen|-|verzieh|verziehen|haben
    wachsen|wächst|wuchs|gewachsen|sein
    waschen|wäscht|wusch|gewaschen|haben
    weisen|-|wies|gewiesen|haben
    werben|wirbt|warb|geworben|haben
    werden|wird|wurde|geworden|sein
    werfen|wirft|warf|geworfen|haben
    wiegen|-|wog|gewogen|haben
    wissen|weiß|wusste|gewusst|haben
    wollen|will|wollte|gewollt|haben
    ziehen|-|zog|gezogen|haben/sein
    zwingen|-|zwang|gezwungen|haben`;

  const split = (s) => s.split('/');
  const STRONG = Object.fromEntries(STRONG_TABLE.trim().split('\n').map((line) => {
    const [inf, pres3, pret3, pii, aux] = line.trim().split('|');
    return [inf, { pres3: pres3 === '-' ? null : split(pres3), pret3: split(pret3), pii: split(pii), aux: split(aux) }];
  }));

  // Present tense that no rule gives.
  const IRREGULAR_PRESENT = {
    sein: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'],
    haben: ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'],
    werden: ['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden'],
    wissen: ['weiß', 'weißt', 'weiß', 'wissen', 'wisst', 'wissen'],
    tun: ['tue', 'tust', 'tut', 'tun', 'tut', 'tun'],
    dürfen: ['darf', 'darfst', 'darf', 'dürfen', 'dürft', 'dürfen'],
    können: ['kann', 'kannst', 'kann', 'können', 'könnt', 'können'],
    mögen: ['mag', 'magst', 'mag', 'mögen', 'mögt', 'mögen'],
    müssen: ['muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen'],
    sollen: ['soll', 'sollst', 'soll', 'sollen', 'sollt', 'sollen'],
    wollen: ['will', 'willst', 'will', 'wollen', 'wollt', 'wollen'],
  };

  // Konjunktiv II forms in use (er-form); every other verb takes würde + infinitive. Some strong ones also have a short
  // du / ihr form ("du wärst", "ihr kämt"; not after t / d: "du tätest", "ihr fändet").
  const KONJ2 = {
    sein: 'wäre', haben: 'hätte', werden: 'würde', können: 'könnte', müssen: 'müsste', dürfen: 'dürfte', sollen: 'sollte',
    wollen: 'wollte', mögen: 'möchte', wissen: 'wüsste', kommen: 'käme', gehen: 'ginge', geben: 'gäbe', bleiben: 'bliebe',
    finden: 'fände', lassen: 'ließe', tun: 'täte', stehen: 'stünde',
  };
  const KONJ2_SHORT = new Set(['sein', 'kommen', 'gehen', 'geben', 'bleiben', 'lassen']);

  // Prefixes. Inseparable ones never take ge- (verstanden); separable ones go to the end of a main clause.
  // um-, über-, unter-, durch-, wieder- can be either; verbs with them count only when listed below.
  const INSEPARABLE = ['miss', 'emp', 'ent', 'zer', 'be', 'er', 'ge', 'ver'];
  const SEPARABLE = [
    'zusammen', 'herunter', 'hinunter', 'zurück', 'vorbei', 'heraus', 'herein', 'hinaus', 'hinein', 'weiter', 'hervor',
    'vorher', 'herüber', 'hinüber', 'spazieren', 'kennen', 'statt', 'groß', 'nach', 'fest', 'fort', 'hoch', 'fern', 'teil', 'heim', 'frei', 'weg', 'mit',
    'los', 'auf', 'aus', 'bei', 'ein', 'her', 'hin', 'vor', 'an', 'ab', 'zu',
  ];
  // Weak verbs that are the base of separable ones (einkaufen, abholen); the deck's own verbs count too.
  const WEAK_BASES = new Set(`holen kaufen machen räumen stellen legen setzen hören schauen passen teilen zahlen füllen packen
    putzen probieren melden wählen drehen decken warten rechnen lernen kochen sagen spielen suchen zeigen schalten wachen
    kehren wandern bauen tauschen klopfen sichern trauen lehnen kündigen fassen fühlen lösen merken nutzen reichen richten
    schicken spülen stimmen wechseln zählen wischen gucken prüfen regen ruhen leben lachen ändern regnen kreuzen klingeln
    atmen sperren wecken beugen`.split(/\s+/));
  const AMBIGUOUS = ['über', 'unter', 'durch', 'wieder', 'hinter', 'um'];
  // Longest first, so "zurück" wins over "zu".
  const PREFIXES = [...AMBIGUOUS, ...SEPARABLE, ...INSEPARABLE].sort((a, b) => b.length - a.length);
  const SEPARABLE_LISTED = new Set(['umziehen', 'umsteigen', 'umdrehen', 'umkehren', 'umfallen', 'umtauschen', 'umbringen',
    'wiedersehen', 'wiederfinden', 'wiedererkennen', 'wiederkommen', 'untergehen', 'durchfallen']);
  const INSEPARABLE_LISTED = new Set(['übertreiben', 'unterhalten', 'unterschreiben', 'überlassen', 'übertragen', 'übernehmen',
    'überweisen', 'unterbrechen', 'unterscheiden', 'unterwerfen', 'umgeben', 'übersehen', 'überfahren', 'unternehmen',
    'umarmen', 'übersetzen', 'überqueren', 'überzeugen', 'überleben', 'überreden', 'unterstützen', 'untersuchen',
    'überlegen', 'überraschen', 'wiederholen', 'umgehen', 'übernachten', 'unterrichten', 'überholen', 'unterdrücken',
    'überprüfen', 'überreichen']);
  // Weak verbs that look like an inseparable prefix + a strong verb (be-reiten: bereitete, not beritt).
  const WEAK_COMPOUNDS = new Set(['bereiten', 'begleiten', 'verleiten', 'beerdigen']);
  // Words that only look prefixed (er-ben, be-ten).
  const NOT_PREFIXED = new Set(['erben', 'ernten', 'beten', 'beben', 'zerren', 'erden', 'geigen', 'gerben', 'erzen', 'beugen']);

  // The auxiliary where the prefix changes it (aufstehen: ist; bekommen: hat — inseparable verbs default to haben).
  // Only where the base does not say it: separable verbs whose auxiliary differs from the base's (stehen hat, aufstehen
  // ist) or that take only one of the base's two (ziehen hat / ist, anziehen hat), inseparable ones with sein (they
  // default to haben), and weak verbs of motion or change.
  const AUX = {
    aufstehen: ['sein'], einschlafen: ['sein'], ausbrechen: ['sein'], zusammenstoßen: ['sein'], abbiegen: ['sein'],
    einziehen: ['sein'], umziehen: ['sein', 'haben'], ausziehen: ['haben', 'sein'], wegziehen: ['sein'],
    ausscheiden: ['sein'], zufrieren: ['sein'],
    anziehen: ['haben'], großziehen: ['haben'], aufziehen: ['haben'], vorziehen: ['haben'], zurückziehen: ['haben'],
    hochziehen: ['haben'], zuziehen: ['haben'],
    hochfahren: ['haben', 'sein'], herunterfahren: ['haben', 'sein'], umkehren: ['sein', 'haben'],
    eintreten: ['sein'], auftreten: ['sein'], zurücktreten: ['sein'], austreten: ['sein'], beitreten: ['sein'],
    entstehen: ['sein'], vergehen: ['sein'], erscheinen: ['sein'], entkommen: ['sein'], ertrinken: ['sein'], zerbrechen: ['sein', 'haben'],
    erfrieren: ['sein'], verfallen: ['sein'], zerfallen: ['sein'], geraten: ['sein'], entfliehen: ['sein'], gelangen: ['sein'],
    entgleisen: ['sein'], verblühen: ['sein'], ersticken: ['sein', 'haben'],
    reisen: ['sein'], verreisen: ['sein'], wandern: ['sein'], landen: ['sein', 'haben'], begegnen: ['sein'], folgen: ['sein'],
    passieren: ['sein'], aufwachen: ['sein'], erwachen: ['sein'], klettern: ['sein'], stolpern: ['sein'], verheilen: ['sein'],
    scheitern: ['sein'], explodieren: ['sein'], zurückkehren: ['sein'], eilen: ['sein'], rasen: ['sein'], flüchten: ['sein'],
    stürzen: ['sein', 'haben'], joggen: ['sein', 'haben'], segeln: ['sein', 'haben'], surfen: ['sein', 'haben'],
    rudern: ['sein', 'haben'], heilen: ['haben', 'sein'], verunglücken: ['sein'], abstürzen: ['sein'], starten: ['sein', 'haben'],
  };
  // Verbs with a strong and a weak meaning (hängen, schaffen …): their forms depend on the meaning, so they are left out.
  const AMBIGUOUS_VERBS = new Set(['hängen', 'schaffen', 'bewegen', 'erschrecken', 'senden', 'wenden', 'erwägen', 'schleifen',
    'weichen', 'quellen', 'löschen', 'erlöschen', 'pflegen']);

  // ---------- Regular forms ----------

  const SIBILANT = /(s|ß|x|z)$/;
  // e before -st / -t: stems in -t / -d and in a consonant + m / n (arbeitest, öffnet, atmet, rechnet; but lernst, wohnst).
  const needsE = (stem) => /[td]$/.test(stem) || /(?:[^aeiouäöülrhmn]|ch)[mn]$/.test(stem);

  // The stem and the shape of the infinitive: -en (machen), -eln / -ern (lächeln, wandern), -n (tun).
  function stemOf(inf) {
    if (/e[lr]n$/.test(inf) && inf.length > 4) return { stem: inf.slice(0, -1), elr: inf.slice(-2, -1) };
    if (inf.endsWith('en')) return { stem: inf.slice(0, -2), elr: null };
    return { stem: inf.slice(0, -1), elr: null };
  }

  function regularPresent(inf) {
    const { stem, elr } = stemOf(inf);
    if (elr) {
      const ich = elr === 'l' ? stem.slice(0, -2) + 'le' : stem + 'e';
      return [ich, stem + 'st', stem + 't', inf, stem + 't', inf];
    }
    const e = needsE(stem);
    const du = e ? stem + 'est' : SIBILANT.test(stem) ? stem + 't' : stem + 'st';
    const t = e ? stem + 'et' : stem + 't';
    return [stem + 'e', du, t, inf, t, inf];
  }

  // du-form from a changed er-form: trägt → trägst, liest → liest, hält → hältst, lädt → lädst.
  function duFromThird(pres3, stem) {
    if (/t$/.test(stem)) return pres3 + 'st';
    if (/d$/.test(stem)) return pres3.slice(0, -1) + 'st';
    const changed = pres3.slice(0, -1);
    return changed + (SIBILANT.test(changed) ? 't' : 'st');
  }

  // Präteritum from the er-form: -te forms like weak verbs (machte, schrie), the others take -st / -en / -t
  // (with -e- after t / d, and both forms after s / ß / z: du lasest / last).
  function preteriteForms(pret3) {
    if (pret3.endsWith('e')) return [[pret3], [pret3 + 'st'], [pret3], [pret3 + 'n'], [pret3 + 't'], [pret3 + 'n']];
    const du = /[td]$/.test(pret3) ? [pret3 + 'est'] : SIBILANT.test(pret3) ? [pret3 + 'est', pret3 + 't'] : [pret3 + 'st'];
    const ihr = /[td]$/.test(pret3) ? pret3 + 'et' : pret3 + 't';
    return [[pret3], du, [pret3], [pret3 + 'en'], [ihr], [pret3 + 'en']];
  }

  function konj2Forms(inf, k3) {
    const forms = [[k3], [k3 + 'st'], [k3], [k3 + 'n'], [k3 + 't'], [k3 + 'n']];
    if (KONJ2_SHORT.has(inf)) {
      const short = k3.slice(0, -1);
      // "du wärst" and "ihr wärt" are the usual forms; for the others the long form is the standard one.
      if (inf === 'sein') forms[1] = [short + 'st', k3 + 'st'], forms[4] = [short + 't', k3 + 't'];
      else {
        if (!SIBILANT.test(short)) forms[1].push(short + 'st'); // no "du ließst"
        forms[4].push(short + 't');
      }
    }
    return forms;
  }

  // Merges per-person lists of alternatives (backt / bäckt).
  function merge(lists) {
    return PERSONS.map((_, i) => [...new Set(lists.flatMap((l) => l[i]))]);
  }

  // ---------- Building a verb ----------

  // From the base data of a strong verb (or null for a weak one).
  function baseForms(inf, data) {
    const { stem } = stemOf(inf);
    const regular = regularPresent(inf);
    let pres;
    if (IRREGULAR_PRESENT[inf]) pres = IRREGULAR_PRESENT[inf].map((f) => [f]);
    else if (data?.pres3) {
      pres = merge(data.pres3.map((p3) => {
        const forms = regular.map((f) => [f]);
        if (p3 !== regular[2]) forms[1] = [duFromThird(p3, stem)], forms[2] = [p3];
        return forms;
      }));
    } else pres = regular.map((f) => [f]);

    const e = needsE(stem);
    const weak = { pret3: stem + (e ? 'ete' : 'te'), pii: 'ge' + stem + (e ? 'et' : 't') };
    if (data) {
      // A card can give the parts of a regular verb too (machen, macht, machte, hat gemacht).
      const irregular = !!IRREGULAR_PRESENT[inf] || pres[2][0] !== regular[2] || data.pret3[0] !== weak.pret3 || data.pii[0] !== weak.pii;
      return { pres, pret: merge(data.pret3.map(preteriteForms)), pii: data.pii, aux: data.aux, irregular };
    }
    return { pres, pret: preteriteForms(weak.pret3), pii: [weak.pii], aux: ['haben'], irregular: false };
  }

  const isKnown = (inf, known) => STRONG[inf] || IRREGULAR_PRESENT[inf] || WEAK_BASES.has(inf) || known.has(inf);

  // The verb's prefix, if any: { prefix, base, separable }. known: further infinitives that count as a base (the deck's).
  function analyse(inf, known = new Set()) {
    if (STRONG[inf] || NOT_PREFIXED.has(inf)) return null;
    const listed = SEPARABLE_LISTED.has(inf) || INSEPARABLE_LISTED.has(inf);
    for (const p of PREFIXES) {
      if (!inf.startsWith(p) || inf.length - p.length < 4) continue;
      const base = inf.slice(p.length);
      if (AMBIGUOUS.includes(p)) {
        if (!listed) return { unknown: true };
        return { prefix: p, base, separable: SEPARABLE_LISTED.has(inf) };
      }
      // be-llen, be-tteln: a doubled consonant never starts a stem, so these are no prefixed verbs.
      if (INSEPARABLE.includes(p)) return /^([^aeiouäöü])\1/.test(base) ? null : { prefix: p, base, separable: false };
      // A separable prefix only where the rest is a verb we know ("an-kommen", not "an-tworten").
      if (isKnown(base, known) || analyse(base, known)?.prefix) return { prefix: p, base, separable: true };
    }
    return null;
  }

  // A verb from its infinitive, or null when its forms are not certain. card: { pres3, pret3, pii, aux } from a deck card.
  function verb(inf, { known = new Set(), card = null, reflexive = false } = {}) {
    if (AMBIGUOUS_VERBS.has(inf) && !card) return null;
    if (!/^[a-zäöüß]+$/.test(inf) || !/(en|ln|rn|tun|sein)$/.test(inf)) return null;
    // Reflexive verbs always take haben ("ich habe mich umgezogen").
    const done = (v) => ({ ...v, inf, reflexive, aux: reflexive ? ['haben'] : v.aux });
    const konj2Of = (i) => (KONJ2[i] ? konj2Forms(i, KONJ2[i]) : null);

    if (card) {
      const base = card.particle ? inf.slice(card.particle.length) : inf;
      const forms = baseForms(base, card);
      // Irregular when the card's forms differ from the ones the rules give for the whole infinitive (besuchen → besucht,
      // einkaufen → eingekauft are regular), or when those are irregular already.
      const plain = verb(inf, { known, reflexive });
      if (plain) {
        const same = (a, b) => a[0] === b[0];
        forms.irregular = plain.irregular || !same(plain.pii, forms.pii) || !same(plain.pres[2], forms.pres[2]) || !same(plain.pret[2], forms.pret[2]);
      }
      return done({ ...forms, particle: card.particle || '', konj2: konj2Of(base) });
    }

    const split = analyse(inf, known);
    if (split?.unknown) return null;
    if (split?.separable) {
      // Separable: the base's finite forms with the particle at the end; Partizip II with it in front (aufgestanden).
      const base = verb(split.base, { known });
      if (!base) return null;
      // A base with two auxiliaries passes on both (ist / hat zusammengebrochen); AUX narrows the ones that take only one.
      return done({ ...base, particle: split.prefix + base.particle, pii: base.pii.map((p) => split.prefix + p), aux: AUX[inf] || base.aux });
    }
    if (split) {
      // Inseparable: the prefix on every form and no ge- (verstehen → verstanden), usually haben. Only a strong base keeps
      // strong forms; anything else is weak (be-gegnen, be-auftragen: begegnete, beauftragte).
      const add = (list) => list.map((f) => split.prefix + f);
      const inner = !STRONG[split.base] && analyse(split.base, known);
      if (inner && inner.prefix && !inner.separable && STRONG[inner.base]) {
        const v = verb(split.base, { known });
        return done({ ...v, pres: v.pres.map(add), pret: v.pret.map(add), pii: v.pii.map((p) => split.prefix + p), aux: AUX[inf] || v.aux });
      }
      const base = baseForms(split.base, (!WEAK_COMPOUNDS.has(inf) && STRONG[split.base]) || null);
      return done({
        ...base, particle: '', konj2: null,
        pres: base.pres.map(add), pret: base.pret.map(add),
        pii: base.pii.map((p) => split.prefix + p.replace(/^ge/, '')),
        aux: AUX[inf] || ['haben'],
      });
    }
    const data = STRONG[inf] || null;
    const forms = baseForms(inf, data);
    if (!data && inf.endsWith('ieren')) forms.pii = [inf.slice(0, -2) + 't'];
    if (!data && AUX[inf]) forms.aux = AUX[inf];
    return done({ ...forms, particle: '', konj2: konj2Of(inf) });
  }


  // ---------- Deck cards ----------

  // A verb card: "fahren, fährt, fuhr, ist gefahren", "sich anziehen", "(ver)leihen", "überlegen, erwägen" (synonyms).
  // Returns { inf, reflexive, card } — card holds the principal parts when the card gives them — or null.
  function readCard(word) {
    const parts = String(word).split(',').map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return null;
    let head = parts[0].replace(/^\(sich\)\s+/, '').replace(/^\((\w+)\)/, '');
    const reflexive = /^sich\s+/.test(head);
    head = head.replace(/^sich\s+/, '');
    if (!/^[a-zäöüß]+$/.test(head)) return null;
    const last = parts[parts.length - 1].match(/^((?:hat|ist)(?:\/(?:hat|ist))?) (\S+)$/);
    if (!last || parts.length < 4) return { inf: head, reflexive, card: null };
    const aux = last[1].split('/').map((a) => (a === 'hat' ? 'haben' : 'sein'));
    // A separable verb's card gives the finite forms with the particle after them ("fängt an"): keep it apart.
    const particle = parts[1].match(/ (\S+)$/)?.[1] || '';
    const bare = (p) => split(p.replace(/ \S+$/, ''));
    if (particle && !head.startsWith(particle)) return null;
    return {
      inf: head,
      reflexive,
      card: { pres3: bare(parts[1]), pret3: bare(parts[2]), pii: split(last[2]), aux, particle },
    };
  }

  // All verb cards of a deck as verbs: [{ note, verb }] (cards whose forms are uncertain are left out). The cards' own
  // infinitives count as bases for separable verbs (so "an-probieren" splits once "probieren" is a card too).
  const isVerbCard = (note, clean = (s) => s) => /^(v|verb)\b/.test(clean(note.pos));

  function fromNotes(notes, clean = (s) => s) {
    const cards = notes
      .filter((n) => isVerbCard(n, clean))
      .map((note) => ({ note, card: readCard(clean(note.word)) }))
      .filter((x) => x.card);
    const known = new Set(cards.map((x) => x.card.inf));
    return cards
      .map(({ note, card }) => ({ note, verb: verb(card.inf, { known, card: card.card, reflexive: card.reflexive }) }))
      .filter((x) => x.verb);
  }

  // ---------- Imperativ ----------

  const IRREGULAR_IMPERATIVE = {
    sein: { du: ['sei'], ihr: ['seid'], Sie: ['seien'] },
    haben: { du: ['hab', 'habe'], ihr: ['habt'], Sie: ['haben'] },
    werden: { du: ['werde'], ihr: ['werdet'], Sie: ['werden'] },
  };
  // Modal verbs, wissen and verbs without a person as subject have no imperative in use.
  const NO_IMPERATIVE = new Set(['können', 'müssen', 'dürfen', 'sollen', 'wollen', 'mögen', 'wissen', 'geschehen', 'gelingen',
    'misslingen', 'betreffen', 'schwellen', 'passieren']);

  // { du, ihr, Sie, rule }: the finite part of the imperative (the particle goes to the end: "Ruf mich an!"), or null.
  //   du: the e → i change stays and -st goes (nimm, lies); a → ä does not (fahr); -e after t / d, a consonant + m / n
  //   and -ig (warte, atme, entschuldige); -eln drops its e (lächle); optional elsewhere (komm / komme).
  //   ihr: the ihr-form (nehmt). Sie: the Sie-form, followed by "Sie" (nehmen Sie).
  //   rule: which of these it is ('irregular', 'eToI', 'eln', 'ern', 'e', 'optional').
  function imperative(v) {
    const plain = baseInf(v);
    if (NO_IMPERATIVE.has(plain)) return null;
    if (IRREGULAR_IMPERATIVE[plain]) return { ...IRREGULAR_IMPERATIVE[plain], rule: 'irregular' };
    const { stem, elr } = stemOf(plain);
    const p3 = v.pres[2][0];
    const eToI = p3 !== regularPresent(plain)[2] && /i/.test(p3) && /e/.test(stem);
    let du;
    let rule;
    if (eToI) du = [/t$/.test(stem) ? p3 : p3.replace(/t$/, '')], rule = 'eToI';
    else if (elr === 'l') du = [stem.slice(0, -2) + 'le'], rule = 'eln';
    else if (elr === 'r') du = [stem + 'e', stem.slice(0, -2) + 're'], rule = 'ern';
    else if (needsE(stem) || /ig$/.test(stem)) du = v.irregular && /[td]$/.test(stem) ? [stem + 'e', stem] : [stem + 'e'], rule = 'e'; // halte / halt
    else du = [stem, stem + 'e'], rule = 'optional';
    return { du, ihr: v.pres[4], Sie: v.pres[5], rule };
  }

  // ---------- Konjunktiv I ----------

  // The Konjunktiv I in PERSONS order: the infinitive's stem + e, est, e, en, et, en (er komme, er habe, er könne); sein is
  // irregular (sei, seist / seiest). Null for -eln / -ern verbs (er lächle), which the drills leave out.
  function konj1(v) {
    const plain = baseInf(v);
    if (plain === 'sein') return [['sei'], ['seist', 'seiest'], ['sei'], ['seien'], ['seiet'], ['seien']];
    const { stem, elr } = stemOf(plain);
    if (elr) return null;
    return [stem + 'e', stem + 'est', stem + 'e', plain, stem + 'et', plain].map((f) => [f]);
  }

  // Reported speech for a person: the Konjunktiv I, or — where it looks like the Indikativ (ich habe, sie kommen) — the
  // Konjunktiv II (hätten, kämen), or würde + infinitive for verbs with no Konjunktiv II in use. { kind, forms }:
  // kind 'konj1', 'konj2' or 'wuerde' (forms are then those of würde).
  function reported(v, person) {
    const i = PERSONS.indexOf(person);
    const k1 = konj1(v);
    if (k1 && !k1[i].some((f) => v.pres[i].includes(f))) return { kind: 'konj1', forms: k1[i] };
    if (v.konj2) return { kind: 'konj2', forms: v.konj2[i] };
    return { kind: 'wuerde', forms: verb('werden').konj2[i] };
  }

  // ---------- Display ----------

  const finite = (v, tense, person) => v[tense][PERSONS.indexOf(person)];

  // The infinitive without its separable particle (anrufen → rufen).
  const baseInf = (v) => (v.particle ? v.inf.slice(v.particle.length) : v.inf);

  // ---------- Perfekt ----------

  // Verbs of the strong table that start with the prefix ge- (analyse() leaves the table's verbs whole; it splits the others).
  const GE_PREFIXED = new Set(['gewinnen', 'gelingen', 'geschehen', 'genießen']);

  // Verbs with haben in the north and sein in the south: both count.
  const REGIONAL = new Set(['liegen', 'sitzen', 'stehen']);
  const regional = (v) => REGIONAL.has(baseInf(v)) && v.aux.length > 1;

  // Which auxiliary the verb takes, in words.
  function auxNote(v) {
    if (regional(v)) return `${v.inf} takes haben (sein in southern Germany, Austria and Switzerland)`;
    if (v.aux.length > 1) {
      return v.aux[0] === 'sein' ? `${v.inf} takes sein; haben only with a direct object`
        : `${v.inf} takes haben with an object; sein when it means moving or changing by itself`;
    }
    return `${v.inf} takes ${v.aux[0]}${v.aux[0] === 'sein' ? ' (like most verbs of movement or change, and sein, bleiben, werden)' : ''}`;
  }

  // How the Partizip II is made: { strength: 'strong' (-en) | 'mixed' (-t, but not the regular form: gedacht) | 'weak',
  // ge: 'separable' (between the parts: angerufen) | 'inseparable' (none: verloren, besucht, gewonnen) | 'ieren' (none:
  // studiert) | 'ge' (in front), ieren: whether it ends in -ieren (also when separable: anprobiert) }.
  function participleRule(v) {
    const pii = v.pii[0];
    const base = baseInf(v);
    const ieren = base.endsWith('ieren');
    let ge = 'ge';
    if (v.particle) ge = 'separable';
    else if (ieren) ge = 'ieren';
    // No ge- in front: be-, ver-, er- … (besucht, verloren), and ge- itself (gefallen, gehört; the strong ones in GE_PREFIXED:
    // gewonnen — but gegangen, gegeben).
    else if (!pii.startsWith('ge') || analyse(base)?.prefix === 'ge' || GE_PREFIXED.has(base)) ge = 'inseparable';
    // The regular -t participle, with or without ge-, tells mixed verbs (gedacht) from weak ones (gehabt, besucht, anvertraut).
    const { stem } = stemOf(base);
    const t = stem + (needsE(stem) ? 'et' : 't');
    const core = pii.slice((v.particle || '').length);
    const strength = /n$/.test(pii) ? 'strong' : core === t || core === 'ge' + t ? 'weak' : 'mixed';
    return { strength, ge, ieren };
  }

  // The infinitive with zu: "zu gehen", and between the parts of a separable verb ("anzurufen").
  const zuInfinitive = (v) => (v.particle ? `${v.particle}zu${baseInf(v)}` : `zu ${v.inf}`);

  // "fahren – fährt – fuhr – ist gefahren"; the separable particle after the finite forms ("steht auf").
  function principalParts(v) {
    const p = v.particle ? ` ${v.particle}` : '';
    return `${v.reflexive ? 'sich ' : ''}${v.inf} – ${v.pres[2][0]}${p} – ${v.pret[2][0]}${p} – ${AUX_3SG[v.aux[0]]} ${v.pii[0]}`;
  }

  return {
    PERSONS, PERSON_LABELS, REFLEXIVE_PRONOUNS, AUX_3SG, STRONG, IRREGULAR_PRESENT, KONJ2,
    verb, readCard, analyse, finite, principalParts, regularPresent, preteriteForms, fromNotes, imperative, baseInf, zuInfinitive, konj1, reported, isVerbCard, regional, auxNote, participleRule,
  };
});
