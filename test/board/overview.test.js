const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
// The Overview is a guide to the Analytics pages (since 2026-11-08). These two
// tests were still written for the dashboard it replaced and had failed ever
// since (owner review, 2026-11-10): rewritten for the guide.
const source = html.slice(html.indexOf('let ANA2 = false;'), html.indexOf('function analyticsOverview(o) {'));
const ctx = { esc: String, location: { hostname: 'board.sarniaboard.workers.dev' } };
vm.createContext(ctx); vm.runInContext(source + '\nthis.guide = analyticsOverviewGuide; this.secs = ANA_SECS;', ctx);
test('overview guide: a card and an Open button for every Analytics page', () => {
  const out = ctx.guide({ callCount: '43% within 30 minutes (438 of 1007 recorded baselines)' });
  for (const [key, label] of ctx.secs) { assert.ok(out.includes(`data-overview-open="${key}"`), key); assert.ok(out.includes(`Open ${label} →`), label); }
  assert.ok(out.includes('43% within 30 minutes'));
  assert.ok(!/NaN|Infinity|undefined/.test(out));
  assert.ok(html.includes("sec: 'overview'"));
});
test('overview guide, Test preview: each page shows its number and Overview has no card for itself', () => {
  const out = ctx.guide({ numbers: { trains: '470 trains on duty in these dates', sleep: '43% within 30 minutes', stale: '96 trains left waiting past the call', assignments: '36 findings not cleared' } });
  for (const text of ['470 trains on duty', '43% within 30 minutes', '96 trains left waiting', '36 findings not cleared']) assert.ok(out.includes(text), text);
  assert.ok(!out.includes('data-overview-open="overview"'));
  assert.ok(!out.includes('Start here'));
  for (const key of ['week', 'trains', 'turns', 'sleep', 'stale', 'assignments']) assert.ok(out.includes(`data-overview-open="${key}"`), key);
});
// The previews across the whole site only switch on at the test address.
test('test site: the switch is off at the normal address', () => {
  assert.equal(vm.runInContext('PREVIEW_HOST', ctx), false);
  const t = { esc: String, location: { hostname: 'board-test.sarniaboard.workers.dev' } };
  vm.createContext(t); vm.runInContext(source + '\nthis.host = PREVIEW_HOST; this.on = PREVIEW;', t);
  assert.equal(t.host, true);
  assert.equal(t.on, false); // still off until the owner key is verified
});
test('all inline scripts parse', () => {
  for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if(m[1].trim()) new vm.Script(m[1]);
});
