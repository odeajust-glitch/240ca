// The board check itself: given the three parsed screens, work out which
// pool and turn each Sarnia train should get, where the owner stands, and
// what CATS did that breaks the rules. Every rule cites BOARD-CHECK.md.
const defaults = require('./config');
const { fmt, roadDay } = require('./time');

// Turn id → pool. Conductors SA/SB/SR, engineers S1/S3/SD, S5 on L502.
function poolOf(turn) {
  if (!turn) return null;
  if (/^SA/.test(turn) || /^S1\d/.test(turn)) return 'A';
  if (/^SB/.test(turn) || /^S3\d/.test(turn)) return 'B';
  if (/^SR/.test(turn) || /^SD/.test(turn)) return 'SR';
  if (/^S5/.test(turn)) return 'S5';
  if (/^MU/.test(turn)) return 'MU';
  return 'other';
}

// Engineer turn that should ride with each conductor turn.
const ENGINEER_FOR = { SA: 'S1', SB: 'S3', SR: 'SD', S5: 'S5' };

function isExcluded(trainNo, cfg) {
  return cfg.excludedTrainPrefixes.some((p) => trainNo.startsWith(p));
}

function orderTimeFromOnDuty(train, cfg) {
  const kind = /^DH/.test(train.symbol) ? 'deadhead' : 'train';
  return train.onDuty + cfg.prepMinutes[kind];
}

function callTime(order, deadhead, cfg) {
  return order - cfg.prepMinutes[deadhead ? 'deadhead' : 'train'] - cfg.callLeadMinutes;
}

// --- Checks on what CATS has already done (Call Board) ---------------------

function crewChecks(trains) {
  const flags = [];
  const notes = [];
  for (const t of trains) {
    const co = t.crew.find((c) => c.craft === 'CO');
    const en = t.crew.find((c) => c.craft === 'EN');
    if (!co || !en) continue;
    const coPool = co.turn.slice(0, 2);
    const enPool = en.turn.slice(0, 2);
    const label = `${t.symbol} ${t.originDay} (on duty ${t.station} ${fmt(t.onDuty)})`;
    const mu = [co, en].find((c) => /^MU/.test(c.turn));
    if (mu) {
      const other = mu === co ? en : co;
      const otherPool = poolOf(other.turn);
      if (otherPool === 'SR') {
        notes.push(`${label}: ${mu.craft} on ${mu.turn} with ${other.turn}. Allowed when no Chain Gang turn was available.`);
      } else {
        flags.push({ rule: 'mu', text: `${label}: ${mu.craft} on make-up turn ${mu.turn} with ${other.turn}. MU is never right on ${otherPool === 'S5' ? 'L502 (S5)' : 'an A/B train'}; possible miscoding.` });
      }
      continue;
    }
    const expectedEn = ENGINEER_FOR[coPool] || (/^S5/.test(co.turn) ? 'S5' : null);
    if (expectedEn && !en.turn.startsWith(expectedEn)) {
      flags.push({ rule: 'pairing', text: `${label}: conductor ${co.turn} paired with engineer ${en.turn}; expected an ${expectedEn} turn.` });
    }
  }
  return { flags, notes };
}

// --- The allocation ---------------------------------------------------------

