// The Toronto South watch (owner, 2026-11-14), asked how the checker should
// confirm a Toronto South crew without checking every time: "if you see a
// train in the line up in mac yard and then fall off 8 hours before its was
// supposed to get called. Check the Toronto South call board 4 hours before
// the suspected call time, at the suspected call time, and 2 hours after the
// suspected call time to see if the train is there. we can have a list of
// train ids to look for to see if a TS crew is on one of our trains departing
// mac yard".
//
// So the checker keeps that list (BoardChecker\toronto-south.json) and opens
// the Toronto South Call Board only when one of its looks is due: at most three
// reads per train, one read for every train due at that check, never on every
// check. Taken as:
// - "fall off 8 hours before": gone from the Mac yard line-up (41975 W) at a
//   check 8 h or more before the call it last showed (leaving near its call is
//   the crew being called). The call is lib/board/engine.js torontoCallTime.
// - Never a deadhead (owner, 2026-10-25: a deadhead won't go to a Toronto South
//   crew), never a train with a Sarnia crew on the Call Board ("IF you see a
//   Sarnia crew on a train then its not a possible toronto south crew").
// - Off the list (no more looks): back on the Mac yard line-up (it's ours
//   again; removed), a Sarnia crew on it (end 'sarnia'), seen on the Toronto
//   South Call Board (end 'seen'), or all three looks done (end 'notSeen', or
//   'unread' when CATS never showed that board).
// Times are minutes in railway (Toronto) time, as lib/board/summary.js `now`.
const fs = require('fs');
const config = require('./config');
const { torontoCallTime } = require('./engine');
const { trainId } = require('./toronto');

const LEAD_MIN = 8 * 60; // fell off at least this long before its call
const LOOKS = [-4 * 60, 0, 2 * 60]; // when to look, from the call
const GAP_MIN = 120; // a line-up read longer ago than this can't say when a train left it
const KEEP_MIN = 48 * 60; // a finished watch stays this long after its last look, for the page
const TRIES = 2; // checks a look is tried when CATS couldn't show the board

const empty = () => ({ v: 1, last: null, trains: {} });

function load(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    return s && s.v === 1 && s.trains && typeof s.trains === 'object' ? s : empty();
  } catch {
    return empty();
  }
}

function save(file, state) {
  fs.writeFileSync(file, JSON.stringify(state));
}

// "EN SD10 · CO SR07", trainees left out.
const crewText = (crew) => (crew || []).filter((c) => !/^(TT|ET)$/.test(c.craft)).map((c) => `${c.craft} ${c.turn}`).join(' · ');

// One check. lineup: the Mac yard line-up as read this check (summary.js
// `macLineup`), or null when it wasn't read: a skipped screen says nothing
// about what left it. callBoard: this check's Call Board trains. → the state,
// changed in place.
function update(state, { now, lineup, callBoard }) {
  const s = state && state.v === 1 && state.trains ? state : empty();
  const board = new Map((callBoard || []).map((t) => [trainId(t), t]));
  for (const w of Object.values(s.trains)) {
    if (w.end) continue;
    const b = board.get(w.id);
    if (b) Object.assign(w, { end: 'sarnia', endAt: now, sarnia: { crew: crewText(b.crew), onDuty: b.onDuty } });
  }
  if (lineup) {
    const here = new Set(lineup.map(trainId));
    for (const [id, w] of Object.entries(s.trains)) if (!w.end && here.has(id)) delete s.trains[id];
    if (s.last && now >= s.last.at && now - s.last.at <= GAP_MIN) {
      for (const t of s.last.trains) {
        if (here.has(t.id) || board.has(t.id) || t.deadhead || s.trains[t.id]) continue;
        if (t.call - now < LEAD_MIN) continue;
        s.trains[t.id] = { id: t.id, status: t.status, order: t.order, call: t.call, lastSeen: s.last.at, fellOff: now,
          looks: LOOKS.map((d) => ({ due: t.call + d })) };
      }
    }
    s.last = { at: now, trains: lineup.map((t) => {
      const deadhead = !!t.deadhead || /^DH/.test(t.symbol || '');
      return { id: trainId(t), status: t.status, order: t.order, call: torontoCallTime(t.order, config, deadhead), deadhead };
    }) };
  }
  for (const [id, w] of Object.entries(s.trains)) {
    if (now - Math.max(w.looks[w.looks.length - 1].due, w.endAt || 0) > KEEP_MIN) delete s.trains[id];
  }
  return s;
}

// The watches with a look due now.
function due(state, now) {
  return Object.values((state && state.trains) || {}).filter((w) => !w.end && w.looks.some((l) => l.at == null && l.due <= now));
}

// After a look at the Toronto South Call Board. found: Map train id →
// { station, onDuty, crew } for the watched trains it showed, or null when
// CATS didn't show the board (each due look is then tried at the next check,
// TRIES checks in all). Looks overdue together (the checker was off) are all
// answered by this one read.
function record(state, now, found) {
  for (const w of due(state, now)) {
    for (const l of w.looks) {
      if (l.at != null || l.due > now) continue;
      if (!found) {
        l.tries = (l.tries || 0) + 1;
        if (l.tries >= TRIES) Object.assign(l, { at: now, seen: false, failed: true });
        continue;
      }
      Object.assign(l, { at: now, seen: found.has(w.id) });
    }
    const hit = found && found.get(w.id);
    if (hit) Object.assign(w, { end: 'seen', endAt: now, seen: { station: hit.station || '', onDuty: hit.onDuty ?? null, crew: crewText(hit.crew) } });
    else if (w.looks.every((l) => l.at != null)) Object.assign(w, { end: w.looks.every((l) => l.failed) ? 'unread' : 'notSeen', endAt: now });
  }
  return state;
}

// The list as each check saves it (summary `torontoSouth`), soonest call first.
function list(state) {
  return Object.values((state && state.trains) || {}).sort((a, b) => a.call - b.call).map((w) => ({
    id: w.id, status: w.status, order: w.order, call: w.call, lastSeen: w.lastSeen, fellOff: w.fellOff,
    looks: w.looks.map((l) => ({ due: l.due, ...(l.at != null ? { at: l.at, seen: !!l.seen } : {}), ...(l.failed ? { failed: true } : {}), ...(l.tries && !l.failed ? { tries: l.tries } : {}) })),
    end: w.end || '', ...(w.seen ? { seen: w.seen } : {}), ...(w.sarnia ? { sarnia: w.sarnia } : {}),
  }));
}

// Which codes open the Toronto South Call Board: the two boxes on the Call
// Board's first screen, 45 and SA for Sarnia's (docs/board-checker/SCREENS.md).
// config.torontoSouthCallBoard, or BOARD_TS_CALLBOARD ("<district> <sub-district>")
// in the laptop's .env. → { district, sub } or null (not known yet: looks wait).
function boardCodes(env = process.env, cfg = config) {
  const raw = String(env.BOARD_TS_CALLBOARD || cfg.torontoSouthCallBoard || '').trim().toUpperCase();
  const m = /^([A-Z0-9]{1,3})[\s/,-]+([A-Z0-9]{1,3})$/.exec(raw);
  return m && !(m[1] === '45' && m[2] === 'SA') ? { district: m[1], sub: m[2] } : null;
}

module.exports = { LEAD_MIN, LOOKS, GAP_MIN, KEEP_MIN, TRIES, empty, load, save, update, due, record, list, boardCodes, crewText };
