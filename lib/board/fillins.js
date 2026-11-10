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
// 501/502 and make-up crews (S501, MU01) are a conductor and an engineer
// under one turn, each a different spare when filling in (owner,
// 2026-11-06: the stand-in crew working MU01 to Garnet): kept per craft,
// "MU01-CO" / "MU01-EN". Other turns: one person, the turn itself.
const SHARED = /^(S5\d{2}|MU\d+)$/;
const keyOf = (b) => (SHARED.test(b.job) && b.craft ? `${b.job}-${b.craft === 'CO' ? 'CO' : 'EN'}` : b.job);

// sharedHome: the "S501-EN" keys whose row on the 501/502 board is at home in
// Sarnia now (not at Garnet, not working). A stand-in on a shared turn used
// to end only by the 48 h limit: its key is never a turn on a home board, and
// a pool turn standing in (SA07 on S501's engineer job, 2026-11-08) is not
// on a spareboard to come back to. So SA07 was still "the crew at Garnet"
// two days later and was sent S501's L501 (owner's screenshot, 2026-11-10).
// It now ends when that craft's row is home again, when the L501 they came
// home on has left the Call Board, or when the job is on the Call Board on
// another train with nobody standing in this check.
function updateFillIns(memory, { backfill = [], bunk = [], callBoard = [], homeTurns = new Set(), spareTurns = new Set(), sharedHome = new Set(), now }) {
  const next = { ...(memory || {}) };
  for (const b of backfill) next[keyOf(b)] = { turn: b.turn, train: b.train, at: now };
  const filled = new Set(backfill.map(keyOf));
  for (const b of bunk) {
    if (b.turn === b.job) delete next[b.job];
    else next[b.job] = { turn: b.turn, train: (next[b.job] && next[b.job].train) || null, at: now, bunkAt: now };
  }
  const onBoard = new Set(callBoard.map((t) => `${t.symbol} ${t.originDay}`));
  for (const [job, f] of Object.entries(next)) {
    const inToronto = f.bunkAt != null && now - f.bunkAt < IN_TORONTO;
    const back = (homeTurns.has(job) || sharedHome.has(job) || spareTurns.has(f.turn)) && !onBoard.has(f.train) && !inToronto;
    const m = /^(.+)-(CO|EN)$/.exec(job);
    const again = !!m && SHARED.test(m[1]) && !filled.has(job) && callBoard.some((t) => `${t.symbol} ${t.originDay}` !== f.train
      && (t.crew || []).some((c) => c.turn === m[1] && /^(EN|LE|CO)$/.test(c.craft || '') && (c.craft === 'CO') === (m[2] === 'CO')));
    // Their L501 home has left the Call Board: they are back in Sarnia, whatever the board rows show since.
    const homeLeg = !!m && SHARED.test(m[1]) && /^L501/.test(f.train || '') && !onBoard.has(f.train);
    if (back || again || homeLeg || now - f.at > KEEP) delete next[job];
  }
  return next;
}

const loadFillIns = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } };
const saveFillIns = (file, m) => fs.writeFileSync(file, JSON.stringify(m));

module.exports = { keyOf, updateFillIns, loadFillIns, saveFillIns };
