# HANDOFF — read this before doing anything

Last updated: 2026-10-26 · Branch: **`claude/vigilant-planck-zawrj4`**
(has everything; the board-checker laptop runs it, pulled + restarted
2026-10-26) · 128 tests (`npm test`)

**If you are a new Claude session:** read the "Start here" section below,
then the dated notes under it as needed (newest first). **Only one Claude
session at a time may change the board checker / website.** Update this file
at the end of every session: state, decisions, what you tried, what's next.

## ▶ Start here (updated 2026-10-26): where things stand

**Owner:** Justin, CN conductor on **SR03** (Chain Gang), union rep, Sarnia.
Non-technical, on Windows: give exact click-by-click / copy-paste steps, use
Command Prompt syntax (`%USERPROFILE%`), not PowerShell's, unless they say so.

**Running on the dedicated laptop** (code `C:\BoardChecker-code`, data
`C:\Users\odeaj\BoardChecker`, settings in its `.env`):
```
cd C:\BoardChecker-code
git pull
node scripts/board-watchdog.js --me SR03 --every 5
```
The watchdog runs `board-auto.js` and restarts it (with its Edge window) if
it hangs; `scripts/start-board-checker.cmd` (Startup folder) does the same.
After pulling, restarting is needed; after a Worker change, the owner must
re-paste `cloudflare/board-worker.js` into Cloudflare (board → Edit code →
Deploy).

**⚠ To check (owner, 2026-10-26): which 501/502 turn really works L502?**
For L50231 26 (0400) the line-up said the first crew up on option 29, but
option 5 (Jobs going spare) put both CO and EN vacancies on **S502**. The
owner isn't sure which is right. Once L502 goes on duty, look at the Call
Board crew (Turn History / the snapshot's on-duty list) to see which turn
was actually called, then adjust: either keep the engine.js L502 rule
(first crew up) or switch to CATS's option-5 turn (and drop the `s5Turn`
mapping in site.js vacancies, which shows "CATS lists S502" under it).

**What it does now:**
- Checks CATS every 5 min in Edge: Call Board, pools 23/19/21/27/25/26,
  line-up 41, Toronto bunkhouse 28 + Mac yard line-up 41. Answers "when do I
  go" (engine.js), remembers each road day's trains (`roadday.js`).
- **Microsoft sign-in:** CATS sign-on, Microsoft email (`MS_EMAIL`) and
  password (`MS_PASSWORD`) are filled from `.env`; the approval is always
  the owner's phone (Authenticator). Fresh sign-in on **R** in the window,
  on `signin` sent to ntfy topic `<BOARD_NTFY_TOPIC>-signin`, and when
  SR03 shows on duty in Sarnia. ntfy alerts (`BOARD_NTFY_TOPIC`) for
  sign-ins. Automating the second factor (TOTP) was **refused** by the
  session's safety check: don't retry unless the owner explicitly changes it.
- **Website: https://board.sarniaboard.workers.dev** (Cloudflare Worker +
  R2 bucket `board-site`, free). Uploads after **every** check
  (`R2_ACCOUNT_ID/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY` in `.env`).
  Email login (Cloudflare Access) is set up but **switched off** by the
  owner: the site is open to anyone with the link. Old
  boardtestsa.netlify.app **redirects** there (keep that Netlify site; keep
  NETLIFY_ lines out of `.env`). Tabs: Current, Turn History, Snapshots,
  Order summary, Article 18.6(b) (grievance letters, names locked with `BOARD_NAMES_KEY`).
- **Toronto (Mac yard) table** predicts crews per train: bunkhouse first,
  then crews still on their way (estimate: on duty + 8 h train / 3 h
  deadhead, then 8 h rest); crews on rest at a train's call are skipped.
- **Turn alerts on phones** (web push, free): Find a turn → 🔔 Get alerts.
  Per turn: lined up, ordered, on duty, mandatory reset (until 0559),
  someone ahead on/off rest (SR/SD only), call moves ≥ N min. Works on
  Android; iPhone only from the home-screen icon (on-screen steps).

**Added 2026-10-22 evening (owner picked #1, #2, #6, #7, #8 of my ideas):**
- #1 "When does this turn go?" on the site: `whenYouGo` (site.js) runs the
  engine with `me` for each Chain Gang CO turn, returning turns and every
  lined-up conductor; engineers get their train/call. Newest check only →
  `data/whengo.json`; turn panel shows it on the newest snapshot.
- #2 Checker health: `status` in index.json (last sign-in, restarts today
  from restarts.log), shown under "Updated". Worker `scheduled()` (cron
  */10, vars NTFY_TOPIC, DOWN_MINUTES=30) ntfy "down"/"back", note in
  `status/down.json` (never served; deployR2 never deletes `status/`).
  ✅ Owner added the variable + cron trigger 2026-10-22 (wrangler.toml matches; keep_vars). Not yet seen firing.
- #6 Prediction accuracy: line-up / Mac rows carry `pred` {co, en} (not
  `known` rows, not S5); BoardTrains keeps the last before on duty
  (`r.predicted`), `predHit` vs the Call Board crew; Order summary tiles
  (this day, 7 days) + story line. FORMAT 8 (rebuilds days once).
