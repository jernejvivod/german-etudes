'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/core/verbs.js');

const forms = (v, tense) => v[tense].map((f) => f[0]);

test('present tense: regular endings, e-insertion, sibilant stems, -eln / -ern', () => {
  assert.deepEqual(forms(V.verb('machen'), 'pres'), ['mache', 'machst', 'macht', 'machen', 'macht', 'machen']);
  assert.deepEqual(forms(V.verb('arbeiten'), 'pres'), ['arbeite', 'arbeitest', 'arbeitet', 'arbeiten', 'arbeitet', 'arbeiten']);
  assert.deepEqual(forms(V.verb('öffnen'), 'pres').slice(1, 3), ['öffnest', 'öffnet']);
  assert.deepEqual(forms(V.verb('rechnen'), 'pres').slice(1, 3), ['rechnest', 'rechnet']);
  assert.deepEqual(forms(V.verb('wohnen'), 'pres').slice(1, 3), ['wohnst', 'wohnt']);
  assert.equal(V.verb('tanzen').pres[1][0], 'tanzt');
  assert.equal(V.verb('heißen').pres[1][0], 'heißt');
  assert.deepEqual(forms(V.verb('lächeln'), 'pres').slice(0, 3), ['lächle', 'lächelst', 'lächelt']);
  assert.deepEqual(forms(V.verb('erinnern'), 'pres'), ['erinnere', 'erinnerst', 'erinnert', 'erinnern', 'erinnert', 'erinnern']);
});

test('present tense: stem changes for du and er only', () => {
  const du = (inf) => V.verb(inf).pres[1][0];
  const er = (inf) => V.verb(inf).pres[2][0];
  assert.deepEqual(['fahren', 'lesen', 'essen', 'nehmen', 'halten', 'laden', 'raten', 'treten', 'gelten', 'waschen', 'wachsen', 'stoßen'].map(du),
    ['fährst', 'liest', 'isst', 'nimmst', 'hältst', 'lädst', 'rätst', 'trittst', 'giltst', 'wäschst', 'wächst', 'stößt']);
  assert.deepEqual(['fahren', 'halten', 'treten', 'sehen'].map(er), ['fährt', 'hält', 'tritt', 'sieht']);
  assert.equal(V.verb('fahren').pres[0][0], 'fahre');
  assert.equal(V.verb('halten').pres[4][0], 'haltet');
  assert.deepEqual(forms(V.verb('wissen'), 'pres'), ['weiß', 'weißt', 'weiß', 'wissen', 'wisst', 'wissen']);
  assert.deepEqual(V.verb('backen').pres[2], ['backt', 'bäckt']);
});

test('Präteritum: -te forms, strong forms with -e- after t / d, both forms after s / ß', () => {
  assert.deepEqual(forms(V.verb('arbeiten'), 'pret'), ['arbeitete', 'arbeitetest', 'arbeitete', 'arbeiteten', 'arbeitetet', 'arbeiteten']);
  assert.deepEqual(forms(V.verb('kommen'), 'pret'), ['kam', 'kamst', 'kam', 'kamen', 'kamt', 'kamen']);
  assert.deepEqual(forms(V.verb('finden'), 'pret'), ['fand', 'fandest', 'fand', 'fanden', 'fandet', 'fanden']);
  assert.deepEqual(V.verb('lesen').pret[1], ['lasest', 'last']);
  assert.deepEqual(forms(V.verb('schreien'), 'pret'), ['schrie', 'schriest', 'schrie', 'schrien', 'schriet', 'schrien']);
  assert.deepEqual(forms(V.verb('denken'), 'pret').slice(0, 2), ['dachte', 'dachtest']);
});

test('Partizip II and auxiliary: ge-, -ieren, prefixes, sein for motion and change', () => {
  const perfect = (inf) => { const v = V.verb(inf); return `${V.AUX_3SG[v.aux[0]]} ${v.pii[0]}`; };
  assert.deepEqual(['machen', 'arbeiten', 'studieren', 'besuchen', 'verstehen', 'bekommen', 'gefallen', 'einkaufen', 'anrufen',
    'aufstehen', 'einschlafen', 'fernsehen', 'teilnehmen', 'vorbereiten', 'begegnen', 'anvertrauen', 'reisen', 'umziehen', 'erben'].map(perfect),
  ['hat gemacht', 'hat gearbeitet', 'hat studiert', 'hat besucht', 'hat verstanden', 'hat bekommen', 'hat gefallen', 'hat eingekauft',
    'hat angerufen', 'ist aufgestanden', 'ist eingeschlafen', 'hat ferngesehen', 'hat teilgenommen', 'hat vorbereitet',
    'ist begegnet', 'hat anvertraut', 'ist gereist', 'ist umgezogen', 'hat geerbt']);
  assert.equal(perfect('fahren'), 'ist gefahren');
  assert.deepEqual(V.verb('fahren').aux, ['sein', 'haben']);
  // Reflexive verbs take haben; separable ones keep the particle apart.
  assert.equal(V.verb('umziehen', { reflexive: true }).aux[0], 'haben');
  assert.equal(V.verb('anrufen').particle, 'an');
  assert.equal(V.verb('anrufen').pres[2][0], 'ruft');
});

