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
const { runBoardCheck, callTime } = require('./engine');
const config = require('./config');
const RoadDays = require('./roadday');
const { deployR2 } = require('./r2');
const V = require('./view');
const { fmt, parts } = require('./time');
const dotenv = require('dotenv');
const { ENV_FILES } = require('./paths');

const BoardTurns = require('../../public/board-turns');
const BoardTrains = require('../../public/board-trains');
const { loadNames, namesForHeld, lockNames } = require('./names');

const PAGE_FILE = path.join(__dirname, '..', '..', 'public', 'board.html');
const TURNS_FILE = path.join(__dirname, '..', '..', 'public', 'board-turns.js');
const TRAINS_FILE = path.join(__dirname, '..', '..', 'public', 'board-trains.js');
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
const FORMAT = 6;
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

// The website is for any member, so the board checker's own asides go.
const siteRules = (text) => text.replace(/, not ours\)/, ')');

// One saved check (a board-probe/board-auto summary) → what the page shows.
// memory: the road day's trains from the checks before it (lib/board/roadday.js),
// so the page counts A/B the way the laptop did; the updated memory comes back.
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
        rules: p ? siteRules(V.goesTo(p)) : 'Toronto train / not counted', call: p ? fmt(p.call) : '', reason: p ? p.reason : '' };
    }),
    onDuty: [...input.callBoard].sort((a, b) => a.onDuty - b.onDuty).map((t) => ({ onDuty: fmt(t.onDuty), station: t.station,
      train: `${t.symbol} ${t.originDay}`, crew: t.crew.map((c) => `${c.craft} ${c.turn}`).join(' · ') })),
    pools: [
      { name: 'Chain Gang (SR) · conductors', turns: board(input.chainGangHome) },
      { name: 'A pool (SA)', turns: board(input.aHome) },
      { name: 'B pool (SB)', turns: board(input.bHome) },
      { name: 'SD · engineers', turns: board(input.sdHome) },
      { name: 'S1 · engineers (A)', turns: board(input.s1Home || []) },
      { name: 'S3 · engineers (B)', turns: board(input.s3Home || []) },
    ].filter((p) => p.turns.length),
    away: input.chainGangAway.map((t) => t.turn),
    returning: g.returning.map((x) => `${x.turn} (${x.train})`),
    sequence: r.today.map((t) => ({ order: fmt(t.order), train: `${t.symbol} ${t.originDay}`, turn: t.turn || '', expected: t.expected, actual: t.actual || '' })),
    flags: r.flags.map((x) => x.text),
    // Mac yard (owner, 2026-10-17). REST is always 8 h after off duty, so
    // off duty = REST − 8 h; no REST = already rested. Rested by now =
    // available (rest until 0000 is available at 0000).
    bunkhouse: (input.bunkhouse || []).map((c) => ({
      pos: String(c.pos).padStart(3, '0'), en: c.en || '', co: c.co || '',
      offDuty: c.restUntil != null ? fmt(c.restUntil - REST_MIN) : '', rested: c.restUntil != null ? fmt(c.restUntil) : '',
      ready: c.restUntil == null || c.restUntil <= r.now,
    })),
    // Crews take these trains in bunkhouse order, skipping any still on rest
    // at the call (torontoCrews).
    macLineup: (() => {
      const crews = input.bunkhouse || [];
      const trains = input.macLineup || [];
      const pick = torontoCrews(trains, crews);
      return trains.map((t, n) => {
        const c = crews[pick[n]];
        const call = callTime(t.order, !!t.deadhead, config);
        // Crews ahead of the one picked, passed over because of rest.
        const skipped = crews.filter((x, k) => k < (pick[n] < 0 ? crews.length : pick[n]) && !pick.slice(0, n).includes(k))
          .map((x) => `${String(x.pos).padStart(3, '0')} ${[x.en, x.co].filter(Boolean).join(' + ')} (rest until ${fmt(x.restUntil)})`);
        return { order: fmt(t.order), status: t.status, train: `${t.symbol} ${t.originDay}`, info: t.info || '', orstn: t.originStation || '',
          call: fmt(call), crew: c ? [c.en, c.co].filter(Boolean).join(' + ') : '', crewPos: c ? String(c.pos).padStart(3, '0') : '',
          crewRested: c && c.restUntil != null ? fmt(c.restUntil) : '', skipped };
      });
    })(),
  };
  return { shown, compare: V.snapshot(r, []), memory: known };
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
function buildSite({ historyDir, outDir, days = 30, pageFile = PAGE_FILE, now = new Date(), names = null } = {}) {
  const dataDir = path.join(outDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const sources = historyFiles(historyDir, days);
  const index = [];
  const skipped = [];
  let tail = null; // last kept snapshot so far: { key, compare, taken }
  const turns = {}; // turn → [{ taken, text }], built oldest first
  const trains = { trains: {} }; // line-up trains followed to the Call Board
  let memory = null; // road-day trains from the checks before (roadday.js)

  sources.forEach(({ day, files }, i) => {
    const file = path.join(dataDir, `${day}.json`);
    const settled = i < sources.length - 2;
    if (settled && fs.existsSync(file)) {
      try {
        const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (cached.format === FORMAT && cached.sourceCount === files.length && cached.tail) {
          tail = cached.tail;
          BoardTurns.history(cached.snapshots, turns);
          BoardTrains.track(cached.snapshots, trains);
          if (cached.snapshots.length) index.push({ day, count: cached.snapshots.length });
          return;
        }
      } catch { /* rebuild it */ }
    }
    const kept = [];
    // Days before this one came from the cache: start from the day before's checks.
    if (!memory && i > 0) memory = RoadDays.rememberFiles(null, sources[i - 1].files);
    for (const f of files) {
      let snap;
      try {
        snap = snapshotOf(JSON.parse(fs.readFileSync(f, 'utf8')), memory);
        memory = snap.memory;
      } catch (err) {
        skipped.push(`${path.basename(path.dirname(f))}\\${path.basename(f)}: ${err.message}`);
        continue;
      }
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
    fs.writeFileSync(file, JSON.stringify({ day, format: FORMAT, sourceCount: files.length, tail, snapshots: kept }));
    if (kept.length) index.push({ day, count: kept.length });
  });

  // Days that fell out of the window come off the site too.
  const live = new Set(sources.map((s) => `${s.day}.json`));
  for (const f of fs.readdirSync(dataDir)) if (!live.has(f)) fs.rmSync(path.join(dataDir, f), { force: true });

  index.reverse(); // newest first
  fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify({ generatedAt: now.toISOString(), latest: tail && tail.taken, days: index }));
  fs.writeFileSync(path.join(dataDir, 'turns.json'), JSON.stringify({ generatedAt: now.toISOString(), turns: BoardTurns.finish(turns) }));
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
  for (const [name, from] of Object.entries(GRIEVANCE_FILES)) {
    try { fs.copyFileSync(from(), path.join(outDir, name)); } catch (err) { skipped.push(`${name}: ${err.message}`); }
  }
  fs.writeFileSync(path.join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  return { days: index.length, snapshots: index.reduce((n, d) => n + d.count, 0), latest: tail && tail.taken, skipped };
}

// Where the site goes, read fresh from .env each time (like the AI review),
// so adding settings doesn't need a restart. The data folder's .env wins.
// Cloudflare R2 (owner, 2026-10-22) when its four settings are there,
// updating every 15 min by default; otherwise Netlify, every 90 (each Netlify
// deploy costs credits).
function siteSettings() {
  let file = {};
  for (const f of ENV_FILES) {
    try { file = dotenv.parse(fs.readFileSync(f)); break; } catch { /* not there */ }
  }
  const get = (name) => (file[name] ?? process.env[name] ?? '').trim();
  const num = (name, dflt) => (get(name) === '' || Number.isNaN(+get(name)) ? dflt : +get(name));
  const r2 = { accountId: get('R2_ACCOUNT_ID'), bucket: get('R2_BUCKET'), keyId: get('R2_ACCESS_KEY_ID'), secret: get('R2_SECRET_ACCESS_KEY') };
  const hasR2 = Object.values(r2).every(Boolean);
  return {
    r2: hasR2 ? r2 : null,
    token: get('NETLIFY_AUTH_TOKEN'),
    siteId: get('NETLIFY_SITE_ID'),
    days: num('BOARD_SITE_DAYS', 30),
    every: Math.max(5, num('BOARD_SITE_EVERY', hasR2 ? 15 : 90)),
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

module.exports = { torontoCrews, snapshotOf, buildSite, deploySite, publishSiteDir, siteFiles, siteSettings, PAGE_FILE };
