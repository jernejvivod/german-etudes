// The daily exercises: which topics are marked learnt, when each came up, and two pseudo-topics: the Daily review, which
// mixes sentences from every topic marked Sentences learnt, and Daily tables, which goes through every table marked
// Table learnt — each in the scope saved with the mark (scope.js).
//
// Kept between sessions (store.js):
//   etudes-learnt: { [topicId]: { sentences?: { settings, since }, table?: { settings, since } } } — settings: the scope
//   etudes-daily:  { sentences: { done: day, seen: { [topicId]: ms }, extra: { [topicId]: ms } }, table: { … } }
//     — the same kinds (KINDS) in both
//     done: the day the exercise was last finished; seen: when the Daily review last asked a topic's sentence, or Daily
//     tables last checked its table; extra: when a topic last got one sentence more than its share (so the remainder
//     rotates)
// A day starts at 4:00, so a late evening still counts as the day before. Unreadable data counts as none.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./store.js'), require('./scope.js'));
  } else {
    root.Etudes.daily = factory(root.Etudes.store, root.Etudes.scope);
  }
})(globalThis, function (store, scope) {
  'use strict';

  const ROLLOVER_HOURS = 4;
  const LEARNT_KEY = 'etudes-learnt';
  const DAILY_KEY = 'etudes-daily';
  const KINDS = ['sentences', 'table'];
  const LENGTHS = [{ value: 10, label: 'Short' }, { value: 20, label: 'Normal' }, { value: 30, label: 'Long' }];

  const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const pad = (n) => String(n).padStart(2, '0');

  // The local day (YYYY-MM-DD) a moment belongs to.
  function dayOf(now = Date.now()) {
    const d = new Date(now);
    d.setHours(d.getHours() - ROLLOVER_HOURS); // wall-clock hours, so a DST change does not move the rollover
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // ---------- Marks ----------

  function marks() {
    const saved = store.read(LEARNT_KEY, null);
    if (!isObject(saved)) return {};
    const result = {};
    for (const [id, own] of Object.entries(saved)) {
      if (!isObject(own)) continue;
      const valid = KINDS.filter((kind) => isObject(own[kind]?.settings) && Number.isFinite(own[kind].since));
      if (valid.length) result[id] = Object.fromEntries(valid.map((kind) => [kind, own[kind]]));
    }
    return result;
  }

  function markOf(id, kind) {
    return marks()[id]?.[kind] ?? null;
  }

  // Marks a topic's sentences or table learnt with a scope, or (settings null) not learnt. A new scope keeps the day
  // it was first marked.
  function setMark(id, kind, settings, now = Date.now()) {
    const all = marks();
    const own = { ...all[id] };
    if (settings) own[kind] = { settings, since: own[kind]?.since ?? now };
    else delete own[kind];
    if (Object.keys(own).length) all[id] = own;
    else delete all[id];
    store.write(LEARNT_KEY, all);
  }

  // ---------- Log ----------

  const times = (v) => (isObject(v) ? Object.fromEntries(Object.entries(v).filter(([, at]) => Number.isFinite(at))) : {});

  function entryOf(all, kind) {
    const entry = isObject(all) ? all[kind] : null;
    return { done: typeof entry?.done === 'string' ? entry.done : null, seen: times(entry?.seen), extra: times(entry?.extra) };
  }

  function log(kind) {
    return entryOf(store.read(DAILY_KEY, null), kind);
  }

  // Changes one kind's log, keeping the others.
  function updateLog(kind, change) {
    const all = store.read(DAILY_KEY, null);
    const entry = entryOf(all, kind);
    change(entry);
    store.write(DAILY_KEY, { ...(isObject(all) ? all : {}), [kind]: entry });
  }

  function noteSeen(kind, id, now = Date.now()) {
    updateLog(kind, (entry) => {
      entry.seen[id] = now;
    });
  }

  // The exercise reached its summary; extraIds got one more than their share.
  function noteDone(kind, extraIds, now = Date.now()) {
    updateLog(kind, (entry) => {
      entry.done = dayOf(now);
      for (const id of extraIds) entry.extra[id] = now;
    });
  }

  function doneToday(kind, now = Date.now()) {
    return log(kind).done === dayOf(now);
  }

  // ---------- Sharing out a review ----------

  // Topics seen on the earliest day first (never seen: first of all); then the one longest without an extra sentence;
  // then in the registry's order.
  function byLeastRecent(kind, topics) {
    const { seen, extra } = log(kind);
    const day = (t) => (seen[t.id] === undefined ? '' : dayOf(seen[t.id]));
    return [...topics].sort((a, b) => day(a).localeCompare(day(b)) || (extra[a.id] ?? 0) - (extra[b.id] ?? 0));
  }

  // How many sentences each of the ordered topics gets: an equal share, and one more for the first n mod k.
  function shares(orderedIds, n) {
    const k = orderedIds.length;
    return orderedIds.map((id, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));
  }

  // A note when n sentences give one of k topics fewer than 2, naming the shortest length that gives each 2.
  function shortWarning(k, n) {
    if (!k || Math.floor(n / k) >= 2) return null;
    const label = (value) => LENGTHS.find((l) => l.value === value)?.label ?? `${value} sentences`;
    const least = n < k ? 'no sentence' : 'only 1 sentence';
    const longer = LENGTHS.find((l) => Math.floor(l.value / k) >= 2);
    return `${label(n)} gives some topics ${least} — ${longer ? `${longer.label} gives each at least 2` : 'mark fewer topics learnt for at least 2 each'}.`;
  }

  // The groups' items mixed: each time from the group with most left that was not taken last (ties by chance), so no
  // two neighbours share a group while that is possible.
  function interleave(groups, rnd = Math.random) {
    const left = groups.map((g) => [...g]);
    const out = [];
    let last = -1;
    for (;;) {
      let best = [];
      left.forEach((g, i) => {
        if (i === last || !g.length) return;
        if (!best.length || g.length > left[best[0]].length) best = [i];
        else if (g.length === left[best[0]].length) best.push(i);
      });
      if (!best.length && left[last]?.length) best = [last];
      if (!best.length) return out;
      last = best.length > 1 ? best[Math.floor(rnd() * best.length)] : best[0];
      out.push(left[last].shift());
    }
  }

  // ---------- The daily exercises ----------

  const dateText = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  // The topics marked learnt for a kind that still offer it (t.sentences, t.table), in the registry's order.
  const learntOf = (kind, topics, all = marks()) => topics.filter((t) => t[kind] && all[t.id]?.[kind]);

  // The learnt topics' marks of a kind, fitted to the options offered now: ready, [{ topic, settings, since }], and a
  // note on each whose settings no longer fit (leftOut).
  function fitLearnt(kind, learnt, all) {
    const ready = [];
    const leftOut = [];
    for (const t of learnt) {
      const settings = scope.fitSettings(t, all[t.id][kind].settings);
      if (scope.settingsProblem(t, settings)) leftOut.push(`${t.title}: its learnt settings no longer fit — open it and save them again.`);
      else ready.push({ topic: t, settings, since: all[t.id][kind].since });
    }
    return { ready, leftOut };
  }

  // ---------- The Daily review ----------

  const NONE_LEARNT = 'No topic is marked learnt yet. Open a topic, choose the parts you know and turn on Sentences learnt.';

  // The Daily review as a topic the shell opens like any other. topics: the registry; clock: now in ms.
  function reviewTopic(topics, clock = Date.now) {
    let ready = []; // [{ topic, settings, since }]: the learnt topics this review uses, their scope fitted
    let leftOut = []; // a note on each learnt topic it cannot use

    const learnt = (all = marks()) => learntOf('sentences', topics, all);

    // Loads the learnt topics' data (each loader once: most topics share vocab.prepare) and checks their scopes.
    async function prepare() {
      const all = marks();
      const topicsLearnt = learnt(all);
      const errors = new Map();
      for (const load of new Set(topicsLearnt.map((t) => t.prepare).filter(Boolean))) {
        let error;
        try {
          error = await load();
        } catch (err) {
          error = String(err.message || err);
        }
        errors.set(load, error || null);
      }
      const failed = topicsLearnt.filter((t) => errors.get(t.prepare));
      ({ ready, leftOut } = fitLearnt('sentences', topicsLearnt.filter((t) => !failed.includes(t)), all));
      leftOut.unshift(...failed.map((t) => `${t.title}: ${errors.get(t.prepare)}`));
      return null;
    }

    function build(settings, rnd = Math.random) {
      const byId = new Map(ready.map((r) => [r.topic.id, r]));
      const order = byLeastRecent('sentences', ready.map((r) => r.topic));
      const counts = shares(order.map((t) => t.id), settings.length);
      const extraIds = order.filter((t, i) => counts[i] > counts[counts.length - 1]).map((t) => t.id);
      const groups = order.map((t, i) => {
        if (!counts[i]) return [];
        const own = { ...byId.get(t.id).settings, length: counts[i] };
        for (const opt of t.options) if ('daily' in opt) own[opt.key] = opt.daily; // My Anki words, whatever was saved
        const step = t.sentences(own, counts[i], rnd);
        return step.items.map((item) => ({ ...item, topic: t.id, topicTitle: t.title, hint: step.hint ?? '', hideTags: !!step.hideTags }));
      });
      return [{
        type: 'drill',
        label: 'Daily review',
        items: interleave(groups, rnd),
        onChecked: (item) => noteSeen('sentences', item.topic, clock()),
        onDone: () => noteDone('sentences', extraIds, clock()),
      }];
    }

    return {
      id: 'daily',
      kind: 'sentences',
      unit: 'topic',
      title: 'Daily review',
      intro: (settings) => ['Every learnt topic comes up today, in equal shares, mixed.', shortWarning(ready.length, settings.length), ...leftOut]
        .filter(Boolean).join(' '),
      defaults: { length: 20 },
      options: [{
        key: 'length', label: 'Length', type: 'radio', inline: true,
        choices: LENGTHS.map(({ value, label }) => ({ value, label, detail: `about ${value} sentences` })),
      }],
      prepare,
      listing: () => ready.map(({ topic, settings, since }) => ({ title: topic.title, text: `${scope.scopeText(topic, settings)} · learnt ${dateText(since)}` })),
      validate: () => (ready.length ? null : leftOut.length ? 'None of the learnt topics can be used — see above.' : NONE_LEARNT),
      sessions: [{ label: 'Start', build }],
      learnt,
    };
  }

  // ---------- Daily tables ----------

  // Every learnt table as a topic the shell opens like any other, one table step each. topics: the registry; clock: now
  // in ms. Done for the day once each table has been checked (not necessarily without mistakes).
  function tablesTopic(topics, clock = Date.now) {
    const learnt = (all = marks()) => learntOf('table', topics, all);
    const titles = topics.filter((t) => t.table).map((t) => t.title);
    const noneLearnt = `No table is marked learnt yet. Open ${titles.slice(0, -1).join(', ')} or ${titles.at(-1)} and turn on Table learnt on its options screen.`;

    // The learnt tables it can use, the least recently done first (never done: first of all; ties in the registry's
    // order), their scope fitted; and a note on each mark it cannot use: one whose topic is gone or no longer has a
    // table, or whose settings no longer fit.
    function usable() {
      const all = marks();
      const gone = Object.keys(all)
        .filter((id) => all[id].table && !topics.some((t) => t.id === id && t.table))
        .map((id) => `${topics.find((t) => t.id === id)?.title ?? id}: there is no such table any more.`);
      const { ready, leftOut } = fitLearnt('table', learnt(all), all);
      const order = byLeastRecent('table', ready.map((r) => r.topic));
      return { ready: order.map((t) => ready.find((r) => r.topic === t)), leftOut: [...gone, ...leftOut] };
    }

    function build(settings, rnd = Math.random) {
      const checked = new Set(); // the topics whose table was checked in this round
      const steps = usable().ready.map(({ topic: t, settings: own }) => {
        const step = t.table(own, rnd);
        return {
          ...step,
          label: `${t.title} — ${step.label}`,
          topicTitle: t.title,
          onChecked: () => {
            if (checked.has(t.id)) return; // a retry
            checked.add(t.id);
            noteSeen('table', t.id, clock());
            if (checked.size === steps.length) noteDone('table', [], clock());
          },
        };
      });
      return steps;
    }

    return {
      id: 'daily-tables',
      kind: 'table',
      unit: 'table',
      title: 'Daily tables',
      intro: () => ['Write out every table you have marked learnt from memory, the least recently done first.', ...usable().leftOut].join(' '),
      defaults: {},
      options: [],
      listing: () => usable().ready.map(({ topic, settings, since }) => ({
        title: `${topic.title} — ${topic.table(settings).label}`,
        text: `${scope.scopeText(topic, settings, 'table')} · learnt ${dateText(since)}`,
      })),
      validate: () => {
        const { ready, leftOut } = usable();
        return ready.length ? null : leftOut.length ? 'None of the learnt tables can be used — see above.' : noneLearnt;
      },
      sessions: [{ label: 'Start', build }],
      learnt,
    };
  }

  return {
    ROLLOVER_HOURS, LENGTHS, KINDS, dayOf,
    marks, markOf, setMark,
    log, noteSeen, noteDone, doneToday,
    byLeastRecent, shares, shortWarning, interleave, reviewTopic, tablesTopic,
  };
});
