// The Members tab, round 3 of the tab-by-tab review (owner, 2026-11-12: "Start members, I would like to clean
// up the members tab, move the 'whos getting alerts' to members from page health. The list of turns being
// tracks that don't have an account, i want to see the owner of the turn/name code").
// Both pieces are TEST SITE ONLY: behind PREVIEW (board-test with the owner key) in public/board.html. Page
// Health on the main site, and the Members tab on either site for anyone else, are as before. To promote,
// drop the PREVIEW tests named below and change these tests, quoting him.
// Turn ids, made-up name codes and made-up names only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The helpers, run as the page runs them. CREW / healthCrew are the crew names this device opened.
const load = (names) => {
  const ctx = vm.createContext({ esc, CREW: names, healthCrew: null, asked: 0, healthClock: (ms) => `T${ms}` });
  vm.runInContext(`${cut('const CODE_GROUPS = ', '\n')}\n${cut('const codeGroup = ', '\n')}\nfunction loadHealthCrew() { asked++; }\n${cut('  const crewFits = ', '  async function renderMembers(said) {')}
    this.whoGetsAlerts = whoGetsAlerts; this.looseNamed = looseNamed; this.looseRowHtml = looseRowHtml; this.accountFor = accountFor;`, ctx);
  return ctx;
};
const NAMES = { SB02: 'Doe, J', SD05: 'Roe, R', B138: 'Moe, K', 'S502-CO': 'Poe, A', 'S502-EN': 'Loe, B', 'YSBY04-CO': 'Zoe, C', 'YSBY04-EN': 'Coe, D' };
const ACCOUNTS = [{ name: 'Jane Doe', code: 'JADO' }, { name: 'KIM MOE', code: null }, { name: 'Amy Beth Poe', code: '' }, { name: 'Ray Roe', code: 'RARO' }, { name: 'Rob Roe', code: 'RORO' }];

test('Who gets alerts is on the Members tab on the test site, and off Page Health there; as before on the main site', () => {
  // Page Health: the section unless PREVIEW.
  assert.ok(html.includes("const who = PREVIEW ? '' : whoGetsAlerts(L.subscribers, { stamp, expanded: view.querySelector('[data-health-followed]')?.open, stale: healthUnavailable });"));
  assert.ok(html.includes('${PREVIEW ? traceSection() : \'\'}${who}'), 'still in the same place on Page Health');
  // Members: only with the test site and the owner key (an Admin never has the health report).
  assert.ok(html.includes('    const review = PREVIEW && membersOwner;\n'));
  assert.ok(html.includes("const whoHtml = !review ? '' : alertsSub ? whoGetsAlerts(alertsSub, { stamp: agoStamp, expanded: whoOpen, stale: false, members: true })"));
  assert.ok(html.includes("Delete from list</button>')).join('')}` : ''}${whoHtml}\n"), 'after the member lists, before the phones with no account');
  // The Notifications link works wherever the section is drawn; Page Health no longer assumes it is there.
  assert.ok(html.includes("    const toNotes = document.getElementById('tonotes');\n    if (toNotes) toNotes.onclick = () => setMode('notes');\n"));
  assert.ok(html.includes("    const toNotes = view.querySelector('.members #tonotes');\n    if (toNotes) toNotes.onclick = () => setMode('notes');\n"));
  // Names that arrive while Members is open draw it again, on the test site only.
  assert.ok(html.includes("if (mode === 'health') renderHealth(); else if (mode === 'members' && PREVIEW) renderMembers(); }"));
});

test('Who gets alerts: the same section either way, in each tab’s own style', () => {
  const ctx = load(NAMES);
  const S = { phones: 5, confirmedAt: 1, turns: [['SB02', 2], ['S502', 1], ['YSBY04', 1], ['SX99', 1]], people: [{ code: 'JADO', turn: 'SB02', phones: 1 }, { code: null, turn: 'B138', phones: 1 }] };
  const page = ctx.whoGetsAlerts(S, { stamp: (ms) => `at ${ms}`, expanded: true, stale: false });
  const tab = ctx.whoGetsAlerts(S, { stamp: (ms) => `at ${ms}`, expanded: true, stale: false, members: true });
  assert.ok(page.startsWith('<section class="sheet"><header><h2>Who gets alerts</h2></header><div class="hbody">\n      <p>5 phones · last confirmed at 1</p>'));
  assert.ok(page.endsWith('(the Members tab shows each member\'s follows, for phones that saved their alerts while signed in). A phone can follow several.</p><p>Every alert sent, by turn, with the logic behind it: <button type="button" class="linkbtn" id="tonotes">Notifications tab</button></p></div></section>'));
  assert.ok(tab.startsWith('<h2>Who gets alerts</h2><div class="mwho">\n      <p>5 phones · last confirmed at 1</p>'));
  assert.ok(tab.includes('phones with no account are listed below'));
  const body = (x) => x.slice(x.indexOf('<details'), x.indexOf('</details>'));
  assert.equal(body(tab), body(page), 'the tables are the same');
  assert.ok(page.includes('<details data-health-followed open>'));
  assert.ok(page.includes('<tr><td>SB02</td><td>Doe, J</td><td>2</td></tr>'));
  assert.ok(page.includes('<tr><td>S502</td><td>CO Poe, A · EN Loe, B</td><td>1</td></tr>'));
  assert.ok(page.includes('<tr><td>YSBY04</td><td>CO Zoe, C · EN Coe, D</td><td>1</td></tr>'));
  assert.ok(page.includes('<tr><td>SX99</td><td><span class="muted">no name read</span></td><td>1</td></tr>'));
  assert.ok(page.includes('<tr><td>JADO</td><td>Doe, J</td><td>SB02</td><td>1</td></tr>'));
  assert.ok(page.includes('1 more person followed by 1 phone: name code not known yet (not seen on a board since they were followed); on B138.'));
  // No names on this device: they are asked for, and each tab says where the passcode goes.
  const bare = load(null);
  assert.ok(bare.whoGetsAlerts(S, { stamp: String, expanded: false, stale: false }).includes('under Article 18.6(b) submissions on this page, and the laptop'));
  assert.ok(bare.whoGetsAlerts(S, { stamp: String, expanded: false, stale: false, members: true }).includes('under Article 18.6(b) submissions on Page Health, and the laptop'));
  assert.equal(bare.asked, 2);
  assert.ok(!bare.whoGetsAlerts(S, { stamp: String, expanded: false, stale: false }).includes('<th>On it now</th>'));
});

