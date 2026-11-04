// Getting a message to the owner's phone when it matters (owner, 2026-11-04:
// "Sometimes when I force a re auth I dont always get the number"). The
// laptop's connection drops now and then (ntfy ETIMEDOUT), so each route is
// tried again for about 2 minutes, and the Microsoft number goes by every
// route there is:
//   - ntfy (BOARD_NTFY_TOPIC), as before;
//   - the board site's own phone alerts (web push) to the phones following
//     the owner's name code (board-auto.js does that part);
//   - Pushover, optional (BOARD_PUSHOVER_TOKEN + BOARD_PUSHOVER_USER in
//     .env; docs/board-checker/PUSHOVER.md): its app has a free trial.
// Never throws.

const WAITS = [5000, 10000, 20000, 30000, 45000]; // ~2 min over 6 tries

// fn() → { ok, message }; tried until ok or the waits run out.
async function withRetry(fn, { waits = WAITS, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let last = { ok: false, message: 'not tried' };
  for (let i = 0; i <= waits.length; i++) {
    try { last = await fn(); } catch (err) { last = { ok: false, message: (err.cause && (err.cause.code || err.cause.message)) || err.message }; }
    if (last.ok) return { ...last, tries: i + 1 };
    if (last.final) break; // a refused key: trying again won't help
    if (i < waits.length) await sleep(waits[i]);
  }
  return { ...last, tries: waits.length + 1 };
}

// signin: the command topic; adds a "Sign in now" button that sends
// "signin" to it (owner, 2026-11-04: re-auth from the reminder).
const signinLink = (cmdTopic) => `https://ntfy.sh/${encodeURIComponent(cmdTopic)}/publish?message=signin`;
async function sendNtfy(text, topic, { fetchImpl = fetch, priority = 'high', signin = null } = {}) {
  if (!topic) return { ok: false, message: 'no ntfy topic', final: true };
  const headers = { Title: 'Board checker', Priority: priority };
  if (signin) headers.Actions = `http, Sign in now, https://ntfy.sh/${encodeURIComponent(signin)}, method=POST, body=signin, clear=true`;
  const res = await fetchImpl(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: 'POST', body: text, headers, signal: AbortSignal.timeout(10000),
  });
  return res.ok ? { ok: true } : { ok: false, message: `ntfy answered ${res.status}`, final: res.status >= 400 && res.status < 500 && res.status !== 429 };
}

// Pushover's message API: an application token and the user key.
// priority 1 = high (sounds even in quiet hours).
// signin: the command topic; Pushover shows a "Sign in now" link that
// sends "signin" to it through ntfy (Pushover can't send anything back).
async function sendPushover(text, { token, user } = {}, { fetchImpl = fetch, priority = 1, signin = null } = {}) {
  if (!token || !user) return { ok: false, message: 'Pushover not set up', final: true };
  const body = new URLSearchParams({ token, user, message: text, title: 'Board checker', priority: String(priority), ...(signin ? { url: signinLink(signin), url_title: 'Sign in now' } : {}) });
  const res = await fetchImpl('https://api.pushover.net/1/messages.json', { method: 'POST', body, signal: AbortSignal.timeout(10000) });
  if (res.ok) return { ok: true };
  // 4xx: a wrong token or user key; Pushover says trying again won't help.
  return { ok: false, message: `Pushover answered ${res.status}`, final: res.status >= 400 && res.status < 500 };
}

module.exports = { withRetry, sendNtfy, sendPushover, signinLink, WAITS };
