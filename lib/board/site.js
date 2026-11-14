// The line-up snapshot website (owner, 2026-10-16): every saved check in
// history\ becomes a page a union rep can browse, published to Cloudflare by the
// laptop itself. Only what's on the masked screens goes out; nothing about
// whose turn it is.
//
// Output (in BoardChecker\site): index.html (public/board.html),
// board-turns.js, board-trains.js, board-analytics.js, the 14h tab's grievance files, robots.txt, data/index.json (the days there are),
// data/<YYYY-MM-DD>.json (that day's snapshots), data/turns.json (each
// turn's history across all of them, for "find a turn") and data/trains.json
// (each line-up train from first sighting to on duty, for the order summary),
// data/analytics.json (runarounds, jobs going spare, sleep) and data/archive.json
// + archive-<month>.json (Analytics' memory from before the first day here,
// lib/board/archive.js). A check identical to the one before it isn't repeated; the
// earlier one gets "same until" instead.
const fs = require('fs');
const path = require('path');
const { loadSummary } = require('./summary');
const { runBoardCheck, callTime, torontoCallTime, fromToronto, isExcluded } = require('./engine');
const config = require('./config');
const RoadDays = require('./roadday');
const { deployR2 } = require('./r2');
const V = require('./view');
const People = require('./people');
const Insights = require('./insights');
const Patterns = require('./patterns');
const Archive = require('./archive');
const Resets = require('./resets');
const MyStatsFiles = require('./mystats');
const { spareFills, onDutyAlready, untiedEarlier, openJob, sdBackups, srBackups, checkVacancies, expectedJobs, watchYardJobs, spareJobs } = require('./spares');
const { onCallBoard, torontoCrews, torontoSouth, garnetHome, trainId } = require('./toronto');
const { describeMe } = require('./report');
const { fmt, parts, roadDay } = require('./time');
const dotenv = require('dotenv');
const { ENV_FILES } = require('./paths');

const BoardTurns = require('../../public/board-turns');
const BoardTrains = require('../../public/board-trains');
const { loadNames, namesForHeld, lockNames, namesByTurn, workingByJob, bunkhouseNames, makeUpNames } = require('./names');
const Seniority = require('./seniority');

