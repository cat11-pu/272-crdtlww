// syncrun.js：按合并预算合并，用尽的合并请求压在账上，收尾时不限预算补齐
import { currentOf, topOf } from "./registers.js";

function fail(code, message) {
  const error = new Error(message || code);
  error.code = code;
  throw error;
}

function cloneState(spec) {
  const source = spec.state || {};
  const values = {};
  (spec.reps || []).forEach(function (rep) {
    values[rep] = currentOf(source.values || {}, rep).slice();
  });
  return {
    values: values,
    ledger: Array.isArray(source.ledger) ? source.ledger.slice() : [],
    applied: Array.isArray(source.applied) ? source.applied.slice() : []
  };
}

function isWrite(event) {
  return event
    && typeof event.rep === "string"
    && typeof event.ts === "number" && isFinite(event.ts)
    && Object.prototype.hasOwnProperty.call(event, "value");
}

function mergeAll(values, reps) {
  const top = topOf(values, reps);
  reps.forEach(function (rep) {
    values[rep] = [top[0], top[1]];
  });
}

export function step(spec) {
  spec = spec || {};
  const reps = Array.isArray(spec.reps) ? spec.reps : [];
  const state = cloneState(spec);
  const events = Array.isArray(spec.events) ? spec.events : fail(spec.event_error_code || "E_BAD_EVENT", "events must be a list");
  let budget = typeof spec.budget === "number" && isFinite(spec.budget) ? Math.max(0, Math.floor(spec.budget)) : 0;
  const staleCode = spec.ts_error_code || "E_STALE_TS";
  const noRepCode = spec.rep_error_code || "E_NO_REP";
  const badEventCode = spec.event_error_code || "E_BAD_EVENT";

  let merged = 0;
  let judged = 0;

  // 上一轮压在账上的合并请求优先占用本轮整批共用的合并预算
  while (state.ledger.length > 0 && budget > 0) {
    state.ledger.shift();
    mergeAll(state.values, reps);
    merged += 1;
    budget -= 1;
  }

  events.forEach(function (event, index) {
    if (!event || typeof event !== "object" || typeof event.kind !== "string") {
      fail(badEventCode, "illegal event at " + index);
    }
    const id = Object.prototype.hasOwnProperty.call(event, "id") ? event.id : index;

    if (event.kind === "write") {
      if (!isWrite(event)) fail(badEventCode, "illegal write event at " + index);
      if (reps.indexOf(event.rep) === -1) fail(noRepCode, "unknown replica " + event.rep);
      if (state.applied.indexOf(id) !== -1) return;
      if (!(event.ts > currentOf(state.values, event.rep)[1])) {
        fail(staleCode, "timestamp " + event.ts + " is not newer than current");
      }
      state.applied.push(id);
      state.values[event.rep] = [event.value, event.ts];
      judged += 1;
      return;
    }

    if (event.kind === "gossip") {
      if (state.applied.indexOf(id) !== -1) return;
      state.applied.push(id);
      judged += 1;
      if (budget > 0) {
        mergeAll(state.values, reps);
        merged += 1;
        budget -= 1;
      } else {
        state.ledger.push(id);
      }
      return;
    }

    fail(badEventCode, "unknown event kind " + event.kind);
  });

  return {
    state: state,
    merged: merged,
    ledger_before: state.ledger.length,
    ledger: state.ledger.slice(),
    judged: judged,
    judged_bound: events.length
  };
}

export function close(spec) {
  spec = spec || {};
  const reps = Array.isArray(spec.reps) ? spec.reps : [];
  const state = cloneState(spec);
  let catchup = 0;
  while (state.ledger.length > 0) {
    state.ledger.shift();
    mergeAll(state.values, reps);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
