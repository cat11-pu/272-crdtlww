import assert from "node:assert";
import { currentOf, topOf } from "../registers.js";
import { step, close } from "../syncrun.js";
import { render } from "../app.js";

const base = {
  budget: 1, reps: ["r1", "r2"],
  state: { values: { r1: [0, 0], r2: [0, 0] }, ledger: [], applied: [] },
  events: [],
  ts_error_code: "E_STALE_TS", rep_error_code: "E_NO_REP",
  event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("currentOf returns a pair", () => {
  assert.ok(Array.isArray(currentOf(base.state.values, "r1")));
});

check("topOf returns a pair", () => {
  assert.ok(Array.isArray(topOf(base.state.values, base.reps)));
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
