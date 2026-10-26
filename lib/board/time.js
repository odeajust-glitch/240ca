// CATS times are local railway time with no zone. Everything is kept as
// "local minutes since the epoch" (built with Date.UTC from the local
// fields) so the server's own timezone can never shift a call time.
const MIN = 60 * 1000;

function at(year, month, day, hour = 0, minute = 0) {
  return Date.UTC(year, month - 1, day, hour, minute) / MIN;
}

function parts(t) {
  const d = new Date(t * MIN);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

const pad = (n) => String(n).padStart(2, '0');

// "14th 2330" style, matching how the owner reads the board.
function fmt(t) {
  const p = parts(t);
  const teen = p.day >= 11 && p.day <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[p.day % 10] || 'th');
  return `${p.day}${suffix} ${pad(p.hour)}${pad(p.minute)}`;
}

// "2026-10-17T15:30": railway local time, no zone, for the phone app.
function localIso(t) {
  const p = parts(t);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function hhmm(s) {
  const m = /^(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  return { hour: +m[1], minute: +m[2] };
}

// A bare day-of-month on a screen (rest "0100 15") means the occurrence
// nearest to `now`; boards never look more than a few days either way.
function nearestDay(now, day, hour, minute) {
  const p = parts(now);
  const candidates = [-1, 0, 1].map((dm) => at(p.year, p.month + dm, day, hour, minute));
  return candidates.reduce((best, c) => (Math.abs(c - now) < Math.abs(best - now) ? c : best));
}

// The road day a moment belongs to: anything before 0500 counts toward the
// previous calendar day.
function roadDay(t, dayStartMinutes) {
  const p = parts(t - dayStartMinutes);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// Railway (Toronto) time `minutes` before `date`, as CATS types it: "1750".
// The engineer spareboards' time box gets the check's time less 10 min
// (owner, 2026-10-26: "if the checker runs at 1800, enter 1750").
function hhmmBefore(date, minutes) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(date.getTime() - minutes * 60000)).map((x) => [x.type, x.value]));
  return `${p.hour}${p.minute}`;
}

module.exports = { at, parts, fmt, localIso, hhmm, nearestDay, roadDay, hhmmBefore };
