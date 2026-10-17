# HANDOFF — read this before doing anything

Last updated: 2026-10-17 · Branch: **`claude/vigilant-planck-zawrj4`** (has
everything; the board-checker laptop runs it)

**If you are a new Claude session:** read this file top to bottom, then
[docs/board-checker/PLAN.md](docs/board-checker/PLAN.md). Don't start coding
until the "Next action" below is unblocked. **Update this file at the end of
every session**: state, decisions, what you tried, what's next.

## ▶ Start here (2026-10-17): where things stand
**Only one Claude session at a time may change the board checker / website.**
On 2026-10-16 a laptop session (on `claude/auto-board-checker-plan-hdk1n5`)
and a website session (on `claude/vigilant-planck-zawrj4`) both changed
`scripts/board-auto.js`, `lib/board/screens.js` and `summary.js`; the
laptop's `git pull` hit conflicts. Fixed by merging the laptop branch into
`claude/vigilant-planck-zawrj4` (commit 8e8c340, 40 tests). Develop on that
branch and push there; if your session was given a different branch, start it
from `origin/claude/vigilant-planck-zawrj4`.

**What exists now:**
- **Board checker** on the dedicated laptop (`C:\BoardChecker-code`, data in
  `C:\Users\<you>\BoardChecker`): `node scripts/board-auto.js --me SR03 --every 5`.
  Route: Call Board (3→6), 23 Chain Gang (CO), 19 A / 21 B (CO), 27 SD,
  **25 S1 / 26 S3 (CC EN, owner)**, 41 line-up. Every check saved to
  `history\<date>\<HHMM>.json`.
- **Line-up snapshot website** for the union rep, on Netlify site
  **boardtestsa** (https://boardtestsa.netlify.app, id
  51fe13b9-72f2-4d91-8f6c-9a4afa292a58, public). Page `public/board.html`
  + `public/board-turns.js` + `public/board-trains.js`; built from history by
  `lib/board/site.js` (`scripts/board-site.js [--deploy]`), published by
  board-auto.js after changed checks (≤ every `BOARD_SITE_EVERY`=30 min) when
  `NETLIFY_AUTH_TOKEN` + `NETLIFY_SITE_ID` are in `BoardChecker\.env`.
  Two views:
  - **Snapshots**: every check (day picker, Earlier/Later), line-up 41 with
    pool chips + "why", pools in tabs (Chain Gang, A, B, SD, S1, S3), Call
    Board on duty, calling sequence, changes, flags. **Find a turn**
    (highlight + panel + history across all checks; `data/turns.json`).
  - **Order summary** (`#orders`): each line-up train by ID (symbol + origin
    day, unique per month) from first seen (PLN time) → plan changes → ORD →
    order changes → on duty on the Call Board (option 6, the "actual").
    Per day: on duty count, average off, on time/late/early (±15 m), order
    changes. No prep adjustment (owner). `data/trains.json`.
  - Website drops "not ours" on L502 (owner).
- Laptop setup steps: `docs/board-checker/SNAPSHOT-SITE.md`.

**Not confirmed yet (ask the owner / check the laptop):**
- Did the laptop's `git merge --abort` + `git pull` go through cleanly, and is
  the board checker running on `claude/vigilant-planck-zawrj4`?
