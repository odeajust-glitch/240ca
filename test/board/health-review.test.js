// Page Health, reviewed with the owner on 2026-11-12 (round 2 of the tab-by-tab review; HANDOFF has the seven
// findings). He said "Go" to items 1 to 5. Two halves:
//   the laptop (lib/board/health.js, scripts/board-auto.js): which waiting updates are only notes, and what
//     became of each failed send. New figures on his own report; nothing a member sees.
//   the page (public/board.html): tried on the test site first (behind PREVIEW), and on both sites since
//     the same day at his word, after he had looked at board-test: "You can push all this to the main
//     except the purple predictive stuff which i believe you removed". The page is his alone.
// And the same day, of the test site's line-up: "can you take out the purple predictive text".
// Turn ids and train ids only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const Health = require('../../lib/board/health');
const T = require('../../public/board-trains');

const html = fs.readFileSync(require.resolve('../../public/board.html'), 'utf8');
const auto = fs.readFileSync(require.resolve('../../scripts/board-auto.js'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from); const b = html.indexOf(to, a + 1); assert.ok(a > 0 && b > a, `not found in the page: ${from}`); return html.slice(a, b); };

test('GitHub: updates that only change notes are told apart from ones to pull for', () => {
  // git's two answers: every update waiting, and those that touch something the laptop runs or publishes.
  assert.deepEqual(Health.behindOf('3\n', null, 5, '0\n'), { behind: 3, behindAt: 5, behindError: null, behindCode: 0 });
  assert.deepEqual(Health.behindOf('7', null, 5, '1'), { behind: 7, behindAt: 5, behindError: null, behindCode: 1 });
  assert.deepEqual(Health.behindOf('0', null, 5, '0'), { behind: 0, behindAt: 5, behindError: null, behindCode: 0 });
  // git gave no second answer: the page falls back to the plain count, as before.
  assert.deepEqual(Health.behindOf('3', null, 5), { behind: 3, behindAt: 5, behindError: null });
  assert.deepEqual(Health.behindOf('3', null, 5, 'fatal: bad pathspec'), { behind: 3, behindAt: 5, behindError: null });
  assert.deepEqual(Health.behindOf('', 'fatal: unable to access', 5, '2'), { behind: null, behindAt: 5, behindError: 'fatal: unable to access' });
  assert.equal(Health.behindOf('2', null, 5, '9').behindCode, 2, 'never more than are waiting');

  // The paths, on a real repository: a note, a doc, a test and a nested note are notes; the page and the checker are not.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'behind-'));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  try {
    git('init', '-q');
    const commit = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); git('add', '-A'); git('commit', '-q', '-m', file); return git('rev-parse', 'HEAD'); };
    const base = commit('lib/board/a.js', '1');
    const count = (from) => [git('rev-list', '--count', `${from}..HEAD`), git('rev-list', '--count', `${from}..HEAD`, '--', ...Health.CODE_PATHS)];
    commit('HANDOFF.md', 'notes'); commit('docs/board-checker/TODO.md', 'list'); commit('test/board/x.test.js', 'a test'); commit('tools/x/README.md', 'nested note');
    assert.deepEqual(count(base), ['4', '0']);
    assert.deepEqual(Health.behindOf(...[count(base)[0], null, 1, count(base)[1]]), { behind: 4, behindAt: 1, behindError: null, behindCode: 0 });
    const notes = git('rev-parse', 'HEAD');
    commit('public/board.html', 'the page');
    assert.deepEqual(count(base), ['5', '1']);
    fs.writeFileSync(path.join(dir, 'HANDOFF.md'), 'notes 2'); fs.writeFileSync(path.join(dir, 'scripts-board-auto.js'), 'x'); git('add', '-A'); git('commit', '-q', '-m', 'both');
    assert.deepEqual(count(notes), ['2', '2'], 'a commit with notes and code is one to pull for');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  // The checker asks git both questions and hands both answers over.
  assert.ok(auto.includes("execFile('git', ['rev-list', '--count', 'HEAD..FETCH_HEAD', '--', ...Health.CODE_PATHS], opts, (err3, outCode) => { codeBehind = Health.behindOf(out, null, Date.now(), err3 ? undefined : outCode); });"));
});

