// Daily S5 alternation confirmed by owner, 2026-11-07. Keep the dated
// assignment separate from the people available to work it. No mutable
// memory is needed: the full-date anchor survives rest changes/restarts.
const { at, parts } = require('./time');
const DAY = 1440;
function serviceDay(train) {
  const ref = train.order ?? train.onDuty;
  const d = Number(train.originDay);
  if (!Number.isFinite(ref) || !Number.isInteger(d) || d < 1 || d > 31) return null;
  const p = parts(ref);
  // Check real dates: Date.UTC would silently roll e.g. February 31 forward.
  const candidates = [-1, 0, 1].map((dm) => at(p.year, p.month + dm, d))
    .filter((t) => parts(t).day === d);
  return candidates.sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref))[0] ?? null;
}
function turnFor(train, anchor) {
  if (!anchor || !/^S50[12]$/.test(anchor.turn)) return null;
  const day = serviceDay(train);
  const start = Date.parse(anchor.date + 'T00:00:00Z') / 60000;
  // Earlier recorded checks retain their contemporary interpretation.
  if (day == null || !Number.isFinite(start) || day < start) return null;
  return ((day - start) / DAY) % 2 === 0 ? anchor.turn : anchor.turn === 'S501' ? 'S502' : 'S501';
}
module.exports = { serviceDay, turnFor };