- Netlify token + site ID added to `.env` and `board-site.js --deploy` worked?
  (This sandbox can't reach api.netlify.com; deploy was only tested with a fake.)
  Until then the site shows the 3 sample checks the owner uploaded by hand.
- Screens 25/26 read on real CATS (no "skipped S1/S3 pool" lines)?
- Owner previews: private artifact https://claude.ai/artifact/9MMCotd26Ev1UesVsW5pJM
  (sample data). Manual zip = index.html + board-turns.js + board-trains.js +
  board-sample.json.

**2026-10-17: alerts in the shift tracker (RailroadTracker), built, not switched on.**
Owner: "let's make it so I see when I go to work for now", with alerts when my turn
is lined up to work in Sarnia, when it's ordered, and when the time changes 30 min or
more. Plan: [docs/board-checker/SHIFT-TRACKER-PLAN.md](docs/board-checker/SHIFT-TRACKER-PLAN.md).
- 240ca (ca304d3): each relay push carries `mine` (state, train, PLN/ORD, call/on-duty
  times, railway local) from `mineForPhone` in `lib/board/relay.js`; 41 tests.
  **The laptop needs a `git pull`** to send it.
- RailroadTracker `board-relay` (e0ed9f8): `BoardAlerts.kt` decides the 3 alerts against
  the app's last look; the Board tab leads with "On duty …". Its handoff §9 has the rules.
  Unit tests pass on a plain JVM; **not yet built with Gradle/Android SDK**.
- **Still blocking (owner):** (1) the relay isn't on `main`, which Render probably deploys:
  merge + `BOARD_KEY` on Render (the plan's "Blockers"); (2) laptop `.env`
  `BOARD_RELAY_URL` + `BOARD_KEY`; (3) build, back up the phone, install `board-relay`.

## 2026-10-16 evening: line-up snapshot website (Netlify), publishes itself
Owner wanted a page for a **union rep** showing the line-up snapshots at the
time each was taken, not specific to SR03. Built on branch
`claude/vigilant-planck-zawrj4` (this branch merged in; the laptop should now
run that branch):
- `public/board.html`: snapshot viewer (day picker + times, Earlier/Later
  across days, line-up timetable with pool chips and "why", pools in tabs,
  call board, calling sequence, changes, flags). Reads `data/index.json` +
  `data/<day>.json`; falls back to `public/board-sample.json` (the three
  fixtures) when served without them. `#YYYY-MM-DD-HHMM` links one snapshot.
- `lib/board/site.js` + `scripts/board-site.js [--deploy]`: builds the site
  from `BoardChecker\history` into `BoardChecker\site` (unchanged checks
  collapse into "same until"; settled days are cached; `BOARD_SITE_DAYS`,
  default 30) and publishes with Netlify's file-digest API (only changed
  files upload). `board-auto.js` publishes after a changed check, at most
  every `BOARD_SITE_EVERY` min (default 30), when `NETLIFY_AUTH_TOKEN` +
  `NETLIFY_SITE_ID` are in `.env`. Never stops a check. 34 tests.
- Netlify site: **boardtestsa** (id 51fe13b9-72f2-4d91-8f6c-9a4afa292a58),
  public. Owner first uploaded by hand (Netlify Drop). Laptop steps:
  docs/board-checker/SNAPSHOT-SITE.md. Not yet run on the laptop.
- Sandbox can't reach api.netlify.com (network policy), so deploy was tested
  with a fake fetch only.
- **Find a turn** (owner, same evening): box above the snapshot list. Type a
  turn (SR03, SA07…): rows with it are highlighted on every section, its pool
  tab opens, and a panel shows where it is in this snapshot plus its history
  (an entry each time what the board said about it changed; click one to jump
  there). Logic in `public/board-turns.js`, shared by the page and the builder;
  the builder writes `data/turns.json`. Last turn is remembered per browser.
- **Order summary** (owner, same evening): "Order summary" button in the top
  bar (`#orders`). Each Sarnia line-up train, keyed by its ID (symbol + origin
  day, pinned to the nearest real date so it's unique per month), followed
  from first sighting (PLN time) through plan changes, ORD (first ordered
  time) and order changes, to its on-duty time on the Call Board (option 6).
  Per day (the on-duty date): went on duty, average off first plan vs on
  duty, on time/late/early (±15 m), order times changed after ordering; tap a
  train for its story. Owner: compare as CATS shows them, no prep
  adjustment. Logic in `public/board-trains.js` (page + builder);
  `data/trains.json`. Needs real history to be useful (fixtures show it works).
- Owner, same evening: website drops "not ours" from the L502 (S5) line
  (`siteRules` in site.js; the laptop report keeps it). **S1/S3 engineer
  pools** shown under Pools at Sarnia: board-auto.js now also reads **option
  25 (S1) and 26 (S3) with CC `EN`** (owner); ⚠ layout assumed to match 23/27
  until seen on real CATS, failures only skip them. Pool parser accepts S1nn/S3nn.
  Day-file `format` bumped to 2 so cached days are rebuilt.

## ⚠ SCOPE (owner, 2026-10-15): ONLY "when do I go to work"
The owner runs board checks only while waiting in Sarnia, because the line-ups
are unreliable. The tool's one job is telling them when they'll be called.
Don't add predictions, flags or questions beyond that. The default report
prints just that answer (`--details` for the working). Route: Call Board, 23
(CO), 41. Screens 19/21 are optional.

## 2026-10-16 night: Enter past CATS messages after sign-on
Owner: CATS sometimes shows messages after signing on. `clearMessages()`
presses Enter up to 5 times, stopping at the main menu: after auto sign-on,
and in `waitForMainMenu` when a non-menu CATS screen sits 3 s (max 2 rounds,
covers signing in by hand). Tested on the fake CATS with 2 message screens.

## ⚠ Branches (2026-10-16 night)
Two sessions worked in parallel: the laptop's on
`claude/auto-board-checker-plan-hdk1n5` (S1/S3 boards in the engine, Enter
past CATS messages) and the website one on `claude/vigilant-planck-zawrj4`
(snapshot site, turn search, order summary). `claude/vigilant-planck-zawrj4`
now has **both** merged (40 tests); the laptop runs that branch. The S1/S3
route is the laptop session's (`config.poolOptions`, 25/26, CC EN).

## 2026-10-16: S1 / S3 engineer boards
Owner: S1 turns go with A trains, S3 with B; they work like A/B (first in
first out; rest/reset, hold, **, B0 → still takes the train, goes spare). S1
has one more turn than the A pool (no logic change: the board is read as
shown). Built: turn regex accepts S1nn/S3nn; loader `s1Home`/`s3Home`;
engine 3c pairs them with A/B line-up trains; view shows S1/S3 BOARDs and
"A pool: SA07 + S104". Options: **S1 = 25, S3 = 26** (owner; in
`config.poolOptions`, `--s1/--s3` override), read with CC `EN` like 27.
Layout assumed = 23 ❓ confirm from the first real run.
Tested on the fake CATS (as 25/26) + unit test. 23 tests.

## 2026-10-16 evening: running on the dedicated board-checker laptop
- New laptop set up per docs/board-checker/NEW-LAPTOP-CLAUDE.md: Git + Node
  (v24) via winget, code at `C:\BoardChecker-code` (not OneDrive), 29 tests
  pass, `.env` in `C:\Users\odeaj\BoardChecker` (all four values set, Haiku).
- Gotcha: `npx playwright install chromium` run from Claude's sandboxed shell
  didn't land where the checker looks; running it in the owner's own terminal
  tab fixed it (~320 MB, slow download).
- Old laptop's checker stopped (owner). First check 16:04: auto sign-on
  worked, AI CHECK "Looks right.", snapshot `history\2026-10-16\1605.txt/.json`.
- Sleep when plugged in is already Never. Lid-close action not checked; owner
  to set it to "Do nothing" when plugged in if the lid will be shut.
- After a restart (Windows Update), start it again:
  `cd C:\BoardChecker-code; node scripts/board-auto.js --me SR03 --every 5`.

## 2026-10-16 afternoon: data off OneDrive, snapshot history, new laptop next
- Owner: get off OneDrive. board-auto.js now keeps everything in
  `C:\Users\<you>\BoardChecker` (`lib/board/paths.js`; `BOARD_DATA_DIR`
  overrides): `.env`, browser `profile`, `last-check.json`, `auto-summary.json`,
  `stuck-screen.json`, `history\`. The owner's `.env` and profile were moved
  there; `probe-out\` is now only for board-probe.js. A repo `.env` is still
  read as a fallback. The code itself is still in OneDrive on this laptop.
- Owner asked for snapshots: every check is saved as
  `history\<YYYY-MM-DD>\<HHMM>.txt` (report as printed + AI note + working)
  and `.json` (masked screens). `BOARD_HISTORY_DAYS` (default 90; 0 = keep all)
  prunes old days. ~20 KB per check.
- Haiku's notes 11:47–13:12 were all false alarms: E27861 16 (SA08, the 16th's
  3rd A) left the Call Board, so only two A trains were visible. The review
  prompt now says departed trains drop off and to accept "used up" notes.
  Proposed, owner hasn't decided: remember each road day's Sarnia trains
  across checks from the snapshots, so departed trains still count.
- Possible A/B swap on the 16th (M30241 14 SB03 before E27861 16 SA08) is
  dropped: E27861's time was never captured. Owner (2026-10-16): don't reason
  about times there's no snapshot for; only use what's in history\.
- ❓ Owner: should crew warnings skip Toronto trains (RM39731 16, MU01)?
- Owner is setting up a second laptop that will only run the board checker,
  and wants to move everything there soon (see docs/board-checker/NEW-LAPTOP.md).

## 2026-10-16: AI check of each report
Owner asked for an AI to check the script's output, with the key changeable
later. `lib/board/review.js` sends the `--details` report to Claude (Anthropic
SDK) with a short summary of the rules; it answers "Looks right." or up to 3
lines on what looks off. It never changes the answer (the rules decide).
- Only when the check changed (or it's the first one), to keep cost down at
  `--every 5`. The note prints under the report and rides along to the phone
  at the end of `report`.
- `.env` is re-read before each review: `ANTHROPIC_API_KEY`, `BOARD_AI_MODEL`
  (default `claude-opus-5-5`), `BOARD_AI_REVIEW=off`. Errors print one line
  and never stop a check. Opus/Sonnet 5.5 requests carry the server-side
  refusal fallback (`fallbacks: "default"`).
- Tested with the owner's key on Haiku (`BOARD_AI_MODEL=claude-haiku-5-5`, owner's choice): first answer misread line-up times and repeated the report's own history warnings; prompt fixed (2968b43), same check now "Looks right."
- ⚠ Any `npm install <pkg>` removes Playwright (it's installed `--no-save`); reinstall with `npm install --no-save playwright`.
- First live run 2026-10-16 09:54: auto sign-on worked with no Microsoft
  prompt; checks every 5 min ran cleanly.

## 2026-10-15 night: automatic CATS sign-on (owner's decision)
Owner asked for the script to use their username/password and to reload and
sign back in when stuck, after being reminded of the earlier decision against
it (CN acceptable-use risk as a union rep, stored password). Built:
- `CATS_EMPLOYEE_NO` / `CATS_PASSWORD` in `.env` (gitignored, laptop only)
  fill the CATS sign-on (the empty text box + the password box), then Enter
  and past any notice. Microsoft/Authenticator are still done by hand.
- A refused sign-on (sign-on screen comes back) turns automatic sign-on off
  until restart, so a wrong password can't lock the account; 3 other failures
  in a row do the same. Credentials are never printed.
- Any failed check: save the stuck screen, reload CATS, sign back in, and
  check again straight away once; then back to the normal interval.
- Tested on a fake sign-on page only (right and wrong login). Not yet on real
  CATS: whether a reload lands on the CATS sign-on or on Microsoft is unknown.

## 2026-10-15 night: two fixes from the owner's live run
- **B trains already out count.** The 19:45 check gave SB03/SB04 the 16th
  0100/0425 trains as the 15th's B trains, though SB01/SB02 were already out
  on them (owner). The 15th's earlier A trains had left, so the Sarnia Call
  Board trains were numbered from A #1. Now the first B train seen on a road
  day fills that day's A slots (like the existing SR rule). On that board SR03
  moves from "not on the line-up" to DHT431B 16. 28 tests.
- **"No F3 key on this screen"** (19:30–19:40): CATS sat on a screen with only
  Enter. `toMainMenu` now presses Enter when there's no F3; an off-route check
  saves the masked screen to `probe-out/stuck-screen.json`. Tested on a fake
  frame only; the real screen hasn't been seen yet.
- ⚠ The owner runs an **old copy** at `Desktop\240ca-claude-auto-board-checker-plan-hdk1n5`
  (not git, 17:08, no relay). These fixes are only in this worktree; it needs
  `npm install --no-save playwright` here, plus `.env`, to run from here.

## 2026-10-15 late: board-check results → shift tracker app (built, not switched on)
Owner wants the board checker's output (when I go, Chain Gang + SD boards,
41 line-up with crews, changes) in their **shift tracker app** =
private repo `odeajust-glitch/RailroadTracker` (Android: Kotlin, Compose, Room;
read its `HANDOFF-auto-board-checker.md` first). What's there already:
- Lineup tab: board checks logged as `lineup_snapshots` (Room schema v16) from
  **screenshots read by Claude** (`ui/lineup/BoardReader.kt`), as evidence for a
  Transport Canada complaint about CATS accuracy (DRPR 6.6 / 7.2).
- Its own rotation forecast (`data/model/ChainGangForecast.kt`).
- Its handoff (2026-10-13) records a decision *against* software logging into
  CATS (CN acceptable-use risk for a union rep, credentials, evidence quality).
  This project's auto checker does log in (owner signs in by hand; nothing
  stored). ❓ Raise with the owner before wiring the two together; the app
  treats its records as evidence.
- Owner confirmed (2026-10-15): it's their app; the owner is Justin.
  (Its handoff calls him an engineer; here he's on SR03 Chain Gang conductor.)
**Owner decided (2026-10-15 night):** (a) auto-check results stay **separate
from the evidence log**: own Board tab, never `lineup_snapshots`; (b) delivery
by a **relay on Render**.

**Built (2026-10-15 night):**
- `lib/board/relay.js` + `server.js`: `POST /api/board` (laptop) and
  `GET /api/board/latest` (phone), `Authorization: Bearer <BOARD_KEY>`; 404
  when the key is wrong or `BOARD_KEY` is unset (like `/api/stats`). Keeps only
  the newest check, in `$ANALYTICS_DIR/board-latest.json` (persistent disk);
  an older check arriving late doesn't replace a newer one. Payload:
  `{checkedAt, me[], report, changes[], myAnswerChanged}`. 27 tests.
- `scripts/board-auto.js` pushes each check when `.env` has
  `BOARD_RELAY_URL` + `BOARD_KEY` ("Sent to your phone." / "Not sent…: why");
  a failed push never stops the check.
- RailroadTracker branch `board-relay` (not merged, not installed): Board tab,
  WorkManager look every 15 min, notification when `myAnswerChanged`. See its
  `HANDOFF-auto-board-checker.md` §8.
- Tested end to end on the emulator against a local relay fed the 15th's two
  fixtures: the tab shows the check; see §8 there for the notification test.
- Note: `myAnswerChanged` is true whenever the "when you go" text changes,
  including just the line-up's end time moving. Same as the laptop's beep.

**Owner's steps to switch it on (not done yet):**
1. Pick a long random key. On Render: service → Environment → add
   `BOARD_KEY`. Merge/deploy this branch's server change (it's on this branch
   only; Render deploys the branch its dashboard names, probably `main`).
2. Laptop `.env`: `BOARD_RELAY_URL=https://<app>.onrender.com` and the same
   `BOARD_KEY`.
3. Phone: install the `board-relay` build (backup procedure in RailroadTracker's
   handoff §6), Board tab → Set up → address + key, allow notifications.

## 2026-10-15 evening: `**` always goes spare; RETN = return
Owner, looking at option 27 (SD08 `** ** 1016` at 16:53): the time is the
RETN (return) column, not an "until". While `**` shows, the turn goes spare,
even past that time; the report says "** goes spare, return <time>".
`config.starsHaveExpiry` is now false (supersedes the earlier "until" rule).
Option 27's real layout matches 23 (heading `… ST RN RETN SC REST USHR TURN`),
so it parses. 22 tests.

## 2026-10-15: SD (engineer) list, option 27
Owner: option 27 lists which SD turns go with the SR (Chain Gang) trains. The
auto route now reads 27 (as shown, then CC `EN` if there's a CC box; skipped
on trouble). Loader → `sdHome` (EN/LE rows, one per turn); engine gives each
Chain Gang line-up train the next callable SD turn by the same skip/spare
rules as SR (`gangQueue` / `firstCallable`); view shows an SD BOARD and
"Chain Gang: SR04 + SD11". 27's layout matches 23 (owner's screenshot,
2026-10-15).
Owner confirmed 2026-10-15: the SD list works exactly like the SR list. A pool screen that can't be parsed is now
skipped instead of failing the check. 22 tests.

## 2026-10-15: owner's view after each check
Owner asked (after the auto check worked on real CATS): after each check show
(1) when I go, (2) the Chain Gang board status, (3) the 41 line-up with who's
projected on each train, (4) changes since the previous check. Built in
`lib/board/view.js`; `formatReport` prints 1–3 by default (both scripts) and
4 when given `changes`. `board-auto.js` keeps the last check's snapshot in
`probe-out/last-check.json` (carries over between runs), prints the full view
every check and beeps when the "when you go" answer changes. The auto route
now also reads 19/21 (CC `CO`) to name A/B turns; failures there are skipped.
Tested on the fake CATS (normal + "later" board). 21 tests.

## 2026-10-15: automatic board check built
`scripts/board-auto.js --me SR03 [--every 20]`: owner signs in by hand (stops
at the CATS main menu); the script then walks the route itself (3→6→Enter,
F8 to the yard jobs; 3→23, CC `CO`; 3→41, 47130/E/24, F8 to END OF FILE; F3
back to the main menu), saves masked `probe-out/auto-summary.json` and prints
only "WHEN YOU GO". `--every N` (min 5) re-checks and speaks up on changes;
if CATS signs out it waits for the owner to sign in again. It never sees or
stores credentials. Screen capture is shared with the probe in
`lib/board/capture.js`. Screens are recognised by their text (whitespace
collapsed, since CATS splits words into boxes); boxes are filled by order.
Tested end to end against a fake CATS built from the recorded menus and the
15b screens: same answer as `board-check.js`, planted names/password absent.
Owner ran it on real CATS 2026-10-15: works. If it stops with "Expected the … screen", ask
for the message and `probe-out/auto-summary.json`.

## 2026-10-15: rules confirmed
`**` = goes spare while shown, time = RETN/return (see 'evening' above); B0 at a normal position = working another
job → goes spare (at POS 999 with a train = out on its own train); A/B "rest"
= resets → goes spare; turns in Toronto never get a Sarnia train until they're
back on the Sarnia list; outer switch / return order is out of scope; line-up
max is 24 h. Shadow checks: 2 so far. 20 tests.

## 2026-10-15: report leads with "when you go"; A/B turns
Owner's main goal is predicting **when they go to work**; the report now opens
with it. The route adds screens **19 (A) and 21 (B)** with CC `CO`, so A/B trains
get turn numbers (first in, first out; an A/B turn on rest/hold/** goes spare
but still takes the train). The 19/21 layout is assumed to match 23 until a
real run confirms it. 18 tests.

## 2026-10-15: first shadow check done
Owner's real run (15th 01:43) is `test/fixtures/board/2026-10-15.json`; results
are in BOARD-CHECK.md "Shadow check #1". No rule broke; four gaps were fixed
(deadhead symbols, working turns, A/B count after midnight, masked clock).
15 tests pass. The probe had a bug on the 15th (noNames used before it was
declared): fixed and verified end to end with a fake CATS.
Owner's folder is nested: `C:\Users\odeaj\OneDrive\Desktop\240ca-…\240ca-…`.
**Next:** more shadow checks (aim ~10–15 agreeing runs). Open: where to read
outer switch times (returning-turn order); is the time beside `**` an "until"?

## 2026-10-14: board brain built (Phase 1)
- `lib/board/`: `grid.js` (probe grid → rows), `screens.js` (Call Board, Chain
  Gang 23, Line-up 41 parsers; names never copied out), `engine.js` (3 A / 2 B
  after 0459, deadheads → SR, rest/HT vs call time, `**` goes spare, returning
  turns at the bottom, L502 excluded, pairing/MU/pool flags), `report.js`,
  `summary.js`, `config.js` (counts, prep, call lead), `time.js` (zone-free
  local minutes).
- `scripts/board-check.js <summary.json> --me SR03 [--now …]` prints the report.
- Tests: `npm test` (`node --test`), 10 passing. The main one reproduces the
  owner-agreed 2026-10-14 prediction from `test/fixtures/board/2026-10-14.json`
  (composite of walkthroughs, names masked).
- Assumptions to revisit: returning turns ordered by Toronto on-duty time
  (stand-in for outer switch time) and assumed home when reached; `**` ignores
  its time (`starsHaveExpiry: false`) until the owner confirms; a status time
  with no day is taken as the snapshot's day.
**Next:** (calendar reminder set for 2026-10-15 12:00 Toronto) owner runs the probe on the 15th with the latest board-probe.js (Call Board pages to the yard jobs,
23 with CO, 41) → run board-check on it → compare with the 14th's prediction.

## 2026-10-14: rules settled, first prediction agreed
The owner (conductor, **SR03**) has taught the three screens the check needs:
**Call Board** (`3`→`6`→Enter, on-duty crews), **Chain Gang position** (`23`, POOL
SR, TERM 0, CC `CO`), and **Train Line-up** (`41`, station 47130, dir E, 24 h;
`ORD`/`PLN`). All rules are in BOARD-CHECK.md, including the call-time/rest
maths, HT, `**`, MU, pairing, returning turns, and 3 A / 2 B after 0459. The
owner agreed with the worked prediction in BOARD-CHECK.md ("that's how I'd
read it").
**Next:** (1) shadow-check that prediction against what actually happened on
the 15th; (2) build Phase 1: `lib/board/` parsers for the three screens plus
the rule engine, with `node --test` tests built from the worked example
(names stripped).

## 2026-10-14: screen walkthrough
The probe now has a **recording mode**: the owner navigates CATS normally, and
every screen is captured in order (`summary.json` → `screens[]`: masked
`screenGrid`, the key pressed / masked text typed to get there, text field
names). Raw `screen-NN.html/png` stay on the owner's PC. The owner pastes the
summary and describes each screen in plain words; record both in SCREENS.md.
First screen to teach: **finding the train currently working** (on duty out of Sarnia).
**Walkthrough 1 (2026-10-14):** route recorded (sign-on → `45 SA 3` → `45 SA 6`
→ `45 SA` = TRAINS ON DUTY, F8 to page); see SCREENS.md. Two probe bugs found
and fixed: (a) screen text was missed (nested in positioned boxes), so the
grid now walks text nodes; (b) **the masked shape of the owner's CATS
password was recorded** (it was typed on the CATS sign-on screen), so typed
values are now kept only for visible text boxes and passwords are never
recorded. The owner was told and advised to change that password.
**Next:** owner re-runs with the fixed probe (download raw file again) and
describes each screen's columns.

## 2026-10-14: scope refocused
The owner works **road only** and holds a **Chain Gang (SR pool)** turn. They are
**not** on the spareboard. Road order out of Sarnia each day: first 3 trains → A
turns, next 2 → B turns, everything else **plus all deadheads** → Chain Gang;
holes backfilled from the spareboard. Their board check: (1) what's been
ordered out of Sarnia → order of trains, (2) where they sit in that order.
**Spec and open questions: [docs/board-checker/BOARD-CHECK.md](docs/board-checker/BOARD-CHECK.md).**
This supersedes the spareboard-centred parts of PLAN.md and the "board screen"
guesses in SCREENS.md (run 2 probably captured a pool screen, not the spareboard).
Turn counts settled: **3 A, 2 B**. They only change by a union-meeting vote, so assume them unless the owner says otherwise.

## ⏸ Paused here (2026-10-13). Resume with this
Owner paused the work. Phase 0 is a technical **go** and risk is signed off.
We were about to have the owner **teach the board screen**. To resume:
1. Ask the owner the 7 questions now listed as blanks in
   [docs/board-checker/SCREENS.md](docs/board-checker/SCREENS.md): how to reach the
   board, the prompt line's options, each column's heading and meaning, codes
   (REST, CO, `+`), paging, Fast/Slow/pools, and how a call or runaround shows on
   screen. Write the answers into SCREENS.md.
2. Ask them to re-run the probe on the **spareboard** screen (they replace only
   `scripts\board-probe.js` via GitHub's "Download raw file", then run
   `node scripts/board-probe.js` in `C:\Users\odeaj\OneDrive\Desktop\<unzipped folder>`)
   and paste `summary.json`. Its `screenGrid` gives masked rows with column
   x-positions; fill the `x` column in SCREENS.md from it.
3. Then start Phase 1: `lib/board/` screen map + parser, with `node --test`
   tests from masked fixtures.
The owner is non-technical and on Windows (cmd). Give click-by-click steps.

## What the project is
`240ca` is a Q&A web app over TCRC Division 240 (CN Rail, Sarnia) collective
agreements and work rules (Express 5, CommonJS, BM25 + Kimi LLM, deployed on
Render). See README.md. We're adding an **automatic board checker**: spareboard
position/ETA, plus a runaround (call-out-of-order) audit.

## Decisions so far (from the owner)
- Features: **runaround / call-order audit** and **my position / ETA**. Rest/mileage
  compliance is out of scope for now.
- Data source: **test whether we can scrape the board site first** (Phase 0 in PLAN).
  If scraping is a no-go, fall back to members pasting board text.
- Handoff lives here in the repo; CLAUDE.md points at it.

## Current state
- Plan written: `docs/board-checker/PLAN.md`. Only code so far is the Phase 0 probe.
- Board rules pulled from `data/crew_calling_cty.pdf` and
  `data/crew_calling_manual.pdf` into the plan's rule table.
- **Board site facts (from owner, 2026-10-13):** `https://cats.cn.ca`, sign in
  with name + password, then Microsoft Authenticator (approval lasts ~24 h).
  No CN VPN needed; it's on the public internet.
- **The cloud container can't reach it:** the environment's network policy blocks
  `cats.cn.ca` (proxy CONNECT 403). The owner could allow the domain in the
  environment's network settings, but MFA needs a human anyway, so the probe
  runs on the owner's own computer.
- `scripts/board-probe.js` is written and was tested against local fake pages
  (a frameset like CATS, tables, a JSON fetch; scrubs tokens, masks names). It opens a visible
  browser and **the owner signs in by hand**, so the script never handles
  credentials. The browser profile persists in `probe-out/profile` so the
  Authenticator approval carries over between runs. `probe-out/` is git-ignored.

## Owner decisions (2026-10-13)
- **Risk sign-off given:** owner is fine with a tool keeping a CATS session open
  under their login. Storing their password for auto re-login has **not** been
  agreed; ask separately if needed.
- Owner is teaching how to read the board screen. Everything they explain goes
  into [docs/board-checker/SCREENS.md](docs/board-checker/SCREENS.md) before code.
  Design intent: the board *reader* is deterministic code driven by that screen
  map, not an LLM eyeballing the screen. The LLM's job is explaining flagged
  runarounds with citations from the agreements.

## Next action: owner teaches the screen (SCREENS.md), and re-runs the probe once more
Run 2 captured the board screen. The probe now also outputs `screenGrid`: masked
rows with column x-positions, so we can map columns precisely. Ask the owner
which CATS screen it was (spareboard or a pool?), what each column means, and
to re-run on the spareboard screen. The owner replaces just
`scripts\board-probe.js` in the existing unzipped folder
(`C:\Users\odeaj\OneDrive\Desktop\…`), using GitHub's "Download raw file"
button. That keeps `probe-out\profile`, so the run also tests whether the
saved session survived. No reinstall is needed; then run:
```
node scripts/board-probe.js
```
Sign in if asked, go to the spareboard screen, press Enter in the terminal,
and paste `probe-out/summary.json`. If it says "Already signed in", that
shows how long a session lasts. Note the time since the last run.

## Phase 0 findings
**Run 1, 2026-10-13 (login flow only; board not captured):**
- **Sign-in:** Microsoft Entra ID (Azure AD), CN tenant `fd753b92-…`, then
  Authenticator push (`SAS/BeginAuth` → `EndAuth` polling). CATS sits behind
  **Azure AD Application Proxy** (`AzureAppProxy*` cookies on `.cn.ca`), so
  every request needs a valid Entra session. A scraper can't just send a
  username and password; it needs a browser session that went through MFA.
  (The flow also detoured through `login.live.com`, a personal Microsoft
  account. Probably just how the owner picked their account; worth checking.)
- **Session lifetime clues:** `AzureAppProxyAccessCookie` is a session cookie.
  `ESTSAUTHPERSISTENT` (Entra "stay signed in") expires ~3 months out, but
  CN's MFA policy re-prompts about every 24 h (owner). Real lifetime is
  still unmeasured; the second run will tell us.
- **The app is Jacada** (`/Xhtml?JacadaApplicationName`, POSTs with `JBS`):
  a web front end over a legacy mainframe "green screen". There is **no JSON
  API**. Each screen is server-rendered HTML, and moving between screens means
  POSTing a form (like pressing keys on a terminal). The owner reached the
  board in 3 POSTs after the landing page.
- **What that means for scraping:** feasible, but by driving the screens the
  way a person does (Playwright filling fields and pressing keys), then
  parsing fixed-position text. That works but breaks if CN changes the
  screens; parsers must fail loudly, not silently mis-read.
- Top page title empty, no tables: the board lives in a frame (fixed in probe).

**Run 2, 2026-10-13 17:56 UTC (~8 min after run 1); board captured:**
- **Session reuse:** the saved browser profile did *not* skip sign-in; the owner
  re-entered name + password, but **Authenticator was not asked again**. The
  App Proxy/Entra session cookies are session-only, so they're lost when the browser
  closes. The MFA approval is remembered. Implication: run one long-lived
  browser. CATS itself pings `KeepAlive?JBS` on a timer (`keepAliveURL` /
  `keepAliveInterval` hidden fields), so an open page stays alive by itself.
  Re-entering the password automatically would mean storing it: the owner must
  decide that explicitly.
- Microsoft's sign-in page takes ~10 s to load. Automation must wait for
  elements, never fixed short sleeps.
- **Frames:** top page → frame `jacadaframe` (`/Xhtml?JacadaApplicationName`)
  holds the screen. No tables and no `<pre>`; ~90 **absolutely-positioned
  elements**, one per mainframe field. Rows must be rebuilt from element
  top/left coordinates (the probe now does this: `screenGrid`).
- **Navigation is a 3270 emulation:** hidden `sessionId`, `processId`,
  `sequenceNumber` (increments per screen; don't replay raw POSTs, drive
  the page), PF keys as submit buttons `acc_F1`…`acc_F24` (owner used `acc_F3`),
  input fields named `txt_Sub0802501055_<n>` (`_138/_139/_140` look like
  the selection fields on the board screen; `_21/_20/_22/_23` on an earlier one).
  The `<n>` suffix looks like a field index, so it's probably stable per screen.
- **Board screen content (masked):** board words seen: TURN, POS, EMPLOYEE, NAME,
  POOL, REST, CO, PREV. Header has a selection prompt like
  `(9=AAAA, 9-9=AAAA, A=AAAA)`. Data repeats per row as roughly:
  `AA99 | 9 | 999 | NAME+ | A | AAAA | A9 | AA | AA`, i.e. turn id, position,
  a 3-digit number, name (`+` suffix = more info?), a 1-letter flag, a status
  word, a code, and two short codes (CO etc.). **Column meanings unconfirmed;
  ask the owner.** It may be a pool screen rather than the spareboard ("POOL" appears).

**Go / no-go:** **technically GO for reading via browser automation**: the
board is plain text in positioned fields, reachable in a few screens, with a
built-in keep-alive. Still open before building: (1) owner confirms which screen
this is and what each column means; (2) owner runs the updated probe once more
so `screenGrid` shows real columns (masked); (3) owner's risk sign-off on
automated logins / long-running session.

## Ground rules for whoever picks this up
- Never commit credentials, raw captures with coworkers' names, or `probe-out/`.
- No polling or scheduled scraping until Phase 0 is a "go" and the owner has
  signed off on the risk.
- Match repo style: CommonJS, small `lib/` modules, comments explain *why*.
- Tests: use built-in `node --test`. Don't add a test framework dependency.
- Develop on the branch above; don't open a PR unless the owner asks.