test('a failed send: what the push service said is kept with the alert', () => {
  const l = { turn: 'SR01', kind: 'position', phones: 0, failed: 2 };
  Health.noteFailure(l, { ok: false, gone: true, message: 'push service says 410' });
  assert.deepEqual(l, { turn: 'SR01', kind: 'position', phones: 0, failed: 2, gone: 1 });
  Health.noteFailure(l, { ok: false, message: 'push service answered 500' });
  Health.noteFailure(l, { ok: false, message: 'push service answered 500' });
  Health.noteFailure(l, { ok: false, message: `fetch failed\n${'x'.repeat(300)}` });
  Health.noteFailure(l, { ok: false });
  assert.deepEqual(l.errors, ['push service answered 500', 'fetch failed', 'no reason given']);
  assert.equal(l.gone, 1);
  // Every place the checker sends a phone an alert notes it, and the JSON log line carries it.
  assert.equal(auto.split('Health.noteFailure(l, r)').length - 1, 4);
  assert.ok(auto.includes('...(l.failed ? { gone: l.gone || 0, errors: l.errors || [] } : {})'));
  assert.ok(auto.includes('alerts: { ...Health.alertsToday(read(alertsLog()), todayToronto), ...Health.alertFailures(read(ALERTS_JSON_LOG), todayToronto, nowToronto) },'));
});

test('what became of the day’s failed sends: only one kind needs the owner', () => {
  const line = (at, turn, text, phones, failed, more = {}) => JSON.stringify({ at, turn, kind: 'lineup', phones, failed, ...more, text });
  const log = [
    line('2026-11-11 23:50', 'SR09', 'yesterday', 0, 1, { gone: 0, errors: ['push service answered 500'] }),
    line('2026-11-12 02:55', 'SR01', 'SR01 is back on the board.', 0, 1), // written before this was kept: no reason
    line('2026-11-12 06:10', 'B110', 'B110 lined up.', 1, 1, { gone: 1, errors: [] }), // the phone had unsubscribed
    line('2026-11-12 07:00', 'S109', 'S109 lined up: M30241.', 0, 1, { gone: 0, errors: ['fetch failed'] }),
    line('2026-11-12 07:08', 'S109', 'S109 lined up: M30241.', 1, 0), // the next check: it went
    line('2026-11-12 08:00', 'SD08', 'SD08 ordered.', 1, 2, { gone: 0, errors: ['push service answered 500', 'fetch failed'] }),
    '{"at":"2026-11-12 08:30","turn":"SR0', // a torn line
    line('2026-11-12 10:50', 'SA02', 'SA02 time change.', 0, 1, { gone: 0, errors: ['fetch failed'] }), // ten minutes ago
    line('2026-11-12 09:00', 'SR03', 'fine', 2, 0),
  ].join('\n');
  assert.deepEqual(Health.alertFailures(log, '2026-11-12', '2026-11-12 11:00'), { gone: 1, retried: 1, pending: 1, open: 2, unknown: 1,
    lastOpen: { at: '2026-11-12 08:00', turn: 'SD08', text: 'SD08 ordered.', why: 'push service answered 500; fetch failed' } });
  // Thirty-five minutes on with no second try that went, the pending one is open too.
  const later = Health.alertFailures(log, '2026-11-12', '2026-11-12 11:30');
  assert.equal(later.pending, 0);
  assert.equal(later.open, 3);
  assert.equal(later.lastOpen.turn, 'SA02');
  assert.equal(Health.RETRY_MIN, 35);
  // A second try after the window is not the same send.
  const late = [line('2026-11-12 07:00', 'S109', 'x', 0, 1, { gone: 0, errors: ['fetch failed'] }), line('2026-11-12 08:00', 'S109', 'x', 1, 0)].join('\n');
  assert.equal(Health.alertFailures(late, '2026-11-12', '2026-11-12 11:00').open, 1);
  assert.deepEqual(Health.alertFailures('', '2026-11-12', '2026-11-12 11:00'), { gone: 0, retried: 0, pending: 0, open: 0, unknown: 0, lastOpen: null });
  // It rides to the page inside the report's alerts.
  const sent = { sent: 91, failed: 1, lastFailure: null, ...Health.alertFailures(log, '2026-11-12', '2026-11-12 11:00') };
  assert.equal(Health.healthOf({ alerts: sent }).alerts.open, 2);
});

