// The Microsoft sign-in (~24 h, CN's policy). A fresh one on purpose only
// when asked (R in the checker window, or "signin" from the phone). Before
// it runs out, the owner's phone is reminded (owner, 2026-11-02: "get rid of"
// the automatic one when going on duty; "a reminder when I'm 12 away from
// needing to redo the authentication, and also at 2 hours"). The approval
// itself stays with the owner's phone (Authenticator).
// BoardChecker\ms-signin.json keeps when the last one was done
// ({ lastAt, reminded: [12, 2] for that one }), so the checker can say how
// long Microsoft's sign-in really lasts.
const fs = require('fs');
const { fmt, at } = require('./time');

const REMIND_HOURS = [12, 2];
// How long a sign-in lasts: BOARD_MS_SIGNIN_HOURS in .env if it turns out
// not to be 24.
const signInHours = (env = process.env) => Number(env.BOARD_MS_SIGNIN_HOURS) > 0 ? Number(env.BOARD_MS_SIGNIN_HOURS) : 24;

// A time as the railway writes it, Toronto clock: "1st 1530".
function torontoFmt(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return fmt(at(+p.year, +p.month, +p.day, +p.hour, +p.minute));
}

// The reminder due now, if any: { hours, text, reminded } (save `reminded`
// in the state once sent), else null. One per mark per sign-in; a mark
// passed while the checker was off is sent late, but only the latest one.
function reminderDue(state, nowMs = Date.now(), { hours = signInHours() } = {}) {
  if (!state || !state.lastAt) return null;
  const endsAt = state.lastAt + hours * 3600000;
  const left = endsAt - nowMs;
  if (left <= 0) return null;
  const done = Array.isArray(state.reminded) && state.remindedFor === state.lastAt ? state.reminded : [];
  const mark = REMIND_HOURS.filter((h) => left <= h * 3600000).sort((a, b) => a - b)[0];
  if (mark == null || done.includes(mark)) return null;
  const leftH = Math.max(1, Math.round(left / 3600000));
  return {
    hours: mark,
    reminded: [...new Set([...done, ...REMIND_HOURS.filter((h) => h >= mark)])],
    text: `Board checker: the Microsoft sign-in runs out in about ${leftH} h (around ${torontoFmt(endsAt)}). To renew it, press R in the checker window or send "signin" from your phone, then approve it in Authenticator.`,
  };
}

function loadState(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function saveState(file, state) {
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

// "23 h 58 m" since the last sign-in, or null if none is known.
function sinceLast(state, nowMs = Date.now()) {
  if (!state.lastAt) return null;
  const mins = Math.round((nowMs - state.lastAt) / 60000);
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} m`;
}

module.exports = { reminderDue, sinceLast, loadState, saveState, signInHours, torontoFmt, REMIND_HOURS };
