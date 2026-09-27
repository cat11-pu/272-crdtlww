// app.js：渲染结果
import { currentOf, topOf } from "./registers.js";
import { step, close } from "./syncrun.js";

export function render(spec) {
  const events = spec.events || [];
  const half = Math.ceil(events.length / 2);
  const first = step(spec);
  const closed = close(Object.assign({}, spec, { state: first.state }));
  const r1 = step(Object.assign({}, spec, { events: events.slice(0, half) }));
  const r2 = step(Object.assign({}, spec, { state: r1.state, events: events.slice(half) }));
  const closedTwo = close(Object.assign({}, spec, { state: r2.state }));
  const replay = step(Object.assign({}, spec, { state: closed.state }));
  const wide = step(Object.assign({}, spec, { budget: spec.budget + 2 }));
  const full = step(Object.assign({}, spec, { events: events, budget: events.length + 2 }));
  const fullClosed = close(Object.assign({}, spec, { state: full.state }));
  const fingerprint = function (state) {
    return JSON.stringify({
      values: state.values, ledger: state.ledger, applied: state.applied.length
    });
  };
  const reps = spec.reps.slice().sort();
  const rows = reps.map(function (rep) {
    const record = closed.state.values[rep] || [0, 0];
    return [rep, record[0], record[1]];
  });
  const topTs = rows.reduce(function (max, row) { return row[2] > max ? row[2] : max; }, 0);
  return { reps_state: rows, top_ts: topTs,
           converged: rows.every(function (row) { return row[0] === rows[0][0] ? row[1] === rows[0][1] && row[2] === rows[0][2] : row[1] === rows[0][1] && row[2] === rows[0][2]; }),
           merged_first: first.merged, merged_wide: wide.merged,
           pair_differs: first.merged !== wide.merged,
           ledger_before: first.ledger_before, ledger: first.ledger,
           catchup: closed.catchup, ledger_after: closed.state.ledger.length,
           mid_differs: fingerprint(r2.state) !== fingerprint(first.state),
           closed_equal: fingerprint(closedTwo.state) === fingerprint(closed.state),
           replay_new: replay.merged, judged: first.judged, judged_bound: first.judged_bound,
           full_diff: fingerprint(closed.state) === fingerprint(fullClosed.state) ? 0 : 1,
           count: events.length, tail: currentOf({}, "r1")[1] + topOf({}, [])[1] };
}
