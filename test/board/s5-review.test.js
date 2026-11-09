const test = require('node:test');
const assert = require('node:assert/strict');
const { runBoardCheck } = require('../../lib/board/engine');
const { turnStates } = require('../../lib/board/alerts');
const { at } = require('../../lib/board/time');

test('Current and notification states pick S502 for the future dated train', () => {
  const i = auditCases()[0].input;
  const result = runBoardCheck(i);
  const p = result.predictions[0];
  assert.deepEqual([p.turn, p.engineer, !!p.known], ['S502','S502',false]);
  const states = turnStates(result, [], { s5: i.s5 });
  for (const craft of ['CO','EN']) assert.equal(states['S502-' + craft].lineup.train, 'L50231 09');
});

test('working conductor leaves engineer TV coverage intact', () => {
  const [p] = runBoardCheck(auditCases()[1].input).predictions;
  assert.deepEqual([p.turn,p.engineerSpare,!!p.known], ['S501',true,false]);
});

test('a dated fill-in routes its craft only', () => {
  const i = auditCases()[1].input;
  i.callBoard = [{ ...i.lineup[0], station:'Sarnia', onDuty:i.lineup[0].order, crew:[{craft:'CO',turn:'S501'}] }];
  i.backfill = [{train:'L50231 09',craft:'CO',turn:'B123',job:'S501'}];
  const result = runBoardCheck(i);
  const p = result.predictions[0];
  assert.deepEqual([p.turn,p.coCovers,p.engineer], ['B123','S501',null]);
  assert.equal(turnStates(result, i.callBoard, {backfill:i.backfill}).B123.onDuty.train,'L50231 09');
});

test('another month cannot confirm the same printed train', () => {
  const i = auditCases()[0].input;
  i.callBoard = [{...i.lineup[0],station:'Sarnia',onDuty:at(2026,10,9,5),crew:[{craft:'CO',turn:'S501'}]}];
  const [p] = runBoardCheck(i).predictions;
  assert.deepEqual([p.turn,p.engineer],['S502','S502']);
});

function auditCases() {
  const order = at(2026, 11, 9, 5);
  const row = (turn, craft, pos, extra = {}) => ({ turn, craft, pos, terminal: 0, ...extra });
  const working = { working: true, workingOn: 'L50231' };
  const base = { now: at(2026, 11, 8, 14), chainGangHome: [], callBoard: [],
    lineup: [{ symbol: 'L50231', trainNo: 'L502', originDay: '09', order, status: 'ORD' }] };
  const home = (pos) => ['CO', 'EN'].map(c => row('S502', c, pos));
  return [
    { name: 'Previous trip uses the same symbol', input: { ...base, s5: [row('S501','CO',999,working), row('S501','EN',999,working), ...home(1)] } },
    { name: 'Conductor working, engineer on TV', input: { ...base, now: order - 120,
      s5: [row('S501','CO',999,working), row('S501','EN',1,{ st: 'TV' }), ...home(2)] } }
  ];
}
