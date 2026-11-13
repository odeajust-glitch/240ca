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
  assert.ok(tab.startsWith('<h2 id="m-who">Who gets alerts</h2><div class="mwho">\n      <p>5 phones · last confirmed at 1</p>'));
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

// "1, 3, 4, 5 and 6" (owner, 2026-11-12, of the eight put to him): the heading says who sees the tab; one line
// per member opening to the card, with the counts at the top as jumps; the two lines about phones with no
// account made one; Remove access at the foot of the opened card; who has no name code saved, folded at the top.
// Test site only, like the rest of this file: the tab drawn three ways below, with made-up members.
const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 13, 17, 0);
const USERS = [
  { id: 'a1', name: 'Ann Admin', email: 'a@x', status: 'approved', role: 'admin', approvedAt: NOW - 3 * DAY, seenAt: NOW - 60000, code: 'ANAD', codeState: 'ok', follows: { turns: ['SB02'], people: 1, phones: 1 } },
  { id: 'm1', name: 'Bob Member', email: 'b@x', status: 'approved', role: 'member', approvedAt: NOW - 3 * DAY, seenAt: NOW - 9 * DAY, code: '', codeState: 'none' },
  { id: 'm2', name: 'Cy <Code>', email: 'c@x', status: 'approved', role: 'member', approvedAt: NOW - 3 * DAY, seenAt: null, code: 'CYCO', codeState: 'wait' },
  { id: 'w1', name: 'Dee Waiting', email: 'd@x', status: 'pending', requestedAt: NOW - DAY, pin: '1', hireDate: '2020-01-01' },
];
async function drawMembers({ preview, owner, admin }) {
  const view = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const answers = {
    'health/accounts': { you: owner ? 'owner' : 'admin', users: USERS, unknownPhones: 2, lock: true, mailToday: 1, mailMax: 70, mailReady: true },
    health: { laptop: { subscribers: { phones: 3, confirmedAt: NOW, turns: [['SB02', 1]], people: [], checkedAt: NOW, noAccount: [{ turns: ['SB02'], people: [], updated: '2026-11-08T12:00:00Z' }, { turns: ['SD05'], people: [], updated: null }] } } },
  };
  const ctx = vm.createContext({
    esc, PREVIEW: preview, membersOwner: owner, membersAdmin: admin, mode: 'members', CREW: { SB02: 'Admin, A' }, healthCrew: null,
    document: { getElementById: () => view }, history: { replaceState() {} }, OwnerKey: { headers: () => ({}) },
    fetch: async (url) => ({ ok: true, status: 200, json: async () => answers[url] }), healthClock: (ms) => `T${ms}`, setMode() {}, Date: class extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } },
  });
  vm.runInContext(`${cut('const CODE_GROUPS = ', '\n')}\n${cut('const codeGroup = ', '\n')}\nfunction loadHealthCrew() {}\n${cut('  const crewFits = ', '  async function renderNotes() {')}\nthis.renderMembers = renderMembers; this.seenShort = seenShort; this.membersHead = membersHead;`, ctx);
  await ctx.renderMembers();
  return { html: view.innerHTML, ctx };
}

