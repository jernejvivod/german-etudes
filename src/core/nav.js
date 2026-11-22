// The ways out of a screen and when they ask first. Esc goes up one level (round → options → topic list; Progress →
// topic list), Shift+Esc and ← Topics straight to the topic list, ✕ to the options. Leaving a drill or table throws the
// round away, so there a key arms first and leaves on a second press of the same key (the other key re-arms for its own
// target), and a click asks in a bar once something in the round would be lost (dirty), leaving on Leave or a second
// click of the same button.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Etudes ||= { topics: [] }).nav = api;
})(globalThis, function () {
  'use strict';

  const GUARDED = ['drill', 'table'];
  const TOP = ['options', 'progress']; // one level below the topic list
  const KEYS = ['esc', 'shift-esc'];

  // screen: the screen shown; via: 'esc' | 'shift-esc' | 'quit' (✕) | 'topics' (← Topics); armed: what a first press or
  // click armed, { target: 'options' | 'home', by: 'key' | 'click' } (the toast or the bar), or null; dirty: leaving
  // would lose something in the round.
  // Returns { go: 'home' | 'options' }, { arm: 'home' | 'options', by: 'key' | 'click' }, { stay: true } (close the bar)
  // or null (nothing to do).
  function leaveAction({ screen, via, armed = null, dirty = false }) {
    if (screen === 'home') return null;
    const key = KEYS.includes(via);
    const target = via === 'topics' || via === 'shift-esc' || (key && TOP.includes(screen)) ? 'home' : 'options';
    if (!GUARDED.includes(screen)) return { go: target };
    if (key) {
      // The bar is up: Esc means Stay, Shift+Esc confirms the topic list or asks for it instead.
      if (armed?.by === 'click') {
        if (via === 'esc') return { stay: true };
        return armed.target === 'home' ? { go: 'home' } : { arm: 'home', by: 'click' };
      }
      return armed?.target === target ? { go: target } : { arm: target, by: 'key' };
    }
    if (!dirty || (armed?.by === 'click' && armed.target === target)) return { go: target };
    return { arm: target, by: 'click' };
  }

  return { leaveAction };
});
