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

// CATS's own crew pool on an *ordered* line-up row (45SASR0 → SR). Planned
// rows always show the A pool by default, so only ORD rows count.
function poolFromCrewCode(code) {
  const m = /^\d*SAS?([A-Z0-9])\d$/.exec(code || '');
  if (!m) return null;
  return { A: 'A', B: 'B', R: 'SR', 5: 'S5' }[m[1]] || null;
}

function runBoardCheck({ now, callBoard, chainGangHome, chainGangAway = [], aHome = [], bHome = [], lineup, me }, overrides = {}) {
  const cfg = { ...defaults, ...overrides };
  const flags = [];
  const notes = [];
  const used = {}; // road day → { A, B }
  const countFor = (day) => (used[day] ||= { A: 0, B: 0 });

  // 1. One timeline of Sarnia departures in order time: trains already on
  //    duty (actual pool from the conductor's turn) and the line-up (actual
  //    pool from CATS's crew code once a train is ORDered).
  const onDuty = callBoard
    .filter((t) => t.station === cfg.homeStation)
    .map((t) => {
      const co = t.crew.find((c) => c.craft === 'CO');
      return { source: 'board', symbol: t.symbol, trainNo: t.trainNo, originDay: t.originDay, deadhead: /^DH/.test(t.symbol),
        order: orderTimeFromOnDuty(t, cfg), onDuty: t.onDuty, turn: co && co.turn, actual: co ? poolOf(co.turn) : null };
    });
  const onBoard = new Set(callBoard.map((t) => `${t.symbol}/${t.originDay}`));
  const coming = lineup
    .filter((t) => !onBoard.has(`${t.symbol}/${t.originDay}`))
    .map((t) => ({ source: 'lineup', symbol: t.symbol, trainNo: t.trainNo, originDay: t.originDay, deadhead: t.deadhead,
      order: t.order, status: t.status, actual: t.status === 'ORD' ? poolFromCrewCode(t.trnCrew) : null }));
  const timeline = [...onDuty, ...coming].sort((a, b) => a.order - b.order);

  for (const e of timeline) {
    if (isExcluded(e.trainNo, cfg)) { e.expected = 'S5'; continue; }
    if (e.deadhead) { e.expected = 'SR'; continue; }
    const day = roadDay(e.order, cfg.dayStartMinutes);
    const n = countFor(day);
    // A train went to the Chain Gang but we've seen none of that road day's
    // A/B trains: they ran before this snapshot (e.g. a 0143 run sees none
    // of the previous morning). Trust CATS that A and B are used up.
    if (e.actual === 'SR' && n.A === 0 && n.B === 0) {
      n.A = cfg.aTurnsPerDay;
      n.B = cfg.bTurnsPerDay;
      notes.push(`Road day starting ${day}: its A/B trains aren't on this snapshot; ${e.symbol} ${e.originDay} going to the Chain Gang means they're used up.`);
    }
    if (n.A < cfg.aTurnsPerDay) { e.expected = 'A'; e.slot = ++n.A; }
    else if (n.B < cfg.bTurnsPerDay) { e.expected = 'B'; e.slot = ++n.B; }
    else e.expected = 'SR';
    e.day = day;
  }

  const today = [];
  for (const e of timeline.filter((x) => x.source === 'board')) {
    today.push(e);
    if (e.actual && e.actual !== 'MU' && e.actual !== e.expected) {
      flags.push({ rule: 'pool', text: `${e.symbol} ${e.originDay} (ordered ~${fmt(e.order)}) went to ${e.actual} (${e.turn}) but the sequence says ${e.expected}.` });
    }
  }
  for (const e of timeline.filter((x) => x.source === 'lineup' && x.actual)) {
    if (e.actual !== e.expected) {
      flags.push({ rule: 'pool', text: `${e.symbol} ${e.originDay} (ORD ${fmt(e.order)}) is ordered for ${e.actual} but the sequence says ${e.expected}.` });
    }
  }

  // 2. Chain Gang queue at home, in position order, then crews coming home.
  //    Turns already out working (POS 999 / B0) aren't in it. Returning turns
  //    go to the bottom by outer switch time; the Call Board only shows their
  //    Toronto on-duty time, so that stands in for it.
  const working = chainGangHome.filter((t) => t.craft === 'CO' && t.working);
  if (working.length) notes.push(`Out working: ${working.map((t) => `${t.turn}${t.workingOn ? ` on ${t.workingOn}` : ''}`).join(', ')}.`);
  const queue = chainGangHome
    .filter((t) => t.craft === 'CO' && !t.working)
    .sort((a, b) => a.pos - b.pos)
    .map((t) => {
      const hold = t.rn === 'HT';
      const spare = !hold && (t.st === '**' || t.rn === '**');
      return { turn: t.turn, restUntil: t.restUntil, holdUntil: hold ? t.statusUntil : null, spare, spareUntil: spare ? t.statusUntil : null };
    });
  const atHome = new Set(queue.map((q) => q.turn));
  const returning = callBoard
    .filter((t) => t.station !== cfg.homeStation)
    .map((t) => ({ t, co: t.crew.find((c) => c.craft === 'CO') }))
    .filter(({ co }) => co && /^SR/.test(co.turn) && !atHome.has(co.turn))
    .sort((a, b) => a.t.onDuty - b.t.onDuty)
    .map(({ t, co }) => ({ turn: co.turn, returning: true, onDutyAway: t.onDuty, restUntil: null, holdUntil: null, spare: false }));
  queue.push(...returning);
  if (returning.length) {
    notes.push(`Coming home (placed at the bottom by Toronto on-duty time, standing in for outer switch time): ${returning.map((r) => r.turn).join(', ')}.`);
  }
  if (chainGangAway.length) {
    notes.push(`At Toronto, not yet called home: ${chainGangAway.filter((t) => t.craft === 'CO').map((t) => t.turn).join(', ')}.`);
  }

  // A and B pools: first in, first out at home (screens 19/21). Unlike the
  // Chain Gang, an A/B turn that can't be called (rest/reset, hold, **)
  // still takes its train: it goes spare to the spareboard (BOARD-CHECK 7b).
  const abQueue = (list, poolCode) => {
    const q = list
      .filter((t) => t.craft === 'CO' && !t.working)
      .sort((a, b) => a.pos - b.pos)
      .map((t) => ({ turn: t.turn, restUntil: t.restUntil, holdUntil: t.rn === 'HT' ? t.statusUntil : null, spare: t.rn !== 'HT' && (t.st === '**' || t.rn === '**') }));
    const home = new Set(q.map((x) => x.turn));
    callBoard
      .filter((t) => t.station !== cfg.homeStation)
      .map((t) => ({ t, co: t.crew.find((c) => c.craft === 'CO') }))
      .filter(({ co }) => co && co.turn.startsWith(poolCode) && !home.has(co.turn))
      .sort((a, b) => a.t.onDuty - b.t.onDuty)
      .forEach(({ co }) => q.push({ turn: co.turn, returning: true, restUntil: null, holdUntil: null, spare: false }));
    return q;
  };
  const abQueues = { A: aHome.length ? abQueue(aHome, 'SA') : null, B: bHome.length ? abQueue(bHome, 'SB') : null };

  // 3. Walk the line-up in order time: each train's pool, and each Chain Gang
  //    train's turn.
  const predictions = [];
  for (const t of timeline.filter((x) => x.source === 'lineup')) {
    const row = { symbol: t.symbol, originDay: t.originDay, order: t.order, status: t.status, deadhead: t.deadhead, catsPool: t.actual };
    if (t.expected === 'S5') {
      predictions.push({ ...row, pool: 'S5', reason: 'L502/L501 is crewed by S5 and never counts.' });
      continue;
    }
    if (t.expected === 'A' || t.expected === 'B') {
      const other = t.expected === 'A' ? `first ${cfg.aTurnsPerDay} after 0459` : 'A used up';
      const why = [`${t.expected} train #${t.slot} of the road day starting ${t.day} (${other}).`];
      const q = abQueues[t.expected];
      let turn = null;
      let spare = false;
      if (q && q.length) {
        const pick = q.shift();
        const call = callTime(t.order, t.deadhead, cfg);
        turn = pick.turn;
        const resting = (pick.restUntil != null && pick.restUntil >= call) || (pick.holdUntil != null && pick.holdUntil >= call);
        spare = resting || pick.spare;
        why.push(`${turn} is first out.`);
        if (resting) why.push(`It's on rest/hold past the call (~${fmt(call)}) → goes spare to the spareboard.`);
        else if (pick.spare) why.push(`It's marked ** → goes spare to the spareboard.`);
        if (pick.returning) why.push(`${turn} is coming home; assumes it's back by then.`);
      } else if (q) {
        why.push(`No ${t.expected} turn left in line → spareboard.`);
      }
      predictions.push({ ...row, pool: t.expected, turn, spare, reason: why.join(' ') });
      continue;
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
    if (t.actual === 'SR') why.push('CATS has it ordered for the Chain Gang too.');
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

  // 4. The owner: when do I go to work? Either a train on the line-up is
  //    theirs, or they're Nth for the first Chain Gang trains after it, with
  //    turns on rest/hold only counting once their time is up.
  let mine = null;
  if (me) {
    const assigned = predictions.find((p) => p.turn === me);
    const lineupEnd = lineup.length ? Math.max(...lineup.map((t) => t.order)) : null;
    if (assigned) {
      const call = callTime(assigned.order, assigned.deadhead, cfg);
      mine = {
        turn: me, train: `${assigned.symbol} ${assigned.originDay}`, status: assigned.status, deadhead: assigned.deadhead,
        order: assigned.order, onDuty: assigned.order - cfg.prepMinutes[assigned.deadhead ? 'deadhead' : 'train'], call,
      };
    } else {
      const idx = queue.findIndex((q) => q.turn === me);
      if (idx < 0) {
        mine = { turn: me, notFound: true };
      } else {
        const ahead = queue.slice(0, idx).map((q) => ({
          turn: q.turn,
          until: q.holdUntil ?? q.restUntil ?? null,
          why: q.holdUntil != null ? 'hold turn' : q.restUntil != null ? 'rest' : null,
          spare: q.spare,
          returning: !!q.returning,
        }));
        const myQ = queue[idx];
        mine = { turn: me, lineupEnd, ahead, myRestUntil: myQ.restUntil ?? null };
      }
    }
  }

  const crew = crewChecks(callBoard);
  flags.push(...crew.flags);
  notes.push(...crew.notes);

  return { now, today, predictions, me: mine, flags, notes };
}

module.exports = { runBoardCheck, poolOf, callTime, poolFromCrewCode };
