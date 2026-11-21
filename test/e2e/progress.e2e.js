'use strict';

// The real app (harness.js): the Progress screen, where parts are ticked learnt for Sentences and Table. Run with
// `npm run test:e2e`. ETUDES_SHOTS=<dir> also saves screenshots of the home screen and the checklist.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withApp, skip } = require('./harness.js');

test('marking parts learnt on Progress', { timeout: 120000, skip }, () => withApp(async (app) => {
  const { evaluate, screen, focused, toast, click, text, key, shot, openTopic, tickPart, tickTopic, learnt, said } = app;
  const box = (id) => evaluate(`(() => { const b = document.getElementById(${JSON.stringify(id)}); return b && { checked: b.checked, mixed: b.indeterminate }; })()`);
  const expanded = () => evaluate(`[...document.querySelectorAll('#progress button.check-toggle')]
    .filter((b) => b.getAttribute('aria-expanded') === 'true').map((b) => b.getAttribute('aria-controls'))`);
  const warn = (id) => evaluate(`[...document.querySelectorAll('#progress-topic-${id} .check-warn')].map((w) => w.textContent)`);
  const count = () => text('#progress-count');
  const countOf = (id) => text(`#${id}-count`);
  const counted = (parts, topics) => `${parts} of 54 parts learnt (ticked for either kind) · ${topics} of 10 topics marked learnt`;

  // Nothing learnt: every topic collapsed, the focus on the first name; Esc goes back to the link.
  await shot('progress-1-home');
  await click('#btn-progress');
  assert.equal(await screen(), 'progress');
  assert.equal(await count(), counted(0, 0));
  assert.equal(await evaluate(`document.querySelectorAll('#progress button.check-toggle').length`), 8, 'no toggle without parts');
  assert.deepEqual(await expanded(), []);
  assert.equal(await focused(), 'adjectives');
  await key('Escape');
  assert.equal(await screen(), 'home');
  assert.equal(await focused(), 'btn-progress');

  // Passiv: Vorgangspassiv for sentences. No tense yet: partly marked, the topic's switch mixed.
  await click('#btn-progress');
  await click('#progress [aria-controls="progress-parts-passive"]');
  assert.equal(await evaluate(`document.querySelector('#progress-parts-passive .check-cols').textContent`), 'SentencesTable');
  await tickPart('passive', 'sentences', 'kinds', 'werden');
  assert.equal(await count(), counted(1, 1));
  assert.deepEqual(await box('progress-passive-sentences'), { checked: false, mixed: true });
  assert.equal(await countOf('progress-passive-sentences'), '1/9');
  assert.deepEqual(await warn('passive'), ['Sentences: Only partly marked — tick at least one of Tenses.']);
  assert.equal(await focused(), 'Vorgangspassiv learnt for sentences', 'the focus stays on the box');
  await tickPart('passive', 'sentences', 'tenses', 'praet');
  assert.deepEqual(await warn('passive'), []);
  assert.deepEqual(await learnt(), { passive: { sentences: { parts: { kinds: ['werden'], tenses: ['praet'] }, since: (await learnt()).passive.sentences.since } } });
  assert.equal(await focused(), 'Präteritum learnt for sentences');
  assert.deepEqual(await expanded(), ['progress-parts-passive'], 'still open');
  // Space toggles the focused box.
  await key('Space');
  assert.deepEqual(await box('progress-passive-sentences-tenses-praet'), { checked: false, mixed: false });
  assert.equal(await focused(), 'Präteritum learnt for sentences');
  await key('Space');
  assert.deepEqual(await box('progress-passive-sentences-tenses-praet'), { checked: true, mixed: false });
  assert.equal(await count(), counted(2, 1));
  assert.equal(await evaluate(`document.getElementById('progress-passive-sentences').getAttribute('aria-label')`), 'Passiv: all parts learnt for sentences');
  assert.equal(await evaluate(`document.querySelector('#progress-parts-passive ul').getAttribute('aria-labelledby')`),
    'progress-title-passive progress-passive-option-kinds');
  await shot('progress-2-ticked');

  // Präpositionen: a Table box for the groups with a case, none for the verbs with fixed prepositions.
  await click('#progress [aria-controls="progress-parts-prepositions"]');
  assert.ok(await box('progress-prepositions-table-groups-akk'));
  assert.equal(await box('progress-prepositions-table-groups-fixed'), null);
  assert.ok(await box('progress-prepositions-sentences-groups-fixed'));
  assert.equal(await evaluate(`document.querySelectorAll('#progress-parts-prepositions .check-part')[4].children.length`), 3, 'an empty cell keeps the columns');
  // Verbformen has no table: one column.
  assert.equal(await evaluate(`document.getElementById('progress-parts-verbforms').classList.contains('single')`), true);

  // Topics without parts: the switch is the mark.
  await tickTopic('fvg', 'sentences');
  assert.equal(await evaluate(`document.getElementById('progress-fvg-sentences').getAttribute('aria-label')`), 'Funktionsverbgefüge learnt for sentences');
  assert.deepEqual((await learnt()).fvg.sentences.parts, {});
  assert.equal(await focused(), 'Funktionsverbgefüge learnt for sentences');
  await tickTopic('adjectives', 'table');
  assert.deepEqual(await box('progress-adjectives-table'), { checked: true, mixed: false });
  assert.equal(await evaluate(`document.getElementById('progress-adjectives-table-count')`), null, 'no count without parts');
  assert.equal(await count(), counted(2, 3));

  // Passiv's Table switch ticks every part, and then clears them.
  await tickTopic('passive', 'table');
  assert.deepEqual(await box('progress-passive-table'), { checked: true, mixed: false });
  assert.equal(await countOf('progress-passive-table'), '9/9');
  assert.equal(await count(), counted(9, 3));
  await shot('progress-3-all');
  await tickTopic('passive', 'table');
  assert.deepEqual(await box('progress-passive-table'), { checked: false, mixed: false });
  assert.equal((await learnt()).passive.table, undefined);
  assert.equal(await count(), counted(2, 3));

  // Settings the topic cannot practise: Zustandspassiv in the Perfekt.
  await tickPart('passive', 'sentences', 'kinds', 'sein');
  await tickPart('passive', 'sentences', 'kinds', 'werden');
  await tickPart('passive', 'sentences', 'tenses', 'perf');
  await tickPart('passive', 'sentences', 'tenses', 'praet');
  assert.match((await warn('passive'))[0], /^Sentences: Zustandspassiv is practised in Präsens, Präteritum, Futur I only/);
  await shot('progress-4-unfit');

  // Collapsing and expanding.
  await click('#progress [aria-controls="progress-parts-passive"]');
  assert.equal(await evaluate(`document.getElementById('progress-parts-passive').hidden`), true);
  await click('#progress [aria-controls="progress-parts-passive"]');
  assert.equal(await evaluate(`document.getElementById('progress-parts-passive').hidden`), false);

  // A topic's name opens its options; Esc goes home, on that topic.
  await openTopic('determiners', '#progress');
  assert.equal(await text('#options-title'), 'Artikelwörter');
  await key('Escape');
  assert.equal(await screen(), 'home');
  assert.equal(await focused(), 'determiners');
  // A topic with a tick starts open (Adjektivendungen: its table).
  await click('#btn-progress');
  assert.deepEqual(await expanded(), ['progress-parts-adjectives', 'progress-parts-passive']);

  // ⇧Esc and ← Topics also go home at once.
  await key('Escape', true);
  assert.equal(await screen(), 'home');
  assert.equal(await focused(), 'btn-progress');
  assert.equal(await toast(), null);
  await click('#btn-progress');
  await click('#progress .to-topics');
  assert.equal(await screen(), 'home');

  // Marks saved before parts were ticked (their settings) show the parts they held; a change saves the new shape and
  // keeps the day.
  await evaluate(`Etudes.store.write('etudes-learnt', {
    passive: { table: { settings: { kinds: ['werden'], tenses: ['praes', 'praet'], length: 20 }, since: 1000 } },
    prepositions: { table: { settings: { groups: ['akk', 'fixed'], hints: true }, since: 2000 } },
    determiners: { sentences: { settings: { families: ['ein'] }, since: 3000 } },
  })`);
  await click('#btn-progress');
  assert.deepEqual(await expanded(), ['progress-parts-passive', 'progress-parts-prepositions', 'progress-parts-determiners']);
  const ticks = (id) => evaluate(`[...document.querySelectorAll('#progress-parts-${id} input:checked')].map((i) => i.id.replace('progress-${id}-', ''))`);
  assert.deepEqual(await ticks('passive'), ['table-kinds-werden', 'table-tenses-praes', 'table-tenses-praet']);
  assert.deepEqual(await ticks('prepositions'), ['table-groups-akk']);
  assert.deepEqual(await ticks('determiners'), ['sentences-families-ein', 'sentences-cases-nom', 'sentences-cases-acc', 'sentences-cases-dat', 'sentences-cases-gen'],
    'the missing cases were the defaults');
  await tickPart('passive', 'table', 'tenses', 'perf');
  assert.deepEqual((await learnt()).passive, { table: { parts: { kinds: ['werden'], tenses: ['praes', 'praet', 'perf'] }, since: 1000 } });
  assert.deepEqual((await learnt()).prepositions, { table: { settings: { groups: ['akk', 'fixed'], hints: true }, since: 2000 } }, 'unchanged until changed');
  await click('#progress .to-topics');

  assert.deepEqual(said(), [], 'nothing read aloud');
  assert.ok(app.ranOnTempProfile(), 'the app ran on the temp profile');
}));
