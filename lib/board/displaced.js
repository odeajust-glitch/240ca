// Displacement alerts (owner, 2026-11-13: "notify you if you have been
// displaced … Joe Haugh has displaced me so I need to place"). His own case
// set the rule: at the 1212 check S501 CO was his (on rest until 14th 0530);
// at 1220 the same row showed Joe Haugh as its own holder ("available") and
// the owner was on no board after it. Joe had lost SR10 on the 11th and had
// not been seen for two days: he was placing.
//
// The rule, per check that read names: a turn of someone's own (their craft's
// on 501/502) now shows one other person as its own holder; they were its
// holder at a check in the last RECENT_MIN; and they are on no board at all
// in this check (on a turn of their own already: they placed, or moved; on
// one that isn't: still out working, or filling in; either way nothing is
// sent). Left out:
//   - yard jobs (Y…, X…): relief holders rotate every night at 0005;
//   - trainee slots (-TT / -ET) and MU placeholders;
//   - a new holder who has TV or TEMP VCNY on another turn this check: a
//     temporary vacancy, not a bump (25 Oct: the owner took SR03 on a TV and
//     its holder came back to it on the 30th);
//   - more than MAX_CHANGES turns changing holder in one check: a change of
//     card, not bumps (25 Oct 1216: 30 at once; never more than 2 otherwise).
// Tried on the board history (people.json, 24 Oct to 13 Nov 1535): 10 from
// 2 Nov on (the owner off SR03 on the 2nd, 2303, among them), each holder
// then off every board until they showed up on another turn or not since;
// none back on the turn they lost. The change of card held back.
//
// Only hashes of name codes go in or out (people.js personHash); the laptop
// adds the name of whoever is on the turn now when it sends (owner: the full
// name), and sends only to the displaced member's own account (owner, same
// day: "Only their account"). memory: { turns: { <key>: { h, at } } }, at =
// the check's local minutes.
//
// OWNER TEST FIRST (owner, same evening: "if youre tracking TEST as a name
// code, and have the owners key, you will get all the bumping notifications
// that would normally goto everyone. Say whos getting bumped by whom. That
// way i can see if they are correct before pushing it as a feature"):
// MEMBERS_ON is false, so no member is told; every bump found goes to the
// phones following the code TEST that were saved with the owner key
// (testDevices), naming both people (testText). To put it on for members:
// MEMBERS_ON = true, at his word.
const MEMBERS_ON = false;
const TEST_CODE = 'TEST';
// The site has been locked since 19:00 Toronto on 2026-11-10: from then a
// phone's alerts are saved only by a signed-in member (the Worker writes
// their account on it) or with the owner key (no account, unless the
// owner's device asked for his account's alerts: 'owner').
const LOCKED_AT = Date.parse('2026-11-11T00:00:00Z');
const SHARED = /^S5\d{2}$/;
const SKIP = /^(Y|X|MU\d)/;
const TRAINEE = /-(TT|ET)$/;
const RECENT_MIN = 60;
const MAX_CHANGES = 6;
const KEEP_MIN = 3 * 24 * 60;

// The turn a sighting counts on ('S501-CO' on 501/502), or null.
function turnKey(s) {
  if (!s || !s.own || !s.h || !s.turn) return null;
  const turn = String(s.turn);
  if (TRAINEE.test(turn) || SKIP.test(turn)) return null;
  if (SHARED.test(turn)) return s.craft ? `${turn}-${s.craft === 'CO' ? 'CO' : 'EN'}` : null;
  return turn;
}
// 'S501-CO' → 'S501 CO', for people.
const turnLabel = (key) => String(key || '').replace(/-(CO|EN)$/, ' $1');