test('1, 3, 4, 5, 6: the Members tab cleaned up, for him on the test site', async () => {
  const { html: tab, ctx } = await drawMembers({ preview: true, owner: true, admin: false });
  // 1. Who sees the tab, said to each.
  assert.ok(tab.includes('<h1 class="hpt">Members <span class="muted">(you and your Admins see this)</span></h1>'));
  assert.equal(ctx.membersHead(false), '<h1 class="hpt">Members <span class="muted">(the owner and Admins see this)</span></h1>');
  assert.ok(!tab.includes('only you see this'));
  // 3. The counts at the top, each a jump to its list.
  assert.ok(tab.includes('<div class="mjumps"><button type="button" class="mjump" data-jump="m-wait">Waiting <b>1</b></button><button type="button" class="mjump" data-jump="m-admins">Admins <b>1</b></button><button type="button" class="mjump" data-jump="m-members">Members <b>2</b></button><button type="button" class="mjump" data-jump="m-who">Who gets alerts</button><button type="button" class="mjump" data-jump="m-loose">No account <b>2</b></button></div>'));
  for (const id of ['m-wait', 'm-admins', 'm-members', 'm-who', 'm-loose']) assert.ok(tab.includes(` id="${id}"`), id);
  // 3. One line a member: name, name code (or none, or waiting for his OK), last seen; the card inside.
  assert.equal(tab.split('<details class="mline"').length - 1, 3, 'the approved members only');
  assert.ok(tab.includes('<summary><b>Ann Admin</b><span class="mcode">ANAD</span><span class="mseen">Today '));
  assert.ok(tab.includes('<summary><b>Bob Member</b><span class="mcode muted">no code</span><span class="mseen">9 days ago</span></summary>'));
  assert.ok(tab.includes('<summary><b>Cy &lt;Code&gt;</b><span class="mcode mflag">CYCO · to OK</span><span class="mseen">Not seen</span></summary>'));
  assert.ok(tab.includes('<dt>Follows</dt><dd>SB02 · 1 name code (1 phone)</dd>'), 'the card keeps every fact');
  // 5. Access with the code buttons; Remove access on its own at the foot of the card.
  assert.ok(tab.includes('<div class="mact" data-id="m2" data-name="Cy &lt;Code&gt;"><button type="button" data-act="codeok">CYCO is theirs</button><button type="button" data-act="codeno">Not theirs</button><label>Access <select data-role'));
  assert.ok(tab.includes('</select></label></div><div class="mact mrm" data-id="m2" data-name="Cy &lt;Code&gt;"><button type="button" data-act="remove">Remove access</button></div></div></details>'));
  // Waiting for approval keeps its full card and buttons.
  assert.ok(tab.includes('<div class="mrow"><b>Dee Waiting</b>'));
  // 6. Who has no name code saved, folded at the top; a code waiting for his OK said there too.
  assert.ok(tab.includes('<details class="mnocode"><summary>1 of 3 have no name code saved, so My stats can’t find their record</summary><p><button type="button" class="linkbtn" data-open="m1">Bob Member</button></p></details>'));
  assert.ok(tab.includes('<p class="mmsg">1 name code is waiting for your OK: <button type="button" class="linkbtn" data-open="m2">Cy &lt;Code&gt;</button>.</p>'));
  // 4. One heading and one explanation for the phones with no account: the Worker's line is not repeated.
  assert.ok(!tab.includes('phones get alerts without a known member'));
  assert.ok(tab.includes('<p class="muted">Phones that get alerts with no member’s account behind them: set up before accounts, or never signed in. Each is matched to its member the next time it changes its alerts while signed in. Newest change first; as of '));
  assert.ok(!tab.includes("The phone's owner isn't known"));
  // Last seen, short.
  assert.equal(ctx.seenShort(null), 'Not seen');
  assert.equal(ctx.seenShort(NOW - 9 * DAY, NOW), '9 days ago');
  assert.match(ctx.seenShort(NOW - DAY, NOW), /^Yesterday \d\d:\d\d$/);
  // The page wires the jumps and the names, and keeps open cards open when the tab is drawn again.
  assert.ok(html.includes("const openIds = new Set([...view.querySelectorAll('.members details.mline[open]')].map((x) => x.dataset.id));"));
  assert.ok(html.includes("view.querySelectorAll('.members [data-jump]').forEach((b) => { b.onclick = () => document.getElementById(b.dataset.jump)?.scrollIntoView({ block: 'start' }); });"));
});

test('1, 3, 4, 5, 6: the main site, and an Admin anywhere, keep the tab as it was', async () => {
  for (const who of [{ preview: false, owner: true, admin: false }, { preview: true, owner: false, admin: true }, { preview: false, owner: false, admin: true }]) {
    const { html: tab } = await drawMembers(who);
    assert.ok(tab.includes('<h1 class="hpt">Members <span class="muted">(only you see this)</span></h1>'), JSON.stringify(who));
    assert.ok(!tab.includes('class="mline"') && !tab.includes('class="mjumps"') && !tab.includes('class="mnocode"') && !tab.includes('class="mact mrm"') && !tab.includes(' id="m-'));
    assert.ok(tab.includes('<h2>Admins (1)</h2>') && tab.includes('<div class="mrow"><b>Bob Member</b>'));
    assert.ok(tab.includes('<button type="button" data-act="remove">Remove access</button></div></div>'), 'Remove access beside Access, as before');
    assert.ok(tab.includes('2 phones get alerts without a known member'));
  }
  // Only the owner key gets the laptop's report: an Admin has no phones-with-no-account list or Who gets alerts.
  const { html: admin } = await drawMembers({ preview: true, owner: false, admin: true });
  assert.ok(!admin.includes('Phones with no account') && !admin.includes('Who gets alerts'));
});
