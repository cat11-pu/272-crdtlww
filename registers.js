// registers.js：LWW 取值与合并规则
export function currentOf(registers, rep) {
  const record = registers && Object.prototype.hasOwnProperty.call(registers, rep)
    ? registers[rep]
    : null;
  if (!Array.isArray(record)) return [0, 0];
  const value = record[0];
  const ts = typeof record[1] === "number" && isFinite(record[1]) ? record[1] : 0;
  return [value, ts];
}

export function topOf(registers, reps) {
  let topValue = 0;
  let topTs = 0;
  let found = false;
  (reps || []).forEach(function (rep) {
    const record = currentOf(registers, rep);
    if (!found || record[1] > topTs) {
      found = true;
      topValue = record[0];
      topTs = record[1];
    }
  });
  return [topValue, topTs];
}
