'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../tools/partizip-deck.js');
const anki = require('../tools/anki-import.js');
const verbs = require('../src/core/verbs.js');

const card = (word, extra = {}) => ({ word, pos: 'v', english: 'to x', article: '', headings: [], examples: [], dueIn: null, lapses: 0, ease: null, ...extra });

test('the deck: no plain regular verbs, the auxiliary with the Partizip II, the patterns as tags, learnt verbs first', () => {
  const { rows, unsure } = P.buildDeck([
    card('machen'),
    card('fahren, fährt, fuhr, ist gefahren'),
    card('anrufen, ruft an, rief an, hat angerufen', { dueIn: 3 }),
    card('studieren'),
    card('besuchen', { examples: [{ de: 'Wir haben gestern die Oma besucht.', en: 'We visited grandma yesterday.' }] }),
    card('senden, sendet, sandte/sendete, hat gesandt/gesendet'),
    card('schaffen'),
  ]);
  const byInf = Object.fromEntries(rows.map((r) => [r.Infinitiv, r]));
  assert.equal(byInf.machen, undefined);
  assert.equal(rows[0].Infinitiv, 'anrufen');
  assert.equal(byInf.anrufen.Partizip, 'hat angerufen');
  assert.match(byInf.anrufen.Regel, /separable: an \+ gerufen/);
  assert.equal(byInf.fahren.Partizip, 'ist gefahren');
  assert.deepEqual(byInf.fahren.tags, ['strong', 'sein', 'neu']);
  assert.equal(byInf.studieren.Partizip, 'hat studiert');
  assert.equal(byInf.besuchen.Beispiel, 'Wir <b>haben</b> gestern die Oma <b>besucht</b>.');
  assert.equal(byInf.senden.Partizip, 'hat gesandt');
  assert.match(byInf.senden.Regel, /also: gesendet/);
  assert.deepEqual(unsure, ['schaffen']);
  const spec = anki.packageSpec(P.DECK, rows);
  assert.equal(spec.deck, 'Deutsch::Partizip II');
  assert.ok(spec.notes.every((n) => n.fields.length === 6));
  assert.ok(spec.notes.some((n) => n.tags.join(' ') === 'partizip::strong partizip::sein partizip::neu'));
});

test('the Partizip II pattern: no ge- after an inseparable prefix (gewonnen) but ge- for gehen; aufstehen takes sein', () => {
  const rule = (inf) => {
    const { strength, ge } = verbs.participleRule(verbs.verb(inf));
    return { strength, ge };
  };
  assert.deepEqual(rule('gewinnen'), { strength: 'strong', ge: 'inseparable' });
  assert.deepEqual(rule('gehen'), { strength: 'strong', ge: 'ge' });
  assert.deepEqual(rule('besuchen'), { strength: 'weak', ge: 'inseparable' });
  assert.deepEqual(rule('denken'), { strength: 'mixed', ge: 'ge' });
  assert.equal(verbs.regional(verbs.verb('aufstehen')), false);
  const { rows } = P.buildDeck([card('aufstehen, steht auf, stand auf, ist aufgestanden')]);
  assert.equal(rows[0].Partizip, 'ist aufgestanden');
});

test('cards with principal parts: weak prefixed and -ieren verbs are not mixed (nor irregular); quotes are escaped', () => {
  const { rows } = P.buildDeck([
    card('einkaufen, kauft ein, kaufte ein, hat eingekauft'),
    card('besuchen, besucht, besuchte, hat besucht', { examples: [{ de: '"Wir haben sie besucht", sagte er.', en: '' }] }),
    card('studieren, studiert, studierte, hat studiert'),
    card('denken, denkt, dachte, hat gedacht'),
    card('anprobieren, probiert an, probierte an, hat anprobiert'),
  ]);
  const byInf = Object.fromEntries(rows.map((r) => [r.Infinitiv, r]));
  assert.deepEqual(byInf.einkaufen.tags, ['separable', 'neu']);
  assert.deepEqual(byInf.besuchen.tags, ['inseparable', 'neu']);
  assert.deepEqual(byInf.studieren.tags, ['ieren', 'neu']);
  assert.deepEqual(byInf.denken.tags, ['mixed', 'neu']);
  assert.match(byInf.anprobieren.Regel, /an \+ probiert \(-ieren: no ge-\)/);
  assert.equal(verbs.fromNotes([card('besuchen, besucht, besuchte, hat besucht')])[0].verb.irregular, false);
  assert.ok(rows.some((r) => /"Wir <b>haben<\/b> sie <b>besucht<\/b>", sagte er\./.test(r.Beispiel)));
});
