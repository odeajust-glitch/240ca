// Turn alerts (owner, 2026-10-22): after each check, what changed for each
// turn that a phone may have subscribed to on the site: lined up for a
// train, that train ordered, on duty on the Call Board, and the call time
// moving. Conductor and engineer turns alike.
//
// Each phone chooses per turn which of these it wants and how far the call
// must move (owner: "only when it's ordered, or when the time changes by a
// certain amount"). Lined up / ordered / on duty are the same news for every
// phone (BoardChecker\turn-alerts.json); time moves are measured per phone
// from the call it was last told of (turn-alerts-phones.json), so small
// drifts add up and each phone's own threshold applies.
const fs = require('fs');
const { fmt, roadDay, localIso } = require('./time');
const { callTime, torontoCallTime, runBoardCheck } = require('./engine');
const { spareFills, openJob, sdBackups, srBackups, checkVacancies, expectedJobs } = require('./spares');
const { torontoCrews, torontoSouth, garnetHome } = require('./toronto');
const config = require('./config');

const MOVE_MINUTES = 30;
// What a phone gets for a turn unless it chose otherwise.
const DEFAULT_PREFS = { lineup: true, ordered: true, onDuty: true, aheadRest: true, aheadBack: true, reset: true, resetAhead: true, position: true, rescue: true, mayCall: true, catsWrong: true, held: true, stale: false, time: MOVE_MINUTES, before: 0 };

// A rescue train is the stalled train's symbol with an R in front (owner,
// 2026-10-23: M383 shows as RM383).
const isRescue = (symbol) => /^R[A-Z]\d/.test(symbol || '');

// A mandatory reset from the crew office always shows as rest or a hold turn
// until 0559 (owner, 2026-10-22).
const RESET_MINUTE = 5 * 60 + 59;
function resetUntil(t) {
  const until = t.rn === 'HT' && t.statusUntil != null ? t.statusUntil : t.restUntil;
  return until != null && ((until % 1440) + 1440) % 1440 === RESET_MINUTE ? until : null;
}
const prefsFor = (prefs, turn) => ({ ...DEFAULT_PREFS, ...((prefs && prefs[turn]) || {}) });
// Does this phone want this kind of news for this turn?
const wants = (prefs, turn, kind) => !!prefsFor(prefs, turn)[kind];

// Rest or a hold turn in force now, on a Chain Gang board row.
function restingNow(t, now) {
  if (t.rn === 'HT') return { why: 'hold turn', until: t.statusUntil ?? null };
  if (t.restUntil != null && t.restUntil > now) return { why: 'rest', until: t.restUntil };
  return null;
}

// What the board says about each turn now: its first line-up train (the
// engine's prediction, conductor or engineer), any Call Board train it's
// on duty on, and (Chain Gang only: SR conductors, SD engineers) the turns
// ahead of it at home and which of them are on rest or hold. On the Chain
// Gang a turn on rest is skipped, so the ones behind move up (owner,
// 2026-10-22); A/B turns on rest still take their train, so they're left out.
// Every board (pools.a/b/s1/s3 too): a turn's own mandatory reset.
// pools: { chainGang, sd, a, b, s1, s3 } as loadSummary gives them, plus
// for rescue trains: lineup (Sarnia, 47130), macLineup (Toronto, 41975) and
// bunkhouse, each null when that screen wasn't read this check.
// Spareboards (owner, 2026-10-25: the same alerts as the Chain Gang):
// pools.spareboards { coFast, coSlow, enFast, enSlow } (lists in board order,
// null when not read), pools.vacancies (jobs going spare, for who's lined up
// to fill them) and pools.yardJobs (crews matched to turns, for on duty).
// Why a turn is lined up for a train (the Notifications tab, owner
// 2026-11-05: "see exactly the notifications being sent, then the logic
// behind it"): the board check's own reason for the train, and for the
// engineer which list it came from.
const ENGINEER_LIST = { SR: 'SD list (option 27), in the Chain Gang order', A: 'S1 list, first in first out with the A pool', B: 'S3 list, first in first out with the B pool', S5: '501/502' };
function lineupWhy(p, craft, turn, spare, spareWhy) {
  const parts = [];
  if (p.known) parts.push(p.reason || 'CATS shows this crew on the Call Board.');
  else {
    if (p.reason) parts.push(p.reason);
    if (craft === 'EN' && turn) parts.push(`Engineer: ${turn}, next on the ${ENGINEER_LIST[p.pool] || 'engineer list'}.`);
  }
  if (spare) parts.push(`${turn} goes spare${spareWhy ? ` (${spareWhy})` : ''}: the turn takes the train and a spareboard employee works it.`);
  return parts.join(' ');
}

