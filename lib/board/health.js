// The board checker's health, for the owner only (owner, 2026-11-02: "one
// health line on the site … can this be set up so only I see it"). The
// laptop writes status/health.json with each publish; the Worker hands it
// out only to the owner's Cloudflare Access email (OWNER_EMAIL), adding its
// own "down" note. Nothing here goes into the public site files.

// Today's watchdog restarts from restarts.log ("2026-11-02, 14:05:00  text"):
// { count, last: { at, text } | null }. today: YYYY-MM-DD (laptop's clock).
function restartsToday(logText, today) {
  const lines = String(logText || '').split(/\r?\n/).filter((l) => l.startsWith(today) && /looks stuck|Restarting:/.test(l));
  const last = lines[lines.length - 1];
  const m = last && /^(\d{4}-\d{2}-\d{2}),? (\d{1,2}:\d{2})(?::\d{2})?\s+(.*)$/.exec(last);
  return { count: lines.length, last: m ? { at: `${m[1]} ${m[2]}`, text: m[3].replace(/^The board checker /, '').trim() } : null };
}

// Today's alert sends from the alerts log ("2026-11-02 06:29  SD06  lineup
// 0 phones, 1 failed  text"): { sent, failed, lastFailure: { at, text } | null }.
function alertsToday(logText, today) {
  let sent = 0;
  let failed = 0;
  let lastFailure = null;
  for (const l of String(logText || '').split(/\r?\n/)) {
    if (!l.startsWith(today)) continue;
    const m = /^(\S+ \d{2}:\d{2})\s+\S+\s+\S+\s+(\d+) phones?(?:, (\d+) failed)?\s+(.*)$/.exec(l);
    if (!m) continue;
    sent += +m[2];
    if (m[3]) { failed += +m[3]; lastFailure = { at: m[1], text: m[4].trim() }; }
  }
  return { sent, failed, lastFailure };
}

// The latest alerts sent, newest first (owner, 2026-11-02: "what
// notifications are being sent out for whom"), from the alerts log:
// [{ at, turn, kind, phones, failed, text }].
function recentAlerts(logText, n = 50) {
  const out = [];
  for (const l of String(logText || '').split(/\r?\n/)) {
    const m = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\s+(\S+)\s+(\S+)\s+(\d+) phones?(?:, (\d+) failed)?\s+(.*)$/.exec(l);
    if (m) out.push({ at: m[1], turn: m[2], kind: m[3], phones: +m[4], failed: +(m[5] || 0), text: m[6].trim() });
  }
  return out.slice(-n).reverse();
}

// Every alert of the last `days` days, newest first, for the Notifications
// tab (owner, 2026-11-05: "type in a turn and see exactly the notifications
// being sent, then the logic behind it"). jsonText: alerts-log.jsonl (one
// JSON line each, with `why`, from 2026-11-05); logText: the Desktop alerts
// log (everything since 2026-10-25, no `why`). A line in both is taken once,
// from the JSON. → { from, alerts: [{ at, turn, kind, phones, failed, text, why? }] }.
function alertHistory(logText, jsonText, { days = 30, now = Date.now() } = {}) {
  const from = new Date(now - days * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  const json = [];
  for (const l of String(jsonText || '').split(/\r?\n/)) {
    if (!l.trim()) continue;
    try { const a = JSON.parse(l); if (a && a.at && a.text) json.push(a); } catch { /* a cut-off line */ }
  }
  const seen = new Set(json.map((a) => `${a.at}|${a.text}`));
  const txt = recentAlerts(logText, Infinity).reverse().filter((a) => !seen.has(`${a.at}|${a.text}`));
  const alerts = [...txt, ...json].filter((a) => a.at.slice(0, 10) >= from)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return { from, alerts };
}

// Who gets alerts (owner, 2026-11-02): the phones are anonymous; what's known
// is what each follows. subs: the Worker's subscriptions ({ turns: ['SR03',
// '@<hash>'] }); personTurns: { hash: { turn } } (a followed person's own
// turn now); codes: Map hash -> name code (seen on a board, memory only).
// -> { phones, turns: [[turn, phones]], people: [{ code, turn, phones }] }.
function subscribersOf(subs = [], personTurns = {}, codes = new Map()) {
  const turns = new Map();
  const people = new Map();
  for (const s of subs) {
    for (const t of new Set(s.turns || [])) {
      if (t.startsWith('@')) {
        const h = t.slice(1);
        const p = people.get(h) || { code: codes.get(h) || null, turn: (personTurns[h] && personTurns[h].turn) || null, phones: 0 };
        p.phones++;
        people.set(h, p);
      } else {
        turns.set(t, (turns.get(t) || 0) + 1);
      }
    }
  }
  const byCount = (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1);
  return {
    phones: subs.length,
    turns: [...turns].sort(byCount),
    people: [...people.values()].sort((a, b) => b.phones - a.phones || String(a.code || '~').localeCompare(String(b.code || '~'))),
  };
}

// The name codes of the people phones follow, to keep over a restart (owner,
// 2026-11-10: after every restart they read "not seen yet" until the checker
// saw them on a board again). subs: the Worker's subscriptions; codes: Map
// hash -> code seen this run; saved: { hash: code } from the last run.
// Only followed people are kept; one no longer followed is dropped.
function followedCodes(subs = [], codes = new Map(), saved = {}) {
  const out = {};
  for (const s of subs) for (const t of s.turns || []) {
    if (!String(t).startsWith('@')) continue;
    const h = t.slice(1);
    const code = codes.get(h) || saved[h];
    if (code) out[h] = code;
  }
  return out;
}

// How far behind GitHub the laptop's folder is, from git's own answers.
// count: `git rev-list --count HEAD..FETCH_HEAD` output; error: why it failed.
function behindOf(count, error, now = Date.now()) {
  const n = /^\d+$/.test(String(count || '').trim()) ? +String(count).trim() : null;
  return n == null ? { behind: null, behindAt: now, behindError: String(error || 'no answer from git').split('\n')[0].slice(0, 120) } : { behind: n, behindAt: now, behindError: null };
}

// Everything the owner's health line shows, from what the laptop knows.
function healthOf({ now = Date.now(), lastCheck = null, lastProblem = null, signIn = {}, signInHours = 24, restarts = { count: 0, last: null }, alerts = null, phones = null, subscribers = null, sent = null, version = null, code = null, backup = null, questions = null }) {
  return {
    at: now,
    lastCheck,
    lastProblem,
    signIn: signIn.lastAt ? { lastAt: signIn.lastAt, endsAt: signIn.lastAt + signInHours * 3600000 } : null,
    restarts,
    alerts,
    phones,
    subscribers,
    sent,
    backup,
    questions, // CATS's "another assignment?" pages, as answered (owner only)
    version,
    code, // { hash, date, subject, folder, behind, behindAt, behindError }: the running code in words
  };
}

module.exports = { alertHistory, restartsToday, alertsToday, recentAlerts, subscribersOf, followedCodes, behindOf, healthOf };