// The page's own functions for the checker box, in a sandbox. preview: the test site with the owner key
// (it no longer changes any of these).
function page({ preview = false } = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const ctx = { PREVIEW: preview, esc, publishedAt: NOW - 5 * 60000, healthClock: (ms) => `Nov 12, ${new Date(ms).toISOString().slice(11, 16)}`, Intl, Number, Math, String };
  vm.createContext(ctx);
  vm.runInContext(cut('  function healthRows(h, now, next, waiting) {', '  const healthTable = (rows) =>'), ctx);
  return { ctx, run: (code) => vm.runInContext(code, ctx) };
}
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const NOW = Date.UTC(2026, 10, 12, 16, 0); // 11:00 Toronto
const min = 60000;
// The report of that morning, as the laptop's older code sent it: two notes-only updates waiting, one send failed at 02:55.
const report = (over = {}, laptop = {}) => ({ down: null, watch: { at: NOW - min, mins: 2, ntfy: true, push: true }, ...over,
  laptop: { at: NOW - 4 * min, lastCheck: NOW - 5 * min, lastProblem: null, signIn: { lastAt: NOW - 22 * 60 * min, endsAt: NOW + 110 * min }, restarts: { count: 0, last: null },
    alerts: { sent: 91, failed: 1, lastFailure: { at: '2026-11-12 02:55', text: 'SR01 is back on the board in Sarnia: position 004 (3 ahead).' } },
    backup: NOW - 7 * 60 * min, version: '67dac13', code: { hash: '67dac13', date: '2026-11-12T14:15:00Z', subject: 'Current, reviewed with the owner', folder: '67dac13', behind: 2, behindAt: NOW - 12 * min, behindError: null }, ...laptop } });
// Rows come out of the sandbox as its own kind of array: copied, so they compare as plain ones.
const rowsOf = (p, h, waiting) => JSON.parse(JSON.stringify(p.run('healthRows')(h, NOW, true, waiting)));
const said = (p, h, waiting) => text(p.run('healthVerdict')(rowsOf(p, h, waiting)));

test('Page Health reads the same on the main site and the test site, at the owner’s word', () => {
  const main = page();
  const tst = page({ preview: true });
  assert.ok(!/\bPREVIEW\b/.test(cut('  function healthRows(h, now, next, waiting) {', '  const healthTable = (rows) =>')), 'the checker box no longer asks which site it is on');
  const newer = report({}, { code: { ...report().laptop.code, behindCode: 0 }, alerts: { sent: 91, failed: 1, lastFailure: report().laptop.alerts.lastFailure, gone: 1, retried: 0, pending: 0, open: 0, unknown: 0, lastOpen: null } });
  const waiting = { pending: [NOW - 140 * min], codes: 2 };
  for (const [h, w] of [[report(), null], [newer, waiting], [newer, null]]) {
    assert.deepEqual(rowsOf(main, h, w), rowsOf(tst, h, w));
    assert.equal(main.run('healthVerdict')(rowsOf(main, h, w)), tst.run('healthVerdict')(rowsOf(tst, h, w)));
  }
  assert.deepEqual(rowsOf(main, report()).map((r) => r.label), ['Laptop last checked', 'Website last published', 'Running code', 'GitHub', 'Worker timer', 'Last failed check', 'Microsoft sign-in', 'Watchdog restarts today', 'Alerts today', 'Laptop backup', 'Health sent']);
  // A report from laptop code older than this has no second count and no word on the failed sends, so
  // those two lines are as they were; the sign-in already puts the point first.
  assert.equal(said(main, report()), '3 things need you GitHub: 2 newer updates waiting: git pull, then restart · checked 12 min ago Microsoft sign-in runs out in 1 h 50 m (Nov 12, 17:50). Press R in the checker window, then approve it on your phone. Alerts today: 91 sent, 1 failed (last failed 02:55: SR01 is back on the board in Sarnia: position 004 (3 ahead).)');
  // With the laptop's new figures: notes and an unsubscribed phone are off the list, what waits on Members is on it.
  assert.equal(said(main, newer, waiting), '3 things need you Microsoft sign-in runs out in 1 h 50 m (Nov 12, 17:50). Press R in the checker window, then approve it on your phone. 1 sign-up is waiting for your approval, since Nov 12, 13:40: Members tab. 2 name codes are waiting for your OK before My stats opens for them: Members tab. Open the Members tab');
  assert.ok(html.includes('const rows = healthRows(h, now, true, accountsWaiting());'));
});

