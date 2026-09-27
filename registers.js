// registers.js：取值与合并规则（LWW：时间戳最大者胜）
export function currentOf(registers, rep) {
  const record = registers && Object.prototype.hasOwnProperty.call(registers, rep)
    ? registers[rep] : null;
  return Array.isArray(record) ? [record[0], record[1]] : [0, 0];
}

export function topOf(registers, reps) {
  let topValue = 0;
  let topTs = 0;
  let found = false;
  (reps || []).forEach(function (rep) {
    const record = registers && Object.prototype.hasOwnProperty.call(registers, rep)
      ? registers[rep] : null;
    if (!Array.isArray(record)) return;
    const ts = record[1];
    if (!found || ts > topTs) {
      found = true;
      topValue = record[0];
      topTs = ts;
    }
  });
  return [topValue, topTs];
}