// → { memory, events: [{ h, by, turn, since, at }], changes, boardChange }.
// sightings: summary.people of this check; tempAway: hashes shown with TV
// or TEMP VCNY on a turn this check (board-auto.js).
function update(memory, sightings = [], now, { tempAway = [] } = {}) {
  const prev = (memory && memory.turns) || {};
  const byTurn = new Map();
  const byPerson = new Map();
  const seen = new Set(); // anyone on any board this check, their own turn or not
  for (const s of sightings || []) {
    if (s && s.h) seen.add(s.h);
    const k = turnKey(s);
    if (!k) continue;
    (byTurn.get(k) || byTurn.set(k, new Set()).get(k)).add(s.h);
    (byPerson.get(s.h) || byPerson.set(s.h, new Set()).get(s.h)).add(k);
  }
  // Names not read this check: nothing is known, nothing changes.
  if (!byTurn.size || now == null) return { memory: memory || { turns: {} }, events: [], changes: 0, boardChange: false };
  const away = new Set(tempAway || []);
  const turns = {};
  for (const [k, v] of Object.entries(prev)) if (v && v.h && now - v.at <= KEEP_MIN) turns[k] = v;
  const found = [];
  let changes = 0;
  for (const [k, who] of byTurn) {
    const was = prev[k];
    if (who.size !== 1) {
      // Two people on it as their own (a crews-in-town line beside a board
      // row): still theirs if the last holder is one; else left as it was.
      if (was && who.has(was.h)) turns[k] = { h: was.h, at: now };
      continue;
    }
    const [h] = who;
    turns[k] = { h, at: now };
    if (!was || was.h === h || now - was.at > RECENT_MIN) continue;
    changes++;
    if (seen.has(was.h) || away.has(h)) continue;
    // Where the new holder was at the last check (placing off another turn).
    const from = Object.keys(prev).find((x) => x !== k && prev[x] && prev[x].h === h && now - prev[x].at <= RECENT_MIN);
    found.push({ h: was.h, by: h, turn: k, since: was.at, at: now, ...(from ? { from } : {}) });
  }
  const boardChange = changes > MAX_CHANGES;
  return { memory: { turns }, events: boardChange ? [] : found, changes, boardChange };
}

// The message (owner, 2026-11-13: name who took it). name: who the board
// shows on the turn now, else their code; when: "13th 1220".
function text(e, name, when) {
  const who = name || 'Someone else';
  return `Looks like ${who} has displaced you off ${turnLabel(e.turn)} (${when} check). Check CATS: you may need to place.`;
}
// What the Notifications tab shows as the logic behind it.
function why(e, codeOf = () => null, fmt = String) {
  const a = codeOf(e.h) || 'the holder';
  const b = codeOf(e.by) || 'someone else';
  return `${turnLabel(e.turn)} was ${a}'s own turn at the ${fmt(e.since)} check; at ${fmt(e.at)} the board showed ${b} on it as their own, and ${a} on no board.`;
}

// The owner's test copy (owner, 2026-11-13: "Say whos getting bumped by
// whom"): bumped = the displaced person's name (else code), by = whoever the
// board shows on it now; told = how many devices their own account has
// (what members would get once it's on for them).
function testText(e, bumped, by, when, told = 0) {
  const from = e.from ? ` (from ${turnLabel(e.from)})` : '';
  const reach = told ? `Would go to ${told} device${told === 1 ? '' : 's'} on their account.` : 'No account has their name code, so nobody would be told.';
  return `${by || 'Someone'}${from} bumped ${bumped || 'the holder'} off ${turnLabel(e.turn)} (${when} check). ${reach}`;
}
function boardChangeText(changes, when) {
  return `${changes} turns changed holder in the ${when} check: taken as a change of card, so no bump alerts for it.`;
}
// The owner's test phones: following TEST, and saved with the owner key (no
// account, saved since the lock), or his own device registered for his
// account's alerts ('owner'), or signed in to his own member account: the
// approved account whose sign-up name makes his code (accounts from
// r2.listCodeAccounts; he approves every sign-up, so no one else holds his
// name). Found 13 Nov: his TEST phone was saved under an account. Never
// another member's, whatever their page claims.
function testDevices(subs = [], testHash, accounts = [], ownerCode = '') {
  const mine = new Set(['owner', ...accounts.filter((a) => a && a.id !== 'owner' && ownerCode && (a.nameCodes || []).includes(ownerCode)).map((a) => a.id)]);
  return subs.filter((x) => (x.turns || []).includes(`@${testHash}`) && (x.account ? mine.has(x.account) : Date.parse(x.updated) >= LOCKED_AT));
}

// The displaced person's own devices (owner, 2026-11-13: "Only their
// account"): those signed in to an account whose saved name code is theirs.
// The owner's own phones carry no account (owner key), so for the owner the
// ones with no account that follow his own code count too, as in
// health.js membersOnly. A phone following someone else's code never does.
function devicesFor(h, subs = [], accounts = [], hashOf, ownerHash = null) {
  const ids = new Set(accounts.filter((a) => a && a.code && hashOf(a.code) === h).map((a) => a.id));
  const isOwner = !!ownerHash && h === ownerHash;
  if (isOwner) ids.add('owner');
  return subs.filter((x) => (x.account ? ids.has(x.account) : isOwner && (x.turns || []).includes(`@${ownerHash}`)));
}

module.exports = { update, text, why, testText, boardChangeText, testDevices, devicesFor, turnKey, turnLabel, RECENT_MIN, MAX_CHANGES, MEMBERS_ON, TEST_CODE, LOCKED_AT };
