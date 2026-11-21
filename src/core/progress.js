// The Progress screen's checklist: every topic with the marks it offers (daily.js) and its parts, each ✓ where a learnt
// scope holds it. The parts are the choices of a topic's checkboxes options that a kind of mark it offers can hold
// (scope.js); its radios and switches are not parts. Each mark is read as its daily exercise uses it: fitted to the
// options offered now (missing keys: the defaults; new choices: not learnt; removed ones dropped).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./scope.js'), require('./daily.js'));
  } else {
    root.Etudes.progress = factory(root.Etudes.scope, root.Etudes.daily);
  }
})(globalThis, function (scope, daily) {
  'use strict';

  // topics: the registry; all: the stored marks (marks for unknown topics, or kinds a topic does not offer, are ignored).
  // Returns { learnt, total, marked, topics: [{ id, title, open, marks, options }] }:
  //   learnt / total: the parts ✓ / all parts; marked: the topics with any mark; open: the topic has a mark
  //   marks: { [kind]: { text, whole, fits } | null } for each kind the topic offers (t.sentences, t.table) — text: the
  //     scope in words; whole: it holds every part the kind can reach; fits: its settings pass settingsProblem
  //   options: [{ key, label, parts: [{ value, label, sentences, table, learnt, only }] }] — sentences / table: whether
  //     that mark holds the part, null where the kind cannot reach it; learnt: either does; only: the kind that holds it
  //     when both marks exist and disagree, else null
  function tree(topics, all = daily.marks()) {
    const items = topics.map((t) => {
      const kinds = daily.KINDS.filter((kind) => t[kind]);
      const marks = {};
      const held = {}; // the learnt scope of each kind marked
      for (const kind of kinds) {
        const mark = all[t.id]?.[kind];
        marks[kind] = null;
        if (!mark) continue;
        const { settings, fits } = daily.fitMark(t, mark);
        held[kind] = scope.scopeOf(t, settings, kind);
        marks[kind] = { text: scope.scopeText(t, settings, kind), whole: true, fits }; // whole: once the parts are known
      }
      const both = kinds.length === 2 && kinds.every((kind) => held[kind]);
      const options = t.options.filter((opt) => opt.type === 'checkboxes').map((opt) => {
        const reach = Object.fromEntries(kinds.map((kind) => [kind, scope.inScope(opt, kind) ? scope.scopeChoices(opt, kind) : []]));
        const parts = opt.choices.filter((c) => kinds.some((kind) => reach[kind].includes(c.value))).map((c) => {
          const state = (kind) => (reach[kind]?.includes(c.value) ? !!held[kind]?.[opt.key]?.includes(c.value) : null);
          const [sentences, table] = [state('sentences'), state('table')];
          const only = both && sentences !== null && table !== null && sentences !== table ? (sentences ? 'sentences' : 'table') : null;
          return { value: c.value, label: c.label, sentences, table, learnt: !!(sentences || table), only };
        });
        return { key: opt.key, label: opt.label, parts };
      }).filter((opt) => opt.parts.length);
      for (const kind of kinds) if (marks[kind]) marks[kind].whole = options.every((opt) => opt.parts.every((p) => p[kind] !== false));
      const open = Object.values(marks).some(Boolean);
      return { id: t.id, title: t.title, open, marks, options };
    });
    const parts = items.flatMap((item) => item.options.flatMap((opt) => opt.parts));
    return {
      learnt: parts.filter((p) => p.learnt).length,
      total: parts.length,
      marked: items.filter((item) => item.open).length,
      topics: items,
    };
  }

  return { tree };
});
