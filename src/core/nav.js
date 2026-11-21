// What Esc and Shift+Esc do on each screen. Esc goes up one level (round → options → topic list), Shift+Esc straight to
// the topic list. Leaving a drill or table throws the round away, so there the key arms first and leaves on a second
// press of the same key; the other key re-arms for its own target.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Etudes ||= { topics: [] }).nav = api;
})(globalThis, function () {
  'use strict';

  const GUARDED = ['drill', 'table'];

  // screen: the screen shown; toTopics: Shift was held; armedFor: the target a first press armed, or null.
  // Returns { go: 'home' | 'options' }, { arm: 'home' | 'options' } or null (nothing to do).
  function escapeAction(screen, toTopics, armedFor) {
    if (screen === 'home') return null;
    const target = toTopics || screen === 'options' ? 'home' : 'options';
    if (GUARDED.includes(screen) && armedFor !== target) return { arm: target };
    return { go: target };
  }

  return { escapeAction };
});
