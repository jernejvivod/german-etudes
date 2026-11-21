// The Progress screen's checklist, where parts are marked learnt: every topic with the marks it offers (daily.js) and its
// parts, each ticked or not for Sentences and for Table. The parts are the choices of a topic's tick-box options that a
// kind of mark it offers can hold (scope.partGroups); its radios and switches are not parts. A topic without parts
// (Funktionsverbgefüge, or the table of Adjektivendungen) has a whole-topic switch instead. An old mark is read as its daily
// exercise used it (daily.partsOf) and written in the new shape on its first change.
// Also what the options screen's quick buttons tick for a round: the parts learnt, or those not learnt yet (practise).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./scope.js'), require('./daily.js'));
  } else {
    root.Etudes.progress = factory(root.Etudes.scope, root.Etudes.daily);
  }
})(globalThis, function (scope, daily) {
  'use strict';

  // The kinds a topic can be marked learnt for (t.sentences, t.table).
  const kindsOf = (t) => daily.KINDS.filter((kind) => t[kind]);

  // The tick-box options with parts for some kind the topic offers, in the options' order.
  const partOptions = (t) => t.options.filter((opt) => kindsOf(t).some((kind) => scope.partGroups(t, kind).includes(opt)));

  // topics: the registry; all: the stored marks (marks for unknown topics, or kinds a topic does not offer, are
  // ignored); savedOf(t): a topic's saved settings, for the single choices and switches its daily exercises use.
  // Returns { learnt, total, marked, topics: [{ id, title, open, marks, options }] }:
  //   learnt / total: the parts ticked for either kind / all parts; marked: the topics with a mark, partly ones too;
  //   open: the topic has a mark
  //   marks: { [kind]: { state, ticked, total, text, problem } } for each kind the topic offers — state, problem:
  //     daily.stateOf's; ticked / total: its parts ticked / all it can hold; text: the parts in words ('' without a mark)
  //   options: [{ key, label, parts: [{ value, label, sentences, table, learnt }] }] — sentences / table: whether that
  //     kind ticks the part, null where it cannot hold it; learnt: either does
  function tree(topics, all = daily.marks(), savedOf = daily.topicSettings) {
    const items = topics.map((t) => {
      const kinds = kindsOf(t);
      const saved = savedOf(t);
      const states = Object.fromEntries(kinds.map((kind) => [kind, daily.stateOf(t, kind, all[t.id]?.[kind], saved)]));
      const options = partOptions(t).map((opt) => {
        const reach = Object.fromEntries(kinds.map((kind) => [kind, scope.partGroups(t, kind).includes(opt) ? scope.scopeChoices(opt, kind) : []]));
        const parts = opt.choices.filter((c) => kinds.some((kind) => reach[kind].includes(c.value))).map((c) => {
          const state = (kind) => (reach[kind]?.includes(c.value) ? !!states[kind].parts?.[opt.key].includes(c.value) : null);
          const [sentences, table] = [state('sentences'), state('table')];
          return { value: c.value, label: c.label, sentences, table, learnt: !!(sentences || table) };
        });
        return { key: opt.key, label: opt.label, parts };
      });
      const every = options.flatMap((opt) => opt.parts);
      const marks = Object.fromEntries(kinds.map((kind) => {
        const { state, parts, problem } = states[kind];
        return [kind, {
          state,
          ticked: every.filter((p) => p[kind]).length,
          total: every.filter((p) => p[kind] !== null).length,
          text: state === 'none' ? '' : scope.partsText(t, parts, kind),
          problem,
        }];
      }));
      const open = Object.values(marks).some((m) => m.state !== 'none');
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

  // Keeps only the options with a part ticked: null when none is.
  function kept(parts) {
    const own = Object.fromEntries(Object.entries(parts).filter(([, values]) => values.length));
    return Object.keys(own).length ? own : null;
  }

  // A mark's parts with one part ticked (on) or not, for daily.setMark: null once nothing is ticked. An old mark is
  // read as its parts first.
  function withPart(t, kind, mark, key, value, on) {
    const parts = daily.partsOf(t, kind, mark) ?? {};
    const opt = scope.partGroups(t, kind).find((o) => o.key === key);
    parts[key] = scope.scopeChoices(opt, kind).filter((v) => (v === value ? on : parts[key]?.includes(v)));
    return kept(parts);
  }

  // Every part of a kind ticked (on; {} for a topic without parts) or none (null), for daily.setMark.
  function withAll(t, kind, on) {
    if (!on) return null;
    return Object.fromEntries(scope.partGroups(t, kind).map((opt) => [opt.key, scope.scopeChoices(opt, kind)]));
  }

  // What the options screen ticks for a round, { [key]: values } over the topic's tick-box options with parts, or null
  // when there is nothing to tick. Learnt: ticked for either kind. which 'learnt': each option its learnt parts, one
  // without any left as it is; null when nothing is learnt. which 'new': each option the choices not learnt yet, one
  // with all of them learnt every choice; null when everything is learnt.
  function practise(t, which, all = daily.marks()) {
    const ticked = kindsOf(t).map((kind) => daily.partsOf(t, kind, all[t.id]?.[kind]) ?? {});
    const options = partOptions(t);
    const learnt = Object.fromEntries(options.map((opt) => [opt.key, scope.choiceValues(opt).filter((v) => ticked.some((parts) => parts[opt.key]?.includes(v)))]));
    if (which === 'learnt') return kept(learnt);
    const fresh = Object.fromEntries(options.map((opt) => [opt.key, scope.choiceValues(opt).filter((v) => !learnt[opt.key].includes(v))]));
    if (!kept(fresh)) return null;
    return Object.fromEntries(options.map((opt) => [opt.key, fresh[opt.key].length ? fresh[opt.key] : scope.choiceValues(opt)]));
  }

  return { tree, withPart, withAll, practise };
});
