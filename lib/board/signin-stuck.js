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
const ENTER_AFTER = 3000;
const KEYS_AFTER = 60000;
const RELOAD_AFTER = 5 * 60000;
const MAX = { enter: 2, keys: 2, reloads: 2 };

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
  if (waiting(kind)) return 'wait';
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

module.exports = { kindOf, nextStep, describe, waiting, ENTER_AFTER, KEYS_AFTER, RELOAD_AFTER, MAX };