function turnStates(result, callBoard, pools = {}) {
  const out = {};
  const at = (turn) => (out[turn] ||= { lineup: null, onDuty: null, ahead: null, reset: null, board: null, workingOn: null });
  // A spare filling in on a trip (pools.fillIns, lib/board/fillins.js):
  // the turn they're working stands for them in Toronto (owner, 2026-10-25).
  const fillIns = pools.fillIns || {};
  const person = (turn) => (turn && fillIns[turn] ? fillIns[turn].turn : turn);
  const own = (list) => list.filter((t) => !t.craft || t.craft === 'CO' || /^S[D13]/.test(t.turn));
  const spareLists = Object.values(pools.spareboards || {}).filter(Boolean);
  const spares = [...new Map(spareLists.flat().map((t) => [t.turn, t])).values()];
  for (const t of [...own([...(pools.chainGang || []), ...(pools.sd || []), ...(pools.a || []), ...(pools.b || []), ...(pools.s1 || []), ...(pools.s3 || [])]), ...spares]) {
    if (t.working) continue;
    at(t.turn).reset = resetUntil(t);
  }
  // 501/502 too (owner on S501, 2026-11-04): one number, two turns, so per
  // craft (S501-CO / S501-EN).
  for (const t of pools.s5 || []) {
    if (t.working || !t.craft) continue;
    at(`${t.turn}-${t.craft === 'CO' ? 'CO' : 'EN'}`).reset = resetUntil(t);
  }
  // Each turn's board position and who's ahead of it at home (owner,
  // 2026-10-22: tell me when my position changes, and why), every board.
  const co = (list) => (list || []).filter((t) => t.craft === 'CO');
  for (const list of [co(pools.chainGang), pools.sd || [], co(pools.a), co(pools.b), pools.s1 || [], pools.s3 || [], ...spareLists]) {
    for (const t of list) if (t.working && t.workingOn) at(t.turn).workingOn = t.workingOn;
    const home = list.filter((t) => !t.working).sort((a, b) => a.pos - b.pos);
    // A turn on both a fast and a slow board: its first board counts.
    home.forEach((t, i) => { if (!at(t.turn).board) at(t.turn).board = { pos: t.pos, ahead: home.slice(0, i).map((x) => x.turn) }; });
  }
  // Someone ahead on rest is skipped on the spareboards too.
  for (const list of [(pools.chainGang || []).filter((t) => t.craft === 'CO'), pools.sd || [], ...spareLists]) {
    const home = list.filter((t) => !t.working).sort((a, b) => a.pos - b.pos);
    home.forEach((t, i) => {
      if (at(t.turn).ahead) return;
      at(t.turn).ahead = Object.fromEntries(home.slice(0, i).map((x) => {
        const r = restingNow(x, result.now);
        return [x.turn, { pos: x.pos, resting: !!r, why: r && r.why, until: r && r.until }];
      }));
    });
  }
  // Rescue trains (owner, 2026-10-23): one on the Sarnia line-up is news for
  // affected turns (calculated below); one on the Toronto line-up for the
  // crews waiting in the bunkhouse. s.rescue: [] none, null screen not read.
  const rescues = (trains, where) => (trains == null ? null : trains.filter((t) => isRescue(t.symbol)).map((t) => ({
    id: `${t.symbol} ${t.originDay}`, where, status: t.status, order: t.order,
    // A rescue train out of Toronto keeps order − 2 h: the one on the saved days (RM30241 01) went on duty at its order.
    call: where === 'Toronto' ? torontoCallTime(t.order, config, true) : callTime(t.order, t.deadhead, config) })));
  const toronto = rescues(pools.macLineup, 'Toronto');
  if (pools.macLineup !== undefined) {
    for (const c of pools.bunkhouse || []) for (const turn of [c.co, c.en].map(person)) if (turn) at(turn).rescue = toronto;
  }
  // The crew at Garnet (owner, 2026-11-04): their L501 home, like the
  // Toronto bunkhouse's train home: lined up / ordered / call moves /
  // reminder; call = order − 2 h 15. Before the Sarnia line-up, which already
  // projects that crew for the next L502.
  if (pools.garnetLineup) {
    const g = garnetHome(pools.garnetLineup, pools.garnet);
    if (g && g.crew) {
      for (const craft of [g.crew.co ? 'CO' : null, g.crew.en ? 'EN' : null].filter(Boolean)) {
        // A stand-in crew (owner, 2026-11-06: spares working MU01's trip to
        // Garnet): the spare actually there, by their own turn, per craft.
        const sub = fillIns[`${g.crew.turn}-${craft}`] || null;
        for (const turn of [`${g.crew.turn}-${craft}`, g.crew.turn, sub && sub.turn].filter(Boolean)) {
          if (out[turn] && out[turn].lineup) continue;
          at(turn).lineup = { train: `${g.train.symbol} ${g.train.originDay}`, status: g.train.status, order: g.train.order, call: g.call, spare: false, deadhead: false, home: 'Garnet',
            why: `${g.crew.turn} is the crew at Garnet (there's only ever one), so the next L501 on the Garnet line-up is theirs home.${sub && turn === sub.turn ? ` ${sub.turn} is working ${g.crew.turn}'s ${craft === 'CO' ? 'conductor' : 'engineer'} job on this trip (matched by name on the Call Board when it left), so ${sub.turn} is told.` : ''} Call = order − 2 h 15 (on duty at Garnet is 15 min before the order).` };
        }
      }
    }
  }
  for (const p of [...result.predictions].sort((a, b) => a.order - b.order)) {
    if (p.onDutyAt != null) continue; // already on duty: the Call Board says so below
    // L502: the 501/502 crew lined up for it isn't told until they're back
    // off duty in Sarnia (owner, 2026-11-05); at Garnet or bringing L501 home
    // they only hear about their L501 (above).
    if (p.s5 && p.s5Away) continue;
    const train = `${p.symbol} ${p.originDay}`;
    for (const [turn0, spare, craft, why] of [[p.turn, p.spare, 'CO', p.spareWhy], [p.engineer, p.engineerSpare, 'EN', p.engineerSpareWhy]]) {
      let sequence = null;
      if (turn0 && !p.known && ['A','B'].includes(p.pool) && (p.status === 'ORD' ? p.pool === 'A' : p.pool === 'B' && p.status === 'PLN')) {
        const ordered = p.status === 'ORD';
        const others = result.predictions.filter(q => q !== p && q.onDutyAt == null && !q.known &&
          roadDay(q.order, config.dayStartMinutes) === roadDay(p.order, config.dayStartMinutes) &&
          (ordered ? q.status === 'PLN' && ['A','B','SR'].includes(q.pool) && q.order < p.order
            : q.status === 'ORD' && q.pool === 'A' && q.order > p.order))
          .sort((a,b) => a.order - b.order).map(q => ({ train: q.symbol + ' ' + q.originDay, order: q.order }));
        if (others.length) sequence = { craft, others };
      }
      // S502 on L502: the conductor and the engineer are two turns with one number.
      for (const turn of p.s5 && turn0 ? [`${turn0}-${craft}`, turn0] : [turn0]) {
        if (!turn || (out[turn] && out[turn].lineup)) continue;
        at(turn).lineup = { train, status: p.status, order: p.order, call: p.call, spare: !!spare, deadhead: !!p.deadhead, ...(spare && why ? { spareWhy: why } : {}),
          ...(sequence ? { sequence } : {}), why: lineupWhy(p, craft, turn0, spare, why) };
      }
    }
  }
  // A spare person filling in shows under the job's turn; the alert goes to
  // the person's own turn (owner, 2026-10-24). pools.backfill: [{ train,
  // craft, job, turn }] from board-auto.js (matched by name, none kept).
  // A spare turn is lined up for the job going spare it's expected to fill
  // (lib/board/spares.js); yardmaster jobs (CC YA) aren't ours.
  if (pools.spareboards) {
    // A job already on duty (on the Call Board) is filled, even if it's
    // still on the vacancy list.
    const listed = (pools.vacancies || []).filter((j) => j.cc !== 'YA' && openJob(j, pools.yardJobs, callBoard, pools.crewsInTown));
    // CATS's option 5 checked against the order (spares.js checkVacancies;
    // owner, 2026-11-02): only the jobs really going spare line anyone up.
    const check = checkVacancies(listed, result.predictions);
    // Jobs the order says go spare that option 5 doesn't list (yet): the
    // spare expected to cover one is told now, why and to expect a call
    // (owner, 2026-11-05: "SA09 has a PL and the job will be going spare …
    // sometimes these don't show and people get surprise calls").
    const eng = (cc) => /^(EN|LE|ET)$/.test(cc || '');
    const expected = expectedJobs(result.predictions, check.corrected, pools.crewsInTown);
    const jobs = [...check.corrected, ...expected];
    const fills = spareFills(jobs, pools.spareboards);
    // The spare CATS's own list would call for a job that isn't real is told
    // (owner: "a notification to B134 that says it's showing in CATS to
    // work, but it's showing the incorrect turn").
    if (check.errors.length) {
      const asListed = spareFills(listed, pools.spareboards);
      for (const e of check.errors) {
        const f = asListed.get(e.job);
        if (!f || !f.turn || (out[f.turn] && out[f.turn].catsWrong)) continue;
        const craft = e.craft === 'EN' ? 'engineer' : 'conductor';
        at(f.turn).catsWrong = {
          // Once per wrong listing on CATS (whose job, which craft), not per
          // train: owner's alert log, 2026-11-04: EN03 heard about S108's
          // engineer job seven times as the train it was matched to moved.
          key: `${e.craft}|${e.cats.turn}`,
          text: `${f.turn}: CATS shows you to work ${e.train} (filling ${e.cats.turn}'s ${craft} job, call ~${fmt(f.call)}), but that's the wrong turn: the order has ${e.order.turn} on ${e.train}${e.order.spare ? ` (${e.order.turn}'s job is going spare)` : `, so no ${craft} job is going spare`}.`,
        };
      }
    }
    for (const j of [...jobs].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))) {
      const f = fills.get(j);
      if (!f || !f.turn || (out[f.turn] && out[f.turn].lineup)) continue;
      const jobCraft = eng(j.cc) ? 'engineer' : 'conductor';
      const whose = j.yard ? `The yard job ${j.train}` : `${j.turn && j.turn !== j.train ? `${j.turn}'s ` : 'The '}${jobCraft} job on ${j.trainDay || j.train}`;
      at(f.turn).lineup = { train: j.trainDay || j.train, status: j.status === 'ORDERED' ? 'ORD' : 'PLN', order: j.at, call: f.call, spare: false, deadhead: /^DH/.test(j.train || ''), job: true,
        ...(!j.yard && j.turn ? { poolJob: { turn: j.turn, craft: jobCraft } } : {}),
        // Why it's going spare (from the order, option 5 not showing it yet).
        // An extra yard job's craft that option 5 leaves out (spares.js extraYardJobs).
        ...(j.extra ? { extra: { cc: j.cc, kind: j.extra } } : {}),
        ...(j.expected && !j.extra ? { covers: { turn: j.turn, why: j.why, craft: j.cc === 'EN' ? 'engineer' : 'conductor' } } : {}),
        why: `${whose} is going spare (${j.extra ? j.why : j.expected ? `the order shows it: ${j.why}; CATS's option 5 doesn't list it yet` : "listed on CATS's option 5, checked against the order"}). The spareboard fills it first in, first out: ${f.turn} is the first on the ${f.board} who can be called by ~${fmt(f.call)}${f.skipped && f.skipped.length ? ` (passed over: ${f.skipped.join('; ')})` : ''}.` };
    }
    // A PL 24–36 h after going on duty on a road job (owner, 2026-11-05: "a
    // notification to warn the person who would take the job if it went
    // spare"): the turn's job may go spare → the spare who'd cover it; a
    // spare who may be passed over → the next spare after them. Once per
    // train (kind mayCall).
    const craftOf = (cc) => (eng(cc) ? 'engineer' : 'conductor');
    const warnTo = (turn, key, text) => { if (turn && !at(turn).plWarn) at(turn).plWarn = { key, text }; };
    const used = new Set([...fills.values()].filter((f) => f && f.turn).map((f) => f.turn));
    const maybeJobs = [];
    for (const p of result.predictions) {
      if (p.onDutyAt != null || p.known || p.s5Away || p.order == null) continue;
      for (const [turn, why, cc] of [[p.turn, p.spareMaybe, 'CO'], [p.engineer, p.engineerSpareMaybe, 'EN']]) {
        if (turn && why) maybeJobs.push({ train: p.symbol, trainDay: `${p.symbol} ${p.originDay}`, at: p.order, cc, yard: false, status: p.status === 'ORD' ? 'ORDERED' : 'PLANNED', turn, why });
      }
    }
    for (const [j, f] of spareFills(maybeJobs, pools.spareboards, used)) {
      if (!f || !f.turn) continue;
      warnTo(f.turn, `${j.trainDay}|${j.cc}|maybe`, `${f.turn}: you may be called for ${j.trainDay} (${j.status === 'ORDERED' ? 'ordered' : 'planned'} for ${fmt(j.at)}, expected call ${fmt(f.call)}): ${j.turn} ${j.why}, so its ${craftOf(j.cc)} job may go spare.`);
    }
    for (const [j, f] of fills) {
      if (!f || !f.warn) continue;
      const train = j.trainDay || j.train;
      warnTo(f.warn.turn, `${train}|${j.cc}|${f.turn}`, `${f.warn.turn}: you may be called for ${train} (${j.status === 'ORDERED' ? 'ordered' : 'planned'} for ${fmt(j.at)}, expected call ${fmt(f.call)}): ${f.warn.why}, so ${f.turn} may be passed over for the ${craftOf(j.cc)} job.`);
    }
    // No one free on the slow board for a road job: the next Chain Gang
    // turn (not lined up for a train already) may be called for it, SD for
    // an engineer job, SR for a conductor job.
    const open = result.predictions.filter((p) => p.onDutyAt == null);
    const sr = (pools.chainGang || []).filter((t) => t.craft === 'CO');
    for (const t of [...(pools.sd || []), ...sr]) at(t.turn).mayCall = null; // read: none unless set below
    for (const [list, pick, who] of [[pools.sd, sdBackups, 'engineer'], [sr, srBackups, 'conductor']]) {
      const busy = new Set(open.map((p) => (who === 'engineer' ? p.engineer : p.turn)).filter(Boolean));
      for (const [j, b] of pick(jobs, fills, list, busy)) {
        if (at(b.turn).mayCall) continue;
        at(b.turn).mayCall = { train: j.train, status: j.status, order: j.at, call: b.call, who };
      }
    }
  }
  // An ordered Mac yard train with no crew rested by its call: a Toronto
  // South crew may get it; the bunkhouse crew first in line (on rest) is
  // told (owner, 2026-10-25). Uses the "may be called" option.
  if (pools.macLineup && pools.bunkhouse) {
    const trains = [...pools.macLineup].sort((a, b) => a.order - b.order);
    const crews = pools.bunkhouse.map((c) => ({ ...c, en: person(c.en), co: person(c.co) }));
    for (const c of crews) for (const t of [c.en, c.co]) if (t) at(t).south = null; // read: none unless set below
    const pick = torontoCrews(trains, crews);
    const south = torontoSouth(trains, crews, pick);
    // The train home each bunkhouse crew is predicted for (owner, 2026-10-25):
    // lined up / ordered / call moves / reminder, like a Sarnia line-up.
    trains.forEach((t, n) => {
      const c = crews[pick[n]];
      if (!c) return;
      for (const turn of [c.en, c.co].filter(Boolean)) {
        if (at(turn).lineup) continue;
        at(turn).lineup = { train: `${t.symbol} ${t.originDay}`, status: t.status, order: t.order, call: torontoCallTime(t.order, config, !!t.deadhead || /^DH/.test(t.symbol || '')),
          spare: false, deadhead: !!t.deadhead, home: true };
      }
    });
    trains.forEach((t, n) => {
      const c = crews[south[n]];
      if (!c) return;
      for (const turn of [c.en, c.co].filter(Boolean)) {
        if (at(turn).south) continue;
        at(turn).south = { train: `${t.symbol} ${t.originDay}`, order: t.order, call: torontoCallTime(t.order, config, !!t.deadhead || /^DH/.test(t.symbol || '')), rested: c.restUntil };
      }
    });
  }
  // On duty on a yard job (crews matched to turns by name).
  for (const j of pools.yardJobs || []) {
    for (const c of j.crew || []) {
      if (!c.turn || j.onDuty == null || (out[c.turn] && out[c.turn].onDuty)) continue;
      at(c.turn).onDuty = { train: j.job, at: j.onDuty, station: j.station || 'SARNIA' };
    }
  }
  for (const t of callBoard) {
    const train = `${t.symbol} ${t.originDay}`;
    for (const c of t.crew) {
      if (/^(TT|ET)$/.test(c.craft)) continue; // a trainee: the turn's own crew gives its on-duty
      const fill = (pools.backfill || []).find((b) => b.train === train && b.job === c.turn && b.craft === c.craft)
        || (fillIns[c.turn] ? { turn: fillIns[c.turn].turn } : null);
      const turn = fill ? fill.turn : c.turn;
      if (!turn || (out[turn] && out[turn].onDuty)) continue;
      at(turn).onDuty = { train, at: t.onDuty, station: t.station, ...(fill ? { job: c.turn } : {}) };
      // One number, two turns (S501 EN / CO): also as "S501-CO" / "S501-EN".
      if (!fill && /^S5\d{2}$/.test(turn)) at(`${turn}-${c.craft === 'CO' ? 'CO' : 'EN'}`).onDuty = at(turn).onDuty;
    }
  }
  if (!pools.skipRescueRouting && pools.lineup === null) {
    for (const state of Object.values(out)) if (state.rescue === undefined) state.rescue = null;
  }
  if (!pools.skipRescueRouting && pools.lineup != null) {
    // Preserve Toronto heads-ups; clear only the read Sarnia scope.
    for (const state of Object.values(out)) if (state.rescue === undefined) state.rescue = [];
    const input = pools.predictionInput || {
      now: result.now, callBoard, chainGangHome: pools.chainGang || [],
      sdHome: pools.sd || [], aHome: pools.a || [], bHome: pools.b || [],
      s1Home: pools.s1 || [], s3Home: pools.s3 || [], s5: pools.s5 || [],
      garnetLineup: pools.garnetLineup || [], lineup: pools.lineup,
      vacancies: pools.vacancies || []
    };
    const assignment = (state) => JSON.stringify({
      lineup: state && state.lineup && {
        train: state.lineup.train, call: state.lineup.call,
        spare: state.lineup.spare, job: !!state.lineup.job
      },
      mayCall: state && state.mayCall || null,
      plWarn: state && state.plWarn || null
    });
    for (const rescue of pools.lineup.filter((t) => isRescue(t.symbol))) {
      const id = rescue.symbol + ' ' + rescue.originDay;
      const same = (t) => t.symbol === rescue.symbol && t.originDay === rescue.originDay;
      const lineup = (input.lineup || []).filter((t) => !same(t)).map((t) => ({
        ...t, trainNo: t.trainNo || (/^DH/.test(t.symbol) ? t.symbol : t.symbol.slice(0, -2))
      }));
      const vacancies = (input.vacancies || []).filter((j) =>
        !(j.train === rescue.symbol && j.at != null && Math.abs(j.at - rescue.order) <= 15));
      const baseline = runBoardCheck({ ...input, lineup, vacancies, me: null });
      const previous = turnStates(baseline, callBoard, {
        ...pools, lineup, vacancies, predictionInput: undefined, skipRescueRouting: true
      });
      const note = { id, where: 'Sarnia', status: rescue.status, order: rescue.order,
        call: callTime(rescue.order, rescue.deadhead, config) };
      for (const turn of new Set([...Object.keys(out), ...Object.keys(previous)])) {
        if (assignment(out[turn]) === assignment(previous[turn])) continue;
        const state = at(turn);
        if (!Array.isArray(state.rescue)) state.rescue = [];
        if (!state.rescue.some((r) => r.id === id && r.where === 'Sarnia')) state.rescue.push(note);
      }
    }
  }
  return out;
}

