# HANDOFF — read this before doing anything

Last updated: 2026-11-03 (crews in town session) · Branch:
**`claude/vigilant-planck-zawrj4`** (has everything) · 205 tests (`npm test`).
**The laptop runs at least `a9f02e2`** (pulled 2026-11-03; ask him to
`git pull` again: later commits are notes and the API-key TODO only).

## ▶ Next session

**Reset tracker built (TODO #8 + #9, 2026-11-03), waiting for real runs.**
lib/board/resets.js: per person (name-code hash), from every day file's
`resets` (collect per check: trips by name code with their Call Board
train / yard job, every board's REST, 0559 rests/holds, bunkhouse REST)
→ site.js writes data/resets.json { taken, turns: { turn: { level
red/yellow, dueText, due, last, ahead } } } for the newest check; the
Current tab's pools/spareboards colour rows (board.html RESETS,
paintResets). Model checked against the owner's CATS PSTS05Y log (see
resets.js header): reset = later of off + 32 h and 05:59 on the second
free night; due = last reset + 7 days; yellow ≤ 2 days, red ≤ 24 h
(owner). Home off duty = REST − 10 h (− 24 h if booked 24 h). Owner: the
7-day reset is what matters; 60 h / 192 h not tracked ("too hard to
pass"); notifications later. FORMAT 19. **Saved question** (TODO #8):
DHT040B 31 / B111, look at it with the tracker once it has run.
Before: #10 crews in town done (behind the scenes + Person search status);
the laptop needs `git pull` + restart.

Next after checking it: #11, #6 and the older
ones. Show options with a recommendation, then build. Before changing a tab,
search the archive for why it is the way it is.

**2026-11-23 reminder (scheduled in that session):** the owner deletes the
Render service (suspended 2026-11-03) and any Render Blueprint. Check
`/api/status` is `ready:true` first.

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
  set 2026-11-02), `VAPID_KEYS` (secret, set 2026-11-03), `KIMI_API_KEY`
  (secret, set 2026-11-03), `OWNER_DOWN_MINUTES` (60), `OWNER_CODE` (JUOD),
  `PUSH_DOWN_MINUTES` (180), `OWNER_EMAIL` (unused while Access is off);
  optional `STATS_KEY`, `KIMI_MODEL_FAST` / `KIMI_MODEL_SLOW`, `BOARD_KEY`
  (relay, unused). Cron */10 (Page Health → Worker timer: runs, checked
  2026-11-03). **Workers Paid plan** ($5/mo, needed by the search).