function runBoardCheck({ now, callBoard, chainGangHome, chainGangAway = [], lineup, me }, overrides = {}) {
  const cfg = { ...defaults, ...overrides };
  const flags = [];
  const notes = [];
  const used = {}; // road day → { A, B }
  const countFor = (day) => (used[day] ||= { A: 0, B: 0 });

  // 1. Sarnia departures already on duty, in order time: what pool each
  //    *should* have had, against what CATS gave it.
  const departed = callBoard
    .filter((t) => t.station === cfg.homeStation)
    .map((t) => ({ ...t, order: orderTimeFromOnDuty(t, cfg), deadhead: /^DH/.test(t.symbol) }))
    .sort((a, b) => a.order - b.order);
  const today = [];
  for (const t of departed) {
    const co = t.crew.find((c) => c.craft === 'CO');
    const actual = co ? poolOf(co.turn) : null;
    let expected;
    if (isExcluded(t.trainNo, cfg)) expected = 'S5';
    else if (t.deadhead) expected = 'SR';
    else {
      const n = countFor(roadDay(t.order, cfg.dayStartMinutes));
      if (n.A < cfg.aTurnsPerDay) { expected = 'A'; n.A++; }
      else if (n.B < cfg.bTurnsPerDay) { expected = 'B'; n.B++; }
      else expected = 'SR';
    }
    today.push({ symbol: t.symbol, originDay: t.originDay, onDuty: t.onDuty, order: t.order, expected, actual, turn: co && co.turn });
    if (actual && actual !== 'MU' && actual !== expected) {
      flags.push({ rule: 'pool', text: `${t.symbol} ${t.originDay} (ordered ~${fmt(t.order)}) went to ${actual} (${co.turn}) but the sequence says ${expected}.` });
    }
  }

  // 2. Chain Gang queue at home, in position order, then crews coming home.
  //    Returning turns go to the bottom by outer switch time; the Call Board
  //    only shows their Toronto on-duty time, so that stands in for it.
  const queue = chainGangHome
    .filter((t) => t.craft === 'CO')
    .sort((a, b) => a.pos - b.pos)
    .map((t) => {
      const hold = t.rn === 'HT';
      const spare = !hold && (t.st === '**' || t.rn === '**');
      return { turn: t.turn, restUntil: t.restUntil, holdUntil: hold ? t.statusUntil : null, spare, spareUntil: spare ? t.statusUntil : null };
    });
  const returning = callBoard
    .filter((t) => t.station !== cfg.homeStation)
    .map((t) => ({ t, co: t.crew.find((c) => c.craft === 'CO') }))
    .filter(({ co }) => co && /^SR/.test(co.turn))
    .sort((a, b) => a.t.onDuty - b.t.onDuty)
    .map(({ t, co }) => ({ turn: co.turn, returning: true, onDutyAway: t.onDuty, restUntil: null, holdUntil: null, spare: false }));
  queue.push(...returning);
  if (returning.length) {
    notes.push(`Coming home (placed at the bottom by Toronto on-duty time, standing in for outer switch time): ${returning.map((r) => r.turn).join(', ')}.`);
  }
  if (chainGangAway.length) {
    notes.push(`At Toronto, not yet called home: ${chainGangAway.filter((t) => t.craft === 'CO').map((t) => t.turn).join(', ')}.`);
  }

  // 3. Walk the line-up in order time, giving each train its pool, and each
  //    Chain Gang train its turn.
  const known = new Set(callBoard.map((t) => `${t.symbol}/${t.originDay}`));
  const upcoming = lineup
    .filter((t) => !known.has(`${t.symbol}/${t.originDay}`))
    .sort((a, b) => a.order - b.order);

  const predictions = [];
  for (const t of upcoming) {
    const row = { symbol: t.symbol, originDay: t.originDay, order: t.order, status: t.status, deadhead: t.deadhead };
    if (isExcluded(t.trainNo, cfg)) {
      predictions.push({ ...row, pool: 'S5', reason: 'L502/L501 is crewed by S5 and never counts.' });
      continue;
    }
    if (!t.deadhead) {
      const day = roadDay(t.order, cfg.dayStartMinutes);
      const n = countFor(day);
      if (n.A < cfg.aTurnsPerDay) {
        n.A++;
        predictions.push({ ...row, pool: 'A', reason: `A train #${n.A} of the road day starting ${day} (first ${cfg.aTurnsPerDay} after 0459).` });
        continue;
      }
      if (n.B < cfg.bTurnsPerDay) {
        n.B++;
        predictions.push({ ...row, pool: 'B', reason: `B train #${n.B} (A used up for the road day starting ${day}).` });
        continue;
      }
    }
    const call = callTime(t.order, t.deadhead, cfg);
    const skipped = [];
    let pick = null;
    for (const q of queue) {
      if (q.restUntil != null && q.restUntil >= call) { skipped.push(`${q.turn} on rest until ${fmt(q.restUntil)}`); continue; }
      if (q.holdUntil != null && q.holdUntil >= call) { skipped.push(`${q.turn} on hold turn until ${fmt(q.holdUntil)}`); continue; }
      pick = q;
      break;
    }
    const why = [t.deadhead ? 'Deadhead → always the next Chain Gang turn.' : 'A and B used up for this road day → Chain Gang.'];
    why.push(`Called ~${fmt(call)}.`);
    if (skipped.length) why.push(`Skipped (keep their place): ${skipped.join('; ')}.`);
    if (!pick) {
      predictions.push({ ...row, pool: 'SR', turn: null, reason: `${why.join(' ')} No Chain Gang turn available → spareboard.` });
      continue;
    }
    queue.splice(queue.indexOf(pick), 1);
    const goesSpare = pick.spare && (!cfg.starsHaveExpiry || pick.spareUntil == null || pick.spareUntil >= call);
    if (goesSpare) why.push(`${pick.turn} is marked ** → the turn goes out with a spareboard employee.`);
    if (pick.returning) why.push(`${pick.turn} is a returning turn; assumes it's home by then.`);
    predictions.push({ ...row, pool: 'SR', turn: pick.turn, spare: goesSpare, reason: why.join(' ') });
  }

  // 4. The owner.
  let mine = null;
  if (me) {
    const assigned = predictions.find((p) => p.turn === me);
    if (assigned) {
      mine = { turn: me, train: `${assigned.symbol} ${assigned.originDay}`, order: assigned.order, status: assigned.status };
    } else {
      const idx = queue.findIndex((q) => q.turn === me);
      mine = idx < 0
        ? { turn: me, notFound: true }
        : { turn: me, aheadAfterLineup: queue.slice(0, idx).map((q) => q.turn + (q.holdUntil ? ` (hold until ${fmt(q.holdUntil)})` : '')) };
    }
  }

  const crew = crewChecks(callBoard);
  flags.push(...crew.flags);
  notes.push(...crew.notes);

  return { now, today, predictions, me: mine, flags, notes };
}

module.exports = { runBoardCheck, poolOf, callTime };
