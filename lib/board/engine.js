// The board check itself: given the three parsed screens, work out which
// pool and turn each Sarnia train should get, where the owner stands, and
// what CATS did that breaks the rules. Every rule cites BOARD-CHECK.md.
const defaults = require('./config');
const { offAt, maybeOff, offText } = require('./daysoff');
const { at, fmt, roadDay, nearestDay } = require('./time');

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
const isRescue = (symbol) => /^R[A-Z]*\d/.test(symbol || '');
const sarniaTrain = (t, cfg) => t.station === cfg.homeStation && (isRescue(t.symbol) || !fromToronto(t.trainNo));

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
      return { turn: t.turn, restUntil: t.restUntil, off: t.off, holdUntil: hold ? t.statusUntil : null, spare, spareUntil: spare && t.st !== 'B0' ? t.statusUntil : null, b0: t.st === 'B0' };
    });
}

// Rest or hold until 0000 means available at 0000 (owner, 2026-10-17,
// replacing "exactly equal = still on rest"): only rest or a hold turn ending
// after the call keeps a turn off it.
const restsPast = (q, call) => q.restUntil != null && q.restUntil > call;
const heldPast = (q, call) => q.holdUntil != null && q.holdUntil > call;

// Why a turn's job goes spare, as words after the turn ("SA09 has a PL @
// 6th 0001"), for the spare told to expect the call (owner, 2026-11-05).
function spareWhy(q, call) {
  const o = offAt(q, call);
  if (o) return `has a ${offText(o)}`;
  if (restsPast(q, call)) return `is on rest until ${fmt(q.restUntil)}`;
  if (heldPast(q, call)) return `is on a hold turn until ${fmt(q.holdUntil)}`;
  if (q.b0) return 'is B0 (working another job)';
  if (q.spare) return 'is marked **';
  return 'can\'t be called';
}

// A road job whose turn has a PL 24–36 h after going on duty (owner,
// 2026-11-05): it may go spare; the spare who'd cover it is warned.
const maybeWhy = (q, call) => { const m = q && maybeOff(q, call); return m ? `has a ${offText(m)}` : null; };

// First turn in the queue that can be called at `call`; turns on rest or
// hold past it are skipped and keep their place.
// skipSpare (reset alerts, owner 2026-11-05): when the turn ahead is put on
// a reset at the call, the job goes to the next turn that can work it; **
// and B0 turns are passed over too, and it only goes spare if no one after
// them is available.
function firstCallable(queue, call, { skipSpare = false, starsHaveExpiry = false } = {}) {
  const skipped = [];
  for (const q of queue) {
    if (restsPast(q, call)) { skipped.push(`${q.turn} on rest until ${fmt(q.restUntil)}`); continue; }
    if (heldPast(q, call)) { skipped.push(`${q.turn} on hold turn until ${fmt(q.holdUntil)}`); continue; }
    if (skipSpare && q.spare && (!starsHaveExpiry || q.spareUntil == null || q.spareUntil >= call)) { skipped.push(`${q.turn} ${q.b0 ? 'B0' : 'marked **'}`); continue; }
    // Days off at the call (option 4, owner 2026-11-05: "it will go spare"):
    // the turn takes its train and goes spare, like **; skipped only where
    // ** turns are (the reset "what if" run).
    const o = offAt(q, call);
    if (o && skipSpare) { skipped.push(`${q.turn} ${offText(o)}`); continue; }
    return { pick: q, skipped };
  }
  return { pick: null, skipped };
}

