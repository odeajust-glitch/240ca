const test = require('node:test');
const assert = require('node:assert/strict');
const { at } = require('../../lib/board/time');
const { notificationReview } = require('../../lib/board/notification-review');

test('the replay distinguishes a predicted ORD recipient from the later dated crew', () => {
  const replay = notificationReview();
  const z = { symbol:'Z14891', originDay:'06', status:'PLN', order:at(2026,11,7,8,48), call:at(2026,11,7,6,33), pool:'B', turn:'SB05', engineer:'S305' };
  const a = { symbol:'A42431', originDay:'07', status:'PLN', order:at(2026,11,7,11), call:at(2026,11,7,8,45), pool:'A', turn:'SA04', engineer:'S106' };
  function step(minute, predictions, callBoard = []) {
    const now = at(2026,11,7,7,minute);
    replay.check({ now, seen:{lineup:true}, callBoard, lineup:[], s5:[] }, { now, predictions });
  }
  step(44, [z,a]);
  step(50, [z,{...a,status:'ORD'}]);
  assert.deepEqual(replay.rows[0].events.map(e => [e.turn,e.kind,e.provisional]),
    [['SA04','ordered',true],['S106','ordered',true]]);
  for (const e of replay.rows[0].events) assert.match(e.suggested, /Z14891 06 is still planned ahead of you for 08:48 and has not been ordered/);
  step(55, [z,{...a,status:'ORD'}]);
  assert.deepEqual(replay.rows[1].events, []);
  step(83, [a], [{...z,station:'SARNIA',onDuty:at(2026,11,7,10,20),crew:[{craft:'CO',turn:'SA04'},{craft:'EN',turn:'S106'}]}]);
  assert.ok(replay.rows[2].events.filter(e => e.kind === 'onDuty').length === 2);
  assert.ok(replay.rows[2].events.every(e => !e.provisional));
});
