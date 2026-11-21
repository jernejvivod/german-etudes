// A topic's settings as the shell and the Daily review see them: fitting saved ones to the options offered now, what is
// wrong with them, and the part that is a topic's learnt scope — every option but those marked round: true, which only
// shape the topic's own round (its length, the order of the adjectives).
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

  // The settings without the round options, keys in the options' order.
  function scopeOf(topic, settings) {
    return Object.fromEntries(topic.options.filter((opt) => !opt.round).map((opt) => [opt.key, settings[opt.key]]));
  }

  // Whether two settings have the same scope (a stored one is fitted first, as the Daily review would use it).
  function sameScope(topic, a, b) {
    const key = (s) => JSON.stringify(scopeOf(topic, fitSettings(topic, s)));
    return key(a) === key(b);
  }

  // The chosen parts in words: "Vorgangspassiv · Präsens, Präteritum"; an option with every part ticked is "all …",
  // and a scope with nothing left out is just "all".
  function scopeText(topic, settings) {
    const parts = topic.options.filter((opt) => opt.type === 'checkboxes' && !opt.round).map((opt) => {
      const chosen = opt.choices.filter((c) => settings[opt.key]?.includes(c.value));
      const all = chosen.length === opt.choices.length;
      return { all, text: all ? `all ${opt.label.toLowerCase()}` : chosen.map((c) => c.label).join(', ') };
    });
    return parts.every((p) => p.all) ? 'all' : parts.map((p) => p.text).join(' · ');
  }

  return { fitSettings, settingsProblem, scopeOf, sameScope, scopeText };
});
