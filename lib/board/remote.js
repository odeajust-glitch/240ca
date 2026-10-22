// A fresh Microsoft sign-in asked for from the phone (owner, 2026-10-22):
// the owner publishes "signin" to an ntfy topic from the ntfy app, and the
// checker, which polls that topic, does what R does. Someone who learned the
// topic could only start a sign-in, never approve it (that stays in
// Authenticator), so the worst case is an unwanted prompt.

// BOARD_NTFY_COMMAND_TOPIC, else the alert topic + "-signin".
function commandTopic(env = process.env) {
  const own = (env.BOARD_NTFY_COMMAND_TOPIC || '').trim();
  if (own) return own;
  const alerts = (env.BOARD_NTFY_TOPIC || '').trim();
  return alerts ? `${alerts}-signin` : null;
}

// A request older than this (laptop asleep or offline when it was sent) is
// ignored rather than acted on hours late.
const STALE_SECONDS = 15 * 60;

const asksSignIn = (text) => /^\s*(sign\s*-?\s*in|re-?auth\w*|login|r)\s*[.!]?\s*$/i.test(text || '');

// ntfy's poll answer (one JSON message per line) → whether a sign-in was
// asked for since `since` (unix seconds), and the newest time seen.
function readCommands(body, since, nowSec = Date.now() / 1000) {
  let asked = false;
  let last = since;
  for (const line of String(body).split('\n')) {
    let m;
    try { m = JSON.parse(line); } catch { continue; }
    if (m.event !== 'message' || !(m.time > since)) continue;
    last = Math.max(last, m.time);
    if (nowSec - m.time <= STALE_SECONDS && asksSignIn(m.message)) asked = true;
  }
  return { asked, last };
}

// One look at the topic. Never throws: a failed poll just tries again later.
async function pollSignIn({ topic, since, fetchImpl = fetch, server = 'https://ntfy.sh' }) {
  try {
    const res = await fetchImpl(`${server}/${encodeURIComponent(topic)}/json?poll=1&since=${Math.floor(since)}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { asked: false, last: since, error: `ntfy answered ${res.status}` };
    return readCommands(await res.text(), since);
  } catch (err) {
    // Node's "fetch failed" hides the real reason (DNS, refused, reset…) in cause.
    const why = err.cause && (err.cause.code || err.cause.message);
    return { asked: false, last: since, error: why ? `${err.message} (${why})` : err.message };
  }
}

module.exports = { commandTopic, readCommands, pollSignIn, asksSignIn, STALE_SECONDS };