- **Agreement search documents:** after adding or changing a PDF in `data\`:
  `node scripts/search-upload.js` (builds the index, uploads only what
  changed to R2 search/ + docs/, retries dropped connections).

## What it does now (one line each; details in the archive and the code)

- **Checks** CATS every 5 min in Edge (`scripts/board-auto.js`, route in
  `runRoute`): Call Board (+ crews in town), pools 23/19/21/27/25/26, line-up
  41, spareboards 13/9/19/17 (with VIEW TIME = now − 10 min, extras shown in
  yellow), 5 (jobs going spare), 29 (501/502), 31 (Garnet), Toronto
  bunkhouse 28 + Mac yard line-up 41 + **Garnet line-up 41** (47956 W S5:
  L501 home). Engine: `lib/board/engine.js`.
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
  Tabs: Current, Turn History, Snapshots (hours 0000–2300, then that hour's
  checks), Order summary, Article 18.6(b) (2 tiles + link to grievance.html),
  Analytics, **Reference** (public/board-ref.js: CATS status/ECC codes, job
  types, track lengths, held-away penalty + calculator), **Agreements**
  (public/board-ask.js, below) and **Page Health** (owner key only). 3 h+
  down → red banner. Uploads retry dropped connections (r2.js retryingFetch).
- **Agreement search** (moved off Render 2026-11-03, live and verified):
  the Agreements tab asks the Worker's `/api/ask` (BM25 over R2 `search/`,
  same tokenizer/scoring as lib/search.js; Kimi streams the answer; deeper
  search; 10 questions per 5 min per address; daily counts `ask/stats/`,
  `/api/stats?key=`). PDFs at R2 `docs/<id>.pdf`; viewer.html, stats.html,
  grievance.html (board look) on the site. Index: lib/search-shards.js,
  uploaded by scripts/search-upload.js. Render (server.js) is no longer used.
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
- **RailroadTracker app** (repo odeajust-glitch/RailroadTracker): reads the
  board site directly. The relay (`BOARD_RELAY_URL` + `BOARD_KEY`) was never
  configured on the laptop; the Worker has it (`/api/board`, off without a
  BOARD_KEY secret). Don't suggest removing it.
- **People (name codes):** sightings carry craft (501/502) and the Call
  Board train (people.json `now`); a person's Work history counts a train
  only if it went on duty while they were on that turn.

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

- **Worker:** the version with the agreement search is deployed (checked
  2026-11-03). ❓ Confirm the 30-min ntfy "down" arrives the next time the
  checker is down.
- ❓ Garnet line-up 41 (W / S5 guessed): if the checker log says "skipped
  Garnet line-up 41", ask what he types in DIR and POOL.
- ❓ Sleep tracker one-check flickers ("M39671 30 called 901 min later"):
  asked whether a prediction must hold 2 checks; no answer yet.
- ❓ The first real "another assignment?" page: check Page Health → "CATS
  pages it asked you about" and that the ntfy Y / N buttons worked. The
  startup line must say "phone alerts on (ntfy)" or asking can't work (it
  then types N after 15 min).
- ❓ Runaround log results: he reviews them before any alerts are added.
- ❓ Not yet seen on real CATS: VIEW TIME box, mid-call hold, CATS option 5
  check, stale trains, runaround log, the watchdog's Edge clean-up (Windows),
  Toronto fill-ins kept while read in the bunkhouse.
- ❓ Crews in town on real CATS: the first checks after the pull should
  show `seen.crewsInTown`, pools in the history .json and "Crews in town:
  N people read." in the log; pages 7 and 11–29 not seen yet (other pool
  names may come through masked as AAAA). Check a person search (JUOD)
  shows the "Crews in town" line.
- ❓ Reset tracker on real data: after the pull, data/resets.json should
  list turns; compare a few people's "reset needed by" with CATS PSTS05Y
  (the owner's own). Wrong if trips are missed (checker down, a name not
  read on the Call Board) or the window starts mid-week.
- Open TODO items: reset tracker notifications (#8),
  API key tester (#11: compare AI keys on the same agreement question; where
  the tester is in the owner's claude.ai chat, link in TODO #11; he pastes
  the code when it's time), DHT040B 31 runaround (waits for #8), home turn worked out better (tabled, owner 2026-11-03: he
  was displaced, To Place, and the site could only say "not seen"), runaround log alerts / claims, Turn History housekeeping
  (later), 18.6(b) rep alert as an email (skipped for now), My week for
  everyone (JUOD only now). Full list: docs/board-checker/TODO.md.

## Latest (newest first; move older ones to the archive when this grows)

- 2026-11-03: reset tracker fixed after its first real run (nearly every
  turn red "due 25th"): checks before 2026-11-03 kept no train with each
  name, so trips now also come from the person's own turn's Call Board
  trains while they held it (collect turnTrips; not a job a spare filled
  in, `filled` from backfill); a long stretch off gives its latest reset
  (naturalReset); one name code on two turns at once = two people, worked
  out per person on their turn (onTurn). FORMAT 20. On the owner's data
  (sim from the site's day files): JUOD due 10th 0755 as CATS; 5 red
  (SR11 overdue since 2nd 0559: worked every day since 26th), 3 yellow.
  Overdue reads "reset overdue (was needed by …)".
- 2026-11-03: checker window no longer prints WHEN YOU GO / "Your answer
  changed" / the beep (owner: "we don't need to track myself in cmd, it
  works great on the site"; formatReport hideMe). History .txt unchanged.
- 2026-11-03: after the reset tracker pull (FORMAT 19 redoes every day
  file, ~3 MB each) the upload timed out ("The operation was aborted due
  to timeout", plus ntfy ETIMEDOUT: slow laptop connection); it caught up
  a few files per check. r2.js deployR2 now allows 60 s + 60 s per MB (up
  to 5 min) per file and tries a timed-out file twice more.
- 2026-11-03 (reset tracker): owner's CATS "EMPLOYEE TIME ON DUTY LOG"
  (PSTS05Y: on/off duty per trip, RESETMNL / RESETSYS / RESETM32 lines,
  7DY TOT, 28DY TOT, 7DY RESET) used as the answer key; built
  lib/board/resets.js + board colours. Owner chose: per person, 7-day
  reset only, yellow 2 days / red 24 h, alerts later.
- 2026-11-03 (crews in town session): owner put #10 (expanded Call Board)
  before #8 (rest tracker). Checker reads past CREWS IN TOWN to the last
  page (board-auto.js Call Board loop, up to 40 more pages; trouble there
  only shortens the list); reader written from his two screenshots (pages
  5 and 6). Owner: every page, HT confirmed, behind the scenes only (not
  on the site); feeds the rest tracker next. Tests: run
  `npm ci` first in a fresh container (jszip etc.), then 207 pass.
- 2026-11-03 (housekeeping session; every note in the archive's "Later
  notes"): L502 alternation + Garnet line-up; Worker timer fixed (wasn't
  deployed); person search (home turn, status, craft, own trains only);
  Turn History short Changes + More detail; Reference tab; Snapshots by
  hour; Order summary / Analytics / 18.6(b) tiles trimmed; predictions
  scored 8 h before the call; My week only while on the turn; runaround log
  (** explained, other pool explained, MU placeholder, board shown);
  YSBY 12 h; **agreement search moved from Render to the Worker** as the
  Agreements tab; grievance page in the board look; Render suspended.
