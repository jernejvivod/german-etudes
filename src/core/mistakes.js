// A drill's mistakes review: after its last item, the items answered wrong come back, one after the other, until each
// has been answered right. Answered right, an item is done; answered wrong, it goes to the end of the queue.
// A review is { queue: [item …], total, tries, last }: queue[0] is the item on screen; total: how many were missed;
// tries: the checks so far; last: null before the item on screen is checked, then whether it was right. All immutable.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Etudes ||= { topics: [] }).mistakes = api;
})(globalThis, function () {
  'use strict';

  // A drill's result ({ item, grades }) with a gap answered wrong.
  function wrong(result) {
    return result.grades.some((g) => !g.ok);
  }

  // The items of the results answered wrong, in the round's order.
  function missed(results) {
    return results.filter(wrong).map((r) => r.item);
  }

  // The review of the missed items, or null when there are none.
  function start(items) {
    return items.length ? { queue: [...items], total: items.length, tries: 0, last: null } : null;
  }

  // The item on screen checked: ok, it was right.
  function check(review, ok) {
    return { ...review, tries: review.tries + 1, last: ok };
  }

  // On to the next item: a right one is done, a wrong one goes to the end. null once none is left.
  function next(review) {
    const [head, ...rest] = review.queue;
    const queue = review.last ? rest : [...rest, head];
    return queue.length ? { ...review, queue, last: null } : null;
  }

  // The items still to answer right, the one on screen included until it is.
  function left(review) {
    return review.queue.length - (review.last === true ? 1 : 0);
  }

  // The note at the review's start, the progress counter, and the line on the summary.
  const note = (review) => `Now the ones you missed (${review.total})`;
  const counter = (review) => `Mistakes · ${review.queue.length} left`;
  const outcome = (review) => `${review.total} missed, answered right in ${review.tries} ${review.tries === 1 ? 'try' : 'tries'}`;

  return { wrong, missed, start, check, next, left, note, counter, outcome };
});
