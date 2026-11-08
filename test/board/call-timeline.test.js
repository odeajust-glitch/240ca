const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../../public/board-analytics');
const T=require('../../public/board-trains');
const I=require('../../lib/board/insights');
const record={turn:'SR03',train:'M302 08',expectedTrain:'M302 08',firstSeen:'2026-11-07 1200',firstCall:'2026-11-08 0145',expected:'2026-11-08 0145',call:'2026-11-08 0045',timelineChanges:[{taken:'2026-11-07 1900',call:'2026-11-08 0045',train:'M302 08'}],timelineComplete:true};
test('call timeline matches owner sketch and keeps block fixed across changes',()=>{
 const m=A.callTimeline(record);assert.equal(T.fromMin(m.block.from),'2026-11-07 1745');assert.equal(T.fromMin(m.block.to),'2026-11-08 0145');assert.equal(T.fromMin(m.first),'2026-11-07 1200');assert.equal(T.fromMin(m.end),'2026-11-08 0045');
 const svg=A.renderCallTimeline(record);for(const t of ['First lined','Green starts','11-07 1745','Original call','Actual call time','11-07 1900'])assert.ok(svg.includes(t),t);
});
test('timeline handles older, short-notice, taken-off and empty records honestly',()=>{
 assert.equal(A.callTimeline({}),null);assert.ok(!A.renderCallTimeline({}).includes('<svg'));
 const old={...record,timelineChanges:undefined,timelineComplete:false,shifts:record.timelineChanges,firstSeen:'2026-11-07 2200'};
 assert.ok(A.renderCallTimeline(old).includes('Tracking began after'));assert.ok(A.renderCallTimeline(old).includes('Older history'));
 const off={...old,takenOff:true,onDuty:'2026-11-07 2300'};assert.equal(T.fromMin(A.callTimeline(off).end),'2026-11-07 2300');assert.ok(A.renderCallTimeline(off).includes('Removed'));
 assert.ok(A.callTimeline({...record,noWindow:true}).block);
 assert.ok(!/NaN|Infinity/.test(A.renderCallTimeline({...record,call:record.expected,timelineChanges:[]})));
 assert.ok(A.renderCallTimeline({...record,turn:'<script>alert(1)</script>'}).includes('&lt;script&gt;'));
});
test('timeline records changes before the eight-hour baseline without altering scoring shifts',()=>{
 const snap=(taken,call)=>({taken,lineup:[{train:'M1 08',call,crew:{co:'SR03'}}],onDuty:[],vacancies:[]});
 const st=I.collect([snap('2026-11-07 0900','8th 0400'),snap('2026-11-07 1200','8th 0145'),snap('2026-11-07 1745','8th 0145'),snap('2026-11-07 1900','8th 0045'),{taken:'2026-11-08 0100',lineup:[],onDuty:[{train:'M1 08',onDuty:'8th 0245',crew:'CO SR03'}]}]);
 const z=I.finish(st).sleep[0];assert.equal(z.timelineChanges.length,2);assert.equal(z.shifts.length,1);assert.equal(z.off,-60);assert.equal(z.timelineComplete,true);
});

test('axis starts at assignment, uses first plan and extends only for ordered later calls',()=>{
 const z={...record,firstSeen:'2026-11-07 2200',expected:'2026-11-08 0300',call:'2026-11-08 0600',timelineChanges:[
 {taken:'2026-11-07 2210',call:'2026-11-08 0215'},
 {taken:'2026-11-07 2220',call:'2026-11-08 0246'},
 {taken:'2026-11-07 2230',call:'2026-11-08 0600'}]};
 let m=A.callTimeline(z);assert.equal(m.from,T.toMin(z.firstSeen));assert.equal(m.to,T.toMin(z.firstCall));assert.equal(m.expected,T.toMin(z.firstCall));assert.equal(m.markers.length,2);
 z.timelineChanges[2].ordered=true;m=A.callTimeline(z);assert.equal(m.to,T.toMin('2026-11-08 0600'));
});

test('early call keeps green before call and red through original planned call',()=>{
 const html=A.renderCallTimeline(record);assert.ok(html.includes('Called 1h 0m early'));assert.ok(html.includes('var(--stop)'));assert.ok(!html.includes('min-width:680px'));
});
test('original-plan summary uses first call, excludes removals and caps lost window',()=>{
 const z={...record,expected:'2026-11-08 0800'};
 const st=A.planReliability([{...z,call:z.firstCall},{...z,call:'2026-11-07 1600'},{...z,call:'2026-11-08 0600'},{...z,takenOff:true},{call:z.call}]);
 assert.equal(st.rows.length,3);assert.equal(st.stable.length,1);assert.equal(st.early.length,1);assert.equal(st.late.length,1);assert.equal(st.lost,480);assert.equal(st.excluded,2);
 assert.equal(A.planReliability([]).lost,null);
});
