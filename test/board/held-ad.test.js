// Engineers held 14 h+ at the away terminal: a reminder that an AD claim needs to be filed and to talk to the
// Local Chairperson. Owner, 2026-11-13: "for the article 18.6 (b) can you add a reminder that an AD claim needs
// to be filed and to talk to their Local Chair person. This applies to engineers only". Test site only
// (PREVIEW) until he says otherwise. Turn ids and train ids only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function page(preview) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ctx = { PREVIEW: preview, esc, RESETS: null, dur: (m) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`, dt: (s) => s || '' };
  vm.createContext(ctx);
  vm.runInContext(cut('const isoOf = (st) =>', '// The owner\'s layout (2026-11-06)'), ctx); // isoOf … claimForm, with EN_AD and enAdNote
  vm.runInContext("const dateOf = (st) => (st ? st.slice(0, 10) : '');", ctx);
  vm.runInContext(cut('function held186(rows) {', '// At the top of a turn or name-code search'), ctx);
  return (code) => vm.runInContext(code, ctx);
}
// A held trip, as heldRows gives it (the 14 h list): conductor SR03, engineer SD03.
const r = { id: 'M39931 13', month: '2026-11', co: 'SR03', en: 'SD03', onDuty: '2026-11-12 0145', offDuty: '2026-11-12 0944', heldMin: 900, back: { id: 'E27121 12', onDuty: '2026-11-13 0044' } };
const NOTE = 'an AD claim needs to be filed. Talk to your Local Chairperson.';

test('the form: the reminder shows while Engineer is the craft picked, and only on the test site', () => {
  const on = page(true);
  const en = on('claimForm')(r, 'EN');
  assert.ok(en.includes(`<p class="enad"><b>Engineer:</b> ${NOTE}</p>`));
  const co = on('claimForm')(r, 'CO');
  assert.ok(co.includes(`<p class="enad" hidden><b>Engineer:</b> ${NOTE}</p>`), 'drawn hidden for a conductor, so picking Engineer shows it');
  // Switching the craft in the form shows or hides it (wireClaim's update).
  assert.ok(html.includes("    const ad = form.querySelector('.enad');\n    if (ad) ad.hidden = d.craft !== 'EN';"));
  assert.ok(html.includes('.enad[hidden] { display: none; }'));
  // Off the test site the form is as it was.
  const off = page(false);
  assert.ok(!off('claimForm')(r, 'EN').includes('enad') && !off('claimForm')(r, 'EN').includes('AD claim'));
});

test('a turn or name-code search: on an engineer’s held trip, not a conductor’s', () => {
  const rows = [{ r, role: 'CO', turn: 'SR03' }, { r, role: 'EN', turn: 'SD03' }];
  const on = page(true)('held186')(rows);
  const [co, en] = on.split('<div class="h186">').slice(1);
  assert.ok(!co.includes('AD claim'));
  assert.ok(text(en).includes(`Engineer: ${NOTE} File it (SD03, engineer)`));
  assert.ok(!page(false)('held186')(rows).includes('AD claim'));
});

test('the 18.6(b) tab: once at the top, for engineers, on the test site only', () => {
  assert.ok(html.includes("  const adTop = enAdNote(true, 'Engineers held 14 h+');"));
  assert.ok(html.includes("    </div>${adTop ? '\\n    ' + adTop : ''}\n    ${unlock}"));
  assert.equal(page(true)('enAdNote')(true, 'Engineers held 14 h+'), `<p class="enad"><b>Engineers held 14 h+:</b> ${NOTE}</p>`);
  assert.equal(page(false)('enAdNote')(true, 'Engineers held 14 h+'), '');
  // His words are kept with it, and the claim's text sent to the rep is not changed.
  assert.ok(html.includes('"for the article 18.6 (b) can you add a reminder that an AD claim needs\n// to be filed and to talk to their Local Chair person. This applies to engineers only"'));
  assert.ok(!cut('function claimText(r, d) {', '// names: unlocked names').includes('AD claim'));
});