test('item 1: notes-only updates and a phone that had unsubscribed do not “need you”', () => {
  const p = page();
  const lf = report().laptop.alerts.lastFailure;
  const alerts = (more) => ({ sent: 91, failed: 1, lastFailure: lf, gone: 0, retried: 0, pending: 0, open: 0, unknown: 0, lastOpen: null, ...more });
  const code = (more) => ({ ...report().laptop.code, ...more });
  const row = (h, label) => rowsOf(p, h).find((r) => r.label === label);

  // Notes only: said, in grey, and not on the list.
  const notes = report({}, { code: code({ behindCode: 0 }), alerts: alerts({ gone: 1 }), signIn: { lastAt: NOW - 4 * 60 * min, endsAt: NOW + 20 * 60 * min } });
  assert.deepEqual(row(notes, 'GitHub'), { label: 'GitHub', text: '2 newer updates waiting, notes only: nothing to pull for · checked 12 min ago', bad: false });
  assert.equal(row(notes, 'Alerts today').text, '91 sent, 1 failed: 1 to a phone that had unsubscribed (removed)');
  assert.equal(row(notes, 'Alerts today').bad, false);
  assert.equal(said(p, notes), 'All good · nothing needs you right now');
  // Some of them change the checker or the site: pull, and it says how many.
  assert.deepEqual(row(report({}, { code: code({ behind: 3, behindCode: 1 }) }), 'GitHub'), { label: 'GitHub', text: '3 newer updates waiting (1 of them changes the checker or the site): git pull, then restart · checked 12 min ago', bad: true });
  assert.equal(row(report({}, { code: code({ behind: 3, behindCode: 3 }) }), 'GitHub').text, '3 newer updates waiting: git pull, then restart · checked 12 min ago');
  assert.equal(row(report({}, { code: code({ behind: 0, behindCode: 0 }) }), 'GitHub').text, 'Up to date · checked 12 min ago');
  // Laptop code from before this: no second count, so the row is as it was (and still asks for the pull).
  assert.deepEqual(row(report(), 'GitHub'), { label: 'GitHub', text: '2 newer updates waiting: git pull, then restart · checked 12 min ago', bad: true });
  assert.equal(row(report(), 'Alerts today').text, '91 sent, 1 failed (last failed 02:55: SR01 is back on the board in Sarnia: position 004 (3 ahead).)');

  // Each kind of failed send in words; only one that did not go, for a reason, is his.
  const fine = report({}, { alerts: alerts({ failed: 5, gone: 2, retried: 1, pending: 1, unknown: 1 }) });
  assert.equal(row(fine, 'Alerts today').text, '91 sent, 5 failed: 1 is being tried again, 1 went through on the next try, 2 to phones that had unsubscribed (removed), 1 with no reason kept');
  assert.equal(row(fine, 'Alerts today').bad, false);
  const open = report({}, { alerts: alerts({ failed: 2, open: 2, lastOpen: { at: '2026-11-12 08:00', turn: 'SD08', text: 'SD08 ordered.', why: 'push service answered 500' } }) });
  assert.equal(row(open, 'Alerts today').bad, true);
  assert.equal(row(open, 'Alerts today').text, '91 sent, 2 failed: 2 did not go. Last: SD08 at 08:00: push service answered 500');
  assert.ok(said(p, open).includes('2 alerts did not reach a phone (SD08 at 08:00: push service answered 500).'));
  assert.equal(row(report({}, { alerts: alerts({ failed: 0 }) }), 'Alerts today').text, '91 sent, 0 failed');
});

