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
// Alerts go only to members' phones from a week after the site was locked
// (owner, 2026-11-12: "7 days from when we locked the site to give them
// enough time to make an account"; locked about 19:00 on 2026-11-10, so
// 19:00 Toronto on 2026-11-17). A phone with no account is skipped, not
// deleted: it starts again the moment its owner signs in and saves its
// alerts. The owner's own phones sign in with the owner key and carry no
// account, so a phone following the owner's name code is kept.
const NO_ACCOUNT_CUTOFF = Date.parse('2026-11-18T00:00:00Z');
function membersOnly(subs = [], nowMs = Date.now(), ownerHash = null) {
  if (nowMs < NO_ACCOUNT_CUTOFF) return subs;
  return subs.filter((x) => x.account || (ownerHash && (x.turns || []).includes(`@${ownerHash}`)));
}

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
  // Phones with no member's account behind them, and what each follows (owner,
  // 2026-11-12: "I want to know who to message privately so they know to make
  // an account"). Only the laptop can name the people: it holds the codes.
  const noAccount = subs.filter((x) => !x.account).map((x) => ({
    turns: [...new Set(x.turns || [])].filter((t) => !t.startsWith('@')).sort(),
    people: [...new Set(x.turns || [])].filter((t) => t.startsWith('@')).map((t) => { const h = t.slice(1); return { code: codes.get(h) || null, turn: (personTurns[h] && personTurns[h].turn) || null }; }),
    updated: x.updated || null,
  })).sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
  const byCount = (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1);
  return {
    noAccount,
    noAccountCutoff: NO_ACCOUNT_CUTOFF,
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
// codeCount (owner, 2026-11-12, reviewing Page Health: "Go"): the same count
// over CODE_PATHS only, the updates that change what the laptop runs or
// publishes. A third of the updates on the branch are notes, and Page Health
// told him to "git pull, then restart" for each: behindCode 0 with behind
// above 0 means notes only, nothing to pull for. Left out when git gave none.
const CODE_PATHS = ['.', ':(exclude,glob)**/*.md', ':(exclude)docs', ':(exclude)test'];
function behindOf(count, error, now = Date.now(), codeCount = undefined) {
  const num = (x) => (/^\d+$/.test(String(x ?? '').trim()) ? +String(x).trim() : null);
  const n = num(count);
  const code = num(codeCount);
  return n == null ? { behind: null, behindAt: now, behindError: String(error || 'no answer from git').split('\n')[0].slice(0, 120) }
    : { behind: n, behindAt: now, behindError: null, ...(code == null ? {} : { behindCode: Math.min(code, n) }) };
}

// A send that did not go (owner, 2026-11-12, reviewing Page Health: "Go"): what
// the push service said, kept on the alert's log entry so Page Health can tell a
// phone that had unsubscribed (removed there and then, nothing to do) from a
// real fault. l: the entry { turn, kind, phones, failed }; r: sendPush's answer.
function noteFailure(l, r) {
  if (r && r.gone) { l.gone = (l.gone || 0) + 1; return l; }
  const why = String((r && r.message) || 'no reason given').split('\n')[0].slice(0, 100);
  l.errors = l.errors || [];
  if (!l.errors.includes(why)) l.errors.push(why);
  return l;
}

// What became of today's failed sends, from the JSON alerts log (one line an
// alert: { at: 'YYYY-MM-DD HH:MM', turn, kind, phones, failed, text, gone?, errors? }).
//   gone: the phone had unsubscribed and was removed: nothing to do;
//   retried: the same alert reached a phone within RETRY_MIN afterwards (a
//     failed send is tried again at the next check, up to 30 minutes);
//   pending: failed inside the last RETRY_MIN, still being tried;
//   open: failed for a reason, older than that, and never went: the one kind
//     that needs the owner (lastOpen says which and why);
//   unknown: failed with nothing kept about why (lines from before 2026-11-12).
// nowLocal: the laptop's railway time now, written like `at`.
const RETRY_MIN = 35;
function alertFailures(jsonText, today, nowLocal) {
  const min = (at) => Date.parse(`${String(at).replace(' ', 'T')}:00Z`) / 60000;
  const lines = [];
  for (const row of String(jsonText || '').split(/\r?\n/)) {
    if (!row.includes(today)) continue;
    try { const x = JSON.parse(row); if (x && String(x.at).startsWith(today)) lines.push(x); } catch { /* a torn line */ }
  }
  const out = { gone: 0, retried: 0, pending: 0, open: 0, unknown: 0, lastOpen: null };
  const now = nowLocal ? min(nowLocal) : null;
  lines.forEach((x, i) => {
    const failed = +x.failed || 0;
    if (!failed) return;
    const gone = Math.min(failed, +x.gone || 0);
    out.gone += gone;
    const rest = failed - gone;
    if (!rest) return;
    const at = min(x.at);
    if (lines.slice(i + 1).some((y) => y.turn === x.turn && y.text === x.text && +y.phones > 0 && min(y.at) - at <= RETRY_MIN)) { out.retried += rest; return; }
    const why = Array.isArray(x.errors) ? x.errors.join('; ') : '';
    if (!why && x.gone == null) { out.unknown += rest; return; }
    if (now != null && now - at < RETRY_MIN) { out.pending += rest; return; }
    out.open += rest;
    out.lastOpen = { at: x.at, turn: x.turn, text: String(x.text || '').slice(0, 140), why: why || 'no reason given' };
  });
  return out;
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

module.exports = { membersOnly, NO_ACCOUNT_CUTOFF, alertHistory, restartsToday, alertsToday, recentAlerts, subscribersOf, followedCodes, behindOf, CODE_PATHS, noteFailure, alertFailures, RETRY_MIN, healthOf };
