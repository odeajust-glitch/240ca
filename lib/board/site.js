// The line-up snapshot website (owner, 2026-10-16): every saved check in
// history\ becomes a page a union rep can browse, published to Netlify by the
// laptop itself. Only what's on the masked screens goes out; nothing about
// whose turn it is.
//
// Output (in BoardChecker\site): index.html (public/board.html),
// board-turns.js, board-trains.js, the 14h tab's grievance files, robots.txt, data/index.json (the days there are),
// data/<YYYY-MM-DD>.json (that day's snapshots), data/turns.json (each
// turn's history across all of them, for "find a turn") and data/trains.json
// (each line-up train from first sighting to on duty, for the order summary). A check identical to the one before it isn't repeated; the
// earlier one gets "same until" instead.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadSummary } = require('./summary');
const { runBoardCheck, callTime, fromToronto, isExcluded } = require('./engine');
const config = require('./config');
const RoadDays = require('./roadday');
const { deployR2 } = require('./r2');
const V = require('./view');
const People = require('./people');
const { spareFills, onDutyAlready, sdBackups, srBackups } = require('./spares');
const { describeMe } = require('./report');
const { fmt, parts } = require('./time');
const dotenv = require('dotenv');
const { ENV_FILES } = require('./paths');

const BoardTurns = require('../../public/board-turns');
const BoardTrains = require('../../public/board-trains');
const { loadNames, namesForHeld, lockNames } = require('./names');

