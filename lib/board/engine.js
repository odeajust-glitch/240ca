// The board check itself: given the three parsed screens, work out which
// pool and turn each Sarnia train should get, where the owner stands, and
// what CATS did that breaks the rules. Every rule cites BOARD-CHECK.md.
const defaults = require('./config');
const { at, fmt, roadDay } = require('./time');

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

// Owner (2026-10-16): a train whose manifest number has an odd third digit
// is ordered out of Toronto (M399, Q139, A425), even when CATS shows it on
// duty at Sarnia. Deadheads (DHT031B) carry a running number, not a manifest.
function fromToronto(trainNo) {
  const m = /^[A-Z]+\d\d(\d)$/.exec(trainNo || '');
  return !!m && !/^DH/.test(trainNo) && +m[1] % 2 === 1;
}
const sarniaTrain = (t, cfg) => t.station === cfg.homeStation && !fromToronto(t.trainNo);

function orderTimeFromOnDuty(train, cfg) {
  const kind = /^DH/.test(train.symbol) ? 'deadhead' : 'train';
  return train.onDuty + cfg.prepMinutes[kind];
}

function callTime(order, deadhead, cfg) {
  return order - cfg.prepMinutes[deadhead ? 'deadhead' : 'train'] - cfg.callLeadMinutes;
}

// --- Checks on what CATS has already done (Call Board) ---------------------

