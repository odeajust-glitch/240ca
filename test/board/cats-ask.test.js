const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../../lib/board/cats-ask');
const { readReplies } = require('../../lib/board/remote');

// Owner, 2026-11-03: "send a notification on ntfy with the wording of whats
// on the page and any spot to enter something … then the board checker can
// fill the page with my answer".
const boxes = [{ maxLength: 8, value: '45' }, { maxLength: 1, value: '' }];

test('the ntfy message has the page, the boxes, and Y / N buttons for a yes-or-no', () => {
  const m = A.questionMessage({ text: 'MESSAGE   \n\n DO YOU WISH TO PLACE ON ANOTHER ASSIGNMENT? (Y/N)\n', boxes, topic: 'me-signin' });
  assert.equal(m.title, 'CATS is asking you');
  assert.match(m.body, /^CATS is showing this before the main menu:\n\nMESSAGE\nDO YOU WISH TO PLACE ON ANOTHER ASSIGNMENT\? \(Y\/N\)\n\nBox 1: "45"\nBox 2: empty \(1 letter\)\n\nTap Y or N below/);
  assert.equal(m.actions, 'http, Y, https://ntfy.sh/me-signin, method=POST, body=Y, clear=true; http, N, https://ntfy.sh/me-signin, method=POST, body=N, clear=true');
  const other = A.questionMessage({ text: 'PLEASE ENTER YOUR TERMINAL', boxes: [{ maxLength: 4, value: '' }], topic: 't' });
  assert.equal(other.actions, null);
  assert.match(other.body, /^CATS is showing this[\s\S]*Box 1: empty\n\nReply in the ntfy app/);
  assert.ok(A.questionMessage({ text: 'x'.repeat(5000), boxes: [], topic: 't' }).body.length < 3400);
  assert.match(m.body, /No answer in 15 minutes: it types N itself\.$/);
  assert.match(A.questionMessage({ text: 'X (Y/N)', boxes, topic: 't', waitMin: 5, fallback: null }).body, /No answer in 5 minutes: it goes back to reloading CATS\.$/);
  assert.match(other.body, /No answer in 15 minutes: it goes back to reloading CATS\.$/);
});

test('the owner\'s reply becomes what to type and which key to press', () => {
  assert.deepEqual(A.parseReply('y', boxes), { fills: { 1: 'Y' }, key: 'Enter' });
  assert.deepEqual(A.parseReply(' N ', boxes), { fills: { 1: 'N' }, key: 'Enter' });
  assert.deepEqual(A.parseReply('2=Y', boxes), { fills: { 1: 'Y' }, key: 'Enter' });
  assert.deepEqual(A.parseReply('1: 46, 2=n', boxes), { fills: { 0: '46', 1: 'N' }, key: 'Enter' });
  assert.deepEqual(A.parseReply('F3', boxes), { fills: {}, key: 'F3' });
  assert.deepEqual(A.parseReply('enter', boxes), { fills: {}, key: 'Enter' });
  assert.deepEqual(A.parseReply('2=Y, F12', boxes), { fills: { 1: 'Y' }, key: 'F12' });
  for (const bad of ['', '3=Y', 'F3, 2=Y', 'Y, N', 'x'.repeat(30), '0=Y']) assert.equal(A.parseReply(bad, boxes), null, bad);
  assert.equal(A.parseReply('Y', [{ maxLength: 8, value: '45' }, { maxLength: 8, value: 'SA' }]), null); // no empty box
  assert.equal(A.replyText({ fills: { 1: 'Y' }, key: 'Enter' }), 'typed Y in box 2, then pressed Enter');
  assert.equal(A.replyText({ fills: {}, key: 'F3' }), 'pressed F3');
});

test('replies on the command topic: new ones, oldest first, never "signin"', () => {
  const line = (time, message, event = 'message') => JSON.stringify({ time, event, message });
  const body = [line(12, 'N'), line(11, 'Y'), line(9, 'old'), line(13, 'signin'), line(14, 'x', 'keepalive'), 'junk'].join('\n');
  assert.deepEqual(readReplies(body, 10), [{ time: 11, text: 'Y' }, { time: 12, text: 'N' }]);
});