test('item 2: a sign-up waiting for approval, and a name code waiting for his OK, are on the list', () => {
  const p = page();
  const quiet = report({}, { code: { ...report().laptop.code, behind: 0, behindCode: 0 }, alerts: { sent: 91, failed: 0, lastFailure: null }, signIn: { lastAt: NOW - 4 * 60 * min, endsAt: NOW + 20 * 60 * min } });
  assert.equal(said(p, quiet, { pending: [], codes: 0 }), 'All good · nothing needs you right now');
  assert.equal(said(p, quiet, null), 'All good · nothing needs you right now');
  // One sign-up since 08:40 that morning; the list said nothing about it.
  const one = p.run('healthVerdict')(rowsOf(p, quiet, { pending: [NOW - 140 * min], codes: 0 }));
  assert.equal(text(one), '1 thing needs you 1 sign-up is waiting for your approval, since Nov 12, 13:40: Members tab. Open the Members tab');
  assert.ok(one.includes('<button type="button" class="linkbtn" id="tomembers">Open the Members tab</button>'));
  const rows = rowsOf(p, quiet, { pending: [NOW - 30 * min, NOW - 140 * min, 0], codes: 2 });
  assert.deepEqual(rows.slice(-2), [
    { label: 'Sign-ups waiting', text: '3 waiting for your approval, the oldest since Nov 12, 13:40 (2 h 20 m ago)', bad: true, say: '3 sign-ups are waiting for your approval, since Nov 12, 13:40: Members tab.' },
    { label: 'Name codes waiting', text: '2 waiting for your OK before My stats opens for them', bad: true, say: '2 name codes are waiting for your OK before My stats opens for them: Members tab.' }]);
  // Counts and a time only: the page asks the Members list, and keeps no name or address from it.
  const ask = cut('  function accountsWaiting() {', '  const retryHealth');
  assert.ok(ask.includes("pending: d.users.filter((u) => u.status === 'pending').map((u) => +u.requestedAt || 0), codes: d.users.filter((u) => u.status === 'approved' && u.codeState === 'wait').length"));
  assert.ok(!/\bu\.(name|email|pin|hireDate)\b/.test(ask));
});

test('item 3: the point first and what to do; the checker down is one line, not five', () => {
  const p = page();
  // The sign-in, with under two hours left and once it has run out.
  assert.ok(said(p, report()).includes('Microsoft sign-in runs out in 1 h 50 m (Nov 12, 17:50). Press R in the checker window, then approve it on your phone.'));
  assert.ok(said(p, report({}, { signIn: { lastAt: NOW - 25 * 60 * min, endsAt: NOW - 12 * min } })).includes('Microsoft sign-in has run out (Nov 12, 15:48). Press R in the checker window, then approve it on your phone.'));
  // The table keeps the fuller words.
  assert.equal(rowsOf(p, report()).find((r) => r.label === 'Microsoft sign-in').text, '22 h 00 m ago; runs out ~Nov 12, 17:50 (1 h 50 m left)');
  // Down 3 h 20 m: who was told, the failed check and the watchdog are in the table, red, and off the list.
  const down = report({ down: { since: NOW - 200 * min, alerted: NOW - 170 * min, pushed: NOW - 20 * min, phones: { sent: 30, failed: 2 }, ownerPushed: NOW - 140 * min, ownerPhones: { sent: 3 } } },
    { at: NOW - 200 * min, lastCheck: NOW - 200 * min, lastProblem: { at: NOW - 200 * min, text: 'CATS did not answer within a minute.' }, restarts: { count: 3, last: { at: '2026-11-12 07:50', text: 'looks stuck: no check for 15 minutes. Restarting it.' } },
      signIn: { lastAt: NOW - 20 * 60 * min, endsAt: NOW + 4 * 60 * min }, alerts: { sent: 40, failed: 0, lastFailure: null }, code: { ...report().laptop.code, behind: 0, behindCode: 0 } });
  assert.equal(said(p, down), '1 thing needs you The checker has not checked since Nov 12, 12:40 (3 h 20 m ago). Last problem: CATS did not answer within a minute. On the laptop, look at the Board checker window; if it is stuck, press Ctrl+C and start it again.');
  assert.deepEqual(rowsOf(p, down).filter((r) => r.bad).map((r) => r.label), ['Laptop last checked', 'Your phones told it was down', 'Down alert', 'Last failed check', 'Watchdog restarts today']);
  // A check that failed while the checker is otherwise up is still its own line.
  const failed = report({}, { lastProblem: { at: NOW - 2 * min, text: 'CATS did not answer within a minute.' } });
  assert.ok(said(p, failed).includes('Last failed check: Failed Nov 12, 15:58 (2 min ago) · CATS did not answer within a minute.'));
});

