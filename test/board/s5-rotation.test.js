// 501/502: L502 goes to S501 and S502 one day each (owner, 2026-11-13, with the site giving L50231 14 to
// S502 a day after S502's L50231 13: "Whatever turn worked 502 this morning can not work it next. The
// rotation goes s501, then s502, then s501"; "They rotate every day. If he's on rest and his job goes out
// he waits till the next time his turn goes out in two days"). This replaces the 2026-11-07 rule these
// tests used to hold ("the first regular turn on option 29 is next"). Every L502 in the saved checks,
// 18 Oct–13 Nov, alternated by day, a day crewed all by MU still that crew's day.
// Reconstructed states, not raw CATS captures (older audit: docs/board-checker/S5-CYCLE-AUDIT-2026-11-08.md).
const test=require('node:test'),assert=require('node:assert/strict');
const {at}=require('../../lib/board/time');
const {runBoardCheck}=require('../../lib/board/engine');
const {s5Board}=require('../../lib/board/site');
const {turnStates}=require('../../lib/board/alerts');
const {expectedJobs}=require('../../lib/board/spares');
const row=(turn,craft,pos,extra={})=>({turn,craft,pos,terminal:0,working:false,restUntil:null,...extra});
const l502=(day,extra={})=>({symbol:'L50231',trainNo:'L502',originDay:String(day).padStart(2,'0'),order:at(2026,11,day,4),status:'PLN',deadhead:false,...extra});
// An L502 a crew worked, as the Call Board or the 36 h memory has it.
const went=(day,crew)=>({symbol:'L50231',trainNo:'L502',originDay:String(day).padStart(2,'0'),station:'SARNIA',onDuty:at(2026,11,day,3,45),crew:crew.map(([craft,turn])=>({craft,turn}))});
function input(){return {now:at(2026,11,7,14),callBoard:[],chainGangHome:[],lineup:[l502(8)],s5:[row('S501','EN',1,{off:[{from:at(2026,11,8,0,1),until:at(2026,11,9,0,1)}]}),row('S501','CO',1),row('S502','EN',2,{st:'**',rn:'HT',statusUntil:at(2026,11,8,5,59)}),row('S502','CO',2),row('MU02','EN',1,{terminal:1}),row('MU02','CO',1,{terminal:1})]};}