function crewChecks(trains, cfg = defaults) {
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
      // MU on L501/L502 is fine (owner, 2026-10-17, replacing "MU is never
      // right on L502").
      if (isExcluded(t.trainNo || t.symbol, cfg)) {
        notes.push(`${label}: ${mu.craft} on ${mu.turn} with ${other.turn}. MU is fine on L501/L502.`);
      } else if (/^MU/.test(other.turn)) {
        // A whole crew off make-up turns is fine (owner, 2026-10-26).
        notes.push(`${label}: ${mu.craft} on ${mu.turn} with ${other.turn}. A make-up crew is fine.`);
      } else if (otherPool === 'SR') {
        notes.push(`${label}: ${mu.craft} on ${mu.turn} with ${other.turn}. Allowed when no Chain Gang turn was available.`);
      } else {
        flags.push({ rule: 'mu', text: `${label}: ${mu.craft} on make-up turn ${mu.turn} with ${other.turn}. MU is never right on an A/B train; possible miscoding.` });
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

// A home Chain Gang list (SR conductors or SD engineers) in position order,
// minus turns out working, with what decides skip/spare for each.
function gangQueue(list) {
  return list
    .filter((t) => !t.working)
    .sort((a, b) => a.pos - b.pos)
    .map((t) => {
      const hold = t.rn === 'HT';
      // ** or B0 (owner: working another job) → the turn goes spare if called.
      // TV (owner, 2026-10-25): the holder is on another turn; this one goes spare, like **.
      const spare = !hold && (t.st === '**' || t.rn === '**' || t.st === 'B0' || t.st === 'TV');
      return { turn: t.turn, restUntil: t.restUntil, holdUntil: hold ? t.statusUntil : null, spare, spareUntil: spare && t.st !== 'B0' ? t.statusUntil : null, b0: t.st === 'B0' };
    });
}

// Rest or hold until 0000 means available at 0000 (owner, 2026-10-17,
// replacing "exactly equal = still on rest"): only rest or a hold turn ending
// after the call keeps a turn off it.
const restsPast = (q, call) => q.restUntil != null && q.restUntil > call;
const heldPast = (q, call) => q.holdUntil != null && q.holdUntil > call;

// First turn in the queue that can be called at `call`; turns on rest or
// hold past it are skipped and keep their place.
function firstCallable(queue, call) {
  const skipped = [];
  for (const q of queue) {
    if (restsPast(q, call)) { skipped.push(`${q.turn} on rest until ${fmt(q.restUntil)}`); continue; }
    if (heldPast(q, call)) { skipped.push(`${q.turn} on hold turn until ${fmt(q.holdUntil)}`); continue; }
    return { pick: q, skipped };
  }
  return { pick: null, skipped };
}

// departed: Sarnia trains an earlier check saw on duty that this Call Board
// no longer shows (lib/board/roadday.js). They count toward their road day's
// A/B trains and nothing else. seenSince: when that unbroken checking began
// (null = no memory).
function runBoardCheck({ now, callBoard, departed = [], seenSince = null, chainGangHome, chainGangAway = [], aHome = [], bHome = [], sdHome = [], s1Home = [], s3Home = [], s5 = [], lineup, me }, overrides = {}) {
  const cfg = { ...defaults, ...overrides };
  const flags = [];
  const notes = [];
  const used = {}; // road day → { A, B }
  const countFor = (day) => (used[day] ||= { A: 0, B: 0 });

  // 1. One timeline of Sarnia departures in order time: trains already on
  //    duty (actual pool from the conductor's turn) and the line-up (actual
  //    pool from CATS's crew code once a train is ORDered).
  const shownNow = new Set(callBoard.map((t) => `${t.symbol}/${t.originDay}`));
  const gone = departed.filter((t) => !shownNow.has(`${t.symbol}/${t.originDay}`));
  const onDuty = [...callBoard.map((t) => [t, 'board']), ...gone.map((t) => [t, 'memory'])]
    .filter(([t]) => sarniaTrain(t, cfg))
    .map(([t, source]) => {
      const co = t.crew.find((c) => c.craft === 'CO');
      const en = t.crew.find((c) => c.craft === 'EN');
      let actual = co ? poolOf(co.turn) : null;
      // A make-up (MU) conductor only stands in on the Chain Gang (owner,
      // 2026-10-17: X27861 16 on MU01 is a Chain Gang train, not A). Unless
      // the engineer is A/B: then it's the miscoding the crew check flags.
      if (actual === 'MU' && !isExcluded(t.trainNo, cfg) && !['A', 'B'].includes(poolOf(en && en.turn))) actual = 'SR';
      return { source, symbol: t.symbol, trainNo: t.trainNo, originDay: t.originDay, deadhead: /^DH/.test(t.symbol),
        order: orderTimeFromOnDuty(t, cfg), onDuty: t.onDuty, turn: co && co.turn, actual };
    });
  const onBoard = new Set([...callBoard, ...gone].map((t) => `${t.symbol}/${t.originDay}`));
  const coming = lineup
    .filter((t) => !onBoard.has(`${t.symbol}/${t.originDay}`) && !fromToronto(t.trainNo))
    .map((t) => ({ source: 'lineup', symbol: t.symbol, trainNo: t.trainNo, originDay: t.originDay, deadhead: t.deadhead,
      order: t.order, status: t.status, actual: t.status === 'ORD' ? poolFromCrewCode(t.trnCrew) : null }));
  const timeline = [...onDuty, ...coming].sort((a, b) => a.order - b.order);

  // A road day's A/B slots go to the trains already called first (on the
  // Call Board, remembered, or ordered with CATS's crew code), in order time,
  // then to the ones still to come (owner, 2026-10-29: M38261 29, called
  // for 1645 as the second B, showed "should be SR" because a train still
  // planned for 1500 took that slot first).
  const called = (e) => (e.source === 'lineup' && !e.actual ? 1 : 0);
  const slotOrder = [...timeline].sort((a, b) => {
    const da = roadDay(a.order, cfg.dayStartMinutes);
    const db = roadDay(b.order, cfg.dayStartMinutes);
    return da < db ? -1 : da > db ? 1 : called(a) - called(b) || a.order - b.order;
  });
  for (const e of slotOrder) {
    if (isExcluded(e.trainNo, cfg)) { e.expected = 'S5'; continue; }
    if (e.deadhead) { e.expected = 'SR'; continue; }
    const day = roadDay(e.order, cfg.dayStartMinutes);
    const n = countFor(day);
    // A train went to the Chain Gang with that road day's A/B count short:
    // the rest ran before this snapshot (e.g. a 0143 run sees none of the
    // previous morning). Trust CATS that A and B are used up. Unless the
    // memory has watched since before the road day began: then every train
    // of it was seen and the count stands.
    const [y, mo, d] = day.split('-').map(Number);
    const wholeDay = seenSince != null && seenSince <= at(y, mo, d) + cfg.dayStartMinutes;
    if (e.actual === 'SR' && !wholeDay && (n.A < cfg.aTurnsPerDay || n.B < cfg.bTurnsPerDay)) {
      if (n.A || n.B) notes.push(`Road day starting ${day}: only ${n.A} A / ${n.B} B of its trains were seen; ${e.symbol} ${e.originDay} going to the Chain Gang means the rest are used up.`);
      else notes.push(`Road day starting ${day}: its A/B trains aren't on this snapshot; ${e.symbol} ${e.originDay} going to the Chain Gang means they're used up.`);
      n.A = cfg.aTurnsPerDay;
      n.B = cfg.bTurnsPerDay;
      e.expected = 'SR';
      e.day = day;
      continue;
    }
    // Same for the first B train of a road day: B comes after A, so the A
    // trains we haven't seen left before this snapshot (owner, 2026-10-15:
    // SB01/SB02 were already out on the 15th's B trains, yet SB03 was given one).
    if (e.actual === 'B' && n.B === 0 && n.A < cfg.aTurnsPerDay) {
      n.A = cfg.aTurnsPerDay;
      notes.push(`Road day starting ${day}: ${e.symbol} ${e.originDay} went to the B pool, so its A trains are used up (the rest left before this snapshot).`);
    }
    if (n.A < cfg.aTurnsPerDay) { e.expected = 'A'; e.slot = ++n.A; }
    else if (n.B < cfg.bTurnsPerDay) { e.expected = 'B'; e.slot = ++n.B; }
    else e.expected = 'SR';
    e.day = day;
  }

  const remembered = timeline.filter((e) => e.source === 'memory' && e.expected && e.expected !== 'S5');
  if (remembered.length) {
    notes.push(`Counted from earlier checks (gone from the Call Board): ${remembered.map((e) => `${e.symbol} ${e.originDay} (${e.actual || e.expected}${e.turn ? ` ${e.turn}` : ''})`).join(', ')}.`);
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
  const queue = gangQueue(chainGangHome.filter((t) => t.craft === 'CO'));
  // Turns on their way home can't come up in Sarnia until they're back on
  // the Sarnia list (owner), so they're reported but never given a train.
  const atHome = new Set(queue.map((q) => q.turn));
  const returning = callBoard
    .filter((t) => t.station !== cfg.homeStation)
    .map((t) => ({ t, co: t.crew.find((c) => c.craft === 'CO') }))
    .filter(({ co }) => co && /^SR/.test(co.turn) && !atHome.has(co.turn))
    .sort((a, b) => a.t.onDuty - b.t.onDuty)
    .map(({ t, co }) => ({ turn: co.turn, train: `${t.symbol} ${t.originDay}`, onDutyAway: t.onDuty }));
  if (returning.length) {
    notes.push(`Coming home, not in the Sarnia line until they tie up: ${returning.map((r) => `${r.turn} (${r.train})`).join(', ')}.`);
  }
  if (chainGangAway.length) {
    notes.push(`At Toronto, not yet called home: ${chainGangAway.filter((t) => t.craft === 'CO').map((t) => t.turn).join(', ')}.`);
  }

  // A and B pools: first in, first out at home (screens 19/21). Unlike the
  // Chain Gang, an A/B turn that can't be called (rest/reset, hold, **)
  // still takes its train: it goes spare to the spareboard (BOARD-CHECK 7b).
  // `craft` null: an engineer list (S1/S3), already one row per turn.
  const abQueue = (list, craft = 'CO') => {
    const q = list
      .filter((t) => (!craft || t.craft === craft) && !t.working)
      .sort((a, b) => a.pos - b.pos)
      .map((t) => ({ turn: t.turn, restUntil: t.restUntil, holdUntil: t.rn === 'HT' ? t.statusUntil : null, spare: t.rn !== 'HT' && (t.st === '**' || t.rn === '**' || t.st === 'B0' || t.st === 'TV'), b0: t.st === 'B0' }));
    // Crews still in Toronto can't be called in Sarnia: only home turns count.
    return q;
  };
  const abQueues = { A: aHome.length ? abQueue(aHome) : null, B: bHome.length ? abQueue(bHome) : null };

  // Line-up trains whose crew is already known (owner, 2026-10-21: DHT042B
  // showed no crew with SR09 out working on it): called (POS 999, out working
  // on it) or on duty on the Call Board. They keep that crew and take no turn
  // from the queues. "Out working on M39671" is the Call Board's M39671 when
  // that turn is on it there, not a later M39671 on the line-up.
  const crewPool = (turn) => ({ A: 'A', B: 'B' }[poolOf(turn)] || 'SR');
  const onBoardWith = (symbol, turn) => callBoard.some((b) => b.symbol === symbol && b.crew.some((c) => c.turn === turn));
  const calledFor = (list) => new Map(list.filter((t) => t.working && t.workingOn && !onBoardWith(t.workingOn, t.turn)).map((t) => [t.workingOn, t.turn]));
  const calledCo = calledFor([...chainGangHome, ...aHome, ...bHome].filter((t) => t.craft === 'CO'));
  const calledEn = calledFor([...sdHome, ...s1Home, ...s3Home].filter((t) => t.craft !== 'CO'));

  // 3. Walk the line-up in order time: each train's pool, and each Chain Gang
  //    train's turn.
  const predictions = [];
  for (const t of timeline.filter((x) => x.source === 'lineup')) {
    const row = { symbol: t.symbol, originDay: t.originDay, order: t.order, call: callTime(t.order, t.deadhead, cfg), status: t.status, deadhead: t.deadhead, catsPool: t.actual };
    if (t.expected === 'S5') {
      // L502 out of Sarnia goes to the first crew up on 501/502 (option 29),
      // engineer and conductor (owner, 2026-10-25), each like A/B: one that
      // can't be called goes spare. They bring L501 home from Garnet. (The
      // board not read: no crew shown.) MU turns are placeholders.
      const up = s5.filter((x) => /^S5\d{2}$/.test(x.turn) && !x.terminal).sort((a, b) => a.pos - b.pos)[0];
      const crewTurn = up && up.turn;
      const s502 = (craft) => s5.find((x) => x.turn === crewTurn && (craft === 'CO' ? x.craft === 'CO' : /^(EN|LE)$/.test(x.craft)));
      if (/^L502/.test(t.symbol) && crewTurn) {
        const why = (x) => (!x ? 'not on the 501/502 board' : x.terminal ? 'away from Sarnia' : x.working ? 'out working'
          : x.st === 'TV' ? 'TV (temporary vacancy)' : (x.st === '**' || x.rn === '**') ? 'marked **' : x.st === 'B0' ? 'B0 (working another job)'
            : x.rn === 'HT' && (x.statusUntil == null || x.statusUntil > row.call) ? 'on a hold turn past the call'
              : x.restUntil != null && x.restUntil > row.call ? `on rest until ${fmt(x.restUntil)}` : null);
        const co = why(s502('CO'));
        const en = why(s502('EN'));
        predictions.push({ ...row, pool: 'S5', turn: crewTurn, spare: !!co, engineer: crewTurn, engineerSpare: !!en, s5: true,
          reason: `L502 goes to the first crew up on 501/502 (option 29): ${crewTurn}, position ${String(up.pos).padStart(3, '0')} (they bring L501 home from Garnet). Conductor: ${co ? `${co} → goes spare` : 'available'}. Engineer: ${en ? `${en} → goes spare` : 'available'}.` });
        continue;
      }
      predictions.push({ ...row, pool: 'S5', reason: 'L502/L501 is crewed by S5 and never counts.' });
      continue;
    }
    // Only a train they could be called for by now: ordered, or its call
    // within the hour (owner, 2026-10-28: SA08 "out working on M30241" was on
    // the morning's M30241 26, not M30241 27 planned for the next night;
    // CATS shows the symbol only).
    const callable = t.status === 'ORD' || row.call - now <= 60;
    const co = callable && calledCo.get(t.symbol);
    if (co) {
      const en = calledEn.get(t.symbol) || null;
      calledCo.delete(t.symbol); // a second line-up train with this symbol isn't theirs
      calledEn.delete(t.symbol);
      predictions.push({ ...row, pool: crewPool(co), turn: co, engineer: en, known: true,
        reason: `${co} is already called for it${en ? `, with ${en}` : ''} (POS 999, out working on ${t.symbol}).` });
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
        const resting = restsPast(pick, call) || heldPast(pick, call);
        spare = resting || pick.spare;
        why.push(`${turn} is first out.`);
        if (resting) why.push(`It's on rest/hold past the call (~${fmt(call)}) → goes spare to the spareboard.`);
        else if (pick.spare) why.push(`It's ${pick.b0 ? 'B0 (working another job)' : 'marked **'} → goes spare to the spareboard.`);
      } else if (q) {
        why.push(`No ${t.expected} turn at home in Sarnia → goes spare to the spareboard.`);
      }
      predictions.push({ ...row, pool: t.expected, turn, spare, reason: why.join(' ') });
      continue;
    }
    const call = callTime(t.order, t.deadhead, cfg);
    const { pick, skipped } = firstCallable(queue, call);
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
    if (goesSpare) why.push(`${pick.turn} is ${pick.b0 ? 'B0 (working another job)' : 'marked **'} → the turn goes out with a spareboard employee.`);
    predictions.push({ ...row, pool: 'SR', turn: pick.turn, spare: goesSpare, reason: why.join(' ') });
  }

  // Line-up trains already on duty: the crew CATS shows on the Call Board.
  for (const t of lineup) {
    const b = callBoard.find((x) => x.symbol === t.symbol && x.originDay === t.originDay);
    if (!b || fromToronto(t.trainNo)) continue;
    const row = { symbol: t.symbol, originDay: t.originDay, order: t.order, call: callTime(t.order, t.deadhead, cfg), status: t.status, deadhead: t.deadhead,
      catsPool: t.status === 'ORD' ? poolFromCrewCode(t.trnCrew) : null, onDutyAt: b.onDuty };
    if (isExcluded(t.trainNo || t.symbol, cfg)) {
      predictions.push({ ...row, pool: 'S5', reason: 'L502/L501 is crewed by S5 and never counts.' });
      continue;
    }
    const co = b.crew.find((c) => c.craft === 'CO');
    const en = b.crew.find((c) => c.craft === 'EN');
    predictions.push({ ...row, pool: crewPool(co && co.turn), turn: co ? co.turn : null, engineer: en ? en.turn : null, known: true,
      reason: `On duty at ${fmt(b.onDuty)} (Call Board): ${[co && co.turn, en && en.turn].filter(Boolean).join(' + ') || 'no crew shown'}, as CATS shows it.` });
  }
  predictions.sort((a, b) => a.order - b.order);

  // 3b. Engineers (owner, 2026-10-15): the SD list on option 27 goes with
  //     the Chain Gang trains in the same order and by the same rules.
  if (sdHome.length) {
    const sdQueue = gangQueue(sdHome);
    for (const p of predictions.filter((x) => x.pool === 'SR' && !x.known)) {
      const { pick, skipped } = firstCallable(sdQueue, p.call);
      if (!pick) {
        // No SD turn can be called in time (owner, 2026-10-25: M39671 showed
        // no engineer at all): it goes to the spareboard, like a conductor.
        p.engineerNone = 'SD';
        p.reason = `${p.reason || ''} No SD engineer available at the call${skipped.length ? ` (${skipped.join('; ')})` : ''} → spareboard.`.trim();
        continue;
      }
      sdQueue.splice(sdQueue.indexOf(pick), 1);
      p.engineer = pick.turn;
      p.engineerSpare = pick.spare && (!cfg.starsHaveExpiry || pick.spareUntil == null || pick.spareUntil >= p.call);
    }
  }

  // 3c. Engineers on A and B trains (owner, 2026-10-16): S1 goes with A, S3
  //     with B, first in first out like A/B: a turn that can't be called
  //     (rest/reset, hold, **, B0) still takes the train and goes spare.
  for (const [pool, list] of [['A', s1Home], ['B', s3Home]]) {
    if (!list.length) continue;
    const q = abQueue(list, null);
    for (const p of predictions.filter((x) => x.pool === pool && !x.known)) {
      const pick = q.shift();
      if (!pick) {
        p.engineerNone = pool === 'A' ? 'S1' : 'S3';
        p.reason = `${p.reason || ''} No ${p.engineerNone} engineer left on the list → spareboard.`.trim();
        continue;
      }
      const resting = restsPast(pick, p.call) || heldPast(pick, p.call);
      p.engineer = pick.turn;
      p.engineerSpare = resting || pick.spare;
    }
  }

  // 4. The owner: when do I go to work? Either a train on the line-up is
  //    theirs, or they're Nth for the first Chain Gang trains after it, with
  //    turns on rest/hold only counting once their time is up.
  let mine = null;
  if (me) {
    const assigned = predictions.find((p) => p.turn === me && !p.onDutyAt); // on duty already: not "when do I go"
    const lineupEnd = lineup.length ? Math.max(...lineup.map((t) => t.order)) : null;
    if (assigned) {
      const call = callTime(assigned.order, assigned.deadhead, cfg);
      mine = {
        turn: me, train: `${assigned.symbol} ${assigned.originDay}`, status: assigned.status, deadhead: assigned.deadhead,
        order: assigned.order, onDuty: assigned.order - cfg.prepMinutes[assigned.deadhead ? 'deadhead' : 'train'], call,
      };
    } else {
      const idx = queue.findIndex((q) => q.turn === me);
      const homeward = returning.find((r) => r.turn === me);
      if (idx < 0 && homeward) {
        mine = { turn: me, comingHome: homeward.train, onDutyAway: homeward.onDutyAway };
      } else if (idx < 0) {
        mine = { turn: me, notFound: true };
      } else {
        const ahead = queue.slice(0, idx).map((q) => ({
          turn: q.turn,
          until: q.holdUntil ?? q.restUntil ?? null,
          why: q.holdUntil != null ? 'hold turn' : q.restUntil != null ? 'rest' : null,
          spare: q.spare,
        }));
        const myQ = queue[idx];
        mine = { turn: me, lineupEnd, ahead, myRestUntil: myQ.restUntil ?? null };
      }
    }
  }

  const crew = crewChecks(callBoard, cfg);
  flags.push(...crew.flags);
  notes.push(...crew.notes);

  // The board as CATS shows it, for the report (the queue above is used up).
  const byPos = (a, b) => a.pos - b.pos;
  const chainGang = {
    home: chainGangHome.filter((t) => t.craft === 'CO').sort(byPos),
    sd: [...sdHome].sort(byPos),
    s1: [...s1Home].sort(byPos),
    s3: [...s3Home].sort(byPos),
    away: chainGangAway.filter((t) => t.craft === 'CO').sort(byPos),
    returning,
  };

  // Ordered line-up trains whose pool CATS already shows, with what the
  // sequence says (for the out-of-sequence tracker, owner 2026-10-26).
  const ahead = timeline.filter((e) => e.source === 'lineup' && e.actual && e.expected);
  return { now, today, ahead, predictions, chainGang, me: mine, flags, notes };
}

// A Mac yard (Toronto) train's expected call: order − 2 h (owner, 2026-10-29).
function torontoCallTime(order, cfg = defaults) {
  return order - (cfg.torontoCallMinutes ?? cfg.callLeadMinutes);
}

module.exports = { runBoardCheck, poolOf, callTime, torontoCallTime, poolFromCrewCode, fromToronto, isExcluded };