test('items 4 and 5 are on the page, on both sites', () => {
  // Folded or trimmed: the rep-email form once everything is set, old CATS pages, the days before counting began, the one-link box.
  assert.ok(html.includes("const fold = [`<details class=\"moredet\"${allSet ? '' : ' open'}><summary>Where Submit sends them: ${allSet ? 'both rep emails, the names passcode and the email sender are set' : 'something is missing'}</summary>`, '</details>'];"));
  assert.ok(html.includes('const oldQ = Q.length > 0 && now - newestQ > 48 * 3600000;'));
  assert.ok(html.includes('while (kept > 1 && !days[kept - 1].opens && !days[kept - 1].phones) kept--;'));
  assert.ok(!html.includes('<h2>Alerts sent</h2></header><div class="hbody"><p>Every alert, by turn'), 'the box that held one link is gone');
  assert.equal(html.split('<h2>Alerts sent</h2>').length - 1, 1, 'the Notifications tab keeps its own heading');
  assert.ok(html.includes('A phone can follow several.</p><p>Every alert sent, by turn, with the logic behind it: <button type="button" class="linkbtn" id="tonotes">Notifications tab</button></p></div></section>`;'));
  // Twice: Page Health's Who gets alerts, and the same section drawn on the Members tab on the test site
  // (members-review.test.js). One at a time on the page.
  assert.equal(html.split('id="tonotes"').length - 1, 2);
  // An address of their own, kept until the report that says who is looking has come: only the owner's key gets one.
  assert.ok(html.includes("let ownerTabWanted = { '#pagehealth': 'health', '#searchreview': 'review' }[location.hash] || '';"));
  assert.ok(html.includes("const ownAddress = (hash) => { try { history.replaceState(null, '', location.pathname + location.search + hash); }"));
  assert.ok(html.includes("if (h && ownerTabWanted && firstTabOpen) { const want = ownerTabWanted; ownerTabWanted = ''; setTimeout(() => setMode(want), 0); }"));
  assert.ok(html.includes("if (ownerTabWanted && healthData) { const want = ownerTabWanted; ownerTabWanted = ''; setMode(want); }"));
  assert.ok(html.includes("document.getElementById('modeReview').hidden = !h;"), 'the tab itself still needs the report');
  assert.ok(!html.includes('id="pagehealth"') && !html.includes('id="searchreview"'), 'no element by that name for the browser to jump to');
});

test('the purple “likely call” line is off the line-up on both sites, at the owner’s word; the test still scores', () => {
  // Owner, 2026-11-12, looking at board-test: "can you take out the purple predictive text".
  assert.match(html, /\nconst TRAIN_LIKELY = false;\n/);
  assert.ok(html.includes('"can you take out the purple predictive\n// text"'));
  const run = (on) => {
    const ctx = { BoardTrains: T, stampMin: T.toMin, PREVIEW: true, PATTERNS: { predict: { all: { '6-10': { n: 25, mid: 60, lo: -30, hi: 240, likelyLo: 0, likelyHi: 120, held: 20, likelyHeld: 13 } } } } };
    vm.createContext(ctx);
    vm.runInContext(cut('function dt(stamp) {', 'const ON_TIME = 15;'), ctx);
    vm.runInContext(`const TRAIN_LIKELY = ${on};\n${cut('function likelyCall(s, t) {', '// The same for a spare (patterns.json spare')}`, ctx);
    return vm.runInContext('likelyCall', ctx)({ taken: '2026-11-12 0800' }, { order: '12th 1427', status: 'PLN', train: 'M38261 12', deadhead: false });
  };
  assert.equal(run(false), null);
  assert.equal(run(true).held, 20, 'the code is kept: true brings the line back');
  // The two-week test's own page does not depend on it.
  const lib = fs.readFileSync(require.resolve('../../lib/board/patterns.js'), 'utf8');
  assert.ok(!lib.includes('TRAIN_LIKELY') && /TEST_FROM/.test(lib));
});