test('the 13th\'s L502 went with S502, so the 14th\'s is S501\'s, whatever option 29 shows (owner, 2026-11-13)',()=>{
 // His photos: S502's CO at 001 on a hold turn (his job on the 13th went to MU01), S502's EN out on
 // L50231 13, S501 bringing L50131 home. The site had S502 for L50231 14, both crafts spare.
 const i={now:at(2026,11,13,6,9),chainGangHome:[],lineup:[l502(14)],
  callBoard:[went(13,[['EN','S502'],['CO','MU01']])],
  s5:[row('S502','CO',1,{st:'**',rn:'HT',statusUntil:at(2026,11,14,5,5)}),row('S502','EN',999,{working:true,workingOn:'L50231'}),
   row('S501','EN',999,{terminal:1,working:true,workingOn:'L50131'}),row('S501','CO',999,{terminal:1,working:true,workingOn:'L50131'}),row('MU01','CO',999,{working:true,workingOn:'L50231'})]};
 const r=runBoardCheck(i),p=r.predictions.find(x=>x.symbol==='L50231');
 assert.deepEqual([p.turn,p.engineer,p.s5Pending],['S501','S501',true]);
 assert.match(p.reason,/one day each: the 14th is S501's \(L50231 13 went with S502\)/);
 assert.deepEqual(r.s5Order.map(x=>x.turn),['S501','S502']);
 const states=turnStates(r,[],{s5:i.s5});
 assert.ok(!states['S502-CO']?.lineup&&!states['S502-EN']?.lineup,'S502 is not lined up for it');
 // Once L50231 13 is off the Call Board, the 36 h memory still has it.
 assert.equal(runBoardCheck({...i,callBoard:[],departed:[went(13,[['EN','S502'],['CO','MU01']])]}).predictions[0].turn,'S501');
 // S502's conductor waits for his turn's next day: the 15th's is S502's.
 assert.equal(runBoardCheck({...i,lineup:[l502(15)]}).predictions[0].turn,'S502');
 assert.deepEqual(runBoardCheck({...i,lineup:[l502(14),l502(15)]}).predictions.map(x=>x.turn),['S501','S502']);
});

test('the last L502 seen sets the days; an all-MU day is still its crew\'s day',()=>{
 const i=input();
 // 5th S502, 6th all MU (S501's day), so the 7th is S502's and the 8th S501's.
 i.departed=[went(5,[['EN','S502'],['CO','S502']]),went(6,[['EN','MU01'],['CO','MU01']])];
 i.lineup=[l502(7,{order:at(2026,11,7,16)})];i.now=at(2026,11,7,6);
 assert.equal(runBoardCheck(i).predictions[0].turn,'S502');
 // A trainee on S501 marks S501's day too; both turns on one train tells nothing.
 i.departed=[went(6,[['EN','MU01'],['CO','MU01'],['TT','S501']])];
 assert.equal(runBoardCheck(i).predictions[0].turn,'S502');
 i.departed=[went(6,[['EN','S502'],['CO','S501']])];
 assert.equal(runBoardCheck(i).predictions[0].turn,'S502','unclear: the stored start day (4th S501) decides');
 // The last one seen wins over the stored start day: if the 6th had been S502's, the 7th is S501's.
 i.departed=[went(6,[['EN','S502'],['CO','S502']])];
 const r=runBoardCheck(i);
 assert.equal(r.predictions[0].turn,'S501');
 assert.match(r.predictions[0].reason,/L50231 06 went with S502/);
});

test('S5 day decides the turn; craft PL and MU display are separate',()=>{
 const i=input(),r=runBoardCheck(i),p=r.predictions[0];
 assert.deepEqual([p.turn,p.engineer,p.spare,p.engineerSpare],['S501','S501',false,true]);
 assert.match(p.reason,/one day each: the 8th is S501's \(no L502 seen lately; counted from S501's on 4th Nov\)/);assert.doesNotMatch(p.reason,/board position|MU02 is working/);
 assert.deepEqual(expectedJobs(r.predictions).map(j=>[j.turn,j.cc]),[['S501','EN']]);
 const states=turnStates(r,[],{s5:i.s5});assert.equal(states['S501-CO'].lineup.train,'L50231 08');assert.ok(!states['S502-CO']?.lineup);
 const rows=i.s5.map(t=>({...t,status:'original status'})),out=s5Board(rows,r.s5Order);
 assert.deepEqual(out.map(t=>t.turn),['S501','S501','S502','S502','MU02','MU02']);assert.ok(out.every(t=>t.status==='original status'));
});
test('board position and MU never change whose day it is',()=>{
 const i=input();i.s5=i.s5.map(t=>({...t,pos:t.turn==='S502'?1:t.turn==='S501'?2:0}));
 for(const extra of [{terminal:0},{terminal:1},{working:true,workingOn:'L50231'}])assert.equal(runBoardCheck({...i,s5:i.s5.map(t=>/^MU/.test(t.turn)?{...t,...extra}:t)}).predictions[0].turn,'S501');
});
test('one day each: S501 the 8th, S502 the 9th, S501 the 10th',()=>{
 const i=input();
 assert.deepEqual([8,9,10].map(d=>runBoardCheck({...i,lineup:[l502(d)]}).predictions[0].turn),['S501','S502','S501']);
});

