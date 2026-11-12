# Accounts: only approved people see the site

Owner, 2026-11-09: "the information is only visible if you have an account";
"I have to approve each person. Sign Up I need name, email, pin and hire
date" (the PIN is the CN employee number); "I check by eye".

Cloudflare Access was tried first on `board-test` and dropped: its free plan
stops at 50 people. The accounts are built into the Worker
(`cloudflare/board-worker.js`, "Accounts"); tests in
`test/board/accounts.test.js`.

## How it works

- **`/account`** is the sign-in / sign-up page. It always works, locked or not.
- **Sign up:** name, email, PIN (their CN employee number; the page only
  says "PIN"), hire date. The page and the emails name no place or company
  (owner: "non descript"). A 6-digit code is emailed to confirm the
  address (owner: "can we verify emails"); only then does it reach your
  list and your phone gets an ntfy alert ("New sign-up", no personal
  details). Sign-ups never confirmed are cleared after two days.
- Emails come from your Gmail address. The sender name is "Account" once
  the Gmail script's line reads `const opts = { name: d.name || 'Sarnia board · 18.6(b)' };`
  (until then it is the 18.6(b) name).
- **You approve:** open `/account` on a device that holds your owner key
  (the same key Page Health uses). The list shows each person's details;
  compare against your seniority list; **Approve** or **Decline**. Either
  way the employee number and hire date are deleted, and the person is
  emailed. **Remove access** signs an approved person out everywhere.
  **Delete from list** forgets a declined/removed person (they could then
  sign up again; a declined person can re-apply anyway).
- **Members tab** on the board page (owner, 2026-11-09): shown only on a
  device with the owner key. Waiting for approval at the top (Approve /
  Decline), then Approved members, each with **Access** (Member / Admin)
  and **Remove access**. An **Admin** is a member who also sees this tab
  and can approve, decline and remove members; only the owner key makes or
  removes an Admin. The same list is still on `/account`. The tab is in
  `public/board.html` (`renderMembers`), so it needs the laptop's publish
  as well as the Worker paste.
- **Profile** in ⚙ Settings on the board page (owner, 2026-11-09): the
  signed-in name, email and access, and **Sign out**. Hidden on a site
  whose Worker has no accounts.
- **After approval** the device they signed up on just opens the site. On
  any other device: `/account` → Sign in → their email → a 6-digit code by
  email (10 minutes, 5 tries). Signed in until the device goes 30 days
  without opening the site (owner, 2026-11-10); each visit renews it.
- **Last seen** (owner, 2026-11-10): each member's row in the Members tab
  shows when they last opened the board (`seenAt`, noted at most once an
  hour when the page asks `/auth/me`).
- **One device per account** (owner, 2026-11-10, so accounts aren't
  shared): signing in on another device signs the first one out, and that
  device's sign-in page says why. Each switch costs one emailed code. The
  owner-key devices are not counted, and an Admin may be signed in on
  any number of devices.
- **Emails** go through the same Gmail script as 18.6(b) (EMAIL.md), at
  most 70 a day for accounts. A sign-up costs two emails (the code and the
  approval), so about 35 new people a day;
  if the allowance runs out the approval still works, the page tells you
  the email didn't go.
- **When no code is sent the page says why** (owner, 2026-11-10, after two
  silent failures): no account with that email (and it switches to Sign
  up), still waiting for approval, already has an account, can't be used
  (removed), asked less than a minute ago, or twenty codes today already.
- `board-test` and `board` share one bucket, so they share the same
  accounts: someone approved or removed on one is the same on the other.
- The sign-up banner has a second switch in `board.html` (`SIGNUP_BANNER`,
  on since 2026-11-10); the Worker's `SIGNUP_NOTICE=on` is the one the
  owner uses.
- **Limits:** 40 sign-ups a day per internet address, 150 a day in all.
- **Follows on the Members tab** (owner, 2026-11-10): a phone that saves its
  alerts while signed in is stamped with the member's account id
  (`account` in its `subs/` file), and each approved member's row shows the
  turns followed. Phones set up before accounts show as a count of phones
  with no known member until they change their alerts while signed in.
  A member's phone is also matched without them doing anything: the
  board page, when signed in, sends the address of the alerts the phone
  already has to `/push/claim`, which writes the account id beside them
  and nothing else. Alerts still reach unmatched phones (a week's grace
  from the lock, 2026-11-10; stopping them is not built).
  Followed name codes are shown as a count only (the Worker can't turn the
  hash back into a code).
