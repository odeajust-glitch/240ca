// Which Toronto crew takes each Mac yard train (lib/board/site.js shows it,
// lib/board/alerts.js tells the crews).
const config = require('./config');
const { torontoCallTime } = require('./engine');
const { PLACEHOLDER } = require('../../public/board-turns');

// A train as the site names it: symbol + origin day ("M38331 24").
const trainId = (t) => `${t.symbol} ${t.originDay}`;

// Owner, 2026-11-14: "IF you see a Sarnia crew on a train then its not a
// possible toronto south crew." A Mac yard train already on the Call Board
// has its Sarnia crew (called, or on duty), so it takes no one from the
// bunkhouse and is never a possible Toronto South crew. A crew that is called
// drops off the bunkhouse while its train stays on the line-up until it
// leaves: on the saved checks of 24 Oct to 13 Nov a line-up train was already
// on the Call Board 188 times; the site gave 96 of them another bunkhouse crew
// (every later train's crew one back) and 91 none, which is where most of the
// "possible Toronto South crew" labels came from (all 47 of those trains went
// to Sarnia crews). The called crew is also kept out of the bunkhouse, in case
// CATS still lists them there: matched by a regular turn (an MU turn is a
// placeholder many people get), or by both turns when both are MU.
// trains: the Mac yard line-up; crews: the bunkhouse pairs ({ en, co }) as
// read; callBoard: the Call Board's trains (summary.js `callBoard`).
// → { called: Map train id → its Call Board train, busy: Set of crew indexes,
//     busyOn: Map crew index → the called train's id }.
function onCallBoard(trains, crews, callBoard) {
  const board = new Map((callBoard || []).map((t) => [trainId(t), t]));
  const called = new Map();
  for (const t of trains || []) {
    const b = board.get(trainId(t));
    if (b) called.set(trainId(t), b);
  }
  const busy = new Set();
  const busyOn = new Map();
  (crews || []).forEach((c, k) => {
    const own = [c.en, c.co].filter(Boolean);
    const regular = own.filter((t) => !PLACEHOLDER.test(t));
    for (const [id, b] of called) {
      const turns = new Set((b.crew || []).map((x) => x.turn));
      if (regular.length ? regular.some((t) => turns.has(t)) : own.length && own.every((t) => turns.has(t))) {
        busy.add(k);
        busyOn.set(k, id);
        break;
      }
    }
  });
  return { called, busy, busyOn };
}

// Crews take the Mac yard trains in bunkhouse order (rest ending at the call
// = available, as at Sarnia). Owner, 2026-10-25: a PLANNED train stays with
// the next crew in line even if it's still on rest at the call (planned
// times move; the page shows when it's rested). An ORDERED train goes to the
// next crew rested by its call; a crew still on rest is passed over and
// keeps its place. Index into `crews` per train, or -1 (no one).
// opts: onCallBoard's { called, busy }: a train already on the Call Board
// gets no one (-1), and its crew is no one's.
function torontoCrews(trains, crews, { called = null, busy = null } = {}) {
  const used = new Set(busy || []);
  return trains.map((t) => {
    if (called && called.has(trainId(t))) return -1;
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
// Never for a train already on the Call Board (opts, as torontoCrews).
function torontoSouth(trains, crews, pick = null, opts = {}) {
  const picked = pick || torontoCrews(trains, crews, opts);
  return trains.map((t, n) => {
    // Never for a deadhead: it won't go to a Toronto South crew (owner, 2026-10-25).
    if (t.status !== 'ORD' || t.deadhead || picked[n] >= 0) return -1;
    if (opts.called && opts.called.has(trainId(t))) return -1;
    const before = new Set([...(opts.busy || []), ...picked.slice(0, n).filter((i) => i >= 0)]);
    return crews.findIndex((c, k) => !before.has(k));
  });
}

// Garnet (owner, 2026-11-04): there's only ever one crew there, the 501/502
// crew that took L502 out, and it brings the next L501 home. The call was
// "the order − 2 h" (owner, 2026-11-04); it is the order − 2 h 15 since
// 2026-11-10 (owner: "yes move it to 2 hours 15"): every L501 on the saved
// days went on duty 15 min before its order (6 of 6), and the call is 2 h
// before on duty. lineup: Garnet's line-up (41, 47956); board:
// the Garnet board (31). → { train, call, crew: { turn, members: [{ turn, craft }], en, co, restUntil } | null } | null
// The crew is every row at the first position, one a craft: one turn's conductor and engineer, or two turns
// (owner, 2026-11-13: S502's engineer and MU01's conductor took L50231 13 out while S502's conductor job was
// held; MU01's conductor was left out, and the page named S502's new conductor, at home, as the one at Garnet).
// turn: the first row's turn, as before.
const GARNET_CALL_MIN = 2 * 60 + 15;
function garnetHome(lineup = [], board = []) {
  const train = (lineup || []).filter((t) => /^L501/.test(t.symbol) && t.order != null).sort((a, b) => a.order - b.order)[0];
  if (!train) return null;
  const rows = (board || []).filter((t) => /^(EN|LE|CO)$/.test(t.craft) && !t.working);
  let crew = null;
  if (rows.length) {
    const first = [...rows].sort((a, b) => a.pos - b.pos)[0];
    const mine = rows.filter((t) => t.turn === first.turn);
    for (const co of [true, false]) {
      if (mine.some((t) => (t.craft === 'CO') === co)) continue;
      const mate = rows.find((t) => t.turn !== first.turn && (t.craft === 'CO') === co && +t.pos === +first.pos);
      if (mate) mine.push(mate);
    }
    const rest = mine.map((t) => t.restUntil).filter((x) => x != null);
    crew = { turn: first.turn, members: mine.map((t) => ({ turn: t.turn, craft: t.craft === 'CO' ? 'CO' : 'EN' })),
      en: mine.some((t) => t.craft !== 'CO'), co: mine.some((t) => t.craft === 'CO'), restUntil: rest.length ? Math.max(...rest) : null };
  }
  return { train, call: train.order - GARNET_CALL_MIN, crew };
}

module.exports = { garnetHome, GARNET_CALL_MIN, onCallBoard, torontoCrews, torontoSouth, trainId };
