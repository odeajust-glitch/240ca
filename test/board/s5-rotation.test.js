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
