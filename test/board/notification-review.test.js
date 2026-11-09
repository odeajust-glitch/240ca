const test = require('node:test');
const assert = require('node:assert/strict');
const { at } = require('../../lib/board/time');
const { turnStates, turnEvents, phoneEvents } = require('../../lib/board/alerts');

function runChecks() {
  const rows = [];
  let told = null;
  return { rows, check(input, result) {
    const states = turnStates(result, input.callBoard, {s5:input.s5, spareboards:input.spareboards, vacancies:input.vacancies});
    const batch = turnEvents(told, states, {now:input.now});
    told = batch.told;
    if (rows.length || batch.events.length) rows.push({...batch, states, now:input.now});
  } };
}

test('the replay distinguishes a predicted ORD recipient from the later dated crew', () => {
  const replay = runChecks();
  const z = { symbol:'Z14891', originDay:'06', status:'PLN', order:at(2026,11,7,8,48), call:at(2026,11,7,6,33), pool:'B', turn:'SB05', engineer:'S305' };
  const a = { symbol:'A42431', originDay:'07', status:'PLN', order:at(2026,11,7,11), call:at(2026,11,7,8,45), pool:'A', turn:'SA04', engineer:'S106' };
  function step(minute, predictions, callBoard = []) {
    const now = at(2026,11,7,7,minute);
    replay.check({ now, seen:{lineup:true}, callBoard, lineup:[], s5:[] }, { now, predictions });
  }
  step(44, [z,a]);
  step(50, [z,{...a,status:'ORD'}]);
  assert.deepEqual(replay.rows[0].events.map(e => [e.turn,e.kind]),
    [['SA04','ordered'],['S106','ordered']]);
  for (const e of replay.rows[0].events) assert.match(e.text, /Z14891 06 is still planned ahead of you for 08:48 and has not been ordered/);
  step(55, [z,{...a,status:'ORD'}]);
  assert.deepEqual(replay.rows[1].events, []);
  step(83, [a], [{...z,station:'SARNIA',onDuty:at(2026,11,7,10,20),crew:[{craft:'CO',turn:'SA04'},{craft:'EN',turn:'S106'}]}]);
  assert.ok(replay.rows[2].events.filter(e => e.kind === 'onDuty').length === 2);
  assert.ok(replay.rows[2].events.filter(e => e.kind === 'onDuty').every(e => !e.text.includes('predicted sequence')));
});

test('B-pool reassignment explains the earlier planned train and preserves engineer spare status', () => {
  const replay = runChecks();
  const z = {symbol:'Z14891', originDay:'06', status:'PLN', order:at(2026,11,7,8,48), call:at(2026,11,7,6,33)};
  const a = {symbol:'A42431', originDay:'07', status:'PLN', order:at(2026,11,7,11), call:at(2026,11,7,8,45)};
  const boards = {enSlow:[{turn:'EN11',pos:1},{turn:'EN03',pos:2}]};
  const A = {pool:'A', turn:'SA04', engineer:'S106', engineerSpare:true};
  const B = {pool:'B', turn:'SB05', engineer:'S305', engineerSpare:true};
  function check(minute, predictions) {
    const now = at(2026,11,7,7,minute);
    replay.check({now, seen:{lineup:true,terminal:true}, callBoard:[], lineup:[], s5:[], spareboards:boards, vacancies:[]}, {now,predictions});
  }
  check(42,[{...z,...A},{...a,...B}]);
  const swapped = [{...z,...B},{...a,...A,status:'ORD'}];
  check(50,swapped);
  check(58,swapped);
  const events = replay.rows[1].events.filter(e => ['SB05','S305'].includes(e.turn));
  const spareEvents = replay.rows[1].events.filter(e => e.text && ['EN03','EN11'].includes(e.turn));
  assert.equal(spareEvents.length, 2);
  assert.match(spareEvents.find(e => e.turn === 'EN11').text,/cover S305’s engineer job.*If Z14891 06/);
  assert.match(spareEvents.find(e => e.turn === 'EN03').text,/cover S106’s engineer job.*still planned ahead/);
  const batch = replay.rows[1];
  const followers = ['SA04','S106','SB05','S305','EN03','EN11'];
  const delivered = (prefs) => phoneEvents(batch.events, {turns:followers,prefs}, batch.states,
    {__welcomed:followers}, {now:batch.now,held:batch.held}).events;
  assert.equal(delivered({}).filter(e => ['ordered','lineup'].includes(e.kind)).length, 6);
  const ordersOnly = Object.fromEntries(followers.map(t => [t,{lineup:false,ordered:true}]));
  assert.deepEqual(delivered(ordersOnly).filter(e => e.kind === 'ordered').map(e => e.turn).sort(),['SA04','S106'].sort());
  check(65,swapped);
  assert.equal(replay.rows[2].events.filter(e => e.text).length, 0);
  const engineerMessage = 'A42431 07 was ordered for 11:00, changing the predicted sequence. S305 is now lined up for Z14891 06, still planned for 08:48. If Z14891 06 is ordered for a time before 11:00, your train assignment may change.';
  assert.equal(events.find(e => e.turn === 'S305').text, engineerMessage);
  assert.equal(spareEvents.find(e => e.turn === 'EN11').text, 'EN11, you are expected to cover S305’s engineer job. ' + engineerMessage);
  assert.equal(events.length,2);
  for (const e of events) {
    assert.equal(e.kind,'lineup');
    assert.match(e.text,/A42431 07 was ordered for 11:00/);
    if (e.turn === 'SB05') assert.match(e.text,/your train assignment may change again\. Expected call 06:33\.$/);
  }
});