const PAGE_FILE = path.join(__dirname, '..', '..', 'public', 'board.html');
const TURNS_FILE = path.join(__dirname, '..', '..', 'public', 'board-turns.js');
const TRAINS_FILE = path.join(__dirname, '..', '..', 'public', 'board-trains.js');
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
const pad = (n) => String(n).padStart(2, '0');
// Bump when what a snapshot shows changes, so day files built earlier are redone.
const FORMAT = 10;
const taken = (t) => { const p = parts(t); return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}${pad(p.minute)}`; };

// Rest in the bunkhouse is always 8 h from going off duty (owner, 2026-10-17;
// first said 10 h).
const REST_MIN = 8 * 60;

// Toronto crews take the Mac yard trains in bunkhouse order, but a crew
// still on rest at a train's call is skipped and keeps its place; the next
// rested crew takes it (owner, 2026-10-22; rest ending at the call =
// available, as at Sarnia). Index into `crews` per train, or -1.
function torontoCrews(trains, crews) {
  const used = new Set();
  return trains.map((t) => {
    const call = callTime(t.order, !!t.deadhead, config);
    const i = crews.findIndex((c, k) => !used.has(k) && (c.restUntil == null || c.restUntil <= call));
    if (i >= 0) used.add(i);
    return i;
  });
}

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
      const en = (t.crew.find((c) => /^(EN|LE)$/.test(c.craft)) || t.crew.find((c) => c.craft !== 'CO') || {}).turn || '';
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
// A yard job is taken as 8 hours (owner, 2026-10-24).
const YARD_MIN = 8 * 60;
// 501/502 and Garnet: one row per turn (the conductor's, else the
// engineer's), away turns marked.
// awayMark false: Garnet's turns are all at Garnet (TERM 1), nothing to mark.
function otherBoard(list, now, awayMark = true) {
  const byTurn = new Map();
  for (const t of list) if (!byTurn.has(t.turn) || t.craft === 'CO') byTurn.set(t.turn, t);
  return [...byTurn.values()].sort((a, b) => a.terminal - b.terminal || a.pos - b.pos).map((t) => {
    const st = V.gangStatus(t, now);
    const bits = t.terminal && awayMark ? [`away (term ${t.terminal})`, ...(st === 'available' ? [] : [st])] : [st];
    return { pos: String(t.pos).padStart(3, '0'), turn: t.turn, status: bits.join('; ') };
  });
}

function snapshotOf(summary, memory = null) {
  const input = loadSummary(summary);
  const known = RoadDays.remember(memory, input.callBoard, input.now);
  const r = runBoardCheck({ ...input, departed: RoadDays.departed(known, input.callBoard), seenSince: known.since });
  const pred = new Map(r.predictions.map((p) => [`${p.symbol}/${p.originDay}`, p]));
  const board = (list) => list.map((t) => ({ pos: String(t.pos).padStart(3, '0'), turn: t.turn, status: V.gangStatus(t, r.now) }));
  const g = r.chainGang || { returning: [] };
  const shown = {
    taken: taken(r.now),
    screens: Object.entries(input.seen).filter(([k, v]) => v && k !== 'callBoardPages').map(([k]) => k),
    lineup: [...input.lineup].sort((a, b) => a.order - b.order).map((t) => {
      const p = pred.get(`${t.symbol}/${t.originDay}`);
      return { order: fmt(t.order), status: t.status, train: `${t.symbol} ${t.originDay}`, deadhead: !!t.deadhead,
        info: t.info || '', engCrew: t.engCrew || '', trnCrew: t.trnCrew || '',
        rules: p ? siteRules(V.goesTo(p)) : 'Toronto train / not counted', call: p ? fmt(p.call) : '', reason: p ? p.reason : '',
        // The crew predicted (not one CATS already shows), to score later (owner, 2026-10-22).
        pred: p && !p.known && p.pool !== 'S5' && (p.turn || p.engineer) ? { co: p.turn || '', en: p.engineer || '' } : null };
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
      { name: 'Conductor fast board', turns: board((input.spareboards || {}).coFast || []) },
      { name: 'Conductor slow board', turns: board((input.spareboards || {}).coSlow || []) },
      { name: 'Engineer fast board', turns: board((input.spareboards || {}).enFast || []) },
      { name: 'Engineer slow board', turns: board((input.spareboards || {}).enSlow || []) },
      { name: '501/502 (S5)', turns: otherBoard(input.s5 || [], r.now) },
      { name: 'Garnet', turns: otherBoard(input.garnet || [], r.now, false) },
    ].filter((p) => p.turns.length),
    // Yard jobs on duty (owner, 2026-10-24): taken as 8 h long.
    yardJobs: (input.yardJobs || []).map((j) => ({ job: j.job, station: j.station, onDuty: j.onDuty != null ? fmt(j.onDuty) : '',
      off: j.onDuty != null ? fmt(j.onDuty + YARD_MIN) : '', crew: j.crew.map((c) => `${c.craft} ${c.turn}`).join(' · ') })),
    // The jobs going spare (option 5, vacancies only).
    // Yardmaster jobs (CC YA) go to the yardmaster spareboard, not ours:
    // left off (owner, 2026-10-24).
    vacancies: (() => {
      const ours = (input.vacancies || []).filter((j) => j.cc !== 'YA');
      // A job already on duty is filled: no one else is predicted for it.
      const open = ours.filter((j) => !onDutyAlready(j, input.yardJobs, input.callBoard));
      const fills = spareFills(open, input.spareboards);
      // No one free on the slow board: the SD (engineer job) or SR turn that may be called.
      const pending = r.predictions.filter((p) => p.onDutyAt == null);
      const sd = sdBackups(open, fills, input.sdHome, new Set(pending.map((p) => p.engineer).filter(Boolean)));
      const sr = srBackups(open, fills, input.chainGangHome.filter((t) => t.craft === 'CO'), new Set(pending.map((p) => p.turn).filter(Boolean)));
      return ours.map((j) => {
        const f = fills.get(j);
        return { pos: String(j.pos).padStart(3, '0'), at: j.at != null ? fmt(j.at) : '', status: j.status,
          train: j.train, pool: j.pool, cc: j.cc, turn: j.turn, yard: j.yard, spare: /\*\*/.test(j.st), returns: j.returns != null ? fmt(j.returns) : '',
          // The spare turn expected to fill it (estimate).
          fill: f ? { turn: f.turn, board: f.board, call: fmt(f.call), skipped: f.skipped, sd: (sd.get(j) || sr.get(j) || {}).turn || '' } : null };
      });
    })(),
    away: input.chainGangAway.map((t) => t.turn),
    returning: g.returning.map((x) => `${x.turn} (${x.train})`),
    sequence: r.today.map((t) => ({ order: fmt(t.order), train: `${t.symbol} ${t.originDay}`, turn: t.turn || '', expected: t.expected, actual: t.actual || '' })),
    flags: r.flags.map((x) => x.text),
    // Mac yard (owner, 2026-10-17). REST is always 8 h after off duty, so
    // off duty = REST − 8 h; no REST = already rested. Rested by now =
    // available (rest until 0000 is available at 0000).
    // Crews on duty out of Sarnia, not in the bunkhouse yet (estimated times).
    onTheWay: crewsOnTheWay(input.callBoard, input.bunkhouse || []).map((c) => ({
      crew: [c.en, c.co].filter(Boolean).join(' + '), en: c.en, co: c.co, train: c.train,
      onDuty: fmt(c.onDuty), offDuty: fmt(c.offDuty), rested: fmt(c.restUntil),
    })),
    bunkhouse: (input.bunkhouse || []).map((c) => ({
      pos: String(c.pos).padStart(3, '0'), en: c.en || '', co: c.co || '',
      offDuty: c.restUntil != null ? fmt(c.restUntil - REST_MIN) : '', rested: c.restUntil != null ? fmt(c.restUntil) : '',
      ready: c.restUntil == null || c.restUntil <= r.now,
    })),
    // Crews take these trains in bunkhouse order, skipping any still on rest
    // at the call (torontoCrews); after the bunkhouse, the crews still on
    // their way (crewsOnTheWay), estimated.
    macLineup: (() => {
      const crews = [...(input.bunkhouse || []), ...crewsOnTheWay(input.callBoard, input.bunkhouse || [])];
      const trains = input.macLineup || [];
      const pick = torontoCrews(trains, crews);
      return trains.map((t, n) => {
        const c = crews[pick[n]];
        const call = callTime(t.order, !!t.deadhead, config);
        // Crews ahead of the one picked, passed over because of rest.
        const skipped = crews.filter((x, k) => k < (pick[n] < 0 ? crews.length : pick[n]) && !pick.slice(0, n).includes(k))
          .map((x) => `${x.expected ? 'on the way:' : String(x.pos).padStart(3, '0')} ${[x.en, x.co].filter(Boolean).join(' + ')} (rest until ${x.expected ? '~' : ''}${fmt(x.restUntil)})`);
        return { order: fmt(t.order), status: t.status, train: `${t.symbol} ${t.originDay}`, info: t.info || '', orstn: t.originStation || '',
          call: fmt(call), crew: c ? [c.en, c.co].filter(Boolean).join(' + ') : '', crewPos: c && !c.expected ? String(c.pos).padStart(3, '0') : '',
          crewRested: c && c.restUntil != null ? fmt(c.restUntil) : '', skipped,
          // A crew not in the bunkhouse yet: where it is now and the guesses.
          crewExpected: c && c.expected ? { train: c.train, onDuty: fmt(c.onDuty), offDuty: fmt(c.offDuty), rested: fmt(c.restUntil), deadhead: c.deadhead } : null,
          pred: c ? { co: c.co || '', en: c.en || '' } : null };
      });
    })(),
  };
  return { shown, compare: V.snapshot(r, []), memory: known };
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
  for (const p of r.predictions) {
    if (!p.engineer || p.onDutyAt || turns[p.engineer]) continue;
    const onDuty = p.order - config.prepMinutes[p.deadhead ? 'deadhead' : 'train'];
    turns[p.engineer] = [`${p.symbol} ${p.originDay}${p.deadhead ? ' (deadhead)' : ''}: called ~${fmt(p.call)}, on duty ${fmt(onDuty)} (${p.status === 'ORD' ? 'ordered' : 'planned, so times are estimates'}).`];
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
// status: { lastSignInAt, restartsToday } (board-auto.js), shown on the page.
function buildSite({ historyDir, outDir, days = 30, pageFile = PAGE_FILE, now = new Date(), names = null, push = null, status = null } = {}) {
  const dataDir = path.join(outDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const sources = historyFiles(historyDir, days);
  const index = [];
  const skipped = [];
  let tail = null; // last kept snapshot so far: { key, compare, taken }
  let checked = null; // newest check read, changed or not (index.json "checked")
  const turns = {}; // turn → [{ taken, text }], built oldest first
  const trains = { trains: {} }; // line-up trains followed to the Call Board
  let memory = null; // road-day trains from the checks before (roadday.js)
  let newest = null; // { summary, memory before it }: for "when do I go"
  const people = {}; // hidden search: person hash → turns seen on, with when (people.js)

  sources.forEach(({ day, files }, i) => {
    const file = path.join(dataDir, `${day}.json`);
    const settled = i < sources.length - 2;
    if (settled && fs.existsSync(file)) {
      try {
        const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (cached.format === FORMAT && cached.sourceCount === files.length && cached.tail) {
          tail = cached.tail;
          const lastSnap = cached.snapshots[cached.snapshots.length - 1];
          if (lastSnap) checked = lastSnap.sameUntil || lastSnap.taken;
          BoardTurns.history(cached.snapshots, turns);
          BoardTrains.track(cached.snapshots, trains);
          People.mergeStretches(people, cached.people);
          if (cached.snapshots.length) index.push({ day, count: cached.snapshots.length });
          return;
        }
      } catch { /* rebuild it */ }
    }
    const kept = [];
    const dayPeople = {};
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
      People.addSightings(dayPeople, newest.summary.people, snap.shown.taken);
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
    People.mergeStretches(people, dayPeople);
    fs.writeFileSync(file, JSON.stringify({ day, format: FORMAT, sourceCount: files.length, tail, snapshots: kept, people: dayPeople }));
    if (kept.length) index.push({ day, count: kept.length });
  });

  // Days that fell out of the window come off the site too.
  const live = new Set(sources.map((s) => `${s.day}.json`));
  for (const f of fs.readdirSync(dataDir)) if (!live.has(f)) fs.rmSync(path.join(dataDir, f), { force: true });

  index.reverse(); // newest first
  fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify({ generatedAt: now.toISOString(), latest: tail && tail.taken, checked, status, days: index }));
  fs.writeFileSync(path.join(dataDir, 'turns.json'), JSON.stringify({ generatedAt: now.toISOString(), turns: BoardTurns.finish(turns) }));
  fs.writeFileSync(path.join(dataDir, 'people.json'), JSON.stringify({ generatedAt: now.toISOString(), people }));
  fs.copyFileSync(pageFile, path.join(outDir, 'index.html'));
  const trainRows = BoardTrains.summarize(trains);
  fs.writeFileSync(path.join(dataDir, 'trains.json'), JSON.stringify({ generatedAt: now.toISOString(), trains: trainRows }));
  const namesOut = path.join(dataDir, 'names.json');
  fs.rmSync(namesOut, { force: true });
  if (names && names.key && names.file) {
    const held = namesForHeld(trainRows, loadNames(names.file), BoardTrains.HELD_LIMIT, now);
    fs.writeFileSync(namesOut, JSON.stringify(lockNames(held, names.key)));
  }
  fs.copyFileSync(TURNS_FILE, path.join(outDir, 'board-turns.js'));
  fs.copyFileSync(TRAINS_FILE, path.join(outDir, 'board-trains.js'));
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
  fs.writeFileSync(path.join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  return { days: index.length, snapshots: index.reduce((n, d) => n + d.count, 0), latest: tail && tail.taken, skipped };
}

// Where the site goes, read fresh from .env each time (like the AI review),
// so adding settings doesn't need a restart. The data folder's .env wins.
// Cloudflare R2 (owner, 2026-10-22) when its four settings are there,
// updating after every check by default; otherwise Netlify, every 90 (each
// Netlify deploy costs credits).
function siteSettings() {
  let file = {};
  for (const f of ENV_FILES) {
    try { file = dotenv.parse(fs.readFileSync(f)); break; } catch { /* not there */ }
  }
  const get = (name) => (file[name] ?? process.env[name] ?? '').trim();
  const num = (name, dflt) => (get(name) === '' || Number.isNaN(+get(name)) ? dflt : +get(name));
  const r2 = { accountId: get('R2_ACCOUNT_ID'), bucket: get('R2_BUCKET'), keyId: get('R2_ACCESS_KEY_ID'), secret: get('R2_SECRET_ACCESS_KEY') };
  const hasR2 = Object.values(r2).every(Boolean);
  // Some R2 settings but not all: say which, rather than quietly using Netlify.
  const R2_NAMES = { accountId: 'R2_ACCOUNT_ID', bucket: 'R2_BUCKET', keyId: 'R2_ACCESS_KEY_ID', secret: 'R2_SECRET_ACCESS_KEY' };
  const r2Missing = Object.values(r2).some(Boolean) && !hasR2 ? Object.keys(r2).filter((k) => !r2[k]).map((k) => R2_NAMES[k]) : [];
  return {
    r2: hasR2 ? r2 : null,
    r2Missing,
    token: get('NETLIFY_AUTH_TOKEN'),
    siteId: get('NETLIFY_SITE_ID'),
    days: num('BOARD_SITE_DAYS', 30),
    // Cloudflare uploads are free: every check goes out unless BOARD_SITE_EVERY
    // asks for a gap (owner, 2026-10-22). Netlify: at least 5 min apart.
    every: hasR2 ? Math.max(0, num('BOARD_SITE_EVERY', 0)) : Math.max(5, num('BOARD_SITE_EVERY', 90)),
    namesKey: get('BOARD_NAMES_KEY'),
  };
}

// Publishes a built site folder wherever the settings point: Cloudflare R2
// first, else Netlify. { ok, message, where } or null when neither is set up.
async function publishSiteDir(dir, settings, { fetchImpl = fetch } = {}) {
  if (settings.r2) return { where: 'Cloudflare', ...(await deployR2({ dir, r2: settings.r2, fetchImpl })) };
  if (settings.token && settings.siteId) return { where: 'Netlify', ...(await deploySite({ dir, siteId: settings.siteId, token: settings.token, fetchImpl })) };
  return null;
}

// Every file in the site folder, as Netlify paths ("/data/index.json").
function siteFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? siteFiles(full, base) : [{ full, url: `/${path.relative(base, full).split(path.sep).join('/')}` }];
  });
}

// Publishes the folder with Netlify's file-digest deploy: send the SHA1 of
// every file, then upload only the ones Netlify doesn't have yet (usually
// today's data and the index). Never throws; a failed publish mustn't stop
// the board check.
async function deploySite({ dir, siteId, token, fetchImpl = fetch, api = 'https://api.netlify.com/api/v1' }) {
  try {
    const files = siteFiles(dir).map((f) => {
      const body = fs.readFileSync(f.full);
      return { ...f, body, sha: crypto.createHash('sha1').update(body).digest('hex') };
    });
    const auth = { Authorization: `Bearer ${token}` };
    const res = await fetchImpl(`${api}/sites/${encodeURIComponent(siteId)}/deploys`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: Object.fromEntries(files.map((f) => [f.url, f.sha])) }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const why = res.status === 401 ? 'Netlify refused the token (NETLIFY_AUTH_TOKEN)'
        : res.status === 404 ? 'Netlify has no site with that NETLIFY_SITE_ID for this token'
          : `Netlify answered ${res.status}`;
      return { ok: false, message: why };
    }
    const deploy = await res.json();
    const need = new Set(deploy.required || []);
    let uploaded = 0;
    for (const f of files) {
      if (!need.has(f.sha)) continue;
      need.delete(f.sha); // two identical files only need one upload
      const put = await fetchImpl(`${api}/deploys/${deploy.id}/files${f.url.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/octet-stream' },
        body: f.body,
        signal: AbortSignal.timeout(60000),
      });
      if (!put.ok) return { ok: false, message: `upload of ${f.url} failed (${put.status})` };
      uploaded++;
    }
    return { ok: true, uploaded, url: deploy.ssl_url || deploy.url || null };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

module.exports = { spareFills, whenYouGo, crewsOnTheWay, torontoCrews, snapshotOf, buildSite, deploySite, publishSiteDir, siteFiles, siteSettings, PAGE_FILE };
