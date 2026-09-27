// syncrun.js：按合并预算合并并留账，收尾不限预算补齐
import { currentOf, topOf } from "./registers.js";

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function codeOf(spec, key, fallback) {
  return spec && Object.prototype.hasOwnProperty.call(spec, key) && spec[key]
    ? String(spec[key]) : fallback;
}

function cloneState(state) {
  const source = state || {};
  const values = {};
  const sourceValues = source.values || {};
  Object.keys(sourceValues).forEach(function (rep) {
    const record = sourceValues[rep];
    values[rep] = Array.isArray(record) ? [record[0], record[1]] : [0, 0];
  });
  return {
    values: values,
    ledger: Array.isArray(source.ledger) ? source.ledger.slice() : [],
    applied: Array.isArray(source.applied) ? source.applied.slice() : []
  };
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function mergeAll(state, reps) {
  const top = topOf(state.values, reps);
  reps.forEach(function (rep) {
    state.values[rep] = [top[0], top[1]];
  });
}

export function step(spec) {
  spec = spec || {};
  const reps = Array.isArray(spec.reps) ? spec.reps : [];
  const events = Array.isArray(spec.events) ? spec.events : [];
  let budget = isNumber(spec.budget) ? Math.max(0, Math.floor(spec.budget)) : 0;
  const state = cloneState(spec.state);
  const staleCode = codeOf(spec, "ts_error_code", "E_STALE_TS");
  const noRepCode = codeOf(spec, "rep_error_code", "E_NO_REP");
  const badEventCode = codeOf(spec, "event_error_code", "E_BAD_EVENT");
  let merged = 0;
  let judged = 0;

  // 上一轮压在账上的合并请求优先占用本轮预算。
  while (state.ledger.length > 0 && budget > 0) {
    const pendingId = state.ledger.shift();
    mergeAll(state, reps);
    merged += 1;
    budget -= 1;
    if (state.applied.indexOf(pendingId) === -1) state.applied.push(pendingId);
  }

  events.forEach(function (event) {
    if (!event || typeof event !== "object") fail(badEventCode, "事件必须是对象");
    if (state.applied.indexOf(event.id) !== -1) return;

    if (event.kind === "write") {
      if (typeof event.rep !== "string" || !isNumber(event.ts)
          || !Object.prototype.hasOwnProperty.call(event, "value")) {
        fail(badEventCode, "write 事件缺少 rep/value/ts");
      }
      if (reps.indexOf(event.rep) === -1) fail(noRepCode, "未知副本 " + event.rep);
      const current = currentOf(state.values, event.rep);
      if (!(event.ts > current[1])) fail(staleCode, "时间戳 " + event.ts + " 不大于当前 " + current[1]);
      state.values[event.rep] = [event.value, event.ts];
      state.applied.push(event.id);
      judged += 1;
    } else if (event.kind === "gossip") {
      if (budget > 0) {
        mergeAll(state, reps);
        merged += 1;
        budget -= 1;
      } else {
        state.ledger.push(event.id);
      }
      state.applied.push(event.id);
      judged += 1;
    } else {
      fail(badEventCode, "未知事件类型 " + String(event.kind));
    }
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
  const state = cloneState(spec.state);
  let catchup = 0;

  while (state.ledger.length > 0) {
    const pendingId = state.ledger.shift();
    mergeAll(state, reps);
    catchup += 1;
    if (state.applied.indexOf(pendingId) === -1) state.applied.push(pendingId);
  }

  return { state: state, catchup: catchup };
}