- #7 Icon: `scripts/make-icons.js` → public/board-icon-{180,192,512}.png.
- #8 Share links `#turn=SR07`, `#train=M38261-22` (navigator.share or copy).
- 2026-10-23 (owner): turn panel Share button removed (train share kept).
  "Someone ahead" alerts only while the turn is on its Sarnia board (SR or SD),
  not on duty; leaving the board forgets `ahead`/`pos`. Screen chips jump to
  their sections. Rescue alerts (pref `rescue`): symbol /^R[A-Z]\d/ on the
  Sarnia 41 → turns home on Sarnia boards; on the Mac 41 → bunkhouse crews.
  Once per rescue id (`told[turn].rescues`). Worker must be re-pasted for the
  `rescue` pref. Not yet seen on a real rescue.
- 2026-10-24 (owner): line-up shows the SR chip + "No Turn Available (goes
  spare)" when no Chain Gang turn is free (page only). New **Turn History**
  tab (mode 'turns', renderTurns: turnPanel + turnStats from the newest
  check). Find a turn on Current/Snapshots now opens the track dialog
  (openTrack): OK keeps prefs, adds to localStorage `trackTurns` and
  subscribes alerts (Alerts.set). Highlighting is `marks` (all tracked
  turns; Turn History's own turn on that tab). Turn panel no longer on the
  main page.
- 2026-10-24 (owner): more screens (docs/board-checker/SCREENS.md "Added
  2026-10-24"). Call Board paged to CREWS IN TOWN (yard jobs, 8 h);
  spareboards 13/9 and engineer 1→19/17; 5 (jobs going spare); 29 (501/502),
  31 (Garnet). Labels co-fast/co-slow/en-fast/en-slow/terminal/s5/garnet;
  loadSummary → yardJobs, spareboards, vacancies, s5, garnet; site pools tabs
  + sections #sec-yard, #sec-vacancies; Turn History facts. FORMAT 9.
  Owner screenshots then: menu 1 = ENGINE SERVICE (selection box 3rd),
  Garnet = S5 TERM 1, yard crew lines have names not turns → matched to
  turns in memory (knownPeople in board-auto.js), saved as summary.yardCrew.
  ❓ Not run on real CATS yet. People working (not on a spareboard list)
  may go unmatched; the TURN screens (014/010, 020/018) could fill that in.
  Filling in (backfill, matched by name): saved as summary.backfill; Turn
  History shows "working SR03" / "worked by B138"; the on-duty alert goes to
  the person's own turn (turnStates pools.backfill), not the job's.
  Who fills a job going spare (site.js spareFills, owner): yard → fast
  board, road → slow board; CC EN/LE/ET → engineer boards, else conductor;
  board order, earliest job first, on rest at the call = skipped. Calls
  assumed: yard = start − 2 h, road = order − 2 h 15 m (❓ confirm yard).
  Shown under each job ("Filled by … estimate") and in Turn History.
  Yardmaster jobs (CC YA) go to the yardmaster board: left off the site.
- Hidden person search (owner, 2026-10-24): type a 4-letter code (first 2
  of first name + first 2 of surname, letters only: Justin O'Dea → JUOD) in
  Turn History or Find a turn. Never suggested, never shown as a name, not
  kept in the URL or on the phone. Each check saves people: [{ h, turn, own }]
  (h = sha256('240ca-person:' + code) first 16 hex, lib/board/people.js);
  site builds data/people.json (hash → turn stretches, FORMAT 10); the page
  hashes the typed code (crypto.subtle) and joins those turns' histories
  (personHistory). Tracking a code tracks the person's current turn (not the
  person; alerts don't follow them to a new turn yet).
- Spareboard alerts (owner, 2026-10-25): turnStates takes spareboards,
  vacancies (+ spareFills, lib/board/spares.js) and yardJobs: spare turns get
  position, someone ahead on rest/back, reset, rescue, lined up/ordered/time
  for the job they're predicted to fill (jobs already on duty skipped), and
  on duty on yard jobs.
- SD may be called (owner, 2026-10-25, pref mayCall): a road job going spare
  needing an engineer with no one free on the engineer slow board → the next
  SD turn (SR for a conductor job off the conductor slow board; pos order;
  not working, resting/held past the call, or already
  projected for a train) gets an alert, once per job (spares.js sdBackups).
  Also on the site under the job and in the SD turn's history. Worker saves
  the pref: owner must re-paste board-worker.js.
- Reminder before the call (owner, 2026-10-25, pref before: 90/60/45/30,
  0 = off, default off): timeEvents sends "about N min to your expected
  call" once per train when the call is within that time (now passed from
  board-auto.js). Worker saves it: re-paste needed.
- Toronto (owner, 2026-10-25, lib/board/toronto.js): PLN train → next crew
  in bunkhouse order even if on rest at the call (site shows "rested <time>"
  in yellow); ORD train → next crew rested by the call (skip, keep place);
  ORD with none rested → "possible Toronto South crew" and the crew first in
  line then gets a mayCall alert (once per train) + Turn History note.
  Never for a deadhead (owner, 2026-10-25). Deadheads that leave either
  line-up and aren't on the Call Board 30 min later: flag 'deadhead'
  ("Deadhead never called", board-trains.js flagOf), tallied on the Order
  summary (this day, last 7 days, latest).
- Turn History redesign, step 1 (owner, 2026-10-25): "Work history" first:
  trains/yard jobs actually worked (orders with onDuty and not workedBy;
  history now keeps crew, onDutyAt, station, job), call = on duty − 2 h,
  worked with = the rest of the crew. Tap a row: call history = changes and
  rests between the previous train worked and this one. Same in person search.
  Rest of the panel unchanged for now; owner to say what's next.
- One number, two turns (owner, 2026-10-25): S5xx (501/502) asks
  "Conductor or Engineer?" in the tracker and Turn History → "S501-CO" /
  "S501-EN" (BoardTurns.splitCraft/crewHasCraft filter facts and work
  history; alerts set states['S501-CO'] for on duty; Worker accepts
  -EN/-CO: re-paste). MU turns are placeholders: not searchable or
  trackable (BoardTurns.PLACEHOLDER), still in people's history.
- L502 (owner, 2026-10-25): the first crew up on 501/502 (option 29, home,
  lowest POS; MU skipped), CO and EN each like A/B (**, TV,
  B0, hold/rest past the call, away or working → goes spare); they bring
  L501 home from Garnet. engine.js uses input.s5; view.goesTo "S5: S501
  (goes spare) + S501"; alerts set S501 and S501-CO/-EN lineups.
- Person stretches split when own/not-own changes (people.js), so a TV
  turn no longer stays "theirs" (JUOD showed S501 instead of SR03).
  Bunkhouse crews also get lined up / ordered / time / reminder alerts for
  the train home they're predicted for (turnStates lineup.home = true).
- Alerts log (owner, 2026-10-25): every alert sent is appended to
  "Board alerts.txt" on the Desktop (OneDrive Desktop first; paths.js
  alertsLog, BOARD_ALERTS_LOG overrides): time, turn, kind, phones, text.
- "Where you stand" (owner, 2026-10-25): phoneEvents sends one 'stand'
  alert per newly followed turn per phone (base.__welcomed); always on.
- Fill-ins carried to Toronto (owner, 2026-10-25, lib/board/fillins.js,
  BoardChecker\fill-ins.json): a backfill (B119 on SB04's job) is kept until
  the job turn is back on a Sarnia board or the spare on its spareboard (and
  the train's off the Call Board), max 48 h; the bunkhouse read by name
  (summary.bunkFill) confirms/finds one, or clears it for the own holder;
  bunkhouse/Toronto alerts and
  on duty for SB04 go to B119 meanwhile. "Back on the board in Sarnia"
  (position pref): a turn seen out working (on duty / POS 999) that shows on
  a Sarnia board again is told its position.
- Turn holders (owner, 2026-10-25, lib/board/holders.js, BoardChecker\
  turn-holders.json, names hashed): own turn = on a Sarnia spareboard, or on
  a pool list at home (T 0) and not working (temporary assignment beats the
  spareboard in the same check); away/working pool rows, rows with TV
  beside the name (turn going spare, person on another turn), Call Board and
  bunkhouse never count. Learned once per check at the end of the route.
  Kept 90 days unseen. Used for yard crews, fill-ins, the bunkhouse check.
- Follow a person or a turn (owner, 2026-10-25): typing a code in Find a
  turn offers "👤 JUOD" (alerts move with their own turn) or "Turn X only".
  Phone keeps '@'+personHash (and the code, for its own label; never a
  name). Worker accepts '@[0-9a-f]{16}' (re-paste needed). Checker keeps
  person-turns.json (hash → own turn from summary.people, own only) and
  expandPhone() turns '@h' into that turn with the entry's prefs; a change
  of turn brings a "where you stand" for the new one.
- **Board position alert (owner, same evening):** kind `position`, pref
  default on, every board (SR/SA/SB CO lists, SD/S1/S3). `told[turn].pos` +
  `posAhead`; when the position moves: "SR03: now position 001 (was 003).
  Moved up: SR07 (M38261) and SR04 (M39671 21) went out." / "Moved down:
  SR12 placed ahead of you." Reason train from Call Board on-duty, else the
  pool row's "out working on", else line-up. Worker re-paste (prefs).
- **Saved for later (owner): #5 a possible-runaround log** — page listing
  trains that went to a different pool/turn than the sequence (engine
  `flags` rule 'pool'), each linked to its snapshot. Owner wants to expand
  on it before building; earlier scope note said "only when do I go".
- Not picked: #3 calendar export, #4 Article 18.6(b) rep alert, #9 weekly
  summary.

**Session 2026-10-26 (all pushed; owner pulled + restarted):**
- MU with MU (a whole make-up crew, e.g. M39931, Z14931 out of Toronto) is a
  note, not a flag; MU with an A/B turn still flagged (engine.js).
- Jobs going spare: an S5 vacancy shows the line-up's 501/502 turn (first
  crew up on 29) with "CATS lists S502" under it when CATS differs
  (site.js `s5Turn`, `cats`). ⚠ Open: which turn really works L502 — see
  the ⚠ note above; check the Call Board crew for L50231 26 and adjust.
- Toronto bunkhouse (28) now keeps MU crews (`anyTurn`, EN/LE/CO rows
  only), so they hold their place in the Mac line-up.
- Earlier the same stretch (2026-10-25/26): every vacancy row shows
  "(spare)", S5 rows get an EN/CO chip, B0s in "skipped" are counted
  ("N on B0 (working)", board.html `skippedText`).
- Owner's next step: **more features in a new session** (none named yet).
  Turn History redesign step 2 is also still open (owner said more may follow).

**Waiting on the owner / to watch:**
- ❓ Did a fresh sign-in restart CN's 24 h? (window: "since the last sign-in")
- ❓ Auto sign-in when SR03 goes on duty: seen working yet?
- ❓ Why the checker hung: next `[watchdog …] looks stuck` line + lines above
  it, and `BoardChecker\restarts.log`.
- ❓ Confirm Toronto trip timings (read as train 8 h, deadhead 3 h).
- ❓ AI review (Haiku): still false alarms after the prompt fix?
- ⚠ The owner pasted `.env` (CATS + CN Microsoft passwords, Anthropic key,
  Netlify token, names passcode) and an R2 key into the chat on 2026-10-22;
  told to change all of them. **Never ask for `.env` contents**; use the
  `findstr /B /C:"NAME=" …` ok/MISSING check.
- Still open from CHECKUP.md: #6, #7, #10, #11. RailroadTracker relay not
  switched on.

## 2026-10-22: road-day memory (CHECKUP #5, built) + Microsoft sign-in question
- **Built:** `lib/board/roadday.js` keeps every Sarnia train seen on the Call
  Board for 36 h in `BoardChecker\road-days.json` (turns only, no names). The
  engine counts the ones gone from the Call Board (`departed`) toward their
  road day's A/B trains; no flags or predictions for them, a working note
  "Counted from earlier checks". First run after the update fills it from the
  last two days of `history\`.
- `since` = when unbroken checking began (a gap > 6 h restarts it). A road day
  that started before `since` may be missing trains, so a train CATS sends to
  the Chain Gang there still means A/B are used up (now also when only some of
  them were seen, not just none). A road day watched from its start keeps
  its count, so a too-early Chain Gang train is flagged.
- Website builder does the same per snapshot (FORMAT 5, days rebuilt once).
  **Laptop: `git pull`, restart the checker.** 68 tests with the sign-in work.
- **Microsoft sign-in (owner, 2026-10-22).** Owner wanted no phone for the
  ~24 h Microsoft sign-in. CN does offer "use a different authenticator app"
  (TOTP), but building code entry from a stored key was **refused by the
  session's safety check** (it bypasses CN's two-step sign-in); not built,
  don't retry without the owner explicitly changing that. Built instead
  (owner chose both): **R in the checker window** = sign out of Microsoft
  (clear its + `.cn.ca` cookies) and reopen CATS for a fresh sign-in; and
  **automatically once the owner's turn shows on duty on the Sarnia Call
  Board** (owner changed it from "ORD + call ≤ 3 h": once working, not
  before; `lib/board/signin.js`, once per train, not within 3 h of the last).
  The approval stays on the phone. The checker prints Microsoft's number to
  match, answers "Stay signed in?" Yes, fills `MS_PASSWORD` if set (once per
  sign-in, off after a refusal), optional ntfy alert (`BOARD_NTFY_TOPIC`),
  and records each sign-in in `ms-signin.json` + prints how long the last
  lasted. Tried on a fake Microsoft page only; selectors (`#idSIButton9`,
  `#idRichContext_DisplaySign`, `#passwordError`) unconfirmed on CN's real
  one. ❓ Does a fresh sign-in really restart CN's 24 h? Watch the "the one
  before was … ago" line. ❓ Is the Microsoft password the same as CATS's?
- **Owner's first real test (2026-10-22): R works** on real CATS/Microsoft;
  Microsoft asked for email + password (typed by hand). No ntfy alert came:
  cause unknown (topic not set/mismatched, or ntfy blocked?). Added: `MS_EMAIL`
  fill, a start-up line saying what was found in .env, and "Phone alert sent"
  / "not sent: why" lines. ❓ Owner to report those lines.
- **ntfy curl test worked on the owner's phone.** Remote forced sign-in
  added (owner): checker polls ntfy topic `<BOARD_NTFY_TOPIC>-signin` every
  minute (`lib/board/remote.js`); a "signin" message ≤ 15 min old = R. Not yet
  tried on the laptop (sandbox can't reach ntfy.sh). 72 tests.
- **Phone sign-in works on the laptop** (ntfy alert arrived, password filled).
  Bug found on CN's real page: its email step carries an off-screen password
  box (for password managers), so the password was typed there and the email
  skipped ("Enter a valid email address"); nothing was sent. Fixed: only
  on-screen inputs count, email before password, fills target the element
  found (`data-board-fill`). Fake page now copies that. ❓ Number to match not
  seen yet on the real page.
- **2026-10-22 ~23:00: phone sign-in worked end to end** after the fix
  (email + password filled, Authenticator push arrived, approved). The try
  before it filled both but the push never arrived and Microsoft's Recent
  activity showed no attempt; finished with "Use a verification code". Cause
  unknown; if it recurs, get a screenshot of the approve screen + Recent
  activity. One poll error "fetch failed" seen once (cause now printed).
  Still to watch: real "Microsoft's number" line; auto sign-in on duty; how
  long a fresh sign-in lasts (the "since the last sign-in" line).
- **Toronto pairing (owner, CHECKUP #8):** a crew or anyone on rest at the
  call is skipped and the next available one takes the train; the skipped
  crew keeps its place. Website's Mac yard table now does that
  (`torontoCrews` in site.js, call = order − 2 h 15, rest ending at the call
  = available), shows "skipped, on rest at the call" and the call time.
  FORMAT 6. #7 (flags) left as is: when a train leaves the line-up its call
  has normally passed, so "rested now" ≈ "rested by the call".
- **Website moving to Cloudflare with email login (owner chose, 2026-10-22).**
  Netlify free = 300 credits, 15 per deploy (~20/month); every 15 min ≈
  2,900/month, so it can't. Built: `lib/board/r2.js` (SigV4 signing checked
  against AWS's S3 examples; `deployR2` mirrors the site folder into the
  bucket: changed files up by MD5 vs ETag, dropped ones deleted),
  `cloudflare/board-worker.js` (read-only Worker serving the R2 binding
  `SITE`, no-cache, ETag/304) + optional `wrangler.toml`; `siteSettings()`
  picks R2 when R2_ACCOUNT_ID/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY
  are set (BOARD_SITE_EVERY default 15), else Netlify (90). Login = one-click
  Cloudflare Access on workers.dev (allowed emails, one-time code); laptop
  uploads straight to R2's S3 API so it never meets the login. Owner's
  steps: docs/board-checker/CLOUDFLARE.md. **Live 2026-10-22:
  https://board.sarniaboard.workers.dev** (account subdomain renamed from the
  owner's name; Access app "board - Cloudflare Workers", policy = Emails,
  One-time PIN login added; Preview URLs off). First deploy went to Netlify
  because the R2 lines were missing; scripts now name missing R2 settings.
  Owner then turned the email login **off** (site open to anyone with the
  link; told to change BOARD_NAMES_KEY first; Access policy kept to turn
  back on). **boardtestsa.netlify.app now redirects** to the Cloudflare site
  (manual Netlify Drop of a `_redirects` file: `/* …workers.dev/:splat
  301!`); keep that Netlify site for the redirect, and remove the NETLIFY_
  lines from .env so nothing republishes over it.
  Owner set `BOARD_SITE_EVERY=5` (2026-10-22): ~8,600 publishes/month ≈ 50k
  R2 writes, far under the free 1M; Workers free 100k requests/day.
  On Cloudflare every check now publishes (not only changed ones), so the
  Current tab's "Last checked … ago" stays green while the board is unchanged;
  an unchanged check uploads ~2 files (index + today's day file).
  The open page only reacted to a *changed* board, so "Last checked" still
  grew until reload (owner noticed). index.json now carries `checked` (newest
  check read) and the page's 2-min poll moves the newest snapshot's
  sameUntil + "Updated" in place. Browser-tested on a local build.
  Owner's run 02:01/02:07: 2nd check printed no site line = throttled (their
  BOARD_SITE_EVERY=5 apparently not read, default was 15). On Cloudflare the
  default is now 0 (every check), and a throttled check says when it's next.
  Confirmed by the owner: the site now updates after every check.
- **Turn alerts by web push (owner chose over ntfy for no cap, 2026-10-22).**
  Built: `lib/board/alerts.js` (per-turn states from predictions incl.
  engineers + Call Board; events lined up / ordered / call moved ≥ 30 min vs
  last *told* / on duty; first run learns only; no line-up read = no line-up
  news; told in `turn-alerts.json`), `lib/board/webpush.js` (RFC 8291
  aes128gcm, matches the RFC's example; RFC 8292 VAPID ES256; keys in
  `push-keys.json`; posts only to Google/Apple/Mozilla/Microsoft push hosts;
  404/410 → subscription deleted), Worker `POST /push/subscribe` (stores
  `subs/<sha256>.json` in R2, host allowlist, ≤ 12 turns, 8 KB; `subs/` never
  served; deployR2 never deletes it), page: 🔔 Get alerts in the turn panel,
  `sw.js` + `manifest.webmanifest` (iPhone must Add to Home Screen),
  `data/push.json` = public key. Sender `sub` = config.siteUrl
  (BOARD_SITE_URL). Browser-tested the button with stand-in push; real phones
  untested. ❓ Owner: re-paste the Worker, pull + restart, try on a phone.
  **Per-phone choices (owner, same day):** each turn on each phone has
  lined up / ordered / on duty on-off + call-move threshold (0 = never, 15,
  30, 60, 90, 120, 180; default all on + 30), sent as `prefs` and checked by
  the Worker. Shared news (lineup/ordered/onDuty) via `turn-alerts.json`;
  time moves per phone from its last-told call (`turn-alerts-phones.json`,
  `phoneEvents`). "Lined up already ordered" → one alert per phone. The
  Worker changed again: re-paste it.
  **"Someone ahead goes on rest"** (owner, same day): Chain Gang only (SR
  CO list, SD list; A/B rest still takes the train, so no move-up). Shared
  event `aheadRest` when a turn ahead at home, not resting last check, is now
  on rest (restUntil > now) or HT; `told[turn].ahead` = {turn: resting}.
  Pref `aheadRest` (default on); Worker re-paste needed again. ❓ Owner
  didn't confirm "Chain Gang only" (assumed). Plus `aheadBack` (owner asked):
  a turn ahead that was resting last check no longer is ("back in line
  ahead of you"), pref default on; Worker re-paste again.
  Owner: alerts work on Android; on iPhone only once the site was added to
  the home screen and opened from that icon. The panel now shows numbered
  iPhone steps (button "Alerts on iPhone: how") until it's opened that way.
- **Watchdog (owner, 2026-10-22):** checker hung a few times a day; owner
  fixed it with Ctrl+C + restart. `scripts/board-watchdog.js` runs
  board-auto.js (same args) and restarts it (taskkill /T so Edge closes too)
  when `heartbeat.json` (written by board-auto: checking / idle / signin)
  says stuck: checking 15 min, idle every+10, signin 45, starting 20
  (`lib/board/watchdog.js`), or when it quits (code 130 = Ctrl+C = stop).
  Backs off to 5 min after 5 restarts in 30 min. `restarts.log`.
  start-board-checker.cmd now runs it. Tested with a fake hanging child.
  ❓ What the hangs actually were is unknown: check restarts.log + the
  window's last lines when one happens.
- Alert wording (owner, 2026-10-22, first real alert on Android worked):
  "SR03 lined up: DHT030B 23 (deadhead) planned for 23rd 0300, expected call
  23rd 0100." Same for ordered ("ordered for …") and time changes
  ("SR03 time change: … (was 23rd 0300, call 23rd 0100)").
- **Toronto line-up: crews on their way (owner, 2026-10-22).** After the
  bunkhouse, the Mac yard table guesses the rest: each Sarnia train on duty
  on the Call Board (not Toronto's odd-digit trains, not L502, crew not in
  the bunkhouse) ties up in Toronto on-duty + 8 h (deadhead + 3 h;
  `config.torontoTripMinutes`), rested 8 h later, queued by tie-up time
  (`crewsOnTheWay` in site.js), then the same rest-at-call skipping. Shown
  with an "estimate" chip; unplaced ones listed under the table; Find a turn
  says "On the way to Toronto … predicted home on …". The 8/3 h are only for
  this. Owner wrote "trains and Deadheads take around 3 hours and trains
  take 8 hours": read as DH 3 h, train 8 h (❓ confirm). FORMAT 7.
- **Mandatory reset alert (owner, 2026-10-22):** the crew office's reset
  always shows as rest or a hold turn until **0559**. A turn's own row (SR,
  SD, SA, SB, S1, S3; working turns skipped) newly showing that → "SRxx:
  you've been put on a mandatory reset until 23rd 0559." Kind `reset`, pref
  default on (checkbox "put on a mandatory reset"); `told[turn].reset` keeps
  it to once per reset. Worker re-paste needed (prefs).
- ⚠ 2026-10-22 the owner pasted the laptop `.env` (CATS + CN Microsoft
  passwords, Anthropic key, Netlify token, names passcode) and an R2 key into
  the chat; told to change all of them. Never ask for .env contents; use the
  `findstr` ok/MISSING check.
  Toronto screens 28 + 41 (Mac) read on all 668 checks since the 18th.
- AI review false alarms 2026-10-21 2229 (Haiku): read M39491's third digit
  as 9 (it's M394, even) and recounted road day 21's A trains from the visible
  ones. Prompt now spells out manifest digits with examples and says the
  notes' road-day counts are final (incl. B out → A used up, remembered
  trains). If Haiku keeps misreading, try `BOARD_AI_MODEL=claude-sonnet-5-5`.
- Owner asked about moving the website off Netlify; nothing was in the docs.
  Owner has details to give.

## ▶ Side project 2026-10-21: 14-hour rule grievance generator
Separate from the board checker; branch `claude/keen-davinci-5ot1na` (off `main`).
- `public/grievance.html` (+ `grievance.js`, `grievance_template.odt`,
  `grievance-logo.png`) on the Agreement Search site, linked from its header.
  Port of div240.netlify.app (owner's drag-and-drop Netlify site, no repo):
  same letter wording, file # (`YYMMDD` of first on-duty + initials + A–K),
  same .odt edits, filename `<conductor last name><YYMMDD of return>.odt` (was `odea…`). JSZip served from
  node_modules at `/vendor/jszip/`. Tests: `test/grievance.test.js`.
- Letter: to N. Chambers (Superintendent – SOD), signed Eric Jung (owner).
- Grievable at **14 h or more** away from home (as the original site), not
  under 14.
- Changes from the original: times counted in Eastern time (DST-safe on any
  phone), auto next-day dates across midnight, "de Man" surnames kept whole,
  preview now matches the .odt (original preview showed the wrong quote), the
  sample member's name/PIN removed from the shipped template.
- Open (owner): rest location (bunkhouse/hotel) isn't in the letter (same as
  the original). Filename prefix settled: conductor's last name (owner).
- **Board site "Article 18.6(b)" tab** (owner, 2026-10-21; first named "14h"), beside Order summary
  (`#14h`): Sarnia trains whose crew was held in Toronto ≥ 14 h. Held = off
  duty (bunkhouse REST − 8 h) → the CO turn's next Call Board on-duty at
  TORONTO (`state.toronto` in board-trains.js, any train, within 72 h); no
  trip home yet + CO still in the bunkhouse = "still held so far". Rows carry
  `co`, `en`, `back`, `heldMin`, `stillHeld` in trains.json. Tap a crew → form
  pre-filled with trains/times (editable), rep types name + PIN, .odt made in
  the browser. site.js now ships grievance.js, grievance_template.odt and
  jszip.min.js (skipped with a note if missing, never breaks the build).
- **Laptop: after `git pull`, run `npm install`** (jszip is new), or the 14h
  tab can't make letters.

## 2026-10-21: "Current" tab is the landing (owner)
- Board site opens on **Current** (`#current`): the newest snapshot, no
  snapshot list (Find a turn stays), no Earlier/Later. Tabs: Current ·
  Snapshots · Order summary · Article 18.6(b).
- Every snapshot shows its age, ticking: newest = "Last checked … ago"
  (from sameUntil or taken; green < 20 m, amber < 1 h, red beyond = checker
  may be down); any other = "Taken … ago · Not the current board" + **Go to
  current**. Page checks data/index.json every 2 min and offers "Update"
  when a newer board is published. Old `#YYYY-MM-DD-HHMM` links open under
  Snapshots.
- Call Board station after "ON DUTY AT:" is no longer masked (L50131 showed
  GARNET as AAAAAA); GARNET also added to BOARD_WORDS. Saved checks keep
  AAAAAA; new ones are right.

## 2026-10-21: crew names in the Article 18.6(b) tab (owner chose both options)
- **Laptop:** each Call Board page gets a second, *unmasked* read
  (`describeFrame(frame, { unmasked: true })`) kept in memory only;
  `parseCallBoardNames` keeps craft + turn + name ("Mike de Man") per train,
  stored in `BoardChecker\names.json` (train|turn → name, 45 days,
  lib/board/names.js). Never in history\, auto-summary, the AI review or the
  relay; the masked `screens` are unchanged.
- **Site:** only crews on the 14h list, conductor + engineer, locked with
  **`BOARD_NAMES_KEY`** from the laptop's `.env` (AES-256-GCM, PBKDF2 250k) as
  `data/names.json`. No key → no file. `public/board-names.js` unlocks in the
  browser.
- **Page:** passcode asked once and kept on that phone ("Forget the passcode"
  undoes it); form fills name + engineer; the phone remembers PIN, Mr./Ms. and
  initials per name, and the last name used per turn (localStorage,
  `grievance-people`). CATS shows no PIN or gender.
- Names for a trip: that train's Call Board names; else the conductor's on
  the train home; else (2026-10-21, owner saw none on older trips) the name
  last seen on that turn, any train, within 14 days, marked `turnOnly` and
  flagged in the form ("if a spare worked it, change them").
- **Owner to do:** add `BOARD_NAMES_KEY=<long passphrase>` to
  `C:\Users\<you>\BoardChecker\.env`, share it only with reps. A short one can
  be guessed offline from the public file.

## 2026-10-21: line-up trains whose crew is already known
Owner's 0357 snapshot: DHT042B 21 (ORD 0500) said "Toronto train / not
counted" while SR09 was at 999 out working on it. Two engine fixes
(`runBoardCheck`, test in engine.test.js):
- A line-up train also on the Call Board (the few minutes it shows on both,
  per owner) now shows the crew CATS has on it ("On duty at …"), instead of
  being dropped. Only real Toronto trains (odd third digit) say "not counted".
- A turn at 999 "out working on" a line-up train that isn't on duty yet keeps
  that train and is no longer skipped over: before, the next turn in the queue
  was given it and every later Chain Gang prediction shifted by one. Matched
  by symbol, never to a train the Call Board already has that turn on.
Both take no turn from the queues (`known: true`). Needs a checker restart.

## 2026-10-17: board checker drives Microsoft Edge

Owner asked for Edge instead of Chrome/Chromium. `lib/board/paths.js`
`browser()` → Playwright `channel: 'msedge'` with its own sign-in folder
`BoardChecker\profile-edge` (the old `profile` is left alone), so the first
run after the switch needs one Microsoft/Authenticator sign-in.
`BOARD_BROWSER=chromium` in `.env` goes back. `scripts/board-probe.js` still
uses Chromium (dev tool only). Not yet run on the laptop.

## ▶ Built 2026-10-17: Mac yard (Toronto) checks — not yet run on real CATS
Owner's spec in docs/board-checker/SCREENS.md (option 28, and 41 for 41975).
- **board-auto.js** reads, after Sarnia's 41: **28 bunkhouse** (no CC; F8 until
  a page with no crew) and **41 for Mac yard** (fills 41975 / W / S1 / 24;
  the POOL box is assumed to be text box 2). Screens are captured with
  `label: 'bunkhouse' | 'mac'`; failures only skip them ("skipped Bunkhouse
  28" / "skipped Mac yard line-up 41"). Sarnia's 41 now blanks the POOL box
  (CATS may keep S1).
- **summary.js**: `bunkhouse` (EN+CO per POS, restUntil) and `macLineup`,
  kept out of Sarnia's pools/line-up.
- **Website**: one **Toronto line-up · Mac yard** table with the predicted
  crew beside each train (bunkhouse order = train order; owner asked for one
  table); Find a turn knows the bunkhouse and the train home. Order summary:
  Toronto trains (filter "Trains from"), **off duty in Toronto = REST − 8 h** (owner corrected from 10 h)
  matched to the Sarnia train the crew went on duty on → **time on duty**;
  flags for Toronto trains gone from 41 and not on the Call Board 30 min
  later: **red "Non-Sarnia Crew"** if no rested crew was in the bunkhouse
  when it disappeared, **yellow "Possible Non-Sarnia Crew or Train
  Cancelled"** if there was (only rested crews count; owner).
- Owner, same day: **MU on L501/L502 is fine** (no flag; note instead).
- Owner, 2026-10-26: Jobs going spare shows **the line-up's 501/502 turn** (first
  crew up on 29) for an S5 vacancy, with "CATS lists S502" under it when CATS differs.
- Owner, 2026-10-26: **MU crews in the Toronto bunkhouse (28) count** for the
  Mac line-up (they were dropped: `parseChainGang` without `anyTurn`). B1 rows still left out.
- Owner, 2026-10-26: **a whole make-up crew (MU with MU) is fine** (M39931,
  Z14931 out of Toronto): a note, not a flag. MU with an A/B turn is still flagged.
- Owner: Order summary "off" colours, early or late alike: green < 30 m,
  yellow 30 m – 1 h 56 m, red beyond (`offCell` in board.html).
- Owner: a train out of Sarnia on an **MU conductor counts as Chain Gang**
  (X27861 16 on MU01 showed as A), unless the engineer is A/B (miscoding
  flag) or it's L501/L502 (S5).
- Owner: **no Toronto off-duty time for L501/L502 or trains that start in
  Toronto** (Mac yard line-up, or odd third manifest digit): shown "n/a".
- Day-file format 3. 46 tests.

**2026-10-17 review (owner picked 4, 9, 12, 15, 17, 18; the rest is in
docs/board-checker/CHECKUP.md for 2026-10-22, Netlify usage 2026-10-24, both
on the owner's calendar):**
- #4 A Toronto-only change (bunkhouse / Mac yard line-up) now also updates
  the website (`toronto` fingerprint in board-auto.js `answer()`).
- #9 Order summary count uses the colour bands (green < 30 m, yellow to
  1 h 56 m, red beyond) instead of ±15 m.
- #12 Snapshots say when the Toronto screens weren't read.
- #15 `scripts/start-board-checker.cmd` + NEW-LAPTOP.md step 8 (Startup
  folder shortcut) to start at Windows sign-in.