test('Konjunktiv II: own forms for sein, haben, modals and a few strong verbs, none for the rest', () => {
  assert.deepEqual(V.verb('sein').konj2[1], ['wärst', 'wärest']);
  assert.deepEqual(forms(V.verb('haben'), 'konj2'), ['hätte', 'hättest', 'hätte', 'hätten', 'hättet', 'hätten']);
  assert.deepEqual(forms(V.verb('können'), 'konj2').slice(0, 2), ['könnte', 'könntest']);
  assert.deepEqual(V.verb('kommen').konj2[1], ['kämest', 'kämst']);
  assert.deepEqual(V.verb('tun').konj2[1], ['tätest']);
  assert.equal(V.verb('kaufen').konj2, null);
});

test('unsure verbs are left out: ambiguous prefixes, strong / weak doubles, unknown separable bases', () => {
  assert.equal(V.verb('hängen'), null);
  assert.equal(V.verb('umfahren'), null);
  assert.equal(V.verb('schaffen'), null);
  // "an-tworten" is no separable verb: antworten stays whole.
  assert.equal(V.verb('antworten').pii[0], 'geantwortet');
  assert.equal(V.verb('hindern').pii[0], 'gehindert');
});

test('deck cards: principal parts, reflexive and optional prefixes, synonym lists', () => {
  assert.deepEqual(V.readCard('fahren, fährt, fuhr, ist gefahren'), { inf: 'fahren', reflexive: false, card: { pres3: ['fährt'], pret3: ['fuhr'], pii: ['gefahren'], aux: ['sein'], particle: '' } });
  // A separable verb's card: the particle is kept apart from the finite forms.
  const an = V.readCard('anfangen, fängt an, fing an, hat angefangen');
  const anfangen = V.verb(an.inf, an);
  assert.equal(anfangen.particle, 'an');
  assert.deepEqual(forms(anfangen, 'pres'), ['fange', 'fängst', 'fängt', 'fangen', 'fangt', 'fangen']);
  assert.equal(V.principalParts(anfangen), 'anfangen – fängt an – fing an – hat angefangen');
  // A card can give a regular verb's parts too.
  const machen = V.readCard('machen, macht, machte, hat gemacht');
  assert.equal(V.verb(machen.inf, machen).irregular, false);
  assert.deepEqual(V.readCard('reiten, reitet, ritt, hat/ist geritten').card.aux, ['haben', 'sein']);
  assert.equal(V.readCard('genießen, genießt, genoss, genossen, hat genossen').card.pii[0], 'genossen');
  assert.deepEqual(V.readCard('sich umziehen'), { inf: 'umziehen', reflexive: true, card: null });
  assert.equal(V.readCard('(ver)leihen, leiht, lieh, hat geliehen').inf, 'leihen');
  assert.equal(V.readCard('(sich) ausleihen').inf, 'ausleihen');
  assert.equal(V.readCard('überlegen, erwägen, berücksichtigen').inf, 'überlegen');
  assert.equal(V.readCard('gern haben'), null);
  const card = V.readCard('backen, backt/bäckt, backte, hat gebacken');
  assert.equal(V.principalParts(V.verb(card.inf, card)), 'backen – backt – backte – hat gebacken');
  assert.equal(V.principalParts(V.verb('aufstehen')), 'aufstehen – steht auf – stand auf – ist aufgestanden');
});

test('review fixes: auxiliaries of prefixed verbs, prefix on a prefixed verb, no "du ließst"', () => {
  const perfect = (inf) => { const v = V.verb(inf); return `${V.AUX_3SG[v.aux[0]]} ${v.pii[0]}`; };
  assert.deepEqual(['eintreten', 'erfrieren', 'geraten', 'misslingen', 'missverstehen', 'überreichen'].map(perfect),
    ['ist eingetreten', 'ist erfroren', 'ist geraten', 'ist misslungen', 'hat missverstanden', 'hat überreicht']);
  assert.equal(V.verb('missverstehen').pret[2][0], 'missverstand');
  assert.deepEqual(V.verb('lassen').konj2[1], ['ließest']);
});

test('herüber- / hinüber- are separable, beugen is no be- verb', () => {
  const verbs = require('../src/core/verbs.js');
  assert.deepEqual(verbs.verb('herüberreichen').pii, ['herübergereicht']);
  assert.deepEqual(verbs.verb('vorbeugen').pii, ['vorgebeugt']);
});
