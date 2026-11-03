// Ask the owner on ntfy what to type on a CATS page (owner, 2026-11-03: "send
// a notification on ntfy with the wording of whats on the page and any spot
// to enter something, that way I could type what needed to be typed in ntfy
// and then the board checker can fill the page with my answer"). Used for
// CATS's "Do you wish to place on another assignment?" (Y/N) at sign-in, and
// any other CATS page the checker can't get past before the main menu.
// The owner answers on the command topic (the one "signin" goes to): a tap on
// the Y / N buttons, or a typed reply:
//   Y            into the answer box (signin-stuck answerBox), then Enter
//   2=Y          into box 2 (as numbered in the message), then Enter
//   1=45, 3=Y    several boxes, then Enter
//   F3 / ENTER   just press that key
//   2=Y, F3      boxes, then that key instead of Enter
const { answerBox } = require('./signin-stuck');

const MAX_TEXT = 3000; // ntfy turns a message over 4096 bytes into a file
const MAX_VALUE = 20;
const KEY = /^(ENTER|F([1-9]|1\d|2[0-4]))$/i;

// Does the page want a yes or no? Then the message gets Y / N buttons.
const yesNo = (text) => /\(\s*Y\s*\/\s*N\s*\)|\bY\s+OR\s+N\b|\bYES\s+OR\s+NO\b|ANOTHER\s+ASSIGNMENT\b[^?]{0,40}\?/i.test(text || '');

const clean = (text) => String(text || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');

// The ntfy message: { title, body, actions } (actions: ntfy's Actions
// header, or null). boxes: [{ maxLength, value }] visible on the page, in order.
function questionMessage({ text, boxes = [], topic }) {
  let words = clean(text);
  if (words.length > MAX_TEXT) words = `${words.slice(0, MAX_TEXT)}…`;
  const list = boxes.map((b, i) => `Box ${i + 1}: ${String(b.value || '').trim() ? `"${String(b.value).trim()}"` : 'empty'}${b.maxLength === 1 ? ' (1 letter)' : ''}`);
  const yn = yesNo(text);
  const how = [
    yn ? 'Tap Y or N below, or reply' : 'Reply',
    'in the ntfy app to the "signin" topic with what to type: Y, or 2=Y for box 2, or 1=45, 3=Y for several; F3 or ENTER to just press a key.',
    'Nothing is typed until you answer; in 30 minutes it goes back to reloading CATS.',
  ].join(' ');
  const body = `CATS is showing this before the main menu:\n\n${words || '(no words on the page)'}\n\n${list.length ? `${list.join('\n')}\n\n` : ''}${how}`;
  const url = `https://ntfy.sh/${encodeURIComponent(topic)}`;
  const actions = yn && topic ? ['Y', 'N'].map((a) => `http, ${a}, ${url}, method=POST, body=${a}, clear=true`).join('; ') : null;
  return { title: 'CATS is asking you', body, actions };
}

// The owner's reply → { fills: { boxIndex: value }, key } or null when it
// can't be read (then they're told and asked again).
function parseReply(reply, boxes = []) {
  const text = String(reply || '').trim();
  if (!text || text.length > 100) return null;
  const parts = text.split(/\s*[,;]\s*/).filter(Boolean);
  const fills = {};
  let key = 'Enter';
  for (const [n, p] of parts.entries()) {
    if (KEY.test(p)) {
      if (n !== parts.length - 1) return null; // a key goes last
      key = /^enter$/i.test(p) ? 'Enter' : p.toUpperCase();
      continue;
    }
    const m = /^(\d{1,2})\s*[=:]\s*(.*)$/.exec(p);
    if (m) {
      const i = +m[1] - 1;
      if (i < 0 || i >= boxes.length || m[2].length > MAX_VALUE) return null;
      fills[i] = m[2].trim().toUpperCase();
      continue;
    }
    if (parts.length !== 1 || p.length > MAX_VALUE) return null;
    const i = answerBox(boxes);
    if (i < 0) return null;
    fills[i] = p.toUpperCase();
  }
  return { fills, key };
}

// For the window, the phone and the saved page: "typed Y in box 1, then Enter".
function replyText({ fills, key }) {
  const typed = Object.entries(fills).map(([i, v]) => `${v} in box ${+i + 1}`);
  return `${typed.length ? `typed ${typed.join(', ')}, then ` : ''}pressed ${key}`;
}

module.exports = { questionMessage, parseReply, replyText, yesNo, MAX_TEXT };
