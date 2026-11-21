'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core/cloze.js');

test('answer checking', () => {
  const gap = { prefix: 'd', answer: 'er' };
  assert.ok(C.isCorrectGap(gap, 'er'));
  assert.ok(C.isCorrectGap(gap, ' ER '));
  assert.ok(C.isCorrectGap(gap, 'der'));
  assert.ok(C.isCorrectGap(gap, '-er'));
  assert.ok(C.isCorrectGap({ prefix: '', answer: 'en' }, '- en'));
  assert.ok(!C.isCorrectGap(gap, 'en'));
  const empty = { prefix: 'ein', answer: '' };
  for (const v of ['', '-', '0', '∅']) assert.ok(C.isCorrectGap(empty, v), JSON.stringify(v));
  assert.ok(C.isCorrectGap(empty, 'ein'));
  assert.ok(!C.isCorrectGap(empty, 'e'));
  const word = { prefix: '', answer: 'worden' };
  assert.ok(C.isCorrectGap(word, 'Worden'));
  assert.ok(!C.isCorrectGap(word, 'geworden'));
  assert.ok(!C.isCorrectGap(word, ''));
});

test('templates: slots, singular / plural and the capitalized sentence start', () => {
  const det = { slot: 'det', prefix: 'dies', answer: 'er' };
  assert.deepEqual(C.fillTemplate('{0} {ist|sind} hier.', [[det, ' Mann']], false), [{ ...det, prefix: 'Dies' }, ' Mann', ' ', 'ist', ' hier.']);
  assert.equal(C.fillTemplate('Wo {ist|sind} {0}?', [['die Kinder']], true).join(''), 'Wo sind die Kinder?');
  const word = { slot: 'det', prefix: '', answer: 'im', alts: ['in dem'], placeholder: 'in + d…' };
  assert.deepEqual(C.capitalizeFirst([word, ' Park'])[0], { ...word, answer: 'Im', alts: ['In dem'], placeholder: 'In + d…' });
  assert.deepEqual(C.capitalizeFirst(['trotz', ' des Regens']), ['Trotz', ' des Regens']);
});

test('Anki fields are cleaned of HTML and entities', () => {
  assert.equal(C.clean('Die <b>Apotheke</b> ist&nbsp;zu.<br>Ja &amp; nein'), 'Die Apotheke ist zu. Ja & nein');
});

test('typed answer display', () => {
  assert.equal(C.typed({ prefix: 'd', answer: 'er' }, 'dem'), 'dem');
  assert.equal(C.typed({ prefix: 'd', answer: 'er' }, 'em'), 'd-em');
  assert.equal(C.typed({ prefix: 'Ein', answer: 'e' }, ''), 'ein-∅');
  assert.equal(C.typed({ prefix: '', answer: 'worden' }, 'geworden'), 'geworden');
  assert.equal(C.typed({ prefix: '', answer: 'worden' }, ''), '∅');
  assert.equal(C.typed({ prefix: 'ein', answer: 'en' }, 'ein'), 'ein');
  assert.ok(C.isCorrectGap({ prefix: '', answer: 'a/d' }, 'A / D'));
});