const PAGE_FILE = path.join(__dirname, '..', '..', 'public', 'board.html');
const TURNS_FILE = path.join(__dirname, '..', '..', 'public', 'board-turns.js');
const TRAINS_FILE = path.join(__dirname, '..', '..', 'public', 'board-trains.js');
const ANALYTICS_FILE = path.join(__dirname, '..', '..', 'public', 'board-analytics.js');
// Turn alerts (owner, 2026-10-22): the service worker must sit at the site's
// root to cover every page; the manifest lets an iPhone add the site to the
// home screen, which Apple requires before it allows web alerts.
const PUSH_FILES = {
  'sw.js': path.join(__dirname, '..', '..', 'public', 'board-sw.js'),
  'manifest.webmanifest': path.join(__dirname, '..', '..', 'public', 'board.webmanifest'),
  // Home-screen icon (owner, 2026-10-22; drawn by scripts/make-icons.js).
  'board-icon-192.png': path.join(__dirname, '..', '..', 'public', 'board-icon-192.png'),
  'board-icon-512.png': path.join(__dirname, '..', '..', 'public', 'board-icon-512.png'),
  'board-icon-180.png': path.join(__dirname, '..', '..', 'public', 'board-icon-180.png'),
};
// The 14h tab writes grievance letters in the browser (public/grievance.js,
// the .odt template, JSZip); names and PINs are typed there and never sent.
// A missing one (no `npm install` since jszip was added) only costs the
// letters, never the rest of the site.
const GRIEVANCE_FILES = {
  'grievance.js': () => path.join(__dirname, '..', '..', 'public', 'grievance.js'),
  'grievance_template.odt': () => path.join(__dirname, '..', '..', 'public', 'grievance_template.odt'),
  'jszip.min.js': () => require.resolve('jszip/dist/jszip.min.js'),
  'board-names.js': () => path.join(__dirname, '..', '..', 'public', 'board-names.js'),
};
// The agreement search (owner, 2026-11-03: moved off Render onto this site):
// its page (public/index.html, here agreements.html), the PDF viewer, the
// usage page, the grievance generator and the libraries they load, at the
// paths they ask for. The answers come from the Worker (/api/ask). A missing
// one is skipped, never the rest of the site.
const PUB = (f) => path.join(__dirname, '..', '..', 'public', f);
const AGREEMENT_FILES = {
  'viewer.html': () => PUB('viewer.html'),
  'stats.html': () => PUB('stats.html'),
  'grievance.html': () => PUB('grievance.html'),
  'grievance-logo.png': () => PUB('grievance-logo.png'),
  'vendor/jszip/jszip.min.js': () => require.resolve('jszip/dist/jszip.min.js'),
  'pdfjs/pdf.min.mjs': () => require.resolve('pdfjs-dist/build/pdf.min.mjs'),
  'pdfjs/pdf.worker.min.mjs': () => require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'),
};
// The yardmaster call order page, test site only (owner, 2026-11-13), and its logic.
const YM_FILES = { 'ym.html': () => PUB('ym.html'), 'board-ym.js': () => PUB('board-ym.js') };
// On Render "/" was the search; here it's the board.
const AGREEMENT_FIX = {};
// The search is a tab of the board page now (owner, 2026-11-03); the old
// address forwards to it.
const AGREEMENTS_REDIRECT = '<!doctype html><meta charset="utf-8"><title>Agreements</title><meta http-equiv="refresh" content="0; url=/#agreements"><script>location.replace("/#agreements")</script><a href="/#agreements">Agreements</a>';
const pad = (n) => String(n).padStart(2, '0');
// Bump when what a snapshot shows changes, so day files built earlier are redone.
// Rebuild cached snapshots using regular S5 board position.
// Rebuild observed call-change timelines from retained raw checks.
// 30: each check keeps option 5's yardmaster jobs (CC YA) on their own (owner, 2026-11-13).
// 31: a Mac yard train already on the Call Board keeps its Sarnia crew, takes no one from the
// bunkhouse and is never "possible Toronto South" (owner, 2026-11-14); the Toronto South watch.
const FORMAT = 31;
const taken = (t) => { const p = parts(t); return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}${pad(p.minute)}`; };

// The crews in town → [{ turn, craft, pool, text }]: turn = the turn, or the
// yard job; craft EN / CO for 501/502's two turns (TT trainee → CO, ET → EN).
const TOWN_TEXT = { rested: 'rested', vacancy: 'vacancy (off the turn)', tempVacancy: 'temporary vacancy (working another job for now)', off: 'day off', hold: 'hold turn', rest: 'on rest' };
function townStatus(pools) {
  const out = [];
  for (const p of pools || []) {
    for (const c of p.crews) {
      const turn = c.turn || p.yard;
      if (!turn || c.status === 'open') continue;
      const what = c.status === 'other' ? 'status not known' : `${TOWN_TEXT[c.status]}${c.until != null ? ` until ${fmt(c.until)}` : ''}`;
      const who = c.trainee ? `${c.craft} trainee` : c.temp ? `${c.craft} (temporary)` : c.craft;
      out.push({ turn, craft: c.craft === 'TT' ? 'CO' : c.craft === 'ET' ? 'EN' : c.craft, pool: p.pool, text: `${who}: ${what}` });
    }
  }
  return out;
}

// Rest in the bunkhouse is always 8 h from going off duty (owner, 2026-10-17;
// first said 10 h).
const REST_MIN = 8 * 60;

// Crews still on their way to Toronto (owner, 2026-10-22: guess the rest of
// the Toronto line-up). Each Sarnia train on duty on the Call Board, whose
// crew isn't in the bunkhouse yet, ties up in Toronto ~8 h after going on
// duty (deadhead ~3 h; config.torontoTripMinutes) and is rested 8 h after
// that. They join the bunkhouse queue behind the crews already there, first
// to tie up first. An estimate: only for this prediction.
function crewsOnTheWay(callBoard, bunkhouse) {
  const inBunk = new Set(bunkhouse.flatMap((c) => [c.en, c.co]).filter(Boolean));
  return callBoard
    .filter((t) => t.station === config.homeStation && !fromToronto(t.trainNo) && !isExcluded(t.trainNo || t.symbol, config))
    .map((t) => {
      const co = (t.crew.find((c) => c.craft === 'CO') || {}).turn || '';
      const en = (t.crew.find((c) => /^(EN|LE)$/.test(c.craft)) || t.crew.find((c) => !/^(CO|TT|ET)$/.test(c.craft)) || {}).turn || '';
      const deadhead = /^DH/.test(t.symbol);
      const offDuty = t.onDuty + config.torontoTripMinutes[deadhead ? 'deadhead' : 'train'];
      return { co, en, expected: true, train: `${t.symbol} ${t.originDay}`, deadhead, onDuty: t.onDuty, offDuty, restUntil: offDuty + REST_MIN };
    })
    .filter((c) => (c.co || c.en) && !inBunk.has(c.co) && !inBunk.has(c.en))
    .sort((a, b) => a.offDuty - b.offDuty);
}

// The website is for any member, so the board checker's own asides go.
const siteRules = (text) => text.replace(/, not ours\)/, ')');

// One saved check (a board-probe/board-auto summary) → what the page shows.
// memory: the road day's trains from the checks before it (lib/board/roadday.js),
// so the page counts A/B the way the laptop did; the updated memory comes back.
// A yard job is taken as 8 hours (owner, 2026-10-24); YSBY jobs 12 (2026-11-03).
const YARD_MIN = 8 * 60;
// YSBY jobs are 12-hour shifts by default (owner, 2026-11-03).
const yardMinutes = (job) => (/^YSBY/.test(job || '') ? 12 * 60 : YARD_MIN);
// 501/502 and Garnet: the engineer and the conductor each get a row (owner,
// 2026-10-25: S501 EN and S501 CO are two turns with one number), away
// turns marked. B1 rows aren't kept.
// awayMark false: Garnet's turns are all at Garnet (TERM 1), nothing to mark.
const CRAFT_ORDER = { EN: 0, LE: 0, CO: 1 };
// The two boards' names on the page, by the label board-auto.js gives their screens (29, 31); the
// make-up turn names in crew.json (mu.boards) use them too.
const BOARD_NAME = { s5: '501/502 (S5)', garnet: 'Garnet' };
function otherBoard(list, now, awayMark = true) {
  const rows = new Map();
  for (const t of list) if (t.craft in CRAFT_ORDER) rows.set(`${t.turn}/${t.craft}`, t);
  return [...rows.values()].sort((a, b) => a.terminal - b.terminal || a.pos - b.pos || CRAFT_ORDER[a.craft] - CRAFT_ORDER[b.craft]).map((t) => {
    const st = V.gangStatus(t, now);
    const bits = t.terminal && awayMark ? [`away (term ${t.terminal})`, ...(st === 'available' ? [] : [st])] : [st];
    return { pos: String(t.pos).padStart(3, '0'), turn: t.turn, craft: t.craft, status: bits.join('; ') };
  });
}

// The 501/502 board in the order the crews take the next L502 (owner,
// 2026-11-06: "correct the order so if someone from the spareboard was
// looking at the order on the website it would show the crew"): the crew
// next for it first; a make-up crew (MU01) working a trip right after the
// crew whose trip it is, with the spares on it when they were read by name.
// rows: otherBoard's; order: the board check's s5Order; backfill: this
// check's fill-ins ({ job, craft, turn }).
function s5Board(rows, order, backfill = []) {
  if (!order.length) return rows;
  const idx = new Map(order.map((c, i) => [c.turn, i]));
  // Preserve the statuses read from CATS. Do not assign MU to a regular
  // crew or append guessed next/covered-trip labels.
  return rows.map((t, i) => ({ t, i })).sort((a, b) =>
    (idx.has(a.t.turn) ? idx.get(a.t.turn) : order.length) -
    (idx.has(b.t.turn) ? idx.get(b.t.turn) : order.length) || a.i - b.i).map(({ t }) => t);
}

function snapshotOf(summary, memory = null) {
  const input = loadSummary(summary);
  const known = RoadDays.remember(memory, input.callBoard, input.now);
  const r = runBoardCheck({ ...input, departed: RoadDays.departed(known, input.callBoard), seenSince: known.since });
  const pred = new Map(r.predictions.map((p) => [`${p.symbol}/${p.originDay}`, p]));
  const board = (list, spareboard = false) => list.map((t) => ({ pos: String(t.pos).padStart(3, '0'), turn: t.turn, status: V.gangStatus(t, r.now, { spareboard }) }));
  // Each spareboard as it opens, plus anyone who only shows once VIEW TIME
  // (the check less 10 min) is typed, in their place with that time beside
  // them (owner, 2026-10-28: no separate (24h) tab, "just put the time in
  // yellow beside their name"). `left`: never predicted, not a pool fact.
  // The job each spare is lined into (owner, 2026-11-05: "show the job they
  // are lined into beside their turn"): option 5's and the order's, as the
  // alerts work it out.
  const lined = spareJobs(r.predictions, input.vacancies, input.spareboards, input.yardJobs, input.callBoard, input.crewsInTown);
  const jobOf = (turn) => { const j = lined.get(turn); return j ? { train: j.train, call: fmt(j.call), covers: j.covers, yard: j.yard } : null; };
  const withView = (name, key) => {
    const list = board((input.spareboards || {})[key] || [], true).map((t) => { const job = jobOf(t.turn); return job ? { ...t, job } : t; });
    const v = (input.spareboardsView || {})[key];
    if (!v) return [{ name, turns: list }];
    const here = new Set(list.map((t) => t.turn));
    const extra = board(v.turns, true).filter((t) => !here.has(t.turn)).map((t) => ({ ...t, left: true, viewTime: v.viewTime }));
    return [{ name, viewTime: v.viewTime, turns: [...list, ...extra].sort((a, b) => a.pos.localeCompare(b.pos) || !!a.left - !!b.left) }];
  };
  // The yardmaster spareboard (owner, 2026-11-14), no names: not one of the pools on the page (kept apart, like the
  // yardmaster jobs going spare); the yardmaster call order reads it (Seniority.liveFacts). Anyone only on the
  // view-time read left it in the last 10 min.
  const ymSpare = !input.ymSpare ? null : (() => {
    const list = board(input.ymSpare, true);
    const v = input.ymSpareView;
    const here = new Set(list.map((t) => t.turn));
    const left = v ? board(v.turns, true).filter((t) => !here.has(t.turn)).map((t) => ({ ...t, left: true, viewTime: v.viewTime })) : [];
    return { ...(v ? { viewTime: v.viewTime } : {}), turns: [...list, ...left].sort((a, b) => a.pos.localeCompare(b.pos) || !!a.left - !!b.left) };
  })();
  const g = r.chainGang || { returning: [] };
  const shown = {
    taken: taken(r.now),
    screens: Object.entries(input.seen).filter(([k, v]) => v && k !== 'callBoardPages').map(([k]) => k),
    lineup: [...input.lineup].sort((a, b) => a.order - b.order).map((t) => {
      const p = pred.get(`${t.symbol}/${t.originDay}`);
      return { order: fmt(t.order), status: t.status, train: `${t.symbol} ${t.originDay}`, deadhead: !!t.deadhead,
        ...(p?.s5 && p.onDutyAt != null ? { s5OnDuty: true } : {}),
        info: t.info || '', engCrew: t.engCrew || '', trnCrew: t.trnCrew || '',
        rules: p ? siteRules(V.goesTo(p)) : fromToronto(t.trainNo) ? 'Toronto train / not counted' : 'Crew prediction unavailable',
        call: p ? fmt(p.call) : !fromToronto(t.trainNo) ? fmt(callTime(t.order, t.deadhead, config)) : '',
        reason: p ? p.reason : !fromToronto(t.trainNo) ? 'Crew prediction could not be produced for this lineup row. This is not a Toronto classification; check the saved calling sequence and Call Board.' : '',
        // The crew predicted (not one CATS already shows), to score later (owner, 2026-10-22).
        pred: p && !p.known && p.pool !== 'S5' && (p.turn || p.engineer) ? { co: p.turn || '', en: p.engineer || '' } : null,
        // Whoever the line-up has on it, predicted or known (sleep tracker, owner 2026-10-26).
        crew: p && (p.turn || p.engineer) ? { co: p.turn || '', en: p.engineer || '' } : null };
    }),
    onDuty: [...input.callBoard].sort((a, b) => a.onDuty - b.onDuty).map((t) => ({ onDuty: fmt(t.onDuty), station: t.station,
      train: `${t.symbol} ${t.originDay}`, crew: t.crew.map((c) => `${c.craft} ${c.turn}`).join(' · '),
      // Spare people filling in on this train (matched by name, no names kept).
      backfill: (summary.backfill || []).filter((b) => b.train === `${t.symbol} ${t.originDay}`).map((b) => ({ craft: b.craft, job: b.job, turn: b.turn })) })),
    pools: [
      { name: 'Chain Gang (SR) · conductors', turns: board(input.chainGangHome) },
      { name: 'A pool (SA)', turns: board(input.aHome) },
      { name: 'B pool (SB)', turns: board(input.bHome) },
      { name: 'SD · engineers', turns: board(input.sdHome) },
      { name: 'S1 · engineers (A)', turns: board(input.s1Home || []) },
      { name: 'S3 · engineers (B)', turns: board(input.s3Home || []) },
      // Owner, 2026-10-24: the spareboards, 501/502 and Garnet.
      ...withView('Conductor fast board', 'coFast'),
      ...withView('Conductor slow board', 'coSlow'),
      ...withView('Engineer fast board', 'enFast'),
      ...withView('Engineer slow board', 'enSlow'),
      { name: BOARD_NAME.s5, turns: s5Board(otherBoard(input.s5 || [], r.now), r.s5Order || [], summary.backfill || []) },
      { name: BOARD_NAME.garnet, turns: otherBoard(input.garnet || [], r.now, false) },
    ].filter((p) => p.turns.length),
    ...(ymSpare ? { ymSpare } : {}),
    // Yard jobs on duty (owner, 2026-10-24): taken as 8 h long.
    yardJobs: (input.yardJobs || []).map((j) => ({ job: j.job, station: j.station, onDuty: j.onDuty != null ? fmt(j.onDuty) : '',
      off: j.onDuty != null ? fmt(j.onDuty + yardMinutes(j.job)) : '', hours: yardMinutes(j.job) / 60, crew: j.crew.map((c) => `${c.craft} ${c.turn}`).join(' · ') })),
    // The jobs going spare (option 5, vacancies only).
    // Yardmaster jobs (CC YA) go to the yardmaster spareboard, not ours:
    // left off (owner, 2026-10-24).
    ...(() => {
      const ours = (input.vacancies || []).filter((j) => j.cc !== 'YA');
      // CATS's option 5 checked against the order (spares.js checkVacancies;
      // owner, 2026-11-02): the corrected list is what's really going spare
      // and what everything else uses; CATS's own list is kept to show.
      const check = checkVacancies(ours, r.predictions);
      const pending = r.predictions.filter((p) => p.onDutyAt == null);
      // CATS puts a 501/502 vacancy on its own S5 turn; the line-up's turn
      // (the 501/502 crew whose turn it is: they alternate) is the one shown (owner, 2026-10-26, 2026-11-03).
      const s5Turn = (j) => {
        if (j.pool !== 'S5') return j.turn;
        const p = r.predictions.find((x) => x.s5 && x.turn && j.train.startsWith(x.symbol));
        return p ? p.turn : j.turn;
      };
      const rowsOf = (list) => {
        // A job already on duty is filled: no one else is predicted for it.
        const open = list.filter((j) => openJob(j, input.yardJobs, input.callBoard, input.crewsInTown));
        const fills = spareFills(open, input.spareboards);
        // No one free on the slow board: the SD (engineer job) or SR turn that may be called.
        const sd = sdBackups(open, fills, input.sdHome, new Set(pending.map((p) => p.engineer).filter(Boolean)));
        const sr = srBackups(open, fills, input.chainGangHome.filter((t) => t.craft === 'CO'), new Set(pending.map((p) => p.turn).filter(Boolean)));
        return list.map((j) => {
          const f = fills.get(j);
          const untied = untiedEarlier(j, input.yardJobs, input.crewsInTown);
          // Predicted (the order's, not on option 5): its line-up train and why.
          const more = j.expected ? { predicted: true, trainDay: j.trainDay, why: j.why, ...(j.extra ? { extra: j.extra } : {}) } : {};
          return { pos: j.pos != null ? String(j.pos).padStart(3, '0') : '', at: j.at != null ? fmt(j.at) : '', status: j.status, ...more,
            train: j.train, pool: j.pool || (j.turn || '').slice(0, 2), cc: j.cc, turn: s5Turn(j), cats: j.catsTurn || (s5Turn(j) !== j.turn ? j.turn : undefined), yard: j.yard, spare: /\*\*/.test(j.st), returns: j.returns != null ? fmt(j.returns) : '',
            // The spare turn expected to fill it (estimate).
            ...(untied ? { untied: fmt(untied.onDuty) } : {}),
            fill: f ? { turn: f.turn, board: f.board, call: fmt(f.call), skipped: f.skipped, sd: (sd.get(j) || sr.get(j) || {}).turn || '' } : null };
        });
      };
      // Predicted jobs going spare (owner, 2026-11-07: "based on anything
      // showing on the corrected train line up that's not showing there"):
      // the order's spare jobs option 5 doesn't list (spares.js
      // expectedJobs). Filled together with option 5's, in call order, as
      // the alerts and the spareboards' "lined into" work it out.
      // An extra yard job's unlisted crafts too (spares.js extraYardJobs), only
      // while its listed craft is still open.
      const stillOpen = (x) => check.corrected.some((j) => j.yard && j.train === x.train && openJob(j, input.yardJobs, input.callBoard, input.crewsInTown));
      const expected = expectedJobs(r.predictions, check.corrected, input.crewsInTown).filter((j) => !j.extra || stillOpen(j));
      const both = rowsOf([...check.corrected, ...expected]);
      const vacancies = both.slice(0, check.corrected.length);
      const vacanciesPredicted = both.slice(check.corrected.length).map((v, i) => [v, expected[i].at]).sort((a, b) => a[1] - b[1]).map(([v]) => v);
      const wrong = new Map(check.errors.map((e) => [e.job, e]));
      const vacanciesCats = rowsOf(ours).map((v, i) => {
        const e = wrong.get(ours[i]);
        return e ? { ...v, wrong: { train: e.train, order: e.order.turn, spare: e.order.spare } } : v;
      });
      // Who CATS's list would have called for each wrong job (owner: "a
      // notification to B134 that says it's showing in CATS to work, but
      // it's showing the incorrect turn").
      const catsErrors = check.errors.map((e) => {
        const v = vacanciesCats[ours.indexOf(e.job)];
        return { train: e.train, craft: e.craft, cats: e.cats.turn, catsPool: e.cats.pool, order: e.order.turn, orderSpare: e.order.spare, at: fmt(e.at),
          wouldCall: (v.fill && v.fill.turn) || '', call: (v.fill && v.fill.call) || '' };
      });
      // Watched, not predicted (owner, 2026-11-11): a regular yard job with
      // nobody on it whose other open craft option 5 leaves out. Who the
      // spareboard would give it to if it were counted, so the guess can be
      // checked against who worked it. No alert, no cover shown, nobody moved.
      const openListed = check.corrected.filter((j) => openJob(j, input.yardJobs, input.callBoard, input.crewsInTown));
      const watched = watchYardJobs(openListed, input.crewsInTown);
      const watchFills = watched.length ? spareFills([...openListed, ...expected, ...watched], input.spareboards) : new Map();
      const vacanciesWatch = watched.map((j) => { const f = watchFills.get(j); return { at: fmt(j.at), train: j.train, cc: j.cc, why: j.why, wouldCall: (f && f.turn) || '', call: f ? fmt(f.call) : '' }; });
      // Yardmaster jobs (CC YA) stay off every list above (owner, 2026-10-24: they go to the yardmaster
      // spareboard), but are kept on their own to look back on (owner, 2026-11-13: "can you see YM jobs that
      // go spare, if you have been recording them can you show me what you know"). Nobody predicted, no
      // alert, nothing else reads them. The TURN column is the job (YSTY01); the EMP column is never kept.
      const yardmasterJobs = (input.vacancies || []).filter((j) => j.cc === 'YA').map((j) => ({ pos: j.pos != null ? String(j.pos).padStart(3, '0') : '',
        at: j.at != null ? fmt(j.at) : '', status: j.status, train: j.train, pool: j.pool || '', cc: j.cc, st: j.st || '', returns: j.returns != null ? fmt(j.returns) : '', turn: j.turn || '' }));
      return { vacancies, vacanciesCats, catsErrors, vacanciesPredicted, ...(vacanciesWatch.length ? { vacanciesWatch } : {}), ...(yardmasterJobs.length ? { yardmasterJobs } : {}), option5Read: !!(input.seen && input.seen.terminal) };
    })(),
    away: input.chainGangAway.map((t) => t.turn),
    returning: g.returning.map((x) => `${x.turn} (${x.train})`),
    // Display the engine's existing sequence, including remembered departures.
    callingSequence: (r.callingTimeline || []).map((t) => ({
      day: t.day || roadDay(t.order, config.dayStartMinutes),
      order: fmt(t.order), train: `${t.symbol} ${t.originDay}`,
      expected: t.expected, actual: t.actual || '', slot: t.slot || null,
      source: t.source, status: t.status || '', deadhead: !!t.deadhead,
    })),
    sequence: r.today.map((t) => ({ order: fmt(t.order), train: `${t.symbol} ${t.originDay}`, turn: t.turn || '', expected: t.expected, actual: t.actual || '' })),
    // Ordered, not on duty yet: the pool CATS shows vs the sequence ("ordered
    // for A but the sequence says B"), for the out-of-sequence tracker.
    sequenceAhead: (r.ahead || []).map((t) => ({ order: fmt(t.order), train: `${t.symbol} ${t.originDay}`, expected: t.expected, actual: t.actual,
      turn: (pred.get(`${t.symbol}/${t.originDay}`) || {}).turn || '' })),
    flags: r.flags.map((x) => x.text),
    // Mac yard (owner, 2026-10-17). REST is always 8 h after off duty, so
    // off duty = REST − 8 h; no REST = already rested. Rested by now =
    // available (rest until 0000 is available at 0000).
    // Crews on duty out of Sarnia, not in the bunkhouse yet (estimated times).
    onTheWay: crewsOnTheWay(input.callBoard, input.bunkhouse || []).map((c) => ({
      crew: [c.en, c.co].filter(Boolean).join(' + '), en: c.en, co: c.co, train: c.train,
      onDuty: fmt(c.onDuty), offDuty: fmt(c.offDuty), rested: fmt(c.restUntil),
    })),
    bunkhouse: (() => {
      // Still listed here but already on the Call Board for a train home (owner, 2026-11-14): onTrain.
      const { busyOn } = onCallBoard(input.macLineup || [], input.bunkhouse || [], input.callBoard);
      return (input.bunkhouse || []).map((c, k) => ({
        pos: String(c.pos).padStart(3, '0'), en: c.en || '', co: c.co || '',
        offDuty: c.restUntil != null ? fmt(c.restUntil - REST_MIN) : '', rested: c.restUntil != null ? fmt(c.restUntil) : '',
        ready: c.restUntil == null || c.restUntil <= r.now,
        ...(busyOn.has(k) ? { onTrain: busyOn.get(k) } : {}),
      }));
    })(),
    // Crews take these trains in bunkhouse order, skipping any still on rest
    // at the call (torontoCrews); after the bunkhouse, the crews still on
    // their way (crewsOnTheWay), estimated.
    // The crews in town (TODO #10, owner 2026-11-03): each turn's or yard
    // job's RESTED/STATUS, no names. Not shown as a list (owner: behind the
    // scenes); Person search's Status uses it.
    town: townStatus(input.crewsInTown),
    // Garnet's line-up (option 41 for 47956, owner 2026-11-03): L501 home.
    garnetLineup: (input.garnetLineup || []).map((t) => ({ train: `${t.symbol} ${t.originDay}`, status: t.status, order: fmt(t.order) })),
    // The Toronto South watch (owner, 2026-11-14; lib/board/toronto-south.js): our trains that left the Mac
    // yard line-up 8 h or more before their call, and what each look at the Toronto South Call Board found.
    // Only in checks that had one; `tsRead`: the look made in this check, if any.
    ...(() => {
      const ts = summary.torontoSouth;
      const list = (ts && Array.isArray(ts.list) ? ts.list : []).map((w) => ({
        train: w.id, status: w.status || '', order: fmt(w.order), call: fmt(w.call), lastSeen: fmt(w.lastSeen), fellOff: fmt(w.fellOff),
        looks: (w.looks || []).map((l) => ({ due: fmt(l.due), ...(l.at != null ? { at: fmt(l.at), seen: !!l.seen } : {}), ...(l.failed ? { failed: true } : {}) })),
        end: w.end || '',
        ...(w.seen ? { seen: { crew: w.seen.crew || '', onDuty: w.seen.onDuty != null ? fmt(w.seen.onDuty) : '', station: w.seen.station || '' } } : {}),
        ...(w.sarnia ? { sarnia: { crew: w.sarnia.crew || '', onDuty: w.sarnia.onDuty != null ? fmt(w.sarnia.onDuty) : '' } } : {}),
      }));
      const read = ts && ts.read ? { at: fmt(ts.read.at), ...(ts.read.error ? { error: String(ts.read.error) } : { pages: ts.read.pages || 0, trains: ts.read.trains || 0 }) } : null;
      return { ...(list.length ? { tsWatch: list, ...(ts.codes === false ? { tsCodes: false } : {}) } : {}), ...(read ? { tsRead: read } : {}) };
    })(),
    // Garnet line-up · L501 home (owner, 2026-11-04: "like the Toronto Line
    // up - Mac Yard, but showing the jobs home from garnet"): the next L501
    // and the one crew in Garnet that takes it; call = order − 2 h 15.
    garnetHome: (() => {
      const g = garnetHome(input.garnetLineup, input.garnet);
      if (!g) return null;
      const c = g.crew;
      return { train: `${g.train.symbol} ${g.train.originDay}`, status: g.train.status, order: fmt(g.train.order), call: fmt(g.call),
        crew: c ? { turn: c.turn, crafts: [c.en ? 'EN' : '', c.co ? 'CO' : ''].filter(Boolean).join(' + '), members: c.members, rested: c.restUntil != null && c.restUntil > r.now ? fmt(c.restUntil) : '',
          late: c.restUntil != null && c.restUntil > g.call } : null };
    })(),
    // Upcoming days off (option 4, owner 2026-11-05): turn + craft only, no names.
    daysOff: (input.daysOff || []).map((d) => ({ from: fmt(d.from), until: fmt(d.until), on: d.from <= r.now, turn: d.turn, craft: d.craft, pool: d.pool, type: d.type, stat: d.stat, leave: d.leave, yard: d.yard })),
    macLineup: (() => {
      const crews = [...(input.bunkhouse || []), ...crewsOnTheWay(input.callBoard, input.bunkhouse || [])];
      const trains = input.macLineup || [];
      // Already on the Call Board: its Sarnia crew has it (owner, 2026-11-14), so
      // it takes no one from the bunkhouse and is never "possible Toronto South".
      const board = onCallBoard(trains, crews, input.callBoard);
      const pick = torontoCrews(trains, crews, board);
      const south = torontoSouth(trains, crews, pick, board);
      const tag = (x) => `${x.expected ? 'on the way:' : String(x.pos).padStart(3, '0')} ${[x.en, x.co].filter(Boolean).join(' + ')}`;
      return trains.map((t, n) => {
        const c = crews[pick[n]];
        const s1 = crews[south[n]];
        const call = torontoCallTime(t.order, config, !!t.deadhead || /^DH/.test(t.symbol || ''));
        const b = board.called.get(trainId(t));
        const on = b ? (b.crew || []).filter((x) => !/^(TT|ET)$/.test(x.craft)) : [];
        const en = (on.find((x) => /^(EN|LE)$/.test(x.craft)) || {}).turn || '';
        const co = (on.find((x) => x.craft === 'CO') || {}).turn || '';
        // Crews ahead of the one picked, passed over because of rest (not one
        // on a train already called, and none for that train itself).
        const skipped = b ? [] : crews.filter((x, k) => k < (pick[n] < 0 ? crews.length : pick[n]) && !pick.slice(0, n).includes(k) && !board.busy.has(k))
          .map((x) => `${x.expected ? 'on the way:' : String(x.pos).padStart(3, '0')} ${[x.en, x.co].filter(Boolean).join(' + ')} (rest until ${x.expected ? '~' : ''}${fmt(x.restUntil)})`);
        return { order: fmt(t.order), status: t.status, train: `${t.symbol} ${t.originDay}`, deadhead: !!t.deadhead, info: t.info || '', orstn: t.originStation || '',
          // On the Call Board: the Sarnia crew called for it (EN first, then CO; trainees left out).
          called: b ? { crew: [en, co].filter(Boolean).join(' + '), en, co, onDuty: fmt(b.onDuty), station: b.station || '' } : null,
          call: fmt(call), crew: c ? [c.en, c.co].filter(Boolean).join(' + ') : '', crewPos: c && !c.expected ? String(c.pos).padStart(3, '0') : '',
          crewRested: c && c.restUntil != null ? fmt(c.restUntil) : '', skipped,
          // Planned, crew still on rest at the call (owner, 2026-10-25): shown in yellow.
          restedLate: c && c.restUntil != null && c.restUntil > call ? fmt(c.restUntil) : '',
          // Ordered, no crew rested by the call: possibly a Toronto South crew.
          south: s1 ? { crew: tag(s1), co: s1.co || '', en: s1.en || '', rested: s1.restUntil != null ? fmt(s1.restUntil) : '' } : null,
          // A crew not in the bunkhouse yet: where it is now and the guesses.
          crewExpected: c && c.expected ? { train: c.train, onDuty: fmt(c.onDuty), offDuty: fmt(c.offDuty), rested: fmt(c.restUntil), deadhead: c.deadhead } : null,
          pred: c ? { co: c.co || '', en: c.en || '' } : null };
      });
    })(),
  };
  return { shown, compare: V.snapshot(r, []), memory: known, input, result: r };
}

// "When do I go?" for every turn the newest check can answer (owner,
// 2026-10-22: the laptop's answer, for anyone on the site). Chain Gang
// conductors get the full answer (position, who's ahead, rest); any turn
// lined up on a train (A/B, engineers too) gets its train and call.
// memory: the road-day memory before this check.
function whenYouGo(summary, memory) {
  const input = loadSummary(summary);
  const known = RoadDays.remember(memory, input.callBoard, input.now);
  const base = { ...input, departed: RoadDays.departed(known, input.callBoard), seenSince: known.since };
  const r = runBoardCheck(base);
  const strip = (lines) => lines.map((l) => l.replace(/^WHEN YOU GO \([^)]*\): /, '').replace('; run a check then.', '; the site updates then.').trim())
    .map((l, i) => (i ? l : l.charAt(0).toUpperCase() + l.slice(1)));
  const turns = {};
  const asked = new Set([
    ...input.chainGangHome.filter((t) => t.craft === 'CO').map((t) => t.turn),
    ...((r.chainGang && r.chainGang.returning) || []).map((x) => x.turn),
    ...r.predictions.filter((p) => !p.onDutyAt).map((p) => p.turn).filter(Boolean),
  ]);
  for (const turn of asked) {
    const m = runBoardCheck({ ...base, me: turn }).me;
    if (m && !m.notFound) turns[turn] = strip(describeMe(m));
  }
  // 501/502: the conductor's and the engineer's apart (owner, 2026-11-05),
  // as "S501-CO" / "S501-EN".
  for (const p of r.predictions) {
    if (!p.s5 || !p.turn || p.onDutyAt) continue;
    const onDuty = p.order - config.prepMinutes.train;
    const head = `${p.symbol} ${p.originDay}: called ~${fmt(p.call)}, on duty ${fmt(onDuty)} (${p.status === 'ORD' ? 'ordered' : 'planned, so times are estimates'}).`;
    const short = (w) => String(w || '').replace(/^(has an? |is )/, '');
    for (const [craft, spare, why] of [['CO', p.spare, p.spareWhy], ['EN', p.engineerSpare, p.engineerSpareWhy]]) {
      const k = `${p.turn}-${craft}`;
      if (turns[k]) continue;
      turns[k] = [`${head}${p.s5Pending ? ' Whether it goes spare is known once you\'re off duty in Sarnia.' : spare ? ` The turn goes spare${why ? ` (${short(why)})` : ''}.` : ''}`];
    }
  }
  for (const p of r.predictions) {
    if (!p.engineer || p.onDutyAt || turns[p.engineer]) continue;
    const onDuty = p.order - config.prepMinutes[p.deadhead ? 'deadhead' : 'train'];
    const spare = p.s5Pending ? ' Whether it goes spare is known once the crew is off duty in Sarnia.'
      : p.engineerSpare ? ` The turn goes spare${p.engineerSpareWhy ? ` (${String(p.engineerSpareWhy).replace(/^(has an? |is )/, '').replace(/\s\(([^)]*)\)/g, ', $1')})` : ''}.` : '';
    turns[p.engineer] = [`${p.symbol} ${p.originDay}${p.deadhead ? ' (deadhead)' : ''}: called ~${fmt(p.call)}, on duty ${fmt(onDuty)} (${p.status === 'ORD' ? 'ordered' : 'planned, so times are estimates'}).${spare}`];
  }
  return { taken: taken(input.now), turns };
}

// Same board as last time? (Ignores when it was taken.)
const sameKey = (shown) => JSON.stringify({ ...shown, taken: null });

// Every <day>\<HHMM>.json in history, oldest first, within `days` of the newest.
function historyFiles(historyDir, days) {
  let dirs = [];
  try { dirs = fs.readdirSync(historyDir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort(); } catch { return []; }
  if (days > 0 && dirs.length) {
    const newest = new Date(`${dirs[dirs.length - 1]}T12:00:00Z`);
    const cutoff = new Date(newest - days * 864e5).toISOString().slice(0, 10);
    dirs = dirs.filter((d) => d > cutoff);
  }
  return dirs.map((d) => ({
    day: d,
    files: fs.readdirSync(path.join(historyDir, d)).filter((f) => /^\d{4}(-\d+)?\.json$/.test(f)).sort().map((f) => path.join(historyDir, d, f)),
  }));
}

// Builds the site folder. Days older than yesterday that were built before
// (same number of checks) are reused, so a month of 5-minute checks doesn't
// get re-read every time.
// names: { file, key } (board-auto.js): the 14h list's crew names, locked
// with BOARD_NAMES_KEY, as data/names.json. No key, no names.
// push: { publicKey } (board-auto.js): turn alerts are on; the page gets the
// key phones subscribe with as data/push.json. No push, no alerts button.
// status: shown on the page if given (no longer used: the checker's health is
// owner-only now, status/health.json via the Worker's /health).
// archiveFile: Analytics' long-term memory (default analytics-archive.json
// next to the history folder), kept archiveDays (BOARD_ARCHIVE_DAYS, 365).
// ym: the yardmaster seniority list's file on the laptop (lib/board/seniority.js), for the test
// site's call order page: data/ym-list.json, its names locked with the names key.
function buildSite({ historyDir, outDir, days = 30, pageFile = PAGE_FILE, now = new Date(), names = null, push = null, status = null, splits = null, postings = null, ym = null,
  archiveFile = path.join(path.dirname(historyDir), 'analytics-archive.json'), statsFile = path.join(path.dirname(historyDir), 'my-stats.json'), archiveDays = +process.env.BOARD_ARCHIVE_DAYS || Archive.KEEP_DAYS } = {}) {
  const dataDir = path.join(outDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const sources = historyFiles(historyDir, days);
  // Name codes split off a shared one (people.js): checks saved before the
  // split are told apart by turn. A day file is redone when the rules change.
  const codeSplits = splits ? People.loadSplits(splits) : People.emptySplits();
  const retieSig = People.splitsSig(codeSplits);
  const index = [];
  const skipped = [];
  let tail = null; // last kept snapshot so far: { key, compare, taken }
  let checked = null; // newest check read, changed or not (index.json "checked")
  const turns = {}; // turn → [{ taken, text }], built oldest first
  const trains = { trains: {} }; // line-up trains followed to the Call Board
  let memory = null; // road-day trains from the checks before (roadday.js)
  let newest = null; // { summary, memory before it }: for "when do I go"
  let nowSeen = null; // the newest check's craft / Call Board train per person (people.json "now")
  const people = {}; // hidden search: person hash → turns seen on, with when (people.js)
  const insights = {}; // runarounds and jobs going spare, for Analytics (insights.js)
  const yardRuns = {}; // every run of every yard job and the turns on it, for My stats (mystats.js collectYard)
  const patterns = {}; // board position, train habits, how wrong the shown time is (patterns.js)
  const resets = Resets.empty(); // the reset tracker's evidence, every day kept (resets.js)

  sources.forEach(({ day, files }, i) => {
    const file = path.join(dataDir, `${day}.json`);
    const settled = i < sources.length - 2;
    if (settled && fs.existsSync(file)) {
      try {
        const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (cached.format === FORMAT && cached.retie === retieSig && cached.sourceCount === files.length && cached.tail) {
          tail = cached.tail;
          const lastSnap = cached.snapshots[cached.snapshots.length - 1];
          if (lastSnap) checked = lastSnap.sameUntil || lastSnap.taken;
          BoardTurns.history(cached.snapshots, turns);
          BoardTrains.track(cached.snapshots, trains);
          Insights.collect(cached.snapshots, insights);
          try { Patterns.collect(cached.snapshots, patterns); } catch { /* the board matters more */ }
          try { MyStatsFiles.collectYard(yardRuns, cached.snapshots); } catch { /* the board matters more */ }
          People.mergeStretches(people, cached.people);
          Resets.merge(resets, cached.resets);
          if (cached.snapshots.length) index.push({ day, count: cached.snapshots.length });
          return;
        }
      } catch { /* rebuild it */ }
    }
    const kept = [];
    const dayPeople = {};
    const dayResets = Resets.empty();
    // Days before this one came from the cache: start from the day before's checks.
    if (!memory && i > 0) memory = RoadDays.rememberFiles(null, sources[i - 1].files);
    for (const f of files) {
      let snap;
      try {
        const summary = JSON.parse(fs.readFileSync(f, 'utf8'));
        const before = memory;
        snap = snapshotOf(summary, memory);
        memory = snap.memory;
        newest = { summary, before };
      } catch (err) {
        skipped.push(`${path.basename(path.dirname(f))}\\${path.basename(f)}: ${err.message}`);
        continue;
      }
      if (!checked || snap.shown.taken > checked) checked = snap.shown.taken;
      const seenPeople = People.retie(newest.summary.people, codeSplits, newest.summary.peopleV, snap.shown.taken);
      People.addSightings(dayPeople, seenPeople, snap.shown.taken);
      try { Resets.collect(dayResets, snap.input, seenPeople, snap.input.now, newest.summary.backfill, { yardDuty: newest.summary.yardDuty === 1 }); } catch { /* the board matters more */ }
      nowSeen = { taken: snap.shown.taken, seen: seenPeople.filter((p) => p.craft || p.train).map(({ h, turn, craft, train }) => ({ h, turn, craft: craft || '', train: train || '' })) };
      const key = sameKey(snap.shown);
      if (tail && tail.key === key) {
        // Unchanged: stretch the previous snapshot instead of repeating it.
        const last = kept[kept.length - 1];
        if (last && snap.shown.taken > last.taken) last.sameUntil = snap.shown.taken;
        continue;
      }
      const changes = tail ? V.changeLines(tail.compare, snap.compare).slice(2).map((l) => l.trim()).filter(Boolean) : null;
      kept.push({ ...snap.shown, prevTaken: tail ? tail.taken : null, changes });
      tail = { key, compare: snap.compare, taken: snap.shown.taken };
    }
    BoardTurns.history(kept, turns);
    BoardTrains.track(kept, trains);
    Insights.collect(kept, insights);
    try { Patterns.collect(kept, patterns); } catch { /* the board matters more */ }
    try { MyStatsFiles.collectYard(yardRuns, kept); } catch { /* the board matters more */ }
    People.mergeStretches(people, dayPeople);
    Resets.merge(resets, dayResets);
    fs.writeFileSync(file, JSON.stringify({ day, format: FORMAT, retie: retieSig, sourceCount: files.length, tail, snapshots: kept, people: dayPeople, resets: dayResets }));
    if (kept.length) index.push({ day, count: kept.length });
  });

  // Days that fell out of the window come off the site too.
  const live = new Set(sources.map((s) => `${s.day}.json`));
  for (const f of fs.readdirSync(dataDir)) if (!live.has(f)) fs.rmSync(path.join(dataDir, f), { force: true });

  index.reverse(); // newest first
  fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify({ generatedAt: now.toISOString(), latest: tail && tail.taken, checked, status, days: index }));
  const turnsDone = BoardTurns.finish(turns);
  fs.writeFileSync(path.join(dataDir, 'turns.json'), JSON.stringify({ generatedAt: now.toISOString(), turns: turnsDone }));
  // Jobs up for bid (owner, 2026-11-11): the laptop's last read of the
  // Circular Inquiry, as it is (job, craft, closing date; no names).
  if (postings) { try { fs.copyFileSync(postings, path.join(dataDir, 'postings.json')); } catch { /* not read yet */ } }
  fs.writeFileSync(path.join(dataDir, 'people.json'), JSON.stringify({ generatedAt: now.toISOString(), people, now: nowSeen }));
  // The reset tracker (owner, 2026-11-03): each own turn now and when its
  // person next needs a reset; the boards colour it yellow / red.
  let resetsOut = {}; // also for My stats, below
  try {
    resetsOut = { turns: Resets.byTurn(resets, people, resets.last), people: Resets.personResets(resets, people, resets.last), offs: Resets.trainOffs(resets) };
    fs.writeFileSync(path.join(dataDir, 'resets.json'), JSON.stringify({ generatedAt: now.toISOString(), taken: tail && tail.taken, since: resets.since, ...resetsOut }));
  } catch (err) { skipped.push(`reset tracker: ${err.message}`); }
  // The test site's reset tracker (owner, 2026-11-13): the same, with each yard shift ending 8 h and its O-T after
  // on duty where CATS has the O-T (3 → 7 with YD), not the 8 / 12 h. Read by the page on the test site only;
  // the main site, the alerts and My stats go on by resets.json.
  try {
    const yardEnds = MyStatsFiles.yardEnds(resets, yardRuns);
    const accT = { ...resets, yardEnds };
    fs.writeFileSync(path.join(dataDir, 'resets-test.json'), JSON.stringify({ generatedAt: now.toISOString(), taken: tail && tail.taken, since: resets.since, yardEnds: Object.keys(yardEnds).length,
      turns: Resets.byTurn(accT, people, resets.last), people: Resets.personResets(accT, people, resets.last), offs: Resets.trainOffs(accT) }));
  } catch (err) { skipped.push(`reset tracker (test site): ${err.message}`); }
  fs.copyFileSync(pageFile, path.join(outDir, 'index.html'));
  const trainRows = BoardTrains.summarize(trains);
  fs.writeFileSync(path.join(dataDir, 'trains.json'), JSON.stringify({ generatedAt: now.toISOString(), trains: trainRows }));
  const found = Insights.finish(insights);
  fs.writeFileSync(path.join(dataDir, 'analytics.json'), JSON.stringify({ generatedAt: now.toISOString(), ...found }));
  // My stats (owner, 2026-11-11): each person's own record, one file each
  // under accounts/stats/, which the Worker only ever hands to the member
  // whose account holds that name code (lib/board/mystats.js). A failure
  // here mustn't cost the rest of the site.
  try {
    const kept = MyStatsFiles.update(MyStatsFiles.load(statsFile), { people, turns: turnsDone, trains: trainRows, resets: resetsOut, analytics: found, nowSeen, acc: resets, yard: yardRuns }, sources.length ? sources[0].day : now.toISOString().slice(0, 10));
    MyStatsFiles.save(statsFile, kept);
    MyStatsFiles.write(outDir, kept);
    // Each pool's average and middle half (no person's own figures), for the tab's pool comparison.
    fs.writeFileSync(path.join(dataDir, 'pools.json'), JSON.stringify(MyStatsFiles.pools(kept, { yard: yardRuns, ot: resets.yardOT })));
    // How each yard job really runs, by its O-T in CATS (3 → 7 with YD): the jobs' own runs, nobody's figures
    // (owner, 2026-11-13; My stats on the test site).
    fs.writeFileSync(path.join(dataDir, 'yardjobs.json'), JSON.stringify(MyStatsFiles.yardJobs(yardRuns, { now: now.toISOString(), ot: resets.yardOT })));
  } catch (err) { skipped.push(`my stats: ${err.message}`); }
  // Patterns across every saved day (test site only for now).
  try { fs.writeFileSync(path.join(dataDir, 'patterns.json'), JSON.stringify({ generatedAt: now.toISOString(), days: index.length, ...Patterns.finish(patterns, trainRows) })); } catch { /* the board matters more */ }
  // Analytics' long-term memory. A failure here mustn't cost the rest of the site.
  try {
    const since = sources.length ? sources[0].day : now.toISOString().slice(0, 10);
    const archive = Archive.update(Archive.load(archiveFile), { trains: trainRows, turns: turnsDone, people, insights: found }, since, { now, keepDays: archiveDays });
    Archive.save(archiveFile, archive);
    // One file per month, and archive.json listing them (F7).
    const { index: archIndex, parts } = Archive.byMonth(Archive.forSite(archive, since));
    for (const [m, part] of Object.entries(parts)) fs.writeFileSync(path.join(dataDir, `archive-${m}.json`), JSON.stringify(part));
    fs.writeFileSync(path.join(dataDir, 'archive.json'), JSON.stringify(archIndex));
  } catch (err) {
    skipped.push(`analytics archive: ${err.message}`);
  }
  const namesOut = path.join(dataDir, 'names.json');
  fs.rmSync(namesOut, { force: true });
  if (names && names.key && names.file) {
    const held = namesForHeld(trainRows, loadNames(names.file), BoardTrains.HELD_LIMIT, now);
    fs.writeFileSync(namesOut, JSON.stringify(lockNames(held, names.key)));
  }
  // Crew names on the board (owner, 2026-11-10): each turn's latest name as
  // "Last, F", locked with the same key as data/crew.json. Only the Worker
  // gives that key out, to approved members, where CREW_NAMES is on
  // (docs/board-checker/ACCOUNTS.md). bunk: who the bunkhouse (28) shows at
  // each position, for the Toronto box (owner, 2026-11-13; names.js
  // recordBunkhouse), only when read in the newest check, with the snapshot
  // that check's board is (taken): the page names that board's crews only.
  // mu: each make-up turn (MU01) as its own row shows it, the same way (owner,
  // 2026-11-13; names.js recordMakeUps): boards [[board, craft, turn, name]]
  // for 501/502 and Garnet, trains [[train, craft, turn, name]] off the Call Board.
  const crewOut = path.join(dataDir, 'crew.json');
  fs.rmSync(crewOut, { force: true });
  if (names && names.key && names.file) {
    const store = loadNames(names.file);
    const bunkRows = newest && tail ? bunkhouseNames(store, newest.summary.probedAt) : [];
    const mu = newest && tail ? makeUpNames(store, newest.summary.probedAt) : null;
    fs.writeFileSync(crewOut, JSON.stringify(lockNames({ at: now.toISOString(), turns: namesByTurn(store, now), working: workingByJob(store, fmt),
      bunk: bunkRows.length ? { taken: tail.taken, rows: bunkRows } : null,
      mu: mu ? { taken: tail.taken, boards: mu.boards.map(([b, ...rest]) => [BOARD_NAME[b] || b, ...rest]), trains: mu.trains } : null }, names.key)));
  }
  // The yardmaster seniority list for the test site's call order page (owner, 2026-11-13): the list
  // without names, and the names by rank locked with the names key, as data/crew.json. No key, no names.
  const ymOut = path.join(dataDir, 'ym-list.json');
  fs.rmSync(ymOut, { force: true });
  if (ym) {
    try {
      const got = Seniority.siteList(ym);
      if (got) {
        // Each person as the newest check showed them, by rank (the test site's "If a yardmaster job went spare now").
        let live = null;
        try { live = newest ? Seniority.liveFacts(got.list, snapshotOf(newest.summary, newest.before).shown) : null; } catch (err) { skipped.push(`yardmaster list now: ${err.message}`); }
        fs.writeFileSync(ymOut, JSON.stringify({ at: now.toISOString(), read: got.read, since: got.since, source: got.source, tempRead: got.tempRead || null, live, list: got.list,
          names: got.names && names && names.key ? lockNames({ byRank: got.names }, names.key) : null }));
      }
    } catch (err) { skipped.push(`yardmaster list: ${err.message}`); }
  }
  for (const [name, from] of Object.entries(YM_FILES)) {
    try { fs.copyFileSync(from(), path.join(outDir, name)); } catch (err) { skipped.push(`${name}: ${err.message}`); }
  }
  fs.copyFileSync(TURNS_FILE, path.join(outDir, 'board-turns.js'));
  fs.copyFileSync(TRAINS_FILE, path.join(outDir, 'board-trains.js'));
  fs.copyFileSync(ANALYTICS_FILE, path.join(outDir, 'board-analytics.js'));
  fs.copyFileSync(path.join(path.dirname(ANALYTICS_FILE), 'board-week.js'), path.join(outDir, 'board-week.js')); // My week (page + Sunday alert)
  fs.copyFileSync(path.join(path.dirname(ANALYTICS_FILE), 'board-mystats.js'), path.join(outDir, 'board-mystats.js')); // My stats tab
  fs.copyFileSync(path.join(path.dirname(ANALYTICS_FILE), 'board-ref.js'), path.join(outDir, 'board-ref.js')); // Reference tab
  for (const [name, from] of Object.entries(PUSH_FILES)) fs.copyFileSync(from, path.join(outDir, name));
  const goOut = path.join(dataDir, 'whengo.json');
  try {
    if (newest) fs.writeFileSync(goOut, JSON.stringify(whenYouGo(newest.summary, newest.before)));
  } catch (err) {
    skipped.push(`when do I go: ${err.message}`);
  }
  const pushOut = path.join(dataDir, 'push.json');
  if (push && push.publicKey) fs.writeFileSync(pushOut, JSON.stringify({ publicKey: push.publicKey }));
  else fs.rmSync(pushOut, { force: true });
  for (const [name, from] of Object.entries(GRIEVANCE_FILES)) {
    try { fs.copyFileSync(from(), path.join(outDir, name)); } catch (err) { skipped.push(`${name}: ${err.message}`); }
  }
  fs.writeFileSync(path.join(outDir, 'agreements.html'), AGREEMENTS_REDIRECT);
  fs.copyFileSync(PUB('board-ask.js'), path.join(outDir, 'board-ask.js'));
  for (const [name, from] of Object.entries(AGREEMENT_FILES)) {
    try {
      const to = path.join(outDir, name);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      if (AGREEMENT_FIX[name]) fs.writeFileSync(to, AGREEMENT_FIX[name](fs.readFileSync(from(), 'utf8')));
      else fs.copyFileSync(from(), to);
    } catch (err) { skipped.push(`${name}: ${err.message}`); }
  }
  fs.writeFileSync(path.join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  return { days: index.length, snapshots: index.reduce((n, d) => n + d.count, 0), latest: tail && tail.taken, skipped };
}

// Where the site goes, read fresh from .env each time, so adding settings
// doesn't need a restart. The data folder's .env wins. Cloudflare R2 (owner,
// 2026-10-22) when its four settings are there, updating after every check
// by default. (Netlify, the first home, was taken out 2026-11-03: owner, "I
// don't use Netlify for this site anymore".)
function siteSettings() {
  let file = {};
  for (const f of ENV_FILES) {
    try { file = dotenv.parse(fs.readFileSync(f)); break; } catch { /* not there */ }
  }
  const get = (name) => (file[name] ?? process.env[name] ?? '').trim();
  const num = (name, dflt) => (get(name) === '' || Number.isNaN(+get(name)) ? dflt : +get(name));
  const r2 = { accountId: get('R2_ACCOUNT_ID'), bucket: get('R2_BUCKET'), keyId: get('R2_ACCESS_KEY_ID'), secret: get('R2_SECRET_ACCESS_KEY') };
  const hasR2 = Object.values(r2).every(Boolean);
  // Some R2 settings but not all: say which, rather than quietly publishing nothing.
  const R2_NAMES = { accountId: 'R2_ACCOUNT_ID', bucket: 'R2_BUCKET', keyId: 'R2_ACCESS_KEY_ID', secret: 'R2_SECRET_ACCESS_KEY' };
  const r2Missing = Object.values(r2).some(Boolean) && !hasR2 ? Object.keys(r2).filter((k) => !r2[k]).map((k) => R2_NAMES[k]) : [];
  return {
    r2: hasR2 ? r2 : null,
    r2Missing,
    days: num('BOARD_SITE_DAYS', 30),
    // Cloudflare uploads are free: every check goes out unless BOARD_SITE_EVERY
    // asks for a gap (owner, 2026-10-22).
    every: Math.max(0, num('BOARD_SITE_EVERY', 0)),
    namesKey: get('BOARD_NAMES_KEY'),
  };
}

// Publishes a built site folder to Cloudflare R2. { ok, message, where }, or
// null when it isn't set up.
async function publishSiteDir(dir, settings, { fetchImpl = fetch } = {}) {
  if (settings.r2) return { where: 'Cloudflare', ...(await deployR2({ dir, r2: settings.r2, fetchImpl })) };
  return null;
}

module.exports = { s5Board, townStatus, spareFills, whenYouGo, crewsOnTheWay, torontoCrews, torontoSouth, snapshotOf, buildSite, publishSiteDir, siteSettings, PAGE_FILE };