// One crew's trip around: whose day the next L502 is, from the L502 before it, at each stage.
for (const first of ['S501','S502']) {
 const other=first==='S501'?'S502':'S501';
 const pair=(turn,pos,extra={})=>['EN','CO'].map(c=>row(turn,c,pos,extra));
 const both=(turn)=>[['EN',turn],['CO',turn]];
 const stages=[
  ['before outbound', 9, {departed:[went(8,both(other))]}, [...pair(first,1),...pair(other,2)], first,false],
  ['outbound L502', 10, {callBoard:[went(9,both(first))]}, [...pair(first,999,{working:true,workingOn:'L50231'}),...pair(other,1)],other,false],
  ['Garnet rest tied 001', 10, {departed:[went(9,both(first))]}, [...pair(first,1,{terminal:1,restUntil:at(2026,11,9,20,30)}),...pair(other,1)],other,false],
  ['Garnet rested tied 001', 10, {departed:[went(9,both(first))]}, [...pair(first,1,{terminal:1}),...pair(other,1)],other,false],
  ['L501 returning, other home first', 10, {departed:[went(9,both(first))]}, [...pair(first,999,{terminal:1,working:true,workingOn:'L50131'}),...pair(other,1)],other,false],
  ['next home turn, per-craft rest', 11, {callBoard:[went(10,both(other))]}, [...pair(first,1).map(x=>x.craft==='EN'?{...x,restUntil:at(2026,11,11,3)}:x),...pair(other,999,{working:true,workingOn:'L50231'})],first,true],
  ['home rested', 11, {departed:[went(10,both(other))]}, [...pair(first,1),...pair(other,999,{terminal:1})],first,false]
 ];
 for(const [stage,day,seen,s5,next,enSpare] of stages) test(`cycle ${first}: ${stage} agrees across prediction, board and notification state`,()=>{
  const i={...input(),now:at(2026,11,day-1,14),callBoard:[],...seen,s5,lineup:[l502(day)]};
  const od=String(day).padStart(2,'0'),r=runBoardCheck(i),p=r.predictions.find(x=>x.originDay===od);
  const states=turnStates(r,[],{s5});
  assert.equal(p.turn,next);assert.equal(p.engineer,next);assert.equal(p.spare,false);assert.equal(p.engineerSpare,enSpare);
  assert.equal(s5Board(s5,r.s5Order)[0].turn,next);
  assert.match(p.reason,new RegExp(next));
  assert.equal(states[next+'-CO'].lineup.train,`L50231 ${od}`);
  assert.equal(states[next+'-EN'].lineup.spare,enSpare);
  assert.equal(states[next+'-CO'].lineup.spare,false);
 });
}
test('away selected turn may be predicted but receives no L502 lineup notification',()=>{
 const i=input();i.s5=i.s5.map(x=>x.turn==='S501'?{...x,terminal:1}:x);
 const r=runBoardCheck(i),states=turnStates(r,[],{s5:i.s5});
 assert.equal(r.predictions[0].turn,'S501');assert.equal(r.predictions[0].s5Away,true);
 assert.ok(!states['S501-CO']?.lineup);assert.ok(!states['S501-EN']?.lineup);
});
test('future ordered L502 must not match a previous dated trip by symbol alone',()=>{
 const i=input();i.now=at(2026,11,8,14);i.lineup=[l502(9,{status:'ORD'})];
 i.s5=[row('S501','CO',999,{working:true,workingOn:'L50231'}),row('S501','EN',999,{working:true,workingOn:'L50231'}),row('S502','CO',1),row('S502','EN',1)];
 assert.equal(runBoardCheck(i).predictions[0].turn,'S502');
});
test('one craft working does not prove both crafts are confirmed for an ordered L502',()=>{
 const i=input();i.now=at(2026,11,8,3);i.lineup=[l502(8,{order:at(2026,11,8,5),status:'ORD'})];
 i.s5=[row('S501','CO',999,{working:true,workingOn:'L50231'}),row('S501','EN',1,{st:'TV'}),row('S502','CO',2),row('S502','EN',2)];
 assert.equal(runBoardCheck(i).predictions[0].engineerSpare,true);
});
