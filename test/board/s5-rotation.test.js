const test=require('node:test'),assert=require('node:assert/strict');
const {at}=require('../../lib/board/time');
const {runBoardCheck}=require('../../lib/board/engine');
const {s5Board}=require('../../lib/board/site');
const {turnStates}=require('../../lib/board/alerts');
const {expectedJobs}=require('../../lib/board/spares');
const row=(turn,craft,pos,extra={})=>({turn,craft,pos,terminal:0,working:false,restUntil:null,...extra});
function input(){return {now:at(2026,11,7,14),callBoard:[],chainGangHome:[],lineup:[{symbol:'L50231',trainNo:'L502',originDay:'08',order:at(2026,11,8,4),status:'PLN',deadhead:false}],s5:[row('S501','EN',1,{off:[{from:at(2026,11,8,0,1),until:at(2026,11,9,0,1)}]}),row('S501','CO',1),row('S502','EN',2,{st:'**',rn:'HT',statusUntil:at(2026,11,8,5,59)}),row('S502','CO',2),row('MU02','EN',1,{terminal:1}),row('MU02','CO',1,{terminal:1})]};}
test('S5 board position selects regular turn; craft PL and MU display are separate',()=>{
 const i=input(),r=runBoardCheck(i),p=r.predictions[0];
 assert.deepEqual([p.turn,p.engineer,p.spare,p.engineerSpare],['S501','S501',false,true]);
 assert.match(p.reason,/board position/);assert.doesNotMatch(p.reason,/anchored|MU02 is working/);
 assert.deepEqual(expectedJobs(r.predictions).map(j=>[j.turn,j.cc]),[['S501','EN']]);
 const states=turnStates(r,[],{s5:i.s5});assert.equal(states['S501-CO'].lineup.train,'L50231 08');assert.ok(!states['S502-CO']?.lineup);
 const rows=i.s5.map(t=>({...t,status:'original status'})),out=s5Board(rows,r.s5Order);
 assert.deepEqual(out.map(t=>t.turn),['S501','S501','S502','S502','MU02','MU02']);assert.ok(out.every(t=>t.status==='original status'));
});
test('reversing the regular board order reverses the prediction regardless of MU status',()=>{
 const i=input();i.s5=i.s5.map(t=>({...t,pos:t.turn==='S502'?1:t.turn==='S501'?2:0}));
 for(const extra of [{terminal:0},{terminal:1},{working:true,workingOn:'L50231'}])assert.equal(runBoardCheck({...i,s5:i.s5.map(t=>/^MU/.test(t.turn)?{...t,...extra}:t)}).predictions[0].turn,'S502');
});
test('calendar parity cannot override board position',()=>{const i=input();i.lineup=[{...i.lineup[0],originDay:'09',order:at(2026,11,9,4)}];assert.equal(runBoardCheck(i).predictions[0].turn,'S501');});


// Reconstructed states, not raw CATS captures. Historical observations and limits:
// docs/board-checker/S5-CYCLE-AUDIT-2026-11-08.md.
for (const first of ['S501','S502']) {
 const other=first==='S501'?'S502':'S501';
 const pair=(turn,pos,extra={})=>['EN','CO'].map(c=>row(turn,c,pos,extra));
 const stages=[
  ['before outbound', [...pair(first,1),...pair(other,2)], first,false],
  ['outbound L502', [...pair(first,999,{working:true,workingOn:'L50231'}),...pair(other,1)],other,false],
  ['Garnet rest tied 001', [...pair(first,1,{terminal:1,restUntil:at(2026,11,8,20,30)}),...pair(other,1)],other,false],
  ['Garnet rested tied 001', [...pair(first,1,{terminal:1}),...pair(other,1)],other,false],
  ['L501 returning, other home first', [...pair(first,999,{terminal:1,working:true,workingOn:'L50131'}),...pair(other,1)],other,false],
  ['next home turn, per-craft rest', [...pair(first,1).map(x=>x.craft==='EN'?{...x,restUntil:at(2026,11,9,6)}:x),...pair(other,999,{working:true,workingOn:'L50231'})],first,true],
  ['home rested', [...pair(first,1),...pair(other,999,{terminal:1})],first,false]
 ];
 for(const [stage,s5,next,enSpare] of stages) test(`cycle ${first}: ${stage} agrees across prediction, board and notification state`,()=>{
  const i={...input(),now:at(2026,11,8,14),s5,lineup:[{...input().lineup[0],originDay:'09',order:at(2026,11,9,4)}]};
  const r=runBoardCheck(i),p=r.predictions[0],states=turnStates(r,[],{s5});
  assert.equal(p.turn,next);assert.equal(p.engineer,next);assert.equal(p.spare,false);assert.equal(p.engineerSpare,enSpare);
  assert.equal(s5Board(s5,r.s5Order)[0].turn,next);
  assert.match(p.reason,new RegExp(next));
  assert.equal(states[next+'-CO'].lineup.train,'L50231 09');
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
 const i=input();i.now=at(2026,11,8,14);i.lineup=[{...i.lineup[0],originDay:'09',order:at(2026,11,9,4),status:'ORD'}];
 i.s5=[row('S501','CO',999,{working:true,workingOn:'L50231'}),row('S501','EN',999,{working:true,workingOn:'L50231'}),row('S502','CO',1),row('S502','EN',1)];
 assert.equal(runBoardCheck(i).predictions[0].turn,'S502');
});
test('one craft working does not prove both crafts are confirmed for an ordered L502',()=>{
 const i=input();i.now=at(2026,11,8,3);i.lineup=[{...i.lineup[0],originDay:'08',order:at(2026,11,8,5),status:'ORD'}];
 i.s5=[row('S501','CO',999,{working:true,workingOn:'L50231'}),row('S501','EN',1,{st:'TV'}),row('S502','CO',2),row('S502','EN',2)];
 assert.equal(runBoardCheck(i).predictions[0].engineerSpare,true);
});
