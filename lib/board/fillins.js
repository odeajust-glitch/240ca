// Spare people filling in on someone else's turn, carried across checks
// (owner, 2026-10-25): B119 goes out on M38261 under SB04, so in Toronto the
// bunkhouse and the trip home show SB04. While that trip lasts, alerts for
// SB04's Toronto news go to B119, the person actually there.
// Memory (BoardChecker\fill-ins.json): { SB04: { turn: 'B119', train, at } }.
const fs = require('fs');

const KEEP = 48 * 60; // minutes: a trip is over by then whatever was seen
// Read by name in the bunkhouse this recently: still in Toronto, whatever the
// boards at home show (owner, 2026-10-31: EN03 working S301 got no Toronto
// alerts: S301 shows at home on the S3 board while its holder is off, so the
// trip looked over once the train out left the Call Board).
const IN_TORONTO = 60;

// backfill: this check's matches ({ train, craft, job, turn }). The trip is
// over once the job's turn is back on a Sarnia board, or the spare is back
// on its spareboard, and the train it went out on is off the Call Board.
// homeTurns / spareTurns: Sets of turns at home now. now: railway minutes.
// bunk: the bunkhouse read by name ({ job, turn }): the person under a turn
// is that turn's own holder (turn === job: no fill-in) or a spare filling in
// (picked up or confirmed, even if the trip out was missed).
function updateFillIns(memory, { backfill = [], bunk = [], callBoard = [], homeTurns = new Set(), spareTurns = new Set(), now }) {
  const next = { ...(memory || {}) };
  for (const b of backfill) next[b.job] = { turn: b.turn, train: b.train, at: now };
  for (const b of bunk) {
    if (b.turn === b.job) delete next[b.job];
    else next[b.job] = { turn: b.turn, train: (next[b.job] && next[b.job].train) || null, at: now, bunkAt: now };
  }
  const onBoard = new Set(callBoard.map((t) => `${t.symbol} ${t.originDay}`));
  for (const [job, f] of Object.entries(next)) {
    const inToronto = f.bunkAt != null && now - f.bunkAt < IN_TORONTO;
    const back = (homeTurns.has(job) || spareTurns.has(f.turn)) && !onBoard.has(f.train) && !inToronto;
    if (back || now - f.at > KEEP) delete next[job];
  }
  return next;
}

const loadFillIns = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };
const saveFillIns = (file, m) => fs.writeFileSync(file, JSON.stringify(m));

module.exports = { updateFillIns, loadFillIns, saveFillIns };
