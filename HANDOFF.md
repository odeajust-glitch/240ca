# HANDOFF — read this before doing anything

Last updated: 2026-11-03 · Branch: **`claude/vigilant-planck-zawrj4`** (has
everything) · 186 tests (`npm test`).

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
  Analytics, and **Page Health** (owner key only). 3 h+ down → red banner.
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
  app"): each check also goes to Render (`BOARD_RELAY_URL` + `BOARD_KEY`,
  `lib/board/relay.js` pushCheck) for the app's Board tab. Don't suggest
  removing it.

## Rules settled with the owner (don't re-litigate)

- Option 5 (jobs going spare) can be wrong; **the order the site works out is
  right** (2026-11-02, E27861 02: CATS listed SA09, the order had SR05).
- L502 = the first crew up on option 29.
- Toronto: PLN train → next crew in bunkhouse order even if resting; ORD →
  next crew rested by the call; none rested → possible Toronto South crew.
  Mac yard call = order − 2 h; Sarnia = order − 15 min prep − 2 h.
- A/B slots per road day: first 3 after 0459 → A, next 2 → B; called trains
  count first.
- Rows with TV beside a name don't count as that person's turn.
- Stale train: still planned 15 min+ past its call; pauses when the plan
  moves later.

## Waiting on the owner / to check on real runs

- **Not pulled yet** (he's away; when home: pull + restart, **re-paste the
  Worker**, add the **VAPID_KEYS** secret): everything after cbec2db, i.e.
  Page Health visitors, down banner, spares on both boards, stale trains,
  runaround log, Netlify removal, the trim, My week, missing from option 5,
  down-3 h phone alert.
- ❓ Runaround log results: he reviews them before any alerts are added.
- ❓ Not yet seen on real CATS: VIEW TIME box, mid-call hold, CATS option 5
  check, stale trains, runaround log, the watchdog's Edge clean-up (Windows),
  Toronto fill-ins kept while read in the bunkhouse.
- Open TODO items: runaround log alerts / claims, Turn History housekeeping
  (later), 18.6(b) rep alert as an email (skipped for now), My week for
  everyone (JUOD only now); calendar export taken off (owner, 2026-11-03),
  "missing from option 5" jobs (now tracked), phone alert to everyone when
  down 3 h+ (built; owner adds the VAPID_KEYS secret).

## Latest (newest first; move older ones to the archive when this grows)

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

- 2026-11-03: **Down 3 h+ → every phone** (owner: go ahead). Worker
  watchChecker: status/down.json made at DOWN_MINUTES regardless of ntfy;
  at PUSH_DOWN_MINUTES (180) and secret VAPID_KEYS (the laptop's
  push-keys.json pasted whole) → pushAll(): web push from the Worker with
  WebCrypto (RFC 8291/8292, one sender key per run, one VAPID JWT per push
  service), to every subs/ phone; 404/410 drops the sub; down.pushed is set
  before sending (never twice); "back" pushed when it recovers if down was
  pushed. Page Health shows phones told. ❓ Free-plan CPU per cron run with
  many phones: not seen live.

- 2026-11-03: **Missing from option 5** (owner: "yes add it, 30 minutes is
  fine"): insights missingCheck: a line-up job marked "(goes spare" (crew
  co/en in the row's rules) with no option 5 job for that train and craft
  (vacanciesCats, else vacancies), only in checks that read option 5
  (`screens` has 'terminal'); kept when missing 30 min+ (MISSING_MIN),
  listedAt when CATS catches up, ended when the order stops saying spare,
  Call Board crew. → analytics `catsMissing`, archived; shown under
  Analytics → CATS errors. Tracking only, no alerts.

- 2026-11-03: **My week** (owner: page + Sunday alert, "only works for JUOD
  first. If it's nice we can push it out"). public/board-week.js (shared by
  page and laptop): weekOf / weekBefore (Sun–Sat), personRec (moved from the
  page's personHistory logic), weekSummary (trips, yard, time on duty to
  Toronto, held 14 h+, rests, calls vs the one slept on, runarounds, stale,
  CATS errors, out of sequence), personWeek, weekText. Page: Analytics → My
  week (first tab; every turn/person followed on this phone; Last week / This
  week / Week before), opened by `#week`. Laptop: board-auto sendWeekly, the
  first check after 09:00 Sunday (Toronto), last week's text to phones
  following '@hash' of BOARD_WEEKLY_CODES (default JUOD), once a week
  (BoardChecker\weekly.json), logged as kind 'weekly'. To open it up: more
  codes in BOARD_WEEKLY_CODES, or (later) a per-phone option.

- 2026-11-03: HANDOFF trimmed (old content → HANDOFF-ARCHIVE.md); Netlify
  publishing removed (site.js deploySite, settings, tests, .env.example);
  relay kept (owner uses the app).
- 2026-11-02: runaround log, stale trains, tracked spares on both boards,
  down banner, Page Health tab (+ visitors), owner key, CATS option 5 check
  + wrong-turn alert + CATS errors, backup, visitor counter, sign-in
  reminders, watchdog fresh Edge, calmer line-up alerts, EN03 Toronto
  fill-in fix, AI check removed. Details: the archive's "Start here" section.
