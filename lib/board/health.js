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

// Everything the owner's health line shows, from what the laptop knows.
function healthOf({ now = Date.now(), lastCheck = null, lastProblem = null, signIn = {}, signInHours = 24, restarts = { count: 0, last: null }, alerts = null, phones = null, version = null, backup = null }) {
  return {
    at: now,
    lastCheck,
    lastProblem,
    signIn: signIn.lastAt ? { lastAt: signIn.lastAt, endsAt: signIn.lastAt + signInHours * 3600000 } : null,
    restarts,
    alerts,
    phones,
    backup,
    version,
  };
}

module.exports = { restartsToday, alertsToday, healthOf };
