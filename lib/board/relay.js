// Gets each board check from the owner's laptop to their phone (2026-10-15).
// board-auto.js pushes the finished check here; the RailroadTracker app pulls
// the latest one and shows it on its Board card. Only the newest check is
// kept: the app wants "when do I go now", and the laptop keeps its own
// history. Kept apart from the app's lineup evidence on purpose (owner's
// decision): these come from software reading CATS, the evidence log doesn't.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

// Returns the cleaned check, or an error message.
function validateCheck(body) {
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object.' };
  const { checkedAt, me, report, changes, myAnswerChanged } = body;
  if (typeof checkedAt !== 'string' || Number.isNaN(Date.parse(checkedAt))) return { error: 'checkedAt must be an ISO time.' };
  if (!isLines(me)) return { error: 'me must be a list of lines.' };
  if (typeof report !== 'string' || report.length > MAX_REPORT_CHARS) return { error: 'report must be text.' };
  if (changes != null && !isLines(changes)) return { error: 'changes must be a list of lines.' };
  return {
    check: {
      checkedAt: new Date(checkedAt).toISOString(),
      me,
      report,
      changes: changes || [],
      myAnswerChanged: !!myAnswerChanged,
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

module.exports = { BoardRelay, boardRoutes, validateCheck, keyMatches, pushCheck };