- #2 reverted: Sarnia's 41 no longer clears POOL; owner says an S1 left there
  is harmless.
- #18 pull request to `main` opened; #17 old preview/zip removed.
- Laptop updated and restarted 2026-10-17; Startup shortcut added. PR #2
  merged into `main`; this branch restarted from `main` for follow-ups.
- **Turn history** (owner, 2026-10-17): the Find a turn panel shows the
  current snapshot, then changes that lasted 30 m or more (orders, on duty,
  rest/hold and spare always kept), then three lists: **Orders** (trains
  projected for / called / on duty), **Rest** (each rest or hold period),
  **Goes spare** (**, B0, or its train going spare; one line per stretch).
  `BoardTurns.history` + `finish` in public/board-turns.js; turns.json shape
  is now `{changes, orders, rests, spares}` per turn.

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
  board-auto.js after changed checks (≤ every `BOARD_SITE_EVERY`=90 min, owner 2026-10-17) when
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
- **Merged to `main`** (https://github.com/odeajust-glitch/240ca/pull/1, 2026-10-17, owner's
  OK), with the line-up website's files (`board.html`, `board-turns.js`,
  `board-trains.js`, `board-sample.json`) hidden on the Render site: `hideBoardSite` in
  `lib/board/relay.js` returns 404 for them (owner). Netlify still builds from them. 42 tests.
  Keep developing on `claude/vigilant-planck-zawrj4` (fast-forwarded to `main`); PR again.
