// Shared cloze model used by every topic.
//
// A cloze item is { tokens, tags, explain, prompt? }:
//   tokens  — strings and gaps { slot, prefix, answer, alts?, label?, placeholder?, keepCase?, exact? }; a whole-word gap has prefix '';
//             keepCase: the placeholder stays as written at the start of a sentence (an infinitive as a hint: "fahren");
//             exact: upper / lower case counts (Ihr, the polite possessive, is not ihr);
//             alts are further accepted answers, label is for screen readers; a whole-word gap with answer '' must stay
//             empty (Satzstellung: the verb's wrong place) and drops out of the solved sentence with its space
//   tags    — [{ text, cls }] shown above the sentence
//   explain — one-line rule shown after checking
//   prompt  — optional { label, text } line above the sentence (e.g. the active sentence to transform)
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Etudes ||= { topics: [] }).cloze = api;
})(globalThis, function () {
  'use strict';

  // Lower-cases, collapses spaces (none around "/") and strips a leading dash, so "-er" (as the app shows endings) counts as "er";
  // "-", "0", "∅" and "/" mean "no ending".
  function normalize(s) {
    const v = String(s || '').trim().replace(/\s+/g, ' ').replace(/ ?\/ ?/g, '/').toLowerCase().replace(/^[-–—]\s*/, '');
    return /^[0∅/]?$/.test(v) ? '' : v;
  }

  // Accepts the bare answer ("er") or prefix + answer ("der"), for the answer and each alternative.
  function isCorrectGap(gap, input) {
    if (gap.exact) return [gap.answer, ...(gap.alts || [])].includes(String(input || '').trim().replace(/\s+/g, ' '));
    const v = normalize(input);
    return [gap.answer, ...(gap.alts || [])].some((a) => {
      const answer = a.toLowerCase();
      return v === answer || (v !== '' && v === (gap.prefix + a).toLowerCase());
    });
  }

  // A gap: the learner types `answer` after the visible `prefix`; extra may add alts / placeholder.
  function gap(slot, label, prefix, answer, extra) {
    return { slot, label, prefix, answer, ...extra };
  }

  function wordGap(slot, answer, label) {
    return gap(slot, label, '', answer);
  }

  function gaps(item) {
    return item.tokens.filter((t) => typeof t === 'object');
  }

  // Grades the values typed into an item's gaps, in token order.
  function grade(item, values) {
    return gaps(item).map((gap, i) => ({ gap, value: values[i], ok: isCorrectGap(gap, values[i]) }));
  }

  // An ending as shown to the learner: "-er", or "-∅" for no ending.
  function display(ending) {
    return '-' + (ending || '∅');
  }

  // The correct answer as shown next to a wrong gap: "-er" for an ending, the word itself for a whole word, ∅ for nothing.
  function correction(gap) {
    return gap.prefix ? display(gap.answer) : gap.answer || '∅';
  }

  // The solved sentence as tokens: strings and the filled gaps. A gap that stays empty (Satzstellung) is dropped with
  // its space, so no double space or " ." is left behind.
  function solved(item) {
    const out = [];
    for (const t of item.tokens) {
      if (typeof t === 'object' && !t.prefix && !t.answer) {
        if (typeof out[out.length - 1] === 'string') out[out.length - 1] = out[out.length - 1].replace(/ $/, '');
        continue;
      }
      if (typeof t === 'string' && typeof out[out.length - 1] === 'string') out[out.length - 1] += t;
      else out.push(t);
    }
    return out;
  }

  // The solved sentence as plain text.
  function text(item) {
    return solved(item).map((t) => (typeof t === 'string' ? t : t.prefix + t.answer)).join('');
  }

  // What the learner typed, for the mistakes list: the whole word as typed, or prefix-ending.
  function typed(gap, value) {
    if (gap.exact) return String(value || '').trim() || '∅'; // as typed: the case is what was wrong (ihren / Ihren)
    const v = normalize(value);
    if (!gap.prefix) return v || '∅';
    const prefix = gap.prefix.toLowerCase();
    return v.length >= prefix.length && v.startsWith(prefix) ? v : prefix + display(v);
  }

  // A sentence split into words and the text between them: parts[odd] are the words (Café, E-Mail count as one);
  // words lists them as { i: index in parts, text, w: lower-cased }.
  const WORD = /([A-Za-zÄÖÜäöüßéèàç]+(?:-[A-Za-zÄÖÜäöüß]+)*)/;
  function splitWords(sentence) {
    const parts = sentence.split(WORD);
    const words = parts.map((p, i) => (i % 2 ? { i, text: p, w: p.toLowerCase() } : null)).filter(Boolean);
    return { parts, words };
  }

  // Punctuation that ends a clause.
  const CLAUSE_END = /[,.;:!?–]/;

  const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

  // Plain text from an Anki field: tags dropped, <br> as a space, entities decoded, whitespace collapsed.
  function clean(html) {
    return String(html || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
        if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
        return ENTITIES[e.toLowerCase()] ?? m;
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Picks by each element's weight.
  function pickWeighted(arr, rnd) {
    let r = rnd() * arr.reduce((sum, x) => sum + x.weight, 0);
    for (const x of arr) {
      r -= x.weight;
      if (r < 0) return x;
    }
    return arr[arr.length - 1];
  }

  // Capitalizes the sentence's first visible word: a string, a gap's prefix, or a whole-word gap's answer (and alts / placeholder).
  function capitalizeFirst(tokens) {
    const [first, ...rest] = tokens;
    if (typeof first === 'string') return [capitalize(first), ...rest];
    if (first.prefix) return [{ ...first, prefix: capitalize(first.prefix) }, ...rest];
    const head = { ...first, answer: capitalize(first.answer) };
    if (first.alts) head.alts = first.alts.map(capitalize);
    if (first.placeholder && !first.keepCase) head.placeholder = capitalize(first.placeholder);
    return [head, ...rest];
  }

  // Fills a sentence template: {0}, {1} … = the token lists in parts; {singular|plural} = the form chosen by `plural`.
  function fillTemplate(template, parts, plural) {
    const tokens = [];
    const re = /\{(\d)\}|\{([^|}]*)\|([^}]*)\}/g;
    let last = 0;
    let m;
    while ((m = re.exec(template))) {
      if (m.index > last) tokens.push(template.slice(last, m.index));
      if (m[1] != null) tokens.push(...parts[Number(m[1])]);
      else tokens.push(plural ? m[3] : m[2]);
      last = re.lastIndex;
    }
    if (last < template.length) tokens.push(template.slice(last));
    return capitalizeFirst(tokens);
  }

  // Fills a template with named slots: {A}, {S} … = slots[letter] (a token or a list of tokens), the first word capitalized.
  function fillSlots(template, slots) {
    return capitalizeFirst(template.split(/(\{[A-Z]\})/).filter(Boolean).flatMap((part) => {
      const slot = /^\{([A-Z])\}$/.exec(part);
      return slot ? slots[slot[1]] : [part];
    }));
  }

  function pick(arr, rnd) {
    return arr[Math.floor(rnd() * arr.length)];
  }

  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // The pool without the keys used recently; when that leaves nothing, `otherwise` (the whole pool, unless given).
  function freshOf(pool, recent, key, otherwise = pool) {
    const fresh = pool.filter((x) => !recent.includes(key(x)));
    return fresh.length ? fresh : otherwise;
  }

  // Picks from the pool, avoiding keys used recently (falls back to the whole pool).
  function pickFresh(pool, recent, key, rnd) {
    return pick(freshOf(pool, recent, key), rnd);
  }

  // Rolling window of recently used keys, so consecutive items don't repeat a word.
  function remember(recent, value, size = 4) {
    recent.push(value);
    if (recent.length > size) recent.shift();
  }

  return {
    normalize, isCorrectGap, gap, wordGap, clean, gaps, grade, display, correction, solved, text, typed,
    capitalize, capitalizeFirst, fillTemplate, fillSlots, pick, pickWeighted, freshOf, pickFresh, remember, shuffle, splitWords, CLAUSE_END,
  };
});