const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();

// "DHT030B 23 (deadhead) planned for 23rd 0300, expected call 23rd 0100"
// (owner, 2026-10-22: the train, its planned or ordered time and the
// expected call, spelled out).
// "has a PL @ 6th 0001" → "PL @ 6th 0001"; "is B0 (working another job)" →
// "B0, working another job": the reason in brackets after "The turn goes
// spare" (owner, 2026-11-05).
const whyShort = (w) => String(w).replace(/^(has an? |is )/, '').replace(/\s\(([^)]*)\)/g, ', $1');
const trainLine = (l) => `${l.train}${l.deadhead ? ' (deadhead)' : ''} ${l.status === 'ORD' ? 'ordered' : 'planned'} for ${fmt(l.order)}, expected call ${fmt(l.call)}`;

// The news every phone shares: lined up, ordered, on duty.
// prev: what each turn was last told ({ turn: { train, status, onDuty } }).
// Returns { events: [{ turn, kind, text }], told } where `told` replaces prev.
// No prev (first run): nothing is sent, the board is just learned.
// lineupRead false (screen 41 not read this check): line-up news waits.
// now (minutes): for the calling hold below.
//
// Mid-call (owner, 2026-10-29): while a crew is being called, they drop off
// the board but the train stays on the line-up until both accept, so the
// next crew looks lined up for it. A new line-up for an ordered train whose
// call time has come, that the turn lined up for it last check has just
// dropped off (not on duty), is held: no alert until the train shows on
// the Call Board (the real crew gets "on duty") or it's still that way
// after HOLD_MAX minutes (then it's real and goes out).
const CALL_WINDOW = 15; // the call window opens this many minutes before the call
const HOLD_MAX = 30;
// Flip-flopping (owner, 2026-10-31, option C: the prediction swapped SR01
// between M30241 28 and DHT377B 30 four times in 2 h, an alert each time):
//   A. a switch from one train to another waits one check: sent only if the
//      new train is still there next check (`pending`);
//   B. a train that turn was told about in the last QUIET_MIN isn't sent
//      again (`recent`: train → { at, status }), unless it's now ordered and
//      wasn't then. The site still shows every change.
const QUIET_MIN = 6 * 60;
const STALE_GRACE = 15; // minutes past the call before a planned train counts as stale (insights.js too)
// Clarify the existing lineup/order event only after reassignment holds and
// repeat suppression have run. A covering spare can keep the same train.
function applySequenceMessages(events, states, prev, told, held) {
  const clock = time => localIso(time).slice(11);
  const messages = new Map();
  for (const event of events) {
    const l = states[event.turn]?.lineup;
    if (!l?.sequence || !['lineup','ordered'].includes(event.kind)) continue;
    const { others, craft } = l.sequence;
    let text;
    if (l.status === 'ORD') {
      const ahead = others[0];
      text = l.train + ' is ordered for ' + clock(l.order) + '. ' + ahead.train + ' is still planned ahead of you for ' +
        clock(ahead.order) + ' and has not been ordered. ' + event.turn + ' is the predicted ' +
        (craft === 'CO' ? 'conductor' : 'engineer') + ' turn.' + (l.spare ? ' Spare coverage is expected.' : '') +
        ' Expected call ' + clock(l.call) + '.';
    } else {
      const other = others.find(q => q.train === prev[event.turn]?.train);
      if (!other) continue;
      text = other.train + ' was ordered for ' + clock(other.order) + ', changing the predicted sequence. ' + event.turn +
        ' is now lined up for ' + l.train + ', still planned for ' + clock(l.order) + '. If ' + l.train +
        ' is ordered for a time before ' + clock(other.order) + ', your train assignment may change' +
        (craft === 'EN' ? '.' : ' again.' + (l.spare ? ' Your turn goes spare.' : '') + ' Expected call ' + clock(l.call) + '.');
    }
    event.text = text;
    messages.set(event.turn, text);
  }
  for (const [turn, state] of Object.entries(states)) {
    const l = state.lineup, job = l?.poolJob, pool = job && states[job.turn]?.lineup;
    const key = pool && [pool.train, job.turn, job.craft, pool.order, pool.status].join('|');
    if (told[turn].sequenceCoverage !== key) delete told[turn].sequenceCoverage;
    if (!pool?.spare || state.onDuty || held.includes(turn) || pool.order !== l.order ||
        (pool.train !== l.train && pool.train.split(' ')[0] !== l.train)) continue;
    const message = messages.get(job.turn);
    if (!message || told[turn].sequenceCoverage === key || told[turn].train !== l.train) continue;
    const text = turn + ', you are expected to cover ' + job.turn + '’s ' + job.craft + ' job. ' +
      message.replace(' Your turn goes spare.', '').replace(' Spare coverage is expected.', '');
    const own = events.filter(e => e.turn === turn && ['ordered','lineup'].includes(e.kind));
    if (own.length) own.forEach(e => { e.text = text; });
    else events.push({turn, kind:'lineup', text, why:l.why});
    told[turn].sequenceCoverage = key;
  }
}
function turnEvents(prev, states, { lineupRead = true, now = null } = {}) {
  const told = {};
  const events = [];
  const held = [];
  const beingCalled = (turn, l) => now != null && l.status === 'ORD' && l.call != null && now >= l.call - CALL_WINDOW
    && Object.entries(prev || {}).some(([x, q]) => x !== turn && q && q.train === l.train
      && !(states[x] && ((states[x].lineup && states[x].lineup.train === l.train) || states[x].onDuty)));
  for (const [turn, s] of Object.entries(states)) {
    const p = (prev && prev[turn]) || {};
    const t = { ...p };
    delete t.held; // set again below while it still applies
    if (s.onDuty) {
      if (p.onDuty !== s.onDuty.train) {
        events.push({ turn, kind: 'onDuty', text: `${turn} on duty on ${s.onDuty.train} at ${cap(s.onDuty.station)} ${fmt(s.onDuty.at)}${s.onDuty.job ? `, working ${s.onDuty.job}` : ''}.` });
      }
      t.onDuty = s.onDuty.train;
    }
    // The crew office put this turn on a mandatory reset (until 0559).
    if (s.reset !== undefined) {
      if (s.reset != null && p.reset !== s.reset) {
        events.push({ turn, kind: 'reset', text: `${turn}: you've been put on a mandatory reset until ${fmt(s.reset)}.` });
      }
      t.reset = s.reset;
    }
    // Its board position moved: who left the line ahead of it (and on what
    // train) or who was placed ahead of it.
    // Back home on a Sarnia board after being out working (owner, 2026-10-25:
    // "will it get a notification that their turn has returned to Sarnia?").
    if (s.board && p.offBoard) {
      events.push({ turn, kind: 'position', text: `${turn} is back on the board in Sarnia: position ${String(s.board.pos).padStart(3, '0')}${s.board.ahead.length ? ` (${s.board.ahead.length} ahead)` : ' (first out)'}.` });
      delete t.offBoard;
    } else if (s.board) {
      if (p.pos != null && p.pos !== s.board.pos && Array.isArray(p.posAhead)) {
        const where = (x) => {
          const o = states[x] || {};
          const train = (o.onDuty && o.onDuty.train) || o.workingOn || (o.lineup && o.lineup.train);
          return train ? `${x} (${train})` : `${x} (off the board)`;
        };
        const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]);
        const left = p.posAhead.filter((x) => !s.board.ahead.includes(x)).map(where);
        const joined = s.board.ahead.filter((x) => !p.posAhead.includes(x));
        const pad3 = (n) => String(n).padStart(3, '0');
        const why = [left.length ? `${list(left)} went out` : null, joined.length ? `${list(joined)} placed ahead of you` : null].filter(Boolean).join('; ');
        events.push({ turn, kind: 'position', text: `${turn}: now position ${pad3(s.board.pos)} (was ${pad3(p.pos)}).${why ? ` ${s.board.pos < p.pos ? 'Moved up' : 'Moved down'}: ${why}.` : ''}` });
      }
      t.pos = s.board.pos;
      t.posAhead = s.board.ahead;
    } else {
      // Out working (on duty, or POS 999 on its pool screen): back on a board later is news.
      if (s.onDuty || s.workingOn) t.offBoard = true;
      delete t.pos; delete t.posAhead; // off the Sarnia board: back on it is a fresh start
    }
    if (s.board) { t.pos = s.board.pos; t.posAhead = s.board.ahead; }
    // A turn ahead (here last check too) went on rest or hold, or came off it.
    // Only while this turn is itself on the Chain Gang board at home in
    // Sarnia (owner, 2026-10-23): not on duty, not away; what it knew before
    // it left is forgotten, so coming back home isn't reported as news.
    if (s.ahead && !s.onDuty) {
      for (const [x, a] of Object.entries(s.ahead)) {
        const was = p.ahead && p.ahead[x];
        const pos = String(a.pos).padStart(3, '0');
        if (a.resting && was === false) {
          events.push({ turn, kind: 'aheadRest', text: `${turn}: ${x} ahead of you (pos ${pos}) went on ${a.why}${a.until != null ? ` until ${fmt(a.until)}` : ''}; it's skipped for calls before then, so you move up.` });
        } else if (!a.resting && was === true) {
          events.push({ turn, kind: 'aheadBack', text: `${turn}: ${x} ahead of you (pos ${pos}) is off rest/hold and back in line ahead of you.` });
        }
      }
      t.ahead = Object.fromEntries(Object.entries(s.ahead).map(([x, a]) => [x, a.resting]));
    } else {
      delete t.ahead;
    }
    // A rescue train showed up where this turn is waiting. Each one is said
    // once; off that board, it's forgotten (back on it, a rescue still there
    // is news again).
    if (s.rescue === undefined) delete t.rescues;
    else if (s.rescue) {
      for (const r of s.rescue) {
        if (p.rescues && p.rescues.includes(r.id)) continue;
        events.push({ turn, kind: 'rescue', text: `${turn}: rescue train ${r.id} on the ${r.where} line-up, ${r.status === 'ORD' ? 'ordered' : 'planned'} for ${fmt(r.order)}, expected call ${fmt(r.call)}.` });
      }
      t.rescues = s.rescue.map((r) => r.id);
    }
    // May be called off the SD board for a job going spare (no engineer
    // free on the slow board). Said once per job.
    if (s.mayCall) {
      if (p.mayCall !== s.mayCall.train) {
        const m = s.mayCall;
        events.push({ turn, kind: 'mayCall', text: `${turn}: you may be called for ${m.train} (${m.status === 'ORDERED' ? 'ordered' : 'planned'} for ${fmt(m.order)}, expected call ${fmt(m.call)}): no ${m.who || 'engineer'} is free on the ${m.who || 'engineer'} slow board.` });
      }
      t.mayCall = s.mayCall.train;
    } else if (s.mayCall === null) {
      delete t.mayCall; // read, and no longer needed: a later one is news again
    }
    // Toronto South may get the ordered train this crew is first in line for.
    if (s.south) {
      if (p.south !== s.south.train) {
        const x = s.south;
        events.push({ turn, kind: 'mayCall', text: `${turn}: ${x.train} is ordered for ${fmt(x.order)} (call ${fmt(x.call)}) and no crew in the bunkhouse is rested by then${x.rested != null ? ` (you're on rest until ${fmt(x.rested)})` : ''}: a Toronto South crew may get it.` });
      }
      t.south = s.south.train;
    } else if (s.south === null) {
      delete t.south;
    }
    // Lined up for a train still planned 15 min or more past its call (owner,
    // 2026-11-02: stale trains; off unless the phone turns it on): once per
    // train and call (a plan moved later and past again is news again).
    const sl = s.lineup;
    if (lineupRead && now != null && sl && sl.status !== 'ORD' && sl.call != null && now - sl.call >= STALE_GRACE) {
      const key = `${sl.train}|${sl.call}`;
      if (p.staleTold !== key) events.push({ turn, kind: 'stale', text: `${turn}: ${sl.train} is ${Math.round(now - sl.call)} min past its planned call (${fmt(sl.call)}) and still not ordered (planned for ${fmt(sl.order)}).` });
      t.staleTold = key;
    }
    // CATS's option 5 would call this spare for a job that isn't real: once
    // per wrong listing (owner, 2026-11-02).
    if (s.plWarn && p.plWarn !== s.plWarn.key) {
      events.push({ turn, kind: 'mayCall', text: s.plWarn.text });
      t.plWarn = s.plWarn.key;
    }
    if (s.catsWrong && p.catsWrong !== s.catsWrong.key) {
      events.push({ turn, kind: 'catsWrong', text: s.catsWrong.text });
      t.catsWrong = s.catsWrong.key;
    }
    const l = s.lineup;
    const recent = Object.fromEntries(Object.entries(p.recent || {}).filter(([, r]) => now != null && now - r.at < QUIET_MIN));
    if (Object.keys(recent).length) t.recent = recent; else delete t.recent;
    const remember = (train, status) => { if (now != null) t.recent = { ...(t.recent || {}), [train]: { at: now, status } }; };
    if (!lineupRead) {
      // keep what they were told
    } else if (l && l.train !== t.onDuty) {
      const spare = l.spare ? ` The turn goes spare${l.spareWhy ? ` (${whyShort(l.spareWhy)})` : ''}.`
        : l.covers ? (l.covers.turn ? ` ${l.covers.turn} ${l.covers.why}, so its ${l.covers.craft} job is going spare: expect a call.`
          : ` ${l.covers.why.replace(/^./, (c) => c.toUpperCase())}, so the ${l.covers.craft} job is going spare: expect a call.`)
          : l.extra ? (l.extra.kind === 'unfilled' ? ` Its ${l.extra.cc} job isn't on CATS yet, but nobody holds that turn on ${l.train}, so it goes spare too: expect a call.`
            : ` Its ${l.extra.cc} job isn't on CATS yet, but ${l.train} is an extra job and its whole crew comes off the spareboard: expect a call.`) : '';
      if (l.train === p.train) delete t.pending; // back to what they were told
      const hold = p.train !== l.train && beingCalled(turn, l)
        ? { train: l.train, since: p.held && p.held.train === l.train ? p.held.since : now } : null;
      if (hold && now - hold.since < HOLD_MAX) {
        t.held = hold; // wait: the crew before them is likely being called
        held.push(turn);
      } else if (p.train !== l.train && p.train && p.pending !== l.train) {
        t.pending = l.train; // A: still there next check, then it's news
      } else if (p.train !== l.train) {
        delete t.pending;
        const r = recent[l.train];
        if (!r) {
          events.push({ turn, kind: 'lineup', why: l.why, text: `${turn} lined up${l.home ? ` home from ${l.home === true ? 'Toronto' : l.home}` : ''}: ${trainLine(l)}.${spare}` });
          // Lined up already ordered: that's news for phones that only want orders.
          if (l.status === 'ORD') events.push({ turn, kind: 'ordered', alsoLineup: true, why: l.why, text: `${turn} ordered: ${trainLine(l)}.${spare}` });
        } else if (r.status !== 'ORD' && l.status === 'ORD') {
          // B: told of this train already, but it's ordered since.
          events.push({ turn, kind: 'ordered', why: l.why, text: `${turn} ordered: ${trainLine(l)}.${spare}` });
        }
        Object.assign(t, { train: l.train, status: l.status });
        remember(l.train, l.status);
      } else if (p.status !== 'ORD' && l.status === 'ORD') {
        events.push({ turn, kind: 'ordered', why: l.why, text: `${turn} ordered: ${trainLine(l)}.${spare}` });
        t.status = l.status;
        remember(l.train, l.status);
      }
    } else if (!l && p.train && p.train !== t.onDuty) {
      // Off the line-up without going on duty here (cancelled, given to
      // someone else): forget it, so a later line-up is news again (unless
      // it's the same train within QUIET_MIN, B above).
      delete t.train; delete t.status; delete t.pending;
    }
    told[turn] = t;
  }
  // Turns not on any screen now keep what they were told (a missed screen
  // shouldn't re-announce everything next check).
  for (const [turn, p] of Object.entries(prev || {})) if (!told[turn]) told[turn] = p;
  if (prev && lineupRead) applySequenceMessages(events, states, prev, told, held);
  return { events: prev ? events : [], told, held };
}

// One phone's time news: for each turn it follows, the call it was last told
// of (set when the turn is lined up for a train) against the call now, with
// that phone's threshold (prefs[turn].time minutes; 0 = no time alerts).
// base: { turn: { train, call } } for this phone. Returns { events, base }.
// Also the reminder a set time before the expected call (owner,
// 2026-10-25: yard jobs don't always show ordered): prefs[turn].before
// minutes (90/60/45/30, 0 = off), once per train. now: railway minutes.
// held: turns whose line-up is on hold mid-call (turnEvents): no time
// change or reminder for it meanwhile.
function timeEvents(base, states, turns, prefs, { lineupRead = true, now = null, held = [] } = {}) {
  const next = { ...(base || {}) };
  const events = [];
  if (!lineupRead) return { events, base: next };
  for (const turn of turns || []) {
    if (turn === '__welcomed' || held.includes(turn)) continue;
    const l = states[turn] && states[turn].lineup;
    if (!l) { delete next[turn]; continue; }
    let b = next[turn];
    if (!b || b.train !== l.train) {
      // Reminders already given survive a flip to another train and back
      // (owner, 2026-10-31: B134 reminded twice for YFLS60).
      const reminded = b ? [].concat(b.reminded || []).slice(-5) : [];
      b = next[turn] = { train: l.train, order: l.order, call: l.call, ...(reminded.length ? { reminded } : {}) };
    } else {
      const min = Number(prefsFor(prefs, turn).time) || 0;
      if (min > 0 && Math.abs(l.call - b.call) >= min) {
        events.push({ turn, kind: 'time', why: `The line-up moved the train's time by ${Math.abs(l.call - b.call)} min (this phone asked for moves of ${min} min or more). ${l.why || ''}`.trim(), text: `${turn} time change: ${trainLine(l)} (was ${b.order != null ? `${fmt(b.order)}, call ` : 'call '}${fmt(b.call)}).` });
        b = next[turn] = { ...b, train: l.train, order: l.order, call: l.call };
      }
    }
    const before = Number(prefsFor(prefs, turn).before) || 0;
    const left = now == null || l.call == null ? null : l.call - now;
    if (before > 0 && left != null && left <= before && left > -15 && ![].concat(b.reminded || []).includes(l.train)) {
      events.push({ turn, kind: 'before', why: `This phone asked for a reminder ${before} min before the expected call. ${l.why || ''}`.trim(), text: `${turn}: about ${Math.max(0, Math.round(left))} min to your expected call: ${trainLine(l)}.` });
      next[turn] = { ...b, reminded: [...[].concat(b.reminded || []), l.train].slice(-5) };
    }
  }
  return { events, base: next };
}

// Everything one phone should get this check: the shared news it wants,
// then its own time moves. An "ordered" that came with the line-up isn't
// sent twice to a phone that also wants line-ups.
// "Where you stand" (owner, 2026-10-25): the first check after a phone
// starts following a turn, one alert with what it's lined up for now, since
// news already told before it subscribed isn't sent again. base.__welcomed
// lists the turns this phone has had it for; a phone known from before this
// existed starts with all its turns counted (no burst of them).
function standText(turn, s = {}) {
  const bits = [];
  if (s.onDuty) bits.push(`on duty on ${s.onDuty.train} at ${cap(s.onDuty.station || '')} ${fmt(s.onDuty.at)}${s.onDuty.job ? `, working ${s.onDuty.job}` : ''}`);
  else if (s.lineup) bits.push(`lined up${s.lineup.home ? ` home from ${s.lineup.home === true ? 'Toronto' : s.lineup.home}` : ''}: ${trainLine(s.lineup)}`);
  else if (s.workingOn) bits.push(`out working on ${s.workingOn}`);
  if (s.board) bits.push(`board position ${String(s.board.pos).padStart(3, '0')}${s.board.ahead.length ? ` (${s.board.ahead.length} ahead)` : ' (first out)'}`);
  if (s.reset != null) bits.push(`on a mandatory reset until ${fmt(s.reset)}`);
  if (s.mayCall) bits.push(`may be called for ${s.mayCall.train}`);
  if (s.south) bits.push(`first in line for ${s.south.train}, a Toronto South crew may get it`);
  return `${turn} tracked. ${bits.length ? `Right now: ${bits.join('; ')}.` : 'Not lined up for anything yet.'}`;
}

// "S501-CO" → "S501 conductor", "S501-EN" → "S501 engineer" in what's sent
// (owner, 2026-11-05: S501's conductor and engineer alerts apart).
const crafted = (text) => String(text).replace(/\b(S5\d{2})-CO\b/g, '$1 conductor').replace(/\b(S5\d{2})-EN\b/g, '$1 engineer');
function phoneEvents(shared, phone, states, base, opts) {
  const turns = phone.turns || [];
  // A phone still following plain "S501" (from before the conductor /
  // engineer question; the page asks it once) gets S501-CO's and S501-EN's,
  // each marked, and not the plain copy as well.
  const plainS5 = (t) => /^S5\d{2}$/.test(t) && turns.includes(t);
  const follows = (t) => (turns.includes(t) && !plainS5(t)) || (/^S5\d{2}-(CO|EN)$/.test(t) && (turns.includes(t) || turns.includes(t.slice(0, 4))));
  const prefTurn = (t) => (turns.includes(t) ? t : t.slice(0, 4));
  const mine = shared.filter((e) => follows(e.turn) && wants(phone.prefs, prefTurn(e.turn), e.kind)
    && !(e.alsoLineup && wants(phone.prefs, prefTurn(e.turn), 'lineup'))).map((e) => ({ ...e, text: crafted(e.text) }));
  // Time changes and reminders per craft too (plain "S501" → both, marked).
  const timeTurns = [...new Set(turns.flatMap((t) => (plainS5(t) ? [`${t}-CO`, `${t}-EN`] : [t])))];
  const timePrefs = { ...(phone.prefs || {}) };
  for (const t of turns) if (plainS5(t)) for (const c of ['CO', 'EN']) if (!timePrefs[`${t}-${c}`]) timePrefs[`${t}-${c}`] = (phone.prefs || {})[t] || {};
  const time = timeEvents(base, states, timeTurns, timePrefs, opts);
  const known = base && !base.__welcomed ? turns : (base && base.__welcomed) || [];
  const stand = turns.filter((t) => !known.includes(t)).map((turn) => ({ turn, kind: 'stand', text: standText(turn, states[turn]) }));
  time.base.__welcomed = turns.slice(); // a turn dropped and added again gets it again
  // Ordered with a new time (owner, 2026-10-31 alert log: "ordered" then
  // "time change" for the same train in the same check): the ordered message
  // already gives the new time, so the time change isn't sent too.
  const said = new Set(mine.filter((e) => e.kind === 'ordered').map((e) => e.turn));
  const timed = time.events.filter((e) => !(e.kind === 'time' && said.has(e.turn)));
  return { events: [...stand, ...mine, ...timed].map((e) => ({ ...e, text: crafted(e.text) })), base: time.base };
}

// A phone following a person (owner, 2026-10-25): its '@<hash>' entries
// become the turn that person is on now (personTurns: { hash: { turn } },
// from their own-turn sightings), with that entry's choices. A turn the
// phone follows by name keeps its own choices. → { turns, prefs }.
function expandPhone(phone, personTurns = {}) {
  const turns = [];
  const prefs = { ...(phone.prefs || {}) };
  for (const t of phone.turns || []) {
    if (!/^@/.test(t)) { if (!turns.includes(t)) turns.push(t); continue; }
    const p = personTurns[t.slice(1)];
    if (!p || !p.turn) continue;
    if (!turns.includes(p.turn)) { turns.push(p.turn); if (!(phone.turns || []).includes(p.turn)) prefs[p.turn] = (phone.prefs || {})[t] || {}; }
  }
  return { ...phone, turns, prefs };
}

// Each person's own turn now, kept across checks: { hash: { turn, at } }.
// sightings: summary.people ({ h, turn, own }); only own turns count.
// Off the turn (owner, 2026-10-30: "it should say I'm not found since there
// is a new person on SR03"): someone else seen on it as their own turn, or
// not seen on it for PERSON_GONE_MIN while the check read names. Their
// alerts stop until they're seen on a turn of their own again. 501/502 has
// two people on one turn, so only the time counts there.
const PERSON_GONE_MIN = 30;
const SHARED_TURN = /^S5\d{2}$/;
function updatePersonTurns(memory, sightings = [], now = Date.now()) {
  const next = { ...(memory || {}) };
  const own = sightings.filter((s) => s.own && s.h && s.turn);
  for (const s of own) {
    // 501/502: their craft's turn (S501-CO), so the alerts are theirs, not
    // the other crew member's (owner on S501 CO, 2026-11-04).
    const turn = SHARED_TURN.test(s.turn) && s.craft ? `${s.turn}-${s.craft === 'CO' ? 'CO' : 'EN'}` : s.turn;
    // A sighting without the craft doesn't undo one with it.
    if (turn === s.turn && SHARED_TURN.test(turn) && next[s.h] && next[s.h].turn.startsWith(`${turn}-`)) { next[s.h] = { ...next[s.h], at: now }; continue; }
    next[s.h] = { turn, at: now };
  }
  const readNames = sightings.length > 0;
  for (const [h, v] of Object.entries(next)) {
    const takenOver = !SHARED_TURN.test(v.turn) && own.some((s) => s.turn === v.turn && s.h !== h) && !own.some((s) => s.h === h && s.turn === v.turn);
    if (now - v.at > 90 * 864e5 || takenOver || (readNames && now - v.at > PERSON_GONE_MIN * 60000)) delete next[h];
  }
  return next;
}

// Trainee slots (S501-TT, S102-ET; owner, 2026-11-04): the trains that
// turn's crew goes on (conductor's for TT, engineer's for ET): lined up,
// ordered, time, on duty, rescue. Never the holder's reset, position or
// who's ahead. turns: the slots someone follows.
const TRAINEE_TURN = /^([A-Z][A-Z0-9]\d{2})-(TT|ET)$/;
function addTrainees(states, turns = []) {
  for (const t of turns) {
    const m = TRAINEE_TURN.exec(t || '');
    if (!m || states[t]) continue;
    const parent = /^S5\d{2}$/.test(m[1]) ? `${m[1]}-${m[2] === 'TT' ? 'CO' : 'EN'}` : m[1];
    const p = states[parent];
    if (!p) continue;
    states[t] = { lineup: p.lineup || null, onDuty: p.onDuty || null, ahead: null, reset: null, board: null, workingOn: p.workingOn || null, ...(p.rescue !== undefined ? { rescue: p.rescue } : {}) };
  }
  return states;
}

// Where tapping an alert opens (owner, 2026-11-06: "go with your
// suggestions"): the Current page scrolled to the box it's about, on that
// turn's board tab, the train highlighted. → './#go=<section>|<turn>|<train>'.
const GO_SECTION = { lineup: 'lineup', ordered: 'lineup', time: 'lineup', before: 'lineup', rescue: 'lineup', mayCall: 'lineup', stale: 'lineup', resetAhead: 'lineup',
  position: 'pools', aheadRest: 'pools', aheadBack: 'pools', reset: 'pools', stand: 'pools', catsWrong: 'vacancies', onDuty: 'callboard' };
function goLink(e, states = {}) {
  const st = states[e.turn] || {};
  const turn = String(e.turn || '').replace(/-(CO|EN|TT|ET)$/, '');
  let sec = GO_SECTION[e.kind] || 'pools';
  let train = '';
  const l = st.lineup;
  if (sec === 'lineup' && e.kind !== 'resetAhead' && e.kind !== 'rescue' && l) {
    train = l.train || '';
    if (l.home === 'Garnet') sec = 'garnet';
    else if (l.home) sec = 'toronto';
    else if (l.job) sec = 'vacancies';
  }
  if (e.kind === 'resetAhead' && e.train) { train = e.train; if (/^Y/.test(train)) sec = 'vacancies'; }
  if (sec === 'callboard' && st.onDuty) train = st.onDuty.train || '';
  if (sec === 'vacancies' && !train) { const m = /\b(?:work|for) ([A-Z][A-Z0-9]{3,7}(?: \d{2})?)/.exec(e.text || ''); if (m) train = m[1]; }
  return `./#go=${encodeURIComponent([sec, turn, train].join('|'))}`;
}

function loadTold(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function saveTold(file, told) {
  fs.writeFileSync(file, JSON.stringify(told));
}

module.exports = { goLink, addTrainees, expandPhone, updatePersonTurns, PERSON_GONE_MIN, isRescue, turnStates, turnEvents, timeEvents, phoneEvents, prefsFor, loadTold, saveTold, MOVE_MINUTES, DEFAULT_PREFS };
