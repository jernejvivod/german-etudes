// A topic's settings as the shell and the daily exercises see them: fitting saved ones to the options offered now, what
// is wrong with them, and the part that is a topic's learnt scope. Each kind of mark (daily.js) has its own:
//   sentences: every option but those marked round: true, which only shape the topic's own round (its length, the order
//     of the adjectives), and those with a daily value, which the Daily review always uses (daily: 'anki', My Anki words);
//   table: the options marked table, the ones its table depends on — table: true, or a function giving the part of the
//     value the table holds (Präpositionen's case table only has the groups with a case of their own).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Etudes ||= { topics: [] }).scope = api;
})(globalThis, function () {
  'use strict';

  const choiceValues = (opt) => (opt.choices ? opt.choices.map((c) => c.value) : []);

  // Saved settings over the defaults, dropping values the topic's options no longer offer.
  function fitSettings(topic, saved) {
    const result = { ...topic.defaults };
    if (!saved || typeof saved !== 'object') return result;
    for (const opt of topic.options) {
      const value = saved[opt.key];
      const valid = choiceValues(opt);
      if (opt.type === 'radio' && valid.includes(value)) result[opt.key] = value;
      if (opt.type === 'checkboxes' && Array.isArray(value)) result[opt.key] = valid.filter((v) => value.includes(v));
      if (opt.type === 'toggle' && typeof value === 'boolean') result[opt.key] = value;
    }
    return result;
  }

  // The first problem with the settings ("Pick at least one", then the topic's own rule), or null.
  function settingsProblem(topic, settings) {
    const tooFew = topic.options.find((opt) => opt.min && settings[opt.key].length < opt.min);
    if (tooFew) return `Pick at least one: ${tooFew.label.toLowerCase()}.`;
    return topic.validate?.(settings) || null;
  }

  const inScope = (opt, kind) => (kind === 'table' ? !!opt.table : !opt.round && !('daily' in opt));
  const scoped = (opt, value, kind) => (kind === 'table' && typeof opt.table === 'function' ? opt.table(value) : value);
  // The choices of a checkboxes option a kind of mark can hold (Präpositionen's case table: the groups with a case).
  const scopeChoices = (opt, kind) => scoped(opt, choiceValues(opt), kind);

  // The part of the settings a kind of mark keeps, keys in the options' order.
  function scopeOf(topic, settings, kind = 'sentences') {
    return Object.fromEntries(topic.options.filter((opt) => inScope(opt, kind)).map((opt) => [opt.key, scoped(opt, settings[opt.key], kind)]));
  }

  // Whether two settings have the same scope (a stored one is fitted first, as the daily exercise would use it).
  function sameScope(topic, a, b, kind = 'sentences') {
    const key = (s) => JSON.stringify(scopeOf(topic, fitSettings(topic, s), kind));
    return key(a) === key(b);
  }

  // The scope in words, so two of them can be told apart: the chosen parts ("Vorgangspassiv · Präsens, Präteritum"; an
  // option with every part ticked is "all …", and with nothing left out just "all", or for a table "the whole table"),
  // then the switches that are on ("with hints") and the other choices ("Cards due within: 1 week").
  function scopeText(topic, settings, kind = 'sentences') {
    const options = topic.options.filter((opt) => inScope(opt, kind));
    const values = scopeOf(topic, settings, kind);
    const parts = options.filter((opt) => opt.type === 'checkboxes').map((opt) => {
      const chosen = opt.choices.filter((c) => values[opt.key]?.includes(c.value));
      const all = chosen.length === scopeChoices(opt, kind).length;
      return { all, text: all ? `all ${opt.label.toLowerCase()}` : chosen.map((c) => c.label).join(', ') };
    });
    const words = parts.every((p) => p.all) ? [kind === 'table' ? 'the whole table' : 'all'] : parts.map((p) => p.text);
    for (const opt of options) {
      if (opt.type === 'toggle' && values[opt.key]) words.push(`with ${opt.label.toLowerCase()}`);
      const choice = opt.type === 'radio' && opt.choices.find((c) => c.value === values[opt.key]);
      if (choice) words.push(`${opt.label}: ${choice.label}`);
    }
    return words.join(' · ');
  }

  return { choiceValues, fitSettings, settingsProblem, inScope, scopeChoices, scopeOf, sameScope, scopeText };
});