test('phones with no account: whose turn or name code it is, and whether they already have an account', () => {
  const ctx = load(NAMES);
  const named = (p, names = NAMES) => JSON.parse(JSON.stringify(ctx.looseNamed(p, names, ACCOUNTS)));
  // A turn: the name on it, and the member it fits ("Last, F" against the account's name, middle names allowed).
  assert.deepEqual(named({ turns: ['SB02'], people: [] }).turns, [{ turn: 'SB02', on: [['', 'Doe, J', 'Jane Doe']] }]);
  assert.deepEqual(named({ turns: ['B138'], people: [] }).turns, [{ turn: 'B138', on: [['', 'Moe, K', 'KIM MOE']] }]);
  assert.deepEqual(named({ turns: ['S502'], people: [] }).turns, [{ turn: 'S502', on: [['CO', 'Poe, A', 'Amy Beth Poe'], ['EN', 'Loe, B', '']] }]);
  // Two members fit the name: neither is named rather than the wrong one.
  assert.deepEqual(named({ turns: ['SD05'], people: [] }).turns, [{ turn: 'SD05', on: [['', 'Roe, R', '']] }]);
  assert.deepEqual(named({ turns: ['SX99'], people: [] }).turns, [{ turn: 'SX99', on: [] }]);
  // A name code: the person it belongs to; an account by its saved name code first.
  assert.deepEqual(named({ turns: [], people: [{ code: 'JADO', turn: 'SB02' }] }).people, [{ code: 'JADO', turn: 'SB02', name: 'Doe, J', why: '', account: 'Jane Doe' }]);
  assert.deepEqual(named({ turns: [], people: [{ code: 'RORO', turn: 'SD05' }] }).people, [{ code: 'RORO', turn: 'SD05', name: 'Roe, R', why: '', account: 'Rob Roe' }]);
  assert.deepEqual(named({ turns: [], people: [{ code: 'ANPO', turn: 'S502-CO' }] }).people, [{ code: 'ANPO', turn: 'S502-CO', name: 'Poe, A', why: '', account: 'Amy Beth Poe' }]);
  assert.deepEqual(named({ turns: [], people: [{ code: 'ZZZZ', turn: null }] }).people, [{ code: 'ZZZZ', turn: null, name: '', why: 'not on the names list', account: '' }]);
  // A code not known yet but on a turn: the name on that turn.
  assert.deepEqual(named({ turns: [], people: [{ code: null, turn: 'B138' }] }).people, [{ code: null, turn: 'B138', name: 'Moe, K', why: '', account: 'KIM MOE' }]);
  // No names on this device: turns and codes only; an account still found by its saved name code.
  assert.deepEqual(named({ turns: ['SB02'], people: [{ code: 'JADO', turn: 'SB02' }] }, null), { turns: [{ turn: 'SB02', on: null }], people: [{ code: 'JADO', turn: 'SB02', account: 'Jane Doe' }] });
  // The row as drawn.
  const day = (ms) => `day ${ms}`;
  const row = ctx.looseRowHtml({ turns: ['SB02', 'SX99'], people: [{ code: 'RORO', turn: 'SD05' }], updated: '2026-11-08T12:00:00Z' }, NAMES, ACCOUNTS, day);
  assert.equal(row, `<div class="mrow"><dl><dt>Turns</dt><dd><span class="mono">SB02</span> Doe, J <span class="mhas">has an account: Jane Doe</span><br><span class="mono">SX99</span> <span class="muted">no name read</span></dd><dt>People</dt><dd><span class="mono">RORO</span> Roe, R <span class="muted">(SD05)</span> <span class="mhas">has an account: Rob Roe</span></dd><dt>Last changed</dt><dd>day ${Date.parse('2026-11-08T12:00:00Z')}</dd></dl></div>`);
  assert.ok(ctx.looseRowHtml({ turns: ['SB02'], people: [], updated: null }, { SB02: 'O<b>, J' }, [], day).includes('O&lt;b&gt;, J'), 'names are escaped');
  // Members on either site, and anyone but the owner on the test site, keep the old rows.
  assert.ok(html.includes("      ${review ? loose.map((p) => looseRowHtml(p, NAMES, approved, day)).join('') : loose.map((p) => `<div class=\"mrow\"><dl><dt>Turns</dt><dd class=\"mono\">${esc(p.turns.join(', ') || 'none')}</dd>"));
  assert.ok(html.includes("    const NAMES = review ? CREW || healthCrew : null;\n"));
});