// departed: Sarnia trains an earlier check saw on duty that this Call Board
// no longer shows (lib/board/roadday.js). They count toward their road day's
// A/B trains and nothing else. seenSince: when that unbroken checking began
// (null = no memory).
function runBoardCheck({ now, callBoard, departed = [], seenSince = null, chainGangHome, chainGangAway = [], aHome = [], bHome = [], sdHome = [], s1Home = [], s3Home = [], s5 = [], garnetLineup = [], lineup, vacancies = [], me, resetJob = null }, overrides = {}) {
  const cfg = { ...defaults, ...overrides };
  // resetJob { train: `${symbol}@${order}`, role }: reset alerts' "what if"
  // run, where the Chain Gang / SD turn for that job is on a reset.
  const skipFor = (symbol, order, role) => ({ skipSpare: !!resetJob && resetJob.role === role && resetJob.train === `${symbol}@${order}`, starsHaveExpiry: cfg.starsHaveExpiry });
  const flags = [];
  const notes = [];
  const used = {}; // road day → { A, B }
  const countFor = (day) => (used[day] ||= { A: 0, B: 0 });

  // 1. One timeline of Sarnia departures in order time: trains already on
  //    duty (actual pool from the conductor's turn) and the line-up (actual
  //    pool from CATS's crew code once a train is ORDered).
  const shownNow = new Set(callBoard.map((t) => `${t.symbol}/${t.originDay}`));
  // A current lineup row supersedes an older remembered departure with
  // the same printed identity. It must get a fresh sequence prediction,
  // without counting the remembered row a second time.
  const linedNow = new Set(lineup.map((t) => `${t.symbol}/${t.originDay}`));
  const gone = departed.filter((t) => !shownNow.has(`${t.symbol}/${t.originDay}`) && !linedNow.has(`${t.symbol}/${t.originDay}`));
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
  const tripKey = (t, time) => cfg.s5Review && /^L502/.test(t.symbol)
    ? t.symbol + '/' + nearestDay(time, Number(t.originDay), 12, 0)
    : t.symbol + '/' + t.originDay;
  const onBoard = new Set([...callBoard, ...gone].map(t => tripKey(t, t.onDuty)));
  const coming = lineup
    .filter((t) => !onBoard.has(tripKey(t, t.order)) && (isRescue(t.symbol) || !fromToronto(t.trainNo)))
    .map((t) => ({ source: 'lineup', symbol: t.symbol, trainNo: t.trainNo, originDay: t.originDay, deadhead: t.deadhead,
      order: t.order, status: t.status, actual: t.status === 'ORD' ? poolFromCrewCode(t.trnCrew) : null,
      rescueSpare: isRescue(t.symbol) && (() => {
        const jobs = vacancies.filter((j) => !j.yard && j.train === t.symbol && j.at != null && Math.abs(j.at - t.order) <= 15 && /^(CO|EN|LE)$/.test(j.cc));
        const noTurn = (j) => !String(j.turn || '').trim() || /^[-*]+$/.test(String(j.turn).trim());
        return jobs.some((j) => j.cc === 'CO') && jobs.some((j) => /^(EN|LE)$/.test(j.cc)) && jobs.every(noTurn);
      })() }));
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
    if (e.rescueSpare) { e.expected = 'SPARE'; continue; }
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
    if (e.source !== 'lineup' && e.actual === 'SR' && !wholeDay && (n.A < cfg.aTurnsPerDay || n.B < cfg.bTurnsPerDay)) {
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
    if (e.source !== 'lineup' && e.actual === 'B' && n.B === 0 && n.A < cfg.aTurnsPerDay) {
      n.A = cfg.aTurnsPerDay;
      notes.push(`Road day starting ${day}: ${e.symbol} ${e.originDay} went to the B pool, so its A trains are used up (the rest left before this snapshot).`);
    }
    // Owner correction, 2026-11-07: ordered Sarnia trains follow the
    // calculated sequence. CATS's differing pool stays diagnostic only.
    e.expected = n.A < cfg.aTurnsPerDay ? 'A' : n.B < cfg.bTurnsPerDay ? 'B' : 'SR';
    const use = e.expected;
    if (use === 'A') e.slot = ++n.A;
    else if (use === 'B') e.slot = ++n.B;
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
      .map((t) => ({ turn: t.turn, restUntil: t.restUntil, off: t.off, holdUntil: t.rn === 'HT' ? t.statusUntil : null, spare: t.rn !== 'HT' && (t.st === '**' || t.rn === '**' || t.st === 'B0' || t.st === 'TV'), b0: t.st === 'B0' }));
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

  // 501/502 crews in the order they take the next L502 (see the S5 case below):
  // owner correction: use regular option-29 position; MU is a placeholder.
  const s5Out = (rows) => rows.some((x) => x.working && /^L502/.test(x.workingOn || ''));
  const s5Coming = (rows) => !s5Out(rows) && rows.some((x) => x.terminal || (x.working && /^L501/.test(x.workingOn || '')));
  // Owner, 2026-11-07: regular S5 board position determines who goes.
  // MU is a placeholder; rest/PL/hold decides craft coverage, never order.
  const s5Crews = [...new Set(s5.filter((x) => /^S5\d{2}$/.test(x.turn)).map((x) => x.turn))]
    .map((turn) => {
      const rows = s5.filter((x) => x.turn === turn);
      return { turn, pos: Math.min(...rows.map((x) => x.pos)),
        // Terminal-local positions can both be 001 after tying up in Garnet.
        // At equal position, home precedes away; an outbound L502 is last.
        // PL/rest/hold and MU never decide this tie or reorder distinct positions.
        locationRank: s5Out(rows) ? 2 : rows.some((x) => x.terminal) ? 1 : 0 };
    })
    .sort((a, b) => a.pos - b.pos || a.locationRank - b.locationRank || a.turn.localeCompare(b.turn));
  const s5Order = s5Crews.map((c) => c.turn);
  let s5Next = 0;

  // 3. Walk the line-up in order time: each train's pool, and each Chain Gang
  //    train's turn.
  const predictions = [];
  for (const t of timeline.filter((x) => x.source === 'lineup')) {
    const row = { symbol: t.symbol, originDay: t.originDay, order: t.order, call: callTime(t.order, t.deadhead, cfg), status: t.status, deadhead: t.deadhead, catsPool: t.actual };
    if (t.rescueSpare) {
      predictions.push({ ...row, pool: 'SPARE', rescueSpare: true, turn: null, spare: true,
        engineer: null, engineerSpare: true, engineerNone: 'rescue',
        spareWhy: 'rescue listed spare for both crafts with no turn',
        engineerSpareWhy: 'rescue listed spare for both crafts with no turn',
        reason: 'Sarnia rescue: option 5 lists conductor and engineer spare without a turn; both crafts → spareboard. Call is lineup time minus 2 h 15 m. No regular pool turn is consumed.' });
      continue;
    }
    if (t.expected === 'S5') {
      // L502 out of Sarnia: the two 501/502 crews alternate (owner,
      // 2026-11-03: "S501 should work it, it alternates"). The crew that just
      // took an L502 to Garnet is last; the one bringing L501 home (or still
      // at Garnet) is next; a crew home in Sarnia and not out on a 502 goes
      // first (then by option 29 position). Each later L502 on the line-up
      // goes to the next crew in that order. Engineer and conductor (owner,
      // 2026-10-25), each like A/B: one that can't be called goes spare.
      // (The board not read: no crew shown.) MU turns are placeholders.
      // A crew already called for this L502 (ordered or due within the hour,
      // out working on it) keeps it and takes nobody's turn.
      const calledS5 = !cfg.s5Review && (t.status === 'ORD' || row.call - now <= 60) && s5.find((x) => /^S5\d{2}$/.test(x.turn) && x.working && x.workingOn === t.symbol);
      if (/^L502/.test(t.symbol) && calledS5) {
        predictions.push({ ...row, pool: 'S5', turn: calledS5.turn, spare: false, engineer: calledS5.turn, engineerSpare: false, s5: true, known: true,
          reason: `${calledS5.turn} is already called for it (out working on ${t.symbol}).` });
        continue;
      }
      if (/^L502/.test(t.symbol) && s5Order.length) {
        const crewTurn = s5Order[s5Next % s5Order.length];
        s5Next += 1;
        const rows = s5.filter((x) => x.turn === crewTurn);
        const s502 = (craft) => rows.find((x) => (craft === 'CO' ? x.craft === 'CO' : /^(EN|LE)$/.test(x.craft)));
        const coming = s5Coming(rows);
        // Still on duty bringing L501 home: CATS shows them working (B0 and
        // the like), so whether they go spare isn't known until they're off
        // duty (owner, 2026-11-03).
        const stillOut = coming && rows.some((x) => x.working);
        // A hold turn (HT) decides it, as in the other pools: ** beside HT
        // isn't spare by itself (owner, 2026-11-03: JUOD on S501 CO, ** HT
        // RETN 3rd 0559, was shown going spare for L50231 04 at 4th 0145).
        const why = (x) => (stillOut ? null : !x ? 'not on the 501/502 board' : offAt(x, row.call) ? offText(offAt(x, row.call)) : x.st === 'TV' ? 'TV (temporary vacancy)'
          : x.rn === 'HT' ? (x.statusUntil == null || x.statusUntil > row.call ? 'on a hold turn past the call' : null)
            : (x.st === '**' || x.rn === '**') ? 'marked **' : x.st === 'B0' ? 'B0 (working another job)'
              : x.restUntil != null && x.restUntil > row.call ? `on rest until ${fmt(x.restUntil)}`
                : coming ? null
                  : x.terminal ? 'away from Sarnia' : x.working ? 'out working' : null);
        // An undated working row can support a provisional prediction only for
        // this craft, near its call, with no competing trip for that turn.
        const coverage = craft => {
          const x = s502(craft);
          const conflict = record => record.symbol === t.symbol &&
            (record.crew || []).some(c => c.turn === crewTurn && c.craft === x?.craft);
          if (cfg.s5Review && x?.working && x.workingOn === t.symbol && !x.terminal &&
              Math.abs(row.call - now) <= 60 && ![...callBoard, ...departed].some(conflict) &&
              lineup.filter(record => record.symbol === t.symbol && Math.abs(callTime(record.order, record.deadhead, cfg) - now) <= 60).length === 1) {
            return why({ ...x, working: false });
          }
          return why(x);
        };
        const co = coverage('CO');
        const en = coverage('EN');
        const up = Math.min(...rows.map((x) => x.pos));
        // Still bringing L501 home: whether either goes spare can't be told
        // until they're off duty (owner, 2026-11-03), unless already known.
        const pending = stillOut;
        // L501 out of Garnet (option 41 for 47956, owner 2026-11-03): the
        // train bringing them home, planned or ordered.
        const l501 = coming ? garnetLineup.filter((g) => /^L501/.test(g.symbol) && g.order != null && g.order <= row.call).sort((a, b) => a.order - b.order).pop() : null;
        const where = !rows.length ? 'not listed on the 501/502 board' : coming ? `next: they bring L501 home from Garnet${l501 ? `; ${l501.symbol} ${l501.originDay} ${l501.status} out of Garnet ${fmt(l501.order)}` : ''}` : `home in Sarnia, position ${String(up).padStart(3, '0')}`;
        const crafts = pending ? `Whether either goes spare is known once ${crewTurn} is off duty.`
          : `Conductor: ${co ? `${co} → goes spare` : 'available'}. Engineer: ${en ? `${en} → goes spare` : 'available'}.`;
        // s5Away: out on a 502, at Garnet or bringing L501 home: not off
        // duty in Sarnia yet (owner, 2026-11-05: no L502 alerts until then).
        const away = rows.some((x) => x.terminal || x.working);
        predictions.push({ ...row, pool: 'S5', turn: crewTurn, spare: !!co, engineer: crewTurn, engineerSpare: !!en, s5: true, s5Pending: pending, s5Away: away, coWhy: co, enWhy: en,
          spareWhy: co ? `${/^PL/.test(co) ? 'has a' : 'is'} ${co}` : null, engineerSpareWhy: en ? `${/^PL/.test(en) ? 'has a' : 'is'} ${en}` : null,
          spareMaybe: !co && !pending ? maybeWhy(s502('CO'), row.call) : null, engineerSpareMaybe: !en && !pending ? maybeWhy(s502('EN'), row.call) : null,
          reason: `L502 follows regular 501/502 board position (option 29): ${crewTurn} (${where}). ${crafts}` });
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
    let co = callable && calledCo.get(t.symbol);
    // An A or B train with a make-up (MU) placeholder on it (owner,
    // 2026-11-03: "if its expecting an A pool turn, and it goes spare it
    // should show the actual turn going out still, same with B pool"): the
    // A/B turn whose train it is goes spare and is shown; MU isn't a turn.
    // Not for the Chain Gang, SD or 501/502.
    const placeholder = co && /^MU/.test(co) && (t.expected === 'A' || t.expected === 'B') ? co : null;
    if (placeholder) { calledCo.delete(t.symbol); calledEn.delete(t.symbol); co = null; }
    if (co) {
      const en = calledEn.get(t.symbol) || null;
      calledCo.delete(t.symbol); // a second line-up train with this symbol isn't theirs
      calledEn.delete(t.symbol);
      predictions.push({ ...row, pool: crewPool(co), turn: co, engineer: en, known: true,
        reason: `${co} is already called for it${en ? `, with ${en}` : ''} (POS 999, out working on ${t.symbol}).` });
      continue;
    }
    const pool = t.expected;
    const mismatch = t.status === 'ORD' && t.actual && t.actual !== t.expected;
    const orderNote = mismatch ? `CATS has it ordered for ${t.actual}, but the calling sequence says ${t.expected}; following the calling sequence.` : '';
    if (pool === 'A' || pool === 'B') {
      const other = pool === 'A' ? `first ${cfg.aTurnsPerDay} after 0459` : 'A used up';
      const why = [`${pool} train #${t.slot} of the road day starting ${t.day} (${other}).`, ...(orderNote ? [orderNote] : [])];
      const q = abQueues[pool];
      let turn = null;
      let spare = false;
      let spareFor = null;
      let maybeFor = null;
      if (q && q.length) {
        const pick = q.shift();
        const call = callTime(t.order, t.deadhead, cfg);
        turn = pick.turn;
        const resting = restsPast(pick, call) || heldPast(pick, call);
        const off = offAt(pick, call);
        spare = resting || !!off || pick.spare;
        if (spare) spareFor = spareWhy(pick, call);
        else maybeFor = maybeWhy(pick, call);
        why.push(`${turn} is first out.`);
        if (off) why.push(`It's ${offText(off)} at the call (~${fmt(call)}) → goes spare to the spareboard.`);
        else if (resting) why.push(`It's on rest/hold past the call (~${fmt(call)}) → goes spare to the spareboard.`);
        else if (pick.spare) why.push(`It's ${pick.b0 ? 'B0 (working another job)' : 'marked **'} → goes spare to the spareboard.`);
      } else if (q) {
        why.push(`No ${pool} turn at home in Sarnia → goes spare to the spareboard.`);
      }
      if (placeholder && turn) { spare = true; spareFor = spareFor || `has ${placeholder} (a make-up placeholder) on its train`; why.push(`${placeholder} (a make-up placeholder) is on it, so ${turn}'s train goes spare.`); }
      if (spare) maybeFor = null;
      if (maybeFor) why.push(`${turn} ${maybeFor}: it may go spare.`);
      predictions.push({ ...row, pool, turn, spare, spareWhy: spareFor, spareMaybe: maybeFor, reason: why.join(' ') });
      continue;
    }
    const call = callTime(t.order, t.deadhead, cfg);
    const { pick, skipped } = firstCallable(queue, call, skipFor(t.symbol, t.order, 'CO'));
    const why = [t.deadhead ? 'Deadhead → always the next Chain Gang turn.' : 'A and B used up for this road day → Chain Gang.', ...(orderNote ? [orderNote] : [])];
    if (t.actual === 'SR' && !mismatch) why.push('CATS has it ordered for the Chain Gang too.');
    why.push(`Called ~${fmt(call)}.`);
    if (skipped.length) why.push(`Skipped (keep their place): ${skipped.join('; ')}.`);
    if (!pick) {
      predictions.push({ ...row, pool: 'SR', turn: null, reason: `${why.join(' ')} No Chain Gang turn available → spareboard.` });
      continue;
    }
    queue.splice(queue.indexOf(pick), 1);
    const off = offAt(pick, call);
    const goesSpare = !!off || (pick.spare && (!cfg.starsHaveExpiry || pick.spareUntil == null || pick.spareUntil >= call));
    if (off) why.push(`${pick.turn} is ${offText(off)} at the call → the turn goes out with a spareboard employee.`);
    else if (goesSpare) why.push(`${pick.turn} is ${pick.b0 ? 'B0 (working another job)' : 'marked **'} → the turn goes out with a spareboard employee.`);
    const maybe = goesSpare ? null : maybeWhy(pick, call);
    if (maybe) why.push(`${pick.turn} ${maybe}: it may go spare.`);
    predictions.push({ ...row, pool: 'SR', turn: pick.turn, spare: goesSpare, spareWhy: goesSpare ? spareWhy(pick, call) : null, spareMaybe: maybe, reason: why.join(' ') });
  }

  // Line-up trains already on duty: the crew CATS shows on the Call Board.
  for (const t of lineup) {
    const b = callBoard.find(x => tripKey(x, x.onDuty) === tripKey(t, t.order));
    if (!b || (!isRescue(t.symbol) && fromToronto(t.trainNo))) continue;
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
      const { pick, skipped } = firstCallable(sdQueue, p.call, skipFor(p.symbol, p.order, 'EN'));
      if (!pick) {
        // No SD turn can be called in time (owner, 2026-10-25: M39671 showed
        // no engineer at all): it goes to the spareboard, like a conductor.
        p.engineerNone = 'SD';
        p.reason = `${p.reason || ''} No SD engineer available at the call${skipped.length ? ` (${skipped.join('; ')})` : ''} → spareboard.`.trim();
        continue;
      }
      sdQueue.splice(sdQueue.indexOf(pick), 1);
      p.engineer = pick.turn;
      p.engineerSpare = !!offAt(pick, p.call) || (pick.spare && (!cfg.starsHaveExpiry || pick.spareUntil == null || pick.spareUntil >= p.call));
      if (p.engineerSpare) p.engineerSpareWhy = spareWhy(pick, p.call);
      else p.engineerSpareMaybe = maybeWhy(pick, p.call);
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
      const resting = restsPast(pick, p.call) || heldPast(pick, p.call) || !!offAt(pick, p.call);
      p.engineer = pick.turn;
      p.engineerSpare = resting || pick.spare;
      if (p.engineerSpare) p.engineerSpareWhy = spareWhy(pick, p.call);
      else p.engineerSpareMaybe = maybeWhy(pick, p.call);
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
        // Goes spare (owner, 2026-11-05: S501 on rest past L50231 06's call).
        spare: !!assigned.spare, spareWhy: assigned.spareWhy || null, s5: !!assigned.s5, s5Pending: !!assigned.s5Pending, coWhy: assigned.coWhy || null, enWhy: assigned.enWhy || null, engineerSpare: !!assigned.engineerSpare,
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
  // The 501/502 crews in the order they take the next L502, for the board
  // (owner, 2026-11-06: show the order with the stand-in crew).
  const s5Next5 = s5Crews.map((c, rank) => ({ turn: c.turn, rank }));
  return { now, today, ahead, callingTimeline: timeline, predictions, chainGang, me: mine, flags, notes, s5Order: s5Next5 };
}

// A Mac yard (Toronto) train's expected call: order − 2 h (owner, 2026-10-29).
function torontoCallTime(order, cfg = defaults) {
  return order - (cfg.torontoCallMinutes ?? cfg.callLeadMinutes);
}

module.exports = { runBoardCheck, poolOf, callTime, torontoCallTime, poolFromCrewCode, fromToronto, isExcluded };
