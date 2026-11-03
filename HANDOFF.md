# HANDOFF — read this before doing anything

Last updated: 2026-11-03 (end of session) · Branch:
**`claude/vigilant-planck-zawrj4`** (has everything) · 186 tests (`npm test`).
**The laptop runs `06d7924`** (pulled 2026-11-03).

## ▶ Next session: site housekeeping

The owner is starting a new conversation to do **housekeeping on the site**
(public/board.html and friends). He hasn't said what yet: ask what he wants
changed, show options with a recommendation, then build. Before changing a
tab, search the archive for why it is the way it is. Still open from this
session: see "Waiting on the owner" below (Worker re-paste, Worker timer line).

**Running to-do list (owner's): [docs/board-checker/TODO.md](docs/board-checker/TODO.md).**
Add every new ask there; move it to "Done" when finished.

**Full history:** [docs/board-checker/HANDOFF-ARCHIVE.md](docs/board-checker/HANDOFF-ARCHIVE.md)
(this file as it stood on 2026-11-03, every dated note back to 2026-10-14).
Search it for a feature, file or rule before changing one. This file is the
current state only: keep it short, and add new notes under "Latest" below.

**If you are a new Claude session:** only one Claude session at a time may
change the board checker / website. Update this file at the end of every
session: state, decisions, what's next.

## The owner

Justin, CN conductor on **SR03** (Chain Gang), union rep, Sarnia.
Non-technical, on Windows: give exact click-by-click / copy-paste steps,
Command Prompt syntax (`%USERPROFILE%`), not PowerShell's. Explain a change
before making it when he asks; offer options with a recommendation.

**The VAPID private key** (BoardChecker\push-keys.json, the Worker's
`VAPID_KEYS` secret) was pasted into the chat on 2026-11-03; the owner chose
to keep it (option A: low risk, the phones' subscription addresses are only
in R2). Making a new one means every phone re-subscribes. Never ask for it.

**Never ask for `.env` contents** (he once pasted passwords into chat and was
told to change them); check settings with `findstr /B /C:"NAME=" …` (ok /
MISSING). Automating the Microsoft second factor (TOTP) was refused by the
safety check: don't retry unless he explicitly asks.

## Running it

Dedicated laptop: code `C:\BoardChecker-code`, data `C:\Users\odeaj\BoardChecker`
(`.env` there).
```
cd C:\BoardChecker-code
git pull
git log --oneline -1
node scripts/board-watchdog.js --me SR03 --every 5
```
- After a pull: Ctrl+C, pull, start again. `git pull` errors about
  `package.json` / `package-lock.json` → `git checkout -- package.json package-lock.json`, pull again.
- After a **Worker** change (`cloudflare/board-worker.js`): he re-pastes it in
  Cloudflare (Workers & Pages → board → Edit code → Ctrl+A, Ctrl+V → Deploy).
  Tell him to open it fresh in Notepad and check for a word only the new
  version has (an old open Notepad bit him twice), or use GitHub's "Copy raw file".
- Worker variables: `NTFY_TOPIC`, `DOWN_MINUTES` (30), `OWNER_KEY` (secret,
  set 2026-11-02), `VAPID_KEYS` (secret, set 2026-11-03),
  `OWNER_DOWN_MINUTES` (60), `OWNER_CODE` (JUOD), `PUSH_DOWN_MINUTES` (180),
  `OWNER_EMAIL` (unused while Access is off). Cron */10 (needed for every
  down alert; Page Health → Worker timer shows whether it runs).

## What it does now (one line each; details in the archive and the code)

- **Checks** CATS every 5 min in Edge (`scripts/board-auto.js`, route in
  `runRoute`): Call Board (+ crews in town), pools 23/19/21/27/25/26, line-up
  41, spareboards 13/9/19/17 (with VIEW TIME = now − 10 min, extras shown in
  yellow), 5 (jobs going spare), 29 (501/502), 31 (Garnet), Toronto
  bunkhouse 28 + Mac yard line-up 41. Engine: `lib/board/engine.js`.
- **Watchdog** (`scripts/board-watchdog.js`, `lib/board/watchdog.js`):
  restarts a stuck checker and its Edge; 'unstick' (reloading CATS) gets 10
  min; a check failing again after a reload exits code 3 → fresh Edge.
  **Stuck before the main menu** (`lib/board/signin-stuck.js`, in
  waitForMainMenu): on a CATS screen that isn't the menu, Enter (3 s, twice),
  F3 (1 min, twice); on that or a non-CATS page for 5 min, reload CATS
  (twice), then exit 3 → fresh Edge. Never while on Microsoft or the CATS
  sign-on (a person may be needed). Saves what it was on (stuck-screen.json,
  or signin-stuck.json + .png) and tells the owner's ntfy once.
  **"Do you wish to place on another assignment?" (Y/N)** and other CATS
  pages it can't pass: BOARD_ASSIGNMENT_ANSWER **ask** (default) → the page
  (words, numbered boxes) to the owner's ntfy, Y / N buttons for a yes/no
  (ntfy http actions posting to the command topic); his reply on the
  "signin" topic (Y, 2=Y, 1=45, 3=Y, F3, ENTER; lib/board/cats-ask.js,
  remote.js readReplies) is typed in. The question right away; other pages
  after Enter + F3 (3 min). Nothing else tried while waiting. **No answer**
  in BOARD_ASK_WAIT_MINUTES (15; owner: "force its way thru … incase my
  phone is off due to being at work"): a yes/no page gets
  BOARD_ASSIGNMENT_FALLBACK (**N**; Y / off), any other page the Enter / F3 /
  reload / fresh-Edge steps; ntfy says which. 2 asks per wait; heartbeat
  'signin' = 45 min. Y / N
  modes type that; off leaves it. Every page saved (words + boxes + picture,
  BoardChecker\assignment-questions\, last 20 → Page Health). **Y means
  the owner has to call in**: never default to Y.
- **Microsoft sign-in:** filled from `.env`, approval on his phone. Fresh
  sign-in only on R / phone "signin" (ntfy). Reminders 12 h and 2 h before
  the ~24 h runs out (`lib/board/signin.js` reminderDue; BOARD_MS_SIGNIN_HOURS).
- **Website** https://board.sarniaboard.workers.dev: Cloudflare Worker + R2
  `board-site`, uploaded every check (`lib/board/site.js`, `lib/board/r2.js`).
  **Open to anyone with the link** (owner: "leave the site open"; Access off).
  Tabs: Current, Turn History, Snapshots, Order summary, Article 18.6(b),
  Analytics, **Reference** (public/board-ref.js: CATS status/ECC codes, job
  types, Mac/B.I.T./Malport track lengths, held-away penalty + calculator;
  typed from the owner's photos 2026-11-03), and **Page Health** (owner key only). 3 h+ down → red banner.
  Netlify publishing was removed 2026-11-03 (boardtestsa.netlify.app is only
  a redirect now). Snapshot FORMAT 17 in site.js.
- **Owner-only bits** (owner key: `#ownerkey=…` once per device, header
  `x-owner-key`; Worker `/health`, `/stats/days`, `/whoami`): Page Health
  (checker health, sign-in, restarts, alerts sent/failed, who gets alerts by
  turn and name code, latest alerts, visitors, backup, code version) and the
  sign-in countdown under "Updated". Visitor counter: `/stats/hit`.
- **Phone alerts** (web push; subscriptions in R2 `subs/`, sent by the
  laptop, `lib/board/alerts.js`): lined up, ordered, time change, on duty,
  reset, position, ahead on/off rest, rescue, may be called, reminder before
  the call, CATS wrong turn, stale train (off by default). Lined-up alerts
  wait one check on a switch and don't repeat a train within 6 h. A crew
  mid-call holds the next "lined up". Person following (`@hash`) drops off
  when someone else takes their turn. ntfy is only for the owner's own
  messages (sign-ins, Worker "down").
- **CATS option 5 checked against the order** (`lib/board/spares.js`
  checkVacancies): Jobs Going Spare shows Corrected / As CATS shows; the
  spare CATS would call gets "wrong turn" once; errors tracked.
- **Analytics** (`public/board-analytics.js`, `lib/board/insights.js`,
  `lib/board/archive.js`, a year kept, per month): trains, turns side by
  side, sleep, **runaround log**, out of sequence, jobs going spare, CATS
  errors, stale trains, predictions; search by train number, turn, name
  code; spreadsheet download. Name codes are hashes (`lib/board/people.js`),
  never names; crew names only for 18.6(b), locked with BOARD_NAMES_KEY.
- **Backup** to R2 `backups/` once a day after 03:00 (`lib/board/backup.js`):
  state zip (14 kept) + finished history days; never `.env` or names.json.
  Restore steps in docs/board-checker/CLOUDFLARE.md.
- **RailroadTracker relay: keep it** (owner, 2026-11-03: "I am using the
  app"): each check also goes to the relay (`BOARD_RELAY_URL` + `BOARD_KEY`,
  `lib/board/relay.js` pushCheck) for the app's Board tab; on the Worker
  now (2026-11-03). Not configured on the laptop: the app reads the board
  site directly.

## Rules settled with the owner (don't re-litigate)

- Option 5 (jobs going spare) can be wrong; **the order the site works out is
  right** (2026-11-02, E27861 02: CATS listed SA09, the order had SR05).
- L502: the two 501/502 crews **alternate** (owner, 2026-11-03): the crew
  bringing L501 home takes the next L502; spare or not is only known once
  they're off duty.
- Toronto: PLN train → next crew in bunkhouse order even if resting; ORD →
  next crew rested by the call; none rested → possible Toronto South crew.
  Mac yard call = order − 2 h; Sarnia = order − 15 min prep − 2 h.
- Yard jobs are 8 h, **YSBY jobs 12 h** by default (owner, 2026-11-03;
  site.js yardMinutes).
- A/B slots per road day: first 3 after 0459 → A, next 2 → B; called trains
  count first.
- Rows with TV beside a name don't count as that person's turn.
- MU turns are placeholders, not in any pool. An A/B train with MU on it:
  the A/B turn goes spare and is shown (not Chain Gang, SD or 501/502).
- Stale train: still planned 15 min+ past its call; pauses when the plan
  moves later.

## Waiting on the owner / to check on real runs

- **Laptop pulled to 06d7924** (everything so far). VAPID_KEYS secret is
  added. **Worker 256eddf deployed 2026-11-03** (it had been pasted but not
  deployed); Worker timer runs, ntfy topic and push key set. ❓ Confirm the
  30-min ntfy "down" arrives the next time the checker is down.
- ❓ The first real "another assignment?" page: check Page Health → "CATS
  pages it asked you about" and that the ntfy Y / N buttons worked. The
  startup line must say "phone alerts on (ntfy)" or asking can't work (it
  then types N after 15 min).
- ❓ Runaround log results: he reviews them before any alerts are added.
- ❓ Not yet seen on real CATS: VIEW TIME box, mid-call hold, CATS option 5
  check, stale trains, runaround log, the watchdog's Edge clean-up (Windows),
  Toronto fill-ins kept while read in the bunkhouse.
- Open TODO items: rest tracker (TODO #8, next housekeeping), home turn worked out better (tabled, owner 2026-11-03: he
  was displaced, To Place, and the site could only say "not seen"), runaround log alerts / claims, Turn History housekeeping
  (later), 18.6(b) rep alert as an email (skipped for now), My week for
  everyone (JUOD only now). Full list: docs/board-checker/TODO.md.

## Latest (newest first; move older ones to the archive when this grows)

- 2026-11-03: **Moving off Render (owner: "I pay 7$ for the render … do
  option 3 and move the relay for the app as well"; $5 Cloudflare Workers
  plan OK; order: relay first, then the agreement search).** Step 1 done in
  code: the Worker serves `POST /api/board` + `GET /api/board/latest`
  (Bearer BOARD_KEY secret, R2 relay/board-latest.json, same checks as
  relay.js; r2.js keeps relay/). Owner's steps: CLOUDFLARE.md "RailroadTracker
  relay on the Worker". The app (repo odeajust-glitch/RailroadTracker, branch
  board-relay) has the server address as a setting (Board tab → Automatic
  board check), so no app code change; branch board-shifts reads the board
  site directly and has no relay. **The laptop has no BOARD_KEY /
  BOARD_RELAY_URL** (checked 2026-11-03): the relay was never in use; the app
  reads the board site. Nothing to move for the app; the Worker relay stays
  off (404) unless a BOARD_KEY secret is added.
  Step 2 (search: D1 full-text + R2 PDFs + Kimi from the Worker) next.
  Don't cancel Render until both are verified.

- 2026-11-03: **MU placeholder on an A/B train** (owner: "if its expecting an
  A pool turn, and it goes spare it should show the actual turn going out
  still, same with B pool. the rule doesnt apply to chain gang, sd, or 502";
  "an MU turn is not a chain gang turn, its a placeholder turn"): engine
  skips the called-crew shortcut when the called turn is MU on an A/B train;
  the A/B queue's turn is shown, spare. Runaround log: MU on a train whose
  turn went spare isn't a 'turn' runaround. Old out-of-sequence entries
  (A42431 25, Z14891 24, M39491 24) keep the predictions saved then.

- 2026-11-03: **Runaround log fixes** (owner: "I want to fix a few things"):
  passed-over turn "** goes spare" with no return or a return after the call
  → explained (insights.js why). DHT040B 31 (B111 slow 001 passed, B133
  went): owner says not a runaround (not enough time for a road trip, enough
  for a yard shift); tabled for the **rest tracker** (TODO #8). The log now
  shows a spare at the board they were expected from (look(turn, board)).
  Whole crew from another pool than the order (M30241 19: A pool → Chain
  Gang, order moved before 0459) → explained.

- 2026-11-03: **My week for a person: only while on the turn** (owner: JUOD
  shown S501's L50231 02 / L50131 02 calls twice and runaround L50231 01
  from before he was on S501). board-week.js weekSummary `spans` (people
  stretches): a turn counts only at times they were on it, 501/502 only
  their craft, one call per train; personRec uses the on-duty-while-on-it
  rule and craft rests. ❓ "M39671 30 called 901 min later": the sleep
  tracker took a one-check flicker (DHT040B 31 at 30th 2327, call 31st 0700)
  as the call slept on; asked the owner whether to require it to hold.

- 2026-11-03: **501/502 "**" beside a hold turn** (owner's option 29 shots:
  CO S501 O'DEA ST ** RN HT RETN 0559 03): the L502 check now lets HT decide
  (spare only if the hold runs past the call), like the other pools; the
  page shows "hold turn until … (**)". Option 29 with the CC box blank lists
  EN and CO together (owner's screenshot), so it stays one read (typing CO
  then EN works too, not needed).

- 2026-11-03: **Garnet line-up (41, 47956 W S5, 24 h)** after Mac yard's
  (board-auto, label garnetLineup; summary classifies [47956] too; snapshot
  garnetLineup [{train, status, order}]; Current: a line under the 501/502
  pool tab; engine: the L502 reason names the L501 out of Garnet for the crew
  coming home). Owner: 501/502 conductor + engineer never split (crew
  alternation stays); option 29 CC box takes CO / EN (not needed: 29 already
  lists both crafts). ❓ Pool S5 / direction W for Garnet not confirmed by
  the owner: check the first run's log for "skipped Garnet line-up 41".
  Trip time / rest estimate: owner "won't matter, but if you need to assume
  a time 8 is a safe number" (8 h): not built; spare or not still waits
  until they're off duty.

- 2026-11-03: **JUOD bumped back onto S501 CO** (owner: "I am not on duty at
  garnet … I wasn't working 501"): (1) the name code's Work history counts a
  train only if it went on duty while they were on that turn (personHistory
  `theirs`: onDutySeen inside the stretch); (2) sightings now carry craft
  (pool rows) and the Call Board train (board-auto sight), site.js writes
  people.json `now` {taken, seen:[{h, turn, craft, train}]}; the page's
  Person.factsFor shows a followed person only their craft on 501/502 and
  Call Board trains only with their name on (newest check only; needs the
  laptop on this code). Then rests split by craft: board-turns history
  rests get craft on 501/502; people stretches keep craft (addSightings);
  personHistory / a S501-CO turn search show only that craft's rests. ❓ At 0518 CATS showed S501 CO
  marked ** → the site says the conductor goes spare on L50231 04: ask.

- 2026-11-03: **Predicted crew, scored better** (owner, option 3): the
  Order summary story shows the last prediction (minutes before the call,
  nearly always right) plus "right since … (x before on duty)" and the
  prediction **8 h before the call** (on duty − 10 h, when people sleep),
  each ✓/✗. board-trains.js predHit: coSince/enSince, early {taken, co, en,
  coHit, enHit} or {none, first}. Analytics → Predictions: "right 8 h before
  the call" tiles. Only trains tracked with this code have it. Also: Order
  summary tiles removed (owner), Snapshots hours 0000–2300. Article 18.6(b):
  two tiles (owner): crews violated last 7 days (off duty in Toronto in the
  7 days before the newest check, still-held counts) and % of Toronto stays
  (heldMin known) in those 7 days.

- 2026-11-03: **Snapshots: hours first** (owner: "organize the times … not
  making the page massive"): #hours (the day's hours with checks), then only
  that hour's checks (renderRail / railHour; show() switches the hour; an
  hour opens its first check). Phone: times only, wrapping, no date.

- 2026-11-03: **Reference tab** (owner: "general useful information", name
  left to me): board-ref.js (copied by site.js, in relay SITE_ONLY), #ref.
  Held-away penalty formula checked against the sheet (test/board/ref.test.js).
  B.I.T.: newer sheet's PAD 010–120 = older sheet's Y217, Y240–Y250 (same
  lengths; owner confirmed the PAD names are correct). C yard has no CO45. Lengths shown as posted (no units on the sheet).

- 2026-11-03: **Turn History, name code (person search) cleanup** (owner's
  picks): Home turn = latest spot the tracker has them; Status = where they
  are now (BoardTurns.facts, or "not seen since … / someone else on SR03
  since …", Person.takenSince); Turns seen on = own board spots only (jobs
  worked are the Work history); Changes = short version (changeSummary:
  no position steps / predicted-train flips) + "Show every check" button;
  dates "28th 0120" everywhere (stampBtn); long train names wrap.
  **Fixed: trains worked filling in on another turn** missing from the
  person view (owner: DRDI vs B126; E27861 27 / Z14931 28 working SR07):
  personHistory takes them from their own turn's record, and the copy not
  "worked by" someone else wins. Then (owner): turn searches get the short
  Changes too, and Orders / Rest / Goes spare fold into "More detail"
  (details.moredet, closed). Held-away time + penalty miles in Work history:
  TODO #7 (later).

- 2026-11-03: **L502 alternates** (owner: "S501 should work it, it
  alternates"; at 0420 the site gave L50231 04 to S502, which had just taken
  L50231 03 to Garnet, "goes spare" both). engine.js s5Order: home and not
  out on a 502 → coming home on L501 / at Garnet → out on a 502; each later
  L502 the next crew; a crew called for this L502 keeps it. Still on duty on
  L501 → shows plain "S501 + S501"; the why says spare or not is known once
  they're off duty (owner). **Worker
  timer fixed**: the new code was in the editor but not deployed; after
  Deploy, Page Health: "ran 1 min ago; ntfy topic set; push key set". Site readable from this session now
  (board.sarniaboard.workers.dev allowed).

- 2026-11-03: **"Another assignment?" answered Y** (owner: the stuck page was
  CATS asking "Do you wish to place on another assignment?", Y or N; "answers
  y … Once I … bypass it … it doesn't pop up anymore"; then "if you answer Y
  i have to call in. Can you have it record whats on the page"). signin-stuck
  isAssignmentQuestion (/ANOTHER ASSIGNMENT…?/ + a box), answerBox (1-letter
  box, the only box, first empty), addQuestion. Then (owner: "OR … send a
  notification on ntfy with the wording … I could type what needed to be
  typed in ntfy and then the board checker can fill the page") → **ask**
  became the default (above). Tested in Chromium with a fake ntfy (reply N →
  typed, Enter, main menu). ❓ Not seen on real CATS / the real ntfy app yet
  (the Y / N buttons need the ntfy app; check the first saved page).

- 2026-11-03: **Stuck before the CATS main menu** (owner: "stuck at a
  notification page … trying to sign into cats"): signin-stuck.js
  kindOf/nextStep (above). Tested in Chromium on a fake notice that only F3
  clears. ❓ The owner will describe the real screen and how he gets past it;
  teach that screen its own step then (add a kind/step, don't widen the
  generic one). Ask for: a phone photo, whether it's inside the CATS box or a
  whole web page, and exactly what he clicks/types.

- 2026-11-03: **Down 1 h → only the owner's phones** (owner: "a page
  notification like everyone gets at 3 hours, but just to me"). Worker
  watchChecker: the owner = subs whose turns include `@` + personHash of
  OWNER_CODE (default JUOD; hashed in the Worker with the people.js salt);
  at OWNER_DOWN_MINUTES (60), below 3 h, pushAll(..., { only }) once
  (down.ownerPushed/ownerPhones); "back" to them only if the 3 h push never
  went. down.json is now made at min(DOWN_MINUTES, OWNER_DOWN_MINUTES) with
  `alerted` = when the ntfy went (null until then). Every run writes
  status/watch.json { at, mins, ntfy, push } → Page Health "Worker timer"
  (owner said the 30-min ntfy never arrives: ❓ check the Cron Trigger and
  NTFY_TOPIC there).

Older notes (down 3 h push, missing from option 5, My week, the trim, 2026-11-02
work): the archive's "Later notes" section at its top.
