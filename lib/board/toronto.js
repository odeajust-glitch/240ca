// Which Toronto crew takes each Mac yard train (lib/board/site.js shows it,
// lib/board/alerts.js tells the crews).
const config = require('./config');
const { torontoCallTime } = require('./engine');

// Crews take the Mac yard trains in bunkhouse order (rest ending at the call
// = available, as at Sarnia). Owner, 2026-10-25: a PLANNED train stays with
// the next crew in line even if it's still on rest at the call (planned
// times move; the page shows when it's rested). An ORDERED train goes to the
// next crew rested by its call; a crew still on rest is passed over and
// keeps its place. Index into `crews` per train, or -1 (no one).
function torontoCrews(trains, crews) {
  const used = new Set();
  return trains.map((t) => {
    const call = torontoCallTime(t.order, config, !!t.deadhead || /^DH/.test(t.symbol || ''));
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

// Garnet (owner, 2026-11-04): there's only ever one crew there, the 501/502
// crew that took L502 out, and it brings the next L501 home. The call was
// "the order − 2 h" (owner, 2026-11-04); it is the order − 2 h 15 since
// 2026-11-10 (owner: "yes move it to 2 hours 15"): every L501 on the saved
// days went on duty 15 min before its order (6 of 6), and the call is 2 h
// before on duty. lineup: Garnet's line-up (41, 47956); board:
// the Garnet board (31). → { train, call, crew: { turn, en, co, restUntil } | null } | null
const GARNET_CALL_MIN = 2 * 60 + 15;
function garnetHome(lineup = [], board = []) {
  const train = (lineup || []).filter((t) => /^L501/.test(t.symbol) && t.order != null).sort((a, b) => a.order - b.order)[0];
  if (!train) return null;
  const rows = (board || []).filter((t) => /^(EN|LE|CO)$/.test(t.craft) && !t.working);
  let crew = null;
  if (rows.length) {
    const first = [...rows].sort((a, b) => a.pos - b.pos)[0].turn;
    const mine = rows.filter((t) => t.turn === first);
    const rest = mine.map((t) => t.restUntil).filter((x) => x != null);
    crew = { turn: first, en: mine.some((t) => t.craft !== 'CO'), co: mine.some((t) => t.craft === 'CO'), restUntil: rest.length ? Math.max(...rest) : null };
  }
  return { train, call: train.order - GARNET_CALL_MIN, crew };
}

module.exports = { garnetHome, GARNET_CALL_MIN, torontoCrews, torontoSouth };