- Account files are in R2 under `accounts/` and are never served.
- Only the owner key opens the list (not the Cloudflare Access email).

## Crew names on the board

Owner, 2026-11-10: "once the site is locked and it is members only, I would
like to add crew names to the board … push it to the test site for now";
"last name, first initial ie Justin O'Dea would be O'Dea, J"; names only for
turns seen on a Call Board in the last 14 days is fine for a first version;
"no names in the notifications" until the alerts grace period is over. His
reason it is all right: every approved member can already see these names
in CATS.

- **Where the names come from** (changed 2026-11-10 after SA05 showed an
  older Call Board name; the owner's photo of the A pool had the right
  one): every pool and spareboard screen the checker already reads
  unmasked gives who CATS shows on each turn now (`screens.js`
  `parseBoardCrew`, kept as `@board|<turn>` in the laptop's names.json by
  `recordBoardCrew`); a turn not on those screens falls back to its last
  Call Board name. The 18.6(b) names don't use the board entries.
- **Which name shows** (owner, 2026-11-10: "when a job is working, put the
  name of the person who's working, who you would see on the call board.
  When the turn is back home … the person whose turn it is"):
  `namesByTurn` takes the Call Board name while the turn is on the Call
  Board in the latest check; while the pool screen still shows it out
  (position 999, a train beside it, or an away terminal) it keeps that
  worker for up to a day; at home it is the pool screen's name.
- 501/502 turns need the craft read with the name, so they only fill in
  from reads made after 2026-11-10 (the pool screen gives both each check).
- **Laptop** (`lib/board/names.js` `namesByTurn`, `lib/board/site.js`): each
  turn's latest name as "Last, F" goes out as `data/crew.json`, locked with
  `BOARD_NAMES_KEY` like the 18.6(b) names. A 501/502 turn is two people:
  keys `S501-CO` / `S501-EN`. A spare who filled a turn is the name shown
  until the regular is seen on it again.
- **Worker** `GET /api/crewkey`: the passcode (the "Crew names passcode"
  saved on Page Health) to an approved signed-in member or the owner key,
  and only where the variable `CREW_NAMES` = `on`. Not tied to `LOCK`.
- **Page** (`CREW`, `crewTag`, `crewIn`, `loadCrew` in `board.html`): since
  the evening of 2026-11-10 (owner: "I want anyone with access to be able
  to see them") drawn for any signed-in approved member and the owner's
  devices on a site whose Worker has `CREW_NAMES` = `on`; that variable is
  the only switch. Where it shows:
  beside the turn in pool and spareboard rows, the turn panel, and after a
  turn wherever `markTurn` writes a line (line-up, crews, away lists).
- **Alerts carry no names**; nothing here touches them.
- **Not showing?** Page Health on the test site has a "Crew names on the
  board" box that says which step is missing (Worker / `CREW_NAMES`,
  passcode not saved, laptop hasn't published, passcode doesn't match).
- Main site: `CREW_NAMES` = `on` on `board` (the owner's plan: after the
  7 pm lock on 2026-11-10). Delete it to take the names off again.
- Known limits: a removed member who kept the passcode could still open a
  copy of the file they saved; changing `BOARD_NAMES_KEY` and the saved
  passcode ends that.

## My stats: each member's own, nobody else's

Owner, 2026-11-11: "Very detailed statistics, trends"; "only available to the
person who owns the account. They can see theirs and no one else's". Live
since 2026-11-11 (Worker `13a1b85` or later). The note at the top of HANDOFF
has what was checked.

- **Laptop** (`lib/board/mystats.js`): each site build writes one record per
  person to `accounts/stats/<name-code hash>.json` (hashes, no names) and keeps
  400 days of it in `BoardChecker\my-stats.json`. `accounts/` is never served
  as a file and never deleted by the publish.
- **Worker** `GET /auth/stats`: to a signed-in approved member, the record for
  the name code saved on their own account (⚙ Settings → Profile). Nothing in
  the request chooses whose. Answers `{ state, code, stats }`; `state` is
  `none` (no code saved), `wait`, `no` or `ok`.
- **Whose code it is.** A member types their own code, so it only counts when
  (a) it matches the name they were approved under: first two letters of the
  first name + first two of a later name, or (b) you pressed **"XXXX is
  theirs"** on the Members tab. A code two or three people have had
  (`CODE_GROUPS`, the same list as `lib/board/people.js`) always waits for
  you. **"Not theirs"** shuts it for that code. Your OK is for that code only:
  if they change it, it waits again. Only the owner key can do this.
- **Page**: the **My stats** tab (`public/board-mystats.js`, `renderMine` in
  `board.html`). No box to type a code into. Every signed-in member on both
  sites since 2026-11-11 (`MINE_ALL = true` in `board.html`; `false` = the
  test site only).
- **What counts as a trip** (reviewed 2026-11-12 against the names the checker
  reads off the Call Board; the rules are at the top of `build` in
  `public/board-mystats.js`, a test for each in `test/board/mystats-review.test.js`):
  a train their name was on, at the on-duty time last shown; before names
  were read (3 November), a train their turn was on, unless someone else's
  name was on that job or the turn was off the train again before it went on
  duty; a yard shift only by name, one per day worked. Days a person is only
  *listed* on a yard job (its own crew, or TEMP on it, in the crews in town)
  say whose job it is, not who came in: those days are `unk` on the record and
  the page leaves them out of every count and says so. From the laptop pull of
  the checker change (2026-11-12) the checker marks who is on a yard job's own
  crew lines (`duty` on the sighting, `yardDuty: 1` on the summary) and those
  days are known.
- **The newer sections** (the days hour by hour, the drawings, "Duty and rest
  beside the rules", "You and your pool", the trip log and its spreadsheet):
  `MINE_MORE` in `board.html`. `false` = the test site with the owner key
  only. The corrected numbers are for every member either way.
- **You and your pool.** The site build writes `data/pools.json`: for each
  pool an average and a middle band over the last four weeks, and nothing
  else (no hashes, no turns, no lists of figures). A figure is given only
  when at least 5 people in the pool have enough saved; each end of the band
  is the midpoint between two neighbouring people's figures, so no number in
  the file is one person's own; rates are rounded to 0.1 and times to 5
  minutes. A pool too small to give (501/502 is four people at most) is set
  beside every road pool together, and that group is given only when the
  people in it outside the pools already given number none, or five or more.
  The member's own figure never leaves their record: the page works it out on
  their phone with the same function (`poolFigures`).
- **Not covered:** Turn History's person search is unchanged, so a member who
  types someone's name code there still sees that person's trips.

## Worker settings

| Name | Type | What |
| --- | --- | --- |
| `LOCK` | Variable | `on` = only approved accounts (and your owner-key devices) see the site. Anything else = open. |
| `SIGNUP_NOTICE` | Variable | `on` = `/auth/me` reports it, the board page shows its "sign up to keep access" banner to anyone not signed in. |
| `OWNER_KEY` | Secret | Needed: opens the approval list and signs the cookies. |
| `AUTH_SECRET` | Secret, optional | Signs the cookies instead of `OWNER_KEY`. Changing whichever is used signs everyone out. |
| `MAIL_SCRIPT_URL`, `MAIL_SCRIPT_KEY` | Secrets | The Gmail script (EMAIL.md). |
| `MAIL_DAY_MAX` | Variable, optional | Account emails a day; 70 if not set. Gmail stops at about 100 a day in all and 18.6(b) is allowed 30, so above 70 the two compete. Raised for the lock (2026-11-10); delete it again once things settle. |
| `CREW_NAMES` | Variable, optional | `on` = approved members may fetch the key to the crew names (`board-test` only for now). |
| `SITE_URL` | Variable | The address put in the emails. |

Stays open when locked: `/account`, `/auth/*`, the app icon / manifest /
`board-sw.js`, `/whoami`, and the RailroadTracker relay (`/api/board*`, its
own `BOARD_KEY`). A request with `Authorization: Bearer <BOARD_KEY>` also
passes. Phones already getting alerts keep getting them.

## Rollout

1. **Test site** (`board-test`): Access off, `LOCK=on`, try sign-up,
   approval, decline, a second device, remove.
2. **Main site, unlocked:** paste the same code into `board`. Nothing
   changes for visitors; `/account` works, so people can sign up ahead of
   time. Then the notice line on the page (Test tab first).
3. **Lock:** add `LOCK=on` on `board`. To undo, delete it.

Built 2026-11-10 in `board.html`: the notice banner (`SIGNUP_NOTICE=on`,
not locked, not signed in, no owner key; a waiting sign-up sees "waiting
for approval" instead) and the hop to `/account` when data comes back 401
(signed out while the page is open).

RailroadTracker is set aside (owner, 2026-11-09: "Let's forget about the
railroad app for now"): the lock does not wait on it. If the app reads the
site's files directly it will stop working once locked, until it sends the
`BOARD_KEY` header; its relay (`/api/board*`) is unaffected.
