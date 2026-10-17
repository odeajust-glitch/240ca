// The line-up snapshot website (owner, 2026-10-16): every saved check in
// history\ becomes a page a union rep can browse, published to Netlify by the
// laptop itself. Only what's on the masked screens goes out; nothing about
// whose turn it is.
//
// Output (in BoardChecker\site): index.html (public/board.html),
// board-turns.js, robots.txt, data/index.json (the days there are),
// data/<YYYY-MM-DD>.json (that day's snapshots), data/turns.json (each
// turn's history across all of them, for "find a turn") and data/trains.json
// (each line-up train from first sighting to on duty, for the order summary). A check identical to the one before it isn't repeated; the
// earlier one gets "same until" instead.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadSummary } = require('./summary');
const { runBoardCheck } = require('./engine');
const V = require('./view');
const { fmt, parts } = require('./time');
const dotenv = require('dotenv');
const { ENV_FILES } = require('./paths');

const BoardTurns = require('../../public/board-turns');
const BoardTrains = require('../../public/board-trains');

const PAGE_FILE = path.join(__dirname, '..', '..', 'public', 'board.html');
const TURNS_FILE = path.join(__dirname, '..', '..', 'public', 'board-turns.js');
const TRAINS_FILE = path.join(__dirname, '..', '..', 'public', 'board-trains.js');
const pad = (n) => String(n).padStart(2, '0');
// Bump when what a snapshot shows changes, so day files built earlier are redone.
const FORMAT = 3;
const taken = (t) => { const p = parts(t); return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}${pad(p.minute)}`; };

// Rest in the bunkhouse is always 10 h from going off duty (owner).
const REST_MIN = 10 * 60;

// The website is for any member, so the board checker's own asides go.
const siteRules = (text) => text.replace(/, not ours\)/, ')');

// One saved check (a board-probe/board-auto summary) → what the page shows.
function snapshotOf(summary) {
  const input = loadSummary(summary);
  const r = runBoardCheck(input);
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
    // Mac yard (owner, 2026-10-17). REST is always 10 h after off duty, so
    // off duty = REST − 10 h; no REST = already rested. Rested by now =
    // available (rest until 0000 is available at 0000).
    bunkhouse: (input.bunkhouse || []).map((c) => ({
      pos: String(c.pos).padStart(3, '0'), en: c.en || '', co: c.co || '',
      offDuty: c.restUntil != null ? fmt(c.restUntil - REST_MIN) : '', rested: c.restUntil != null ? fmt(c.restUntil) : '',
      ready: c.restUntil == null || c.restUntil <= r.now,
    })),
    // Crews take these trains in bunkhouse order: first crew, first train.
    macLineup: (input.macLineup || []).map((t, i) => {
      const c = (input.bunkhouse || [])[i];
      return { order: fmt(t.order), status: t.status, train: `${t.symbol} ${t.originDay}`, info: t.info || '', orstn: t.originStation || '',
        crew: c ? [c.en, c.co].filter(Boolean).join(' + ') : '', crewPos: c ? String(c.pos).padStart(3, '0') : '',
        crewRested: c && c.restUntil != null ? fmt(c.restUntil) : '' };
    }),
  };
  return { shown, compare: V.snapshot(r, []) };
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
function buildSite({ historyDir, outDir, days = 30, pageFile = PAGE_FILE, now = new Date() } = {}) {
  const dataDir = path.join(outDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const sources = historyFiles(historyDir, days);
  const index = [];
  const skipped = [];
  let tail = null; // last kept snapshot so far: { key, compare, taken }
  const turns = {}; // turn → [{ taken, text }], built oldest first
  const trains = { trains: {} }; // line-up trains followed to the Call Board

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
    for (const f of files) {
      let snap;
      try {
        snap = snapshotOf(JSON.parse(fs.readFileSync(f, 'utf8')));
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
  delete turns.__last;
  fs.writeFileSync(path.join(dataDir, 'turns.json'), JSON.stringify({ generatedAt: now.toISOString(), turns }));
  fs.copyFileSync(pageFile, path.join(outDir, 'index.html'));
  fs.writeFileSync(path.join(dataDir, 'trains.json'), JSON.stringify({ generatedAt: now.toISOString(), trains: BoardTrains.summarize(trains) }));
  fs.copyFileSync(TURNS_FILE, path.join(outDir, 'board-turns.js'));
  fs.copyFileSync(TRAINS_FILE, path.join(outDir, 'board-trains.js'));
  fs.writeFileSync(path.join(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  return { days: index.length, snapshots: index.reduce((n, d) => n + d.count, 0), latest: tail && tail.taken, skipped };
}

// Netlify settings, read fresh from .env each time (like the AI review), so
// adding them doesn't need a restart. The data folder's .env wins.
function siteSettings() {
  let file = {};
  for (const f of ENV_FILES) {
    try { file = dotenv.parse(fs.readFileSync(f)); break; } catch { /* not there */ }
  }
  const get = (name) => (file[name] ?? process.env[name] ?? '').trim();
  const num = (name, dflt) => (get(name) === '' || Number.isNaN(+get(name)) ? dflt : +get(name));
  return {
    token: get('NETLIFY_AUTH_TOKEN'),
    siteId: get('NETLIFY_SITE_ID'),
    days: num('BOARD_SITE_DAYS', 30),
    every: Math.max(5, num('BOARD_SITE_EVERY', 90)),
  };
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

module.exports = { snapshotOf, buildSite, deploySite, siteFiles, siteSettings, PAGE_FILE };
