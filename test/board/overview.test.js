const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const source = html.slice(html.indexOf('function anaHome('), html.indexOf('function anaTrains('));
const ctx = { BoardTrains: require('../../public/board-trains'), esc: String };
vm.createContext(ctx); vm.runInContext(source, ctx);
test('overview: empty data is explicit; all four detail links work with existing section routing', () => {
  const out = ctx.anaHome({});
  assert.ok(out.includes('No on-duty trains recorded yet'));
  assert.ok(!/NaN|Infinity/.test(out));
  for (const key of ['sleep', 'pred', 'trains', 'runlog']) assert.ok(out.includes(`data-sec="${key}"`));
  assert.ok(html.includes("sec: 'overview'"));
  for (const label of ['My week','Trains','Turns side by side','Sleep','Runaround log','Out of sequence','Jobs going spare','CATS errors','Stale trains','Predictions']) assert.ok(html.includes(`'${label}'`));
});
test('overview: fractions exclude unknowns; ongoing holds and unconfirmed events are labelled', () => {
  const out = ctx.anaHome({ runs: [
    {ran:true,at:'2026-11-07 0400',heldMin:900,stillHeld:true,predHit:{early:{coHit:true,enHit:false}}},
    {ran:true,at:'2026-11-06 0400',heldMin:0,predHit:{early:{coHit:false,enHit:true}}},
    {ran:true,at:'2026-11-07 0500',heldMin:null,predHit:{early:{none:true}}},
  ], sleep:[{off:20},{off:90},{off:null},{off:0,takenOff:true}], runLog:[{result:'likely'},{result:'possible'},{result:'explained'}] });
  for (const text of ['2026-11-06 to 2026-11-07','50%','1 of 2','1 of 2 recorded stays','1 ongoing stay','1 likely','1 possible','not confirmed findings']) assert.ok(out.includes(text),text);
});
test('all inline scripts parse', () => {
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if(m[1].trim()) new vm.Script(m[1]);
});
