const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../lib/board/signin-stuck');

const t0 = { stuckFor: 0, enter: 0, keys: 0, reloads: 0, restarted: false };
const min = 60000;

test('the sign-in wait knows which page it is on', () => {
  const cats = { seq: '4' };
  assert.equal(S.kindOf({ s: cats, isMenu: true }), 'menu');
  assert.equal(S.kindOf({ s: null, onMicrosoft: true }), 'microsoft');
  assert.equal(S.kindOf({ s: cats, isSignOn: true }), 'signOn');
  assert.equal(S.kindOf({ s: cats }), 'cats');
  assert.equal(S.kindOf({ s: null }), 'other');
  assert.equal(S.kindOf({ s: { seq: null } }), 'other');
});

test('a person-wait is never treated as stuck', () => {
  for (const k of ['menu', 'microsoft', 'signOn']) assert.equal(S.nextStep(k, { ...t0, stuckFor: 60 * min }), 'wait');
});

// Owner, 2026-11-03: stuck at a notice before the main menu.
test('a CATS notice: Enter, then F3, then reload, then a fresh Edge', () => {
  const at = (ms, t = {}) => S.nextStep('cats', { ...t0, stuckFor: ms, ...t });
  assert.equal(at(1000), 'wait');
  assert.equal(at(3000), 'enter');
  assert.equal(at(4000, { enter: 1 }), 'enter');
  assert.equal(at(30000, { enter: 2 }), 'wait');
  assert.equal(at(min, { enter: 2 }), 'keys');
  assert.equal(at(1.5 * min, { enter: 2, keys: 1 }), 'wait');
  assert.equal(at(2 * min, { enter: 2, keys: 1 }), 'keys');
  assert.equal(at(4 * min, { enter: 2, keys: 2 }), 'wait');
  assert.equal(at(5 * min, { enter: 2, keys: 2 }), 'reload');
  // After a reload the clock and the key tries start over.
  assert.equal(at(3000, { reloads: 1 }), 'enter');
  assert.equal(at(5 * min, { enter: 2, keys: 2, reloads: 1 }), 'reload');
  assert.equal(at(5 * min, { enter: 2, keys: 2, reloads: 2 }), 'restart');
  assert.equal(at(9 * min, { enter: 2, keys: 2, reloads: 2, restarted: true }), 'wait');
});

test('a page that isn\'t CATS: no keys, a reload after 5 minutes', () => {
  assert.equal(S.nextStep('other', { ...t0, stuckFor: 4 * min }), 'wait');
  assert.equal(S.nextStep('other', { ...t0, stuckFor: 5 * min }), 'reload');
  assert.match(S.describe('other', '  Notice  to users '), /^the page "Notice to users"$/);
  assert.equal(S.describe('other', ''), 'a blank or error page');
  assert.doesNotMatch(S.describe('cats', 'x'), /x/);
});

// Owner, 2026-11-03: "Do you wish to place on another assignment?" Y or N.
test('the "another assignment" question is spotted and answered in the right box', () => {
  const scr = (text, n = 1) => ({ seq: '3', text, textInputs: Array(n).fill('x') });
  assert.ok(S.isAssignmentQuestion(scr('MESSAGE DO YOU WISH TO PLACE ON ANOTHER ASSIGNMENT? (Y/N)')));
  assert.ok(S.isAssignmentQuestion(scr('Do you wish to place on another assignment ?')));
  assert.ok(!S.isAssignmentQuestion(scr('DO YOU WISH TO PLACE ON ANOTHER ASSIGNMENT?', 0))); // no box to answer in
  assert.ok(!S.isAssignmentQuestion(scr('MAIN MENU MILEAGE')));
  assert.ok(!S.isAssignmentQuestion(null));
  assert.equal(S.assignmentAnswer({}), 'ASK'); // owner, 2026-11-03: Y means calling in; ask instead
  assert.equal(S.assignmentAnswer({ BOARD_ASSIGNMENT_ANSWER: 'y' }), 'Y');
  assert.equal(S.assignmentAnswer({ BOARD_ASSIGNMENT_ANSWER: ' n ' }), 'N');
  assert.equal(S.assignmentAnswer({ BOARD_ASSIGNMENT_ANSWER: 'off' }), null);
  assert.equal(S.answerBox([{ maxLength: 8, value: '' }, { maxLength: 1, value: '' }]), 1);
  assert.equal(S.answerBox([{ maxLength: 8, value: 'SA' }]), 0);
  assert.equal(S.answerBox([{ maxLength: 8, value: '45' }, { maxLength: 8, value: '' }]), 1);
  assert.equal(S.answerBox([{ maxLength: 8, value: '45' }, { maxLength: 8, value: 'SA' }]), -1);
});

test('the question page is kept for the owner, newest first, the last 20', () => {
  let list = [];
  for (let i = 0; i < 25; i++) list = S.addQuestion(list, { at: i, answer: 'Y', text: `JOB ${i}   \n\n\n\nDO YOU WISH TO PLACE ON ANOTHER ASSIGNMENT?  ` });
  assert.equal(list.length, S.KEEP_QUESTIONS);
  assert.equal(list[0].at, 24);
  assert.equal(list[0].text, 'JOB 24\n\nDO YOU WISH TO PLACE ON ANOTHER ASSIGNMENT?');
  assert.equal(S.addQuestion(null, { at: 1, answer: 'N', text: 'x'.repeat(5000) })[0].text.length, 3000);
});

test('a CATS page still there after the keys goes to the owner, and nothing else is tried while waiting', () => {
  const base = { ...t0, enter: 2, keys: 2, canAsk: true };
  assert.equal(S.nextStep('cats', { ...base, stuckFor: 2.5 * min }), 'wait');
  assert.equal(S.nextStep('cats', { ...base, stuckFor: 3 * min }), 'ask');
  assert.equal(S.nextStep('cats', { ...base, stuckFor: 20 * min, asks: 1, awaiting: true }), 'wait'); // no reload while waiting
  assert.equal(S.nextStep('cats', { ...base, stuckFor: 5 * min, asks: 2 }), 'reload');
  assert.equal(S.nextStep('cats', { ...base, stuckFor: 3 * min, canAsk: false }), 'wait'); // no ntfy: the old steps
  assert.equal(S.nextStep('other', { ...base, stuckFor: 3 * min }), 'wait'); // only CATS pages
});
