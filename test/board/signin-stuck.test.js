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
