// Which Toronto crew takes each Mac yard train (lib/board/site.js shows it,
// lib/board/alerts.js tells the crews).
const config = require('./config');
const { callTime } = require('./engine');

// Crews take the Mac yard trains in bunkhouse order (rest ending at the call
// = available, as at Sarnia). Owner, 2026-10-25: a PLANNED train stays with
// the next crew in line even if it's still on rest at the call (planned
// times move; the page shows when it's rested). An ORDERED train goes to the
// next crew rested by its call; a crew still on rest is passed over and
// keeps its place. Index into `crews` per train, or -1 (no one).
function torontoCrews(trains, crews) {
  const used = new Set();
  return trains.map((t) => {
    const call = callTime(t.order, !!t.deadhead, config);
    const ordered = t.status === 'ORD';
    const i = crews.findIndex((c, k) => !used.has(k) && (!ordered || c.restUntil == null || c.restUntil <= call));
    if (i >= 0) used.add(i);
    return i;
  });
}

// An ordered train with no crew rested by its call (owner, 2026-10-25): a
// Toronto South crew may get it. The crew first in line when that train
// comes up (still on rest) is the one told. → per train: index or -1.
function torontoSouth(trains, crews, pick = torontoCrews(trains, crews)) {
  return trains.map((t, n) => {
    // Never for a deadhead: it won't go to a Toronto South crew (owner, 2026-10-25).
    if (t.status !== 'ORD' || t.deadhead || pick[n] >= 0) return -1;
    const before = new Set(pick.slice(0, n).filter((i) => i >= 0));
    return crews.findIndex((c, k) => !before.has(k));
  });
}

module.exports = { torontoCrews, torontoSouth };
