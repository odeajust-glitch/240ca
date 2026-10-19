// Gets each board check from the owner's laptop to their phone (2026-10-15).
// board-auto.js pushes the finished check here; the RailroadTracker app pulls
// the latest one and shows it on its Board card. Only the newest check is
// kept: the app wants "when do I go now", and the laptop keeps its own
// history. Kept apart from the app's lineup evidence on purpose (owner's
// decision): these come from software reading CATS, the evidence log doesn't.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { localIso } = require('./time');

const MAX_REPORT_CHARS = 20000;
const MAX_LINES = 200;

// Constant-time, so the key can't be guessed a character at a time.
function keyMatches(provided, expected) {
  if (!expected) return false;
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function bearer(req) {
  const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
  return m ? m[1] : '';
}

const isLines = (v) => Array.isArray(v) && v.length <= MAX_LINES && v.every((l) => typeof l === 'string' && l.length <= 500);

// "When do I go to work?" as fields, for the app's own alerts (owner,
// 2026-10-17: lined up in Sarnia, ordered, on-duty time moved 30 min+).
// Built from runBoardCheck's `me`; times are railway local, no zone.
function mineForPhone(m) {
  if (!m) return null;
  if (m.train) {
    return {
      turn: m.turn, state: 'linedUp', train: m.train, status: m.status, deadhead: !!m.deadhead,
      callAt: localIso(m.call), onDutyAt: localIso(m.onDuty),
    };
  }
  if (m.comingHome) return { turn: m.turn, state: 'comingHome', train: m.comingHome };
  if (m.notFound) return { turn: m.turn, state: 'notFound' };
  return {
    turn: m.turn, state: 'waiting',
    ahead: m.ahead.map((a) => a.turn),
    myRestUntil: m.myRestUntil != null ? localIso(m.myRestUntil) : null,
  };
}

const STATES = ['linedUp', 'waiting', 'comingHome', 'notFound'];
const isShort = (v) => typeof v === 'string' && v.length <= 40;
const isLocalTime = (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(v);

// Keeps only the known fields, so the server never stores anything else.
function validateMine(m) {
  if (m == null) return { mine: null };
  if (typeof m !== 'object' || !isShort(m.turn) || !STATES.includes(m.state)) return { error: 'mine must have a turn and a known state.' };
  const out = { turn: m.turn, state: m.state };
  if (m.state === 'linedUp') {
    if (!isShort(m.train) || !isShort(m.status) || !isLocalTime(m.callAt) || !isLocalTime(m.onDutyAt)) {
      return { error: 'mine: a lined-up turn needs train, status, callAt and onDutyAt.' };
    }
    Object.assign(out, { train: m.train, status: m.status, deadhead: !!m.deadhead, callAt: m.callAt, onDutyAt: m.onDutyAt });
  } else if (m.state === 'comingHome') {
    if (!isShort(m.train)) return { error: 'mine: coming home needs the train.' };
    out.train = m.train;
  } else if (m.state === 'waiting') {
    if (!Array.isArray(m.ahead) || m.ahead.length > MAX_LINES || !m.ahead.every(isShort)) return { error: 'mine.ahead must be a list of turns.' };
    if (m.myRestUntil != null && !isLocalTime(m.myRestUntil)) return { error: 'mine.myRestUntil must be a local time.' };
    Object.assign(out, { ahead: m.ahead, myRestUntil: m.myRestUntil ?? null });
  }
  return { mine: out };
}

// Returns the cleaned check, or an error message.
function validateCheck(body) {
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object.' };
  const { checkedAt, me, report, changes, myAnswerChanged } = body;
  if (typeof checkedAt !== 'string' || Number.isNaN(Date.parse(checkedAt))) return { error: 'checkedAt must be an ISO time.' };
  if (!isLines(me)) return { error: 'me must be a list of lines.' };
  if (typeof report !== 'string' || report.length > MAX_REPORT_CHARS) return { error: 'report must be text.' };
  if (changes != null && !isLines(changes)) return { error: 'changes must be a list of lines.' };
  const { mine, error } = validateMine(body.mine);
  if (error) return { error };
  return {
    check: {
      checkedAt: new Date(checkedAt).toISOString(),
      me,
      report,
      changes: changes || [],
      myAnswerChanged: !!myAnswerChanged,
      mine,
    },
  };
}

// Holds the latest check, saved to disk so a restart or deploy doesn't blank
// the phone's card.
class BoardRelay {
  constructor(dir) {
    this.file = path.join(dir, 'board-latest.json');
    this.latest = null;
    try { this.latest = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { /* none yet */ }
  }

  save(check) {
    // An older check arriving late (laptop retry) mustn't replace a newer one.
    if (this.latest && Date.parse(this.latest.checkedAt) > Date.parse(check.checkedAt)) return this.latest;
    this.latest = { ...check, receivedAt: new Date().toISOString() };
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.latest));
    } catch (err) {
      console.error('Could not save the board check:', err.message);
    }
    return this.latest;
  }
}

// Express routes. Without BOARD_KEY set they don't exist (404), like /api/stats.
function boardRoutes(app, relay, getKey = () => process.env.BOARD_KEY) {
  const gate = (req, res, next) => (keyMatches(bearer(req), getKey()) ? next() : res.status(404).json({ error: 'Not found.' }));

  app.post('/api/board', gate, (req, res) => {
    const { check, error } = validateCheck(req.body);
    if (error) return res.status(400).json({ error });
    res.json({ ok: true, checkedAt: relay.save(check).checkedAt });
  });

  app.get('/api/board/latest', gate, (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!relay.latest) return res.status(204).end();
    res.json(relay.latest);
  });
}

// The line-up website's files live in public/ (lib/board/site.js builds the
// Netlify site from them) but aren't for the agreement-search site on Render
// (owner, 2026-10-17). Mount before express.static. Decoded and normalized,
// so /board%2Ehtml or /x/../board.html can't slip past.
const SITE_ONLY = new Set(['/board.html', '/board-turns.js', '/board-trains.js', '/board-sample.json']);

function hideBoardSite(req, res, next) {
  let p;
  try { p = path.posix.normalize(decodeURIComponent(req.path)).toLowerCase(); } catch { return res.status(400).end(); }
  if (SITE_ONLY.has(p)) return res.status(404).send('Not found.');
  next();
}

// Laptop side: send one check. Never throws; a failed push mustn't stop the
// board check itself.
async function pushCheck({ url, key, check, fetchImpl = fetch }) {
  try {
    const res = await fetchImpl(`${url.replace(/\/+$/, '')}/api/board`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(check),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { ok: false, message: res.status === 404 ? 'the relay refused the key (or BOARD_KEY is not set on Render)' : `the relay answered ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

module.exports = { BoardRelay, boardRoutes, validateCheck, keyMatches, pushCheck, mineForPhone, hideBoardSite };