- **Still to do (owner):** (1) set `BOARD_KEY` on Render and confirm Render deploys `main`;
  (2) laptop `git pull`, then `.env` `BOARD_RELAY_URL` + `BOARD_KEY`; (3) build, back up
  the phone, install RailroadTracker `board-relay`.

**2026-10-17:** the AI check flagged "DHT031B 17 (0200) went to spareboard,
but SR08's rest ends 0000, exactly at its call time, so it should have taken
it". The engine was right by the owner's rule (rest ending exactly at the call
time = still on rest, BOARD-CHECK.md); the review prompt only said "past the
call time", so it now states the rule. The AI note never changes the answer.
**Owner then changed the rule (2026-10-17):** rest until 0000 = available at
0000, and the same for HT (owner). Engine: `restsPast` / `heldPast` (ending
> call) in engine.js. Review prompt, BOARD-CHECK.md and a test updated.
⚠ Shadow check #1 (15th) had SR02 skipped with rest to 0100 vs an estimated
0100 call for DHT211C; under the new rule the checker would have given it to
SR02. Our call time is an estimate (on duty − 2 h), so watch for this.

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
  every `BOARD_SITE_EVERY` min (default 90), when `NETLIFY_AUTH_TOKEN` +
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

## 2026-10-19: Microsoft re-sign-in blocked inside the CATS frame
When the ~24 h Microsoft sign-in expires, CATS loads login.microsoftonline.com
in `jacadaframe`; Microsoft refuses framing ("refused to connect", grey ⊘ in
Edge). `fixFramedLogin()` spots a sub-frame on microsoftonline / chrome-error
and opens the exact Microsoft URL the frame was sent to (recorded from
sub-frame requests) as the whole page (max once a minute; falls back to a
CATS reload if it won't open). After sign-in, when the page is back on CATS
without `jacadaframe`, it reloads CATS. (A plain CATS reload alone didn't fix
it on the owner's laptop.) Return-after-sign-in path untested (needs real MS). Called in `waitForMainMenu` and
before giving up on a check. Tested on the fake CATS ('framed' variant).

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
