// Stuck between the sign-in and the CATS main menu (owner, 2026-11-03: "it
// was stuck at a notification page … trying to sign into cats"). While the
// checker waits for the main menu it knows which kind of page it is on:
//   menu       the CATS main menu: done
//   microsoft  Microsoft's sign-in (waits on the owner's Authenticator)
//   signOn     the CATS sign-on screen (filled from .env, or by hand)
//   cats       some other CATS screen (a message, a notice)
//   other      a page that isn't CATS or Microsoft, or a blank / error page
// The first three are never "stuck" here (a person may be needed; the
// watchdog's 45 min covers them). For the other two this says what to try,
// in order, the longer it lasts:
//   3 s    Enter, as the owner does by hand (2 rounds; CATS screens only)
//   1 min  F3 (or Enter when the screen has no F3), twice (CATS screens only)
//   5 min  reload CATS from the start (the clock and the key tries start
//          over: the notice may come back after signing in again); twice
//   then   5 min more: close Edge and start fresh (under the watchdog)
// A CATS page still there after the keys (3 min) goes to the owner's ntfy
// (lib/board/cats-ask.js) when they can answer there (t.canAsk); while their
// answer is awaited (t.awaiting, up to ASK_WAIT) nothing else is tried.
const ENTER_AFTER = 3000;
const KEYS_AFTER = 60000;
const RELOAD_AFTER = 5 * 60000;
const ASK_AFTER = 3 * 60000;
const ASK_WAIT = 30 * 60000;
const MAX = { enter: 2, keys: 2, reloads: 2, asks: 2 };

const waiting = (kind) => kind === 'menu' || kind === 'microsoft' || kind === 'signOn';

// What kind of page: s is screenState (null when there's no CATS frame).
function kindOf({ s, onMicrosoft, isMenu, isSignOn }) {
  if (s && isMenu) return 'menu';
  if (onMicrosoft) return 'microsoft';
  if (s && isSignOn) return 'signOn';
  if (s && s.seq !== null) return 'cats';
  return 'other';
}

// The next thing to do. t: { stuckFor (ms on cats/other pages since the
// last reload), enter, keys (since the last reload), reloads, restarted }.
function nextStep(kind, t) {
  if (waiting(kind) || t.awaiting) return 'wait';
  if (kind === 'cats' && t.canAsk && t.keys >= MAX.keys && (t.asks || 0) < MAX.asks && t.stuckFor >= ASK_AFTER) return 'ask';
  if (t.stuckFor >= RELOAD_AFTER) {
    if (t.reloads < MAX.reloads) return 'reload';
    return t.restarted ? 'wait' : 'restart';
  }
  if (kind === 'cats' && t.stuckFor >= ENTER_AFTER && t.enter < MAX.enter) return 'enter';
  if (kind === 'cats' && t.stuckFor >= KEYS_AFTER * (t.keys + 1) && t.keys < MAX.keys) return 'keys';
  return 'wait';
}

// A short name for the page, for the window and the owner's phone: no
// screen text (it can carry crew names), only a web page's title.
function describe(kind, title) {
  if (kind === 'cats') return 'a CATS screen that isn\'t the main menu';
  const t = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return t ? `the page "${t}"` : 'a blank or error page';
}

// CATS asking "Do you wish to place on another assignment?" (Y or N) when
// signing in (owner, 2026-11-03: "make it so it answers y when it thinks
// that page is up … once I bypass it with y or n it doesn't pop up
// anymore"; then "if you answer Y i have to call in … OR can you have it send
// a notification on ntfy … and then the board checker can fill the page with
// my answer"). BOARD_ASSIGNMENT_ANSWER in .env: ask (the default: the page
// goes to the owner's ntfy and their reply is typed in, lib/board/cats-ask.js),
// Y, N, or off.
const isAssignmentQuestion = (s) => !!s && s.textInputs.length > 0 && /ANOTHER\s+ASSIGNMENT\b[^?]{0,40}\?/i.test(s.text);
function assignmentAnswer(env = {}) {
  const v = String(env.BOARD_ASSIGNMENT_ANSWER ?? 'ASK').trim().toUpperCase();
  if (v === 'OFF' || v === 'NO ANSWER') return null;
  if (v === 'Y' || v === 'N') return v;
  return 'ASK';
}
// Which box takes the answer: boxes [{ maxLength, value }] on screen, in
// order. A one-letter box first, then the only box, then the first empty
// one; -1 when none fits (nothing is typed then).
function answerBox(boxes) {
  const empty = (b) => !String(b.value || '').trim();
  const one = boxes.findIndex((b) => b.maxLength === 1 && empty(b));
  if (one >= 0) return one;
  if (boxes.length === 1) return 0;
  return boxes.findIndex(empty);
}

// What the question page said, kept for the owner to read later (owner,
// 2026-11-03: "if you answer Y i have to call in. Can you have it record
// whats on the page"): newest first, the last KEEP_QUESTIONS.
const KEEP_QUESTIONS = 20;
function addQuestion(list, rec) {
  const text = String(rec.text || '').split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 3000);
  return [{ at: rec.at, answer: rec.answer, text }, ...(Array.isArray(list) ? list : [])].slice(0, KEEP_QUESTIONS);
}

module.exports = { kindOf, nextStep, describe, waiting, ASK_WAIT, isAssignmentQuestion, assignmentAnswer, answerBox, addQuestion, KEEP_QUESTIONS, ENTER_AFTER, KEYS_AFTER, RELOAD_AFTER, MAX };
