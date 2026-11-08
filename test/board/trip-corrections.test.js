const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../public/board-trains');
const A = require('../../public/board-analytics');
const snap = (taken, onDuty = [], bunkhouse = []) => ({taken, screens:['lineup','bunkhouse'],lineup:[],onDuty,bunkhouse});
const train = (at, crew = 'EN SD12 · CO SR04', id='X39491 06') => ({train:id,onDuty:at,crew,station:'SARNIA'});
const initial = {taken:'2026-11-07 2100',screens:['lineup'],lineup:[{train:'X39491 06',order:'7th 2330',status:'ORD'}]};
test('time/crew correction withdraws earlier Toronto off-duty match, preserving evidence',()=>{
 const state=T.track([initial,snap('2026-11-07 2127',[train('7th 2315')]),
 snap('2026-11-08 0206',[],[{en:'SD12',co:'SR04',rested:'8th 0949'}])]);
 let row=T.summarize(state)[0];assert.equal(row.offDuty,'2026-11-08 0149');assert.equal(row.timeOnDuty,154);
 T.track([snap('2026-11-08 0250',[train('8th 0445','EN S107 · CO SA05')])],state);
 row=T.summarize(state)[0];
 assert.equal(row.onDuty,'2026-11-08 0445');assert.equal(row.offDuty,null);assert.equal(row.timeOnDuty,null);
 assert.equal(row.heldMin,undefined);assert.ok(row.dataIssue);
 assert.ok(row.events.some(e=>e.kind==='offDuty'&&e.at==='2026-11-08 0149'));
 assert.ok(row.events.some(e=>e.kind==='offDutyInvalidated'));
 T.track([snap('2026-11-08 1500',[],[{en:'S107',co:'SA05',rested:'8th 2200'}])],state);
 row=T.summarize(state)[0];assert.equal(row.offDuty,'2026-11-08 1400');assert.equal(row.timeOnDuty,555);assert.equal(row.dataIssue,undefined);
});
test('crew-only correction is not skipped when on-duty time stays unchanged',()=>{
 const state=T.track([initial,snap('2026-11-07 2127',[train('7th 2315')]),
 snap('2026-11-08 0206',[],[{en:'SD12',co:'SR04',rested:'8th 0949'}]),
 snap('2026-11-08 0300',[train('7th 2315','EN S107 · CO SA05')])]);
 const row=T.summarize(state)[0];assert.equal(row.crew,'EN S107 · CO SA05');assert.equal(row.offDuty,null);
 assert.ok(row.events.some(e=>e.kind==='crewChange'));
});
test('legacy invalid off-duty data cannot produce duration/held totals',()=>{
 const bad={id:'X39491 06',month:'2026-11',onDuty:'2026-11-08 0445',offDuty:'2026-11-08 0149',crew:'EN S107 · CO SA05',timeOnDuty:176,heldMin:900,stillHeld:true};
 const clean=T.cleanTrip(bad);assert.equal(clean.offDuty,null);assert.equal(clean.timeOnDuty,null);assert.equal(clean.heldMin,null);assert.equal(clean.stillHeld,false);
 assert.equal(A.joinOld('trains',[bad],[])[0].timeOnDuty,null);assert.equal(bad.timeOnDuty,176);
});
test('different train dates stay separate and normal trips keep their duration',()=>{
 const second={...initial,lineup:[...initial.lineup,{train:'X39491 07',order:'8th 2330',status:'PLN'}]};
 const state=T.track([second,snap('2026-11-08 0600',[train('8th 0445','EN S107 · CO SA05')]),
 snap('2026-11-08 1500',[],[{en:'S107',co:'SA05',rested:'8th 2200'}])]);
 const rows=T.summarize(state);assert.equal(rows.length,2);
 assert.equal(rows.find(r=>r.id==='X39491 06').timeOnDuty,555);
 assert.equal(rows.find(r=>r.id==='X39491 07').onDuty,null);
});
