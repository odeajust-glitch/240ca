# HANDOFF — read this before doing anything

Last updated: **2026-11-05** (end of the reset tracker / trainees / Garnet /
assignment history / alert-check session, claude.ai
session_01AP9cZud7gx8TSqRyscer6F) · Branch:
**`claude/vigilant-planck-zawrj4`** (has everything; no PR) · 256 tests
(`npm ci` then `npm test`, all pass). No other Claude session is known to
be changing the checker now; if one is, only one may change it at a time.

## ▶ Start here (state at 2026-11-05)

**Newest (2026-11-05, later session, claude.ai session_01AP9cZuN9352AvkVm7uMr1Z):
upcoming days off (CATS 3 → 4) built, A + B + C** (owner: "do A, B and C").
Not run on real CATS yet: after his pull, check the log has no "skipped
Upcoming days off 4" and the Current tab shows the **Days off** section.
Details under "What it does now". That session started from an old copy
(f6c9036) and was rebased onto this work; check both features after the pull.

**Laptop:** the owner has NOT yet pulled the last few commits (from
`0a09803` on). First thing: have him `git pull` in `C:\BoardChecker-code`,
Ctrl+C the checker and start it again, then reload the site on the phone
(close the tab if it still shows the old page). The site's page
(index.html) is copied from the laptop's `public/board.html` on every
check, so nothing goes live until he pulls.

Done in the last session (2026-11-05), to confirm on the real site/phone:
1. **Engineers and 18.6(b):** engineers are NOT under Article 18.6(b)
   (owner). Their details box has no article line; an engineer-only list in
   Turn History is headed "Held in Toronto 14 h+". Owner: the details
   (engineer turn + conductor, train to Toronto + on duty, off duty Toronto,
   train home + on duty, held) "is enough": **no engineer template coming**.
   The same engineer box + Copy is now also on the **Article 18.6(b) tab**,
   under the conductor's grievance form when a crew is tapped
   (board.html engineerBox / wireEngineerBox). ❓ Check it shows there.
2. **Work history on a phone:** the hours worked moved under the off-duty
   time ("off 27th 0005" / "(7 h 35 m)") so it no longer runs into "at
   Toronto". ❓ Check.
3. **Reset alerts, Chain Gang / SD** (owner): a turn put on a reset at the
   call does not take the train and go spare; the job goes to the **next
   turn that can work it, past ** / B0 turns**, and only spare if no one
   after them is available. Example that triggered it: 4th 1944 check,
   SD02 on M39491 (call 5th 0226) told EN03; should have been SD04 (SD11
   hold, SD01 **). Only in the reset "what if" run (engine `resetJob`,
   `firstCallable` skipSpare); the normal line-up still has a ** turn take
   its train and go spare. ❓ Watch the next Chain Gang / SD reset alert.
4. **Test alerts:** `node scripts/alert-check.js CODE` (name code or turn)
   sends "Test: CODE" to the phones following it, **skipping phones that
   also follow the owner's code (JUOD)**; `--all` includes them. Worked:
   WADE's phone and ERBR's phone both got it (2026-11-05).
5. Owner asked why Chrome's lock menu had no "Permissions": Chrome only
   lists a permission once the site has asked; that browser had never been
   set up for alerts (🔔 Track / alerts → Allow).

Still to watch on real runs (from 2026-11-03/04):
- Reset alerts reaching the right people (A/B/S1/S3 → the spare who'd
  fill it; spareboards → next spare; Chain Gang/SD as above).
- Trainees (WADE on S501-TT): stays on the slot while away, alerts follow.
- Crews-in-town list cut short when CATS is slow.
- Saved question DHT040B 31 / B111 (TODO #8): look at it with the tracker.
- Pushover trial ends ~2026-12-04 (TODO #12): ask the owner if Pushover
  is the one that always arrives, then buy or remove it.

## ▶ Older next-session notes (2026-11-04, the parallel API/Agreements session)

**First ask the owner how these looked on the real site** (sent to him
2026-11-04, after his first check with the new code):
1. Search Review tab shows next to Page Health on his phone.
2. Agreements tab: the tip under the question box; his question headed
   "Claude Opus"; a member's "Try a deeper search" "Claude Sonnet".
   Members stay on Sonnet (owner, 2026-11-04: "keep the deeper search at
   sonnet"); he can change any of the three on the Search Review tab.
3. Search Review: his question saved (You, documents searched, passages
   from, the Opus answer); AI spending: Kimi balance a dollar amount (the
   Moonshot balance address is unchecked: if "couldn't read it", fix it),
   Claude today 1 answer; Kimi answers show $0 if Moonshot's stream has
   no token counts (then priced from nothing: look at it).
4. Line-up: L50231 04 reads "EN S501 · CO S501 · TT S501".
5. **Kimi's thinking leaked into an answer** (owner, 2026-11-04, incognito
   = member, first answer set to Kimi K3.1 Pro): with `thinking:
   disabled` it wrote its reasoning as the answer. Fixed: thinking is
   never turned off now (reasoning comes as reasoning_content, not shown).
   Also: a Claude 400 is asked again without `fallbacks` + beta header; a
   failed Claude/Kimi sends a `fallback` event (page note, reason on the
   owner's phone; kept in the question log, Search Review "fell back");
   Claude's stand-in is Kimi K2.6; Kimi answers labelled with the model
   (Kimi K2.6 / K3.1 Pro / K3). Suggested to him: first answer → Claude
   Haiku in Search Review. ❓ Worker re-pasted + laptop pulled? Then check
   a K3.1 Pro answer is clean (the first token may take longer: it thinks).

Still open from earlier:
1. Model tester: Netlify → Add new project → Import from GitHub, base
   directory `tools/ca-model-compare` (TODO #11 has the settings), keys
   MOONSHOT_API_KEY / ANTHROPIC_API_KEY / TEST_PASSWORD set by him. Empty
   project `ca-model-compare-empty` can be deleted. No Google/Gemini key yet.
2. (Anthropic spend limit: done, owner 2026-11-04.)

Dates: Pushover trial ends ~2026-12-04 (TODO #12, compare routes); the
Anthropic key expires **2026-12-31 22:00** (Google Calendar reminder set
with the steps: replace it in Cloudflare and Netlify). Render deletion
reminder 2026-11-23.

**Reset tracker built (TODO #8 + #9, 2026-11-03), waiting for real runs.**
lib/board/resets.js: per person (name-code hash), from every day file's
`resets` (collect per check: trips by name code with their Call Board
train / yard job, every board's REST, 0559 rests/holds, bunkhouse REST)
→ site.js writes data/resets.json { taken, turns: { turn: { level
red/yellow, dueText, due, last, ahead } } } for the newest check; the
Current tab's pools/spareboards colour rows (board.html RESETS,
paintResets). Model checked against the owner's CATS PSTS05Y log (see
resets.js header): reset = later of off + 32 h and 05:59 on the second
free night; due = first on duty after it + 7 days (owner; confirmed on
SD11 / MAZY: needed by 4th 0015, right per the owner); yellow ≤ 2 days, red ≤ 24 h
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

**Remote access** (owner, 2026-11-04: "remote works great"): Chrome Remote
Desktop on the laptop (name BoardChecker, his Google account + PIN), from
his phone app or remotedesktop.google.com/access on any computer. He can
fix things while away; steps can assume he's on that. The checker does
NOT start on its own after a Windows restart (offered: a scheduled task
at logon; not set up).

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
  (secret, set 2026-11-03), `ANTHROPIC_API_KEY` (secret, ❓ not set yet; the key expires
  2026-12-31 22:00, calendar reminder set:
  Opus deeper answers, 2026-11-04), `OWNER_DOWN_MINUTES` (60), `OWNER_CODE` (JUOD),
  `PUSH_DOWN_MINUTES` (180), `OWNER_EMAIL` (unused while Access is off);
  optional `STATS_KEY`, `KIMI_MODEL_FAST` / `KIMI_MODEL_SLOW`, `CLAUDE_MODEL` (owner, Opus), `CLAUDE_MODEL_DEEP` (members, Sonnet), `BOARD_KEY`
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
  L501 home) + **upcoming days off 4** (2026-11-05). Engine: `lib/board/engine.js`.
- **Days off** (option 4: nothing typed, F8 pages; `lib/board/daysoff.js`,
  parseDaysOff in screens.js): each line = 24 h off from the time shown
  (owner), remembered in BoardChecker\days-off.json until it ends (a line
  may leave the "upcoming" list once it starts). Rows get `off`; the order
  skips a Chain Gang/SD turn off at the call, an A/B/S1/S3/501-502 turn
  goes spare, spares off are passed over; "days off …" in pool statuses;
  Current tab "Days off" section; runaround log "explained". ET counts as
  the engineer side (as option 5's CC already did).
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

- ❓ **Days off (option 4)**, new 2026-11-05: first real run (see Start
  here). Owner "not sure" what STAT (A/B) and A/U/X mean: shown, not used.
  Leave types other than OFF: "don't worry". Asked whether an ET line
  (engineer trainee?) should mean the engineer turn is off (it does now).

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
  API key tester (#11: in tools/ca-model-compare, waiting for his Netlify
  import and scored results), DHT040B 31 runaround (waits for #8), home turn worked out better (tabled, owner 2026-11-03: he
  was displaced, To Place, and the site could only say "not seen"), runaround log alerts / claims, Turn History housekeeping
  (later), 18.6(b) rep alert as an email (skipped for now), My week for
  everyone (JUOD only now). Full list: docs/board-checker/TODO.md.

## Latest (newest first; move older ones to the archive when this grows)

- 2026-11-05: **Upcoming days off** (option 3 → 4) added, A + B + C (see
  "What it does now"). Tests: test/board/daysoff.test.js (owner's screenshot).

- 2026-11-04: `node scripts/alert-check.js WADE` (or a turn) sends "Test:
  WADE" to every phone following that code / turn and reports each (push
  host: fcm = Android/Chrome, web.push.apple.com = iPhone). Don't name a
  script *-test.js: node --test runs it (push-test.js broke the suite once).
- 2026-11-05: reset alerts, Chain Gang / SD: the job goes to the next turn that can work it, past ** turns (owner: SD02 on M39491 should have told SD04, not EN03). Spare only if none.
- 2026-11-05: engineers are not under 18.6(b); their details drop the article line and an engineer-only list is headed "Held in Toronto 14 h+". Owner: "this info is enough": no engineer template needed. Engineer details also on the Article 18.6(b) tab under the conductor form (tap a crew).
- 2026-11-04: **Article 18.6(b) in Turn History** (owner: show it "when
  someone looks for their turn or uses their name code and they were the
  member of the crew. Just don't auto fill their name for the name code.
  For engineers … the information they would need to file"). board.html
  held186 / wireHeld186: turn search lists heldRows with co or en = the
  turn (letter prefilled like the 18.6(b) tab, names if unlocked); name-code
  search lists trips in their Work history where they were co or en
  (trainees left out), letter with no name; engineer → details text + Copy
  (owner 2026-11-05: no engineer template needed; not 18.6(b) for engineers). Turn search's Work
  history also shows off duty now.
- 2026-11-04: assignment history read on the laptop (19:05, 19:23) but 0
  trains came out: real rows start with the X box saved as "[]"
  (`node scripts/assign-check.js` shows the saved page); parseAssignHistory
  strips it. The backfill failed with "no box for START DATE": CATS draws
  START and DATE: apart; fillByLabel falls back to the label's last word.
  **Backfill done 2026-11-04 20:15**: 199 trains read (195 with off duty);
  site offs: 188 from history, 160 bunkhouse, 13 rest, 30 estimates (was
  64); Z14931 01 2355, Z14931 27 0040, M38331 29 0245 match the owner's CATS.
- 2026-11-04: **one-time backfill of off-duty times**: `node scripts/assign-backfill.js
  2026-10-16` writes BoardChecker\assign-backfill.json; the running
  checker's next check reads 3 → 7 with START DATE typed in too, S1 and S5,
  F8 up to 150 pages (heartbeat each page), says "Assignment history
  backfill from …", deletes the request. Saved with that check, so
  resets.offs carries every train in the range.
- 2026-11-04: **off duty in the Work history** (owner: "Can we start to add
  off duty times in turn history"): resets.js trainOffs → resets.json
  `offs` {train: {on, off, how}}; board.html offLine: "on duty 0245 · off
  1101 (8 h 16 m)", "~" when estimated. Fixed: a REST shown while the turn
  is away (term 1+, Garnet) is 8 h like the bunkhouse (L50231 04: rest
  until 1901 → off 1101 as CATS; was 0901 with − 10 h).
- 2026-11-04 19:03: laptop on c966799. Garnet reminder alert worked
  ("S501-CO: about 27 min to your expected call: L50131 04 … call 1930").
  One check: "crews in town list cut short: CATS did not answer within a
  minute" (36 people read, usually ~90) ❓ watch if it repeats. Assignment
  history now prints "Assignment history (3 → 7): N trains read, M with
  their off duty" when read.
- 2026-11-04: **next: exact off duty from CATS ASSIGNMENT HISTORY (PSTS17A)**
  (owner's screenshot). Boxes: DIST 45, SUB-DIST SA, POOL OR YD/LO = a
  *location* code (S1 = Sarnia, not the S1 pool; S5 = 502/501), HOME/AWAY
  (0 home, 1 away; owner uses 1 = trains coming to Sarnia from Toronto,
  since tying up in Toronto is already exact from the bunkhouse 28),
  START DATE YYMMDD (any). Columns: TRAIN ID (+ day), ODT-DATE/TIME
  (on duty YYMMDD HHMM), INT-TERMINAL, MILES, DUTY (HHMM on duty; N/A =
  still on duty). Off duty = ODT + DUTY. Row colours just alternate. Plan:
  read S1/1 and S5 with start = yesterday about hourly; resets.js offDuty
  uses it first. **Built 2026-11-04** (owner: main menu 3 → 7, F8 to page):
  board-auto fillByLabel (only POOL and HOME/AWAY typed; owner: START DATE
  etc. left as CATS has them) + hourly read (assignReadAt) of S1 and S5 (both
  HOME/AWAY 1 ❓ for S5), label assignHistory; screens.js
  parseAssignHistory; summary assignHistory; resets.js acc.offs → offDuty
  'history' (exact, before bunkhouse/REST/estimates). Masking keeps
  2[4-9]MMDD dates. ❓ First real read: window says "skipped assignment
  history …" if a box label or the screen isn't found.
- 2026-11-04: **possible resets** (owner: off at 2355 gave a reset, after
  0000 it would have needed another night; "mark those as possible
  resets"; he has a way to find specific trains' off-duty times for later
  accuracy, ❓ ask about it). resets.js work(): an off duty that's only
  estimated (Call Board − 30, yard length) where ±30 min changes the reset
  → possible:true (incl. a reset only the earlier time would give). Latest
  reset possible → board colour / alerts use the earlier deadline (if it
  didn't count), text "…, or X if the possible reset Y counts"; Person
  search line amber "Possible reset … (off duty estimated near midnight)".
  Real data: 1 of 317 resets possible.
- 2026-11-04: **shared name codes** (owner's SR11 "overdue since 2nd 1644"
  was wrong: one code seen on SR01, SB03, SA07, SB06, SR11 at once): resets.js
  onTurn treats a code on two turns together ≥ 6 h as shared → only that
  turn's stretch, nothing known before (since). Bumps (SR03/S501 40 min)
  stay one person. **Person search shows resets in green** (owner: "the rest
  where they got their reset is a different color"): resets.json `people`
  {hash: [{at, kind}]} (personResets); board.html workHistory restLine
  "Reset 3rd 0755 (32 h off, two nights)" / "(put on a reset)", tr.wreset.
- 2026-11-04: **trainees stay on their slot while away** (owner: WADE "should
  show him with me … stay on the turn till they get back to Sarnia"):
  lib/board/trainees.js keepTrainees (BoardChecker\trainees.json): a
  trainee not seen while the turn is away / working gets a kept sighting
  on S501-TT; back home 30 min grace, then let go (crews in town shows them
  again if still training); 4 days max unseen. Call Board names now read
  TT crew lines (parseTrainCrewNames TRAIN_CRAFT). Applied in board-auto
  before saveSnapshot (summary.people). ❓ First real test: WADE (TT on
  S501) should be picked up from the Call Board at L50131 04's on-duty
  (4th ~2130 at Garnet) and then show as S501 · TT; he isn't on the Garnet
  board (31) or 501/502 (29) (owner, 2026-11-04). Trainees never show on
  the Garnet board (31) or the Toronto bunkhouse (28) (owner): only Sarnia's
  crews in town and the Call Board's crew lines; away, they're kept.
  By hand: `node scripts/trainee.js add WADE S501 TT` (list / remove) puts
  a trainee in BoardChecker\trainees.json (owner: "fix it so Wade shows in
  s501 now"). Worked 2026-11-04 1629: WADE on S501-TT, his phone got the
  notification (the checker had been stopped; started again after the add). Garnet line-up 41 works
  with station only (L50131 04 ORD 4th 2130 read at 1203).
- 2026-11-04: re-auth from the phone without the ntfy app (owner: "Can I
  use pushover to do my reauth"): Pushover can't send back, so a link to
  ntfy's GET publish (https://ntfy.sh/<signin topic>/publish?message=signin)
  does it; printed by `node scripts/phone-test.js` for the home screen; the
  12 h / 2 h sign-in reminders carry a "Sign in now" button (ntfy http
  action) / link (Pushover url). owner-notify.js signinLink.
- 2026-11-04: owner at Garnet: **his alerts stopped** (seen on S501 away,
  term 1 → own:false → updatePersonTurns dropped him after 30 min). Board
  sightings away / working now count as own when the holders file says
  that name holds the turn (board-auto sight, knownPeople). ❓ **Garnet
  line-up 41 (47956 W S5) has never returned a train** (0 checks read on
  the 3rd and 4th). Owner: "take out W S5 and 24": now station 47956 only,
  DIR / POOL / hours cleared (CATS keeps Mac yard's W / S1 / 24 otherwise).
  ❓ Check the next checks read L501 (snapshot screens has garnetLineup).
- 2026-11-04: owner's PSTS05Y after his L502: **"7DY RESET: 261111 0244"**
  = first shift after the reset (L50231 04 on duty 4th 0245) + 7 days − 1
  min. resets.js due = back.on + WEEK − 1 (was + WEEK). 7DY TOT 33:33,
  28DY 130:04; L50231 04 off 4th 11:01.
- 2026-11-04: **trainees** (owner: WADE, a TT on S501, showed as S501's
  conductor): a TT / ET (no position in crews in town, or a TT/ET crew line
  on the Call Board) is seen on its own slot S501-TT / S102-ET (board-auto
  sight). Reset tracker: keyOf keeps TT/ET; a trainee's trips are the
  turn's (conductor's for TT, engineer's for ET; resets.js tripsOf); never a
  board colour (BOARD_TURN). Alerts: alerts.js addTrainees gives a followed
  trainee slot the turn crew's lined up / ordered / time / on duty / rescue,
  never the holder's reset or position. Person search: "S501 · TT
  (trainee)", the turn's facts; crews-in-town line keeps trainee rows apart.
  Work history (board.html personHistory): a trainee slot's trains are the
  turn's while they were on it, "L50231 04 (S501 · TT)" + a "TT trainee"
  chip, whole crew under Worked with; no holder's rests (owner: "log what
  turn they are working and indicate it's a TT turn").
- 2026-11-04: **Search Review tab** (owner-only, shown like Page Health
  when the Worker accepts the owner key; owner: "move Agreement search
  models from page health tab to another tab … the options there and the
  questions"): Questions asked, Agreement search models, AI spending
  (the last two moved off Page Health). **Questions and answers are now
  kept** (owner, 2026-11-04: to review real questions before changing
  models; chose: members told on the Agreements tab, 60 days, his own
  too, marked "You"): Worker askLog → R2 ask/log/YYYY-MM-DD.json (the
  question as typed, each answer with its model label and exact model
  name, the documents searched (`searched`, `picked` = not the usual
  set) and the documents the passages came from (`used`), deeper /
  retried flags; no address, no name); pruneAskLog on the 10-min timer
  deletes days 61–67 back; GET /health/questions[?day=] owner only. The
  old "no question kept" (from Render) no longer holds. Agreements tab
  has a tip under the question box (owner: better answers when the search
  is narrowed to one agreement) with a link that opens Documents to search.
- 2026-11-04: **Page Health → AI spending** (owner: "the api balances in
  the page health section", then "a usage history"): Kimi balance live
  (Moonshot GET /v1/users/me/balance with KIMI_API_KEY; address not
  checked against Moonshot's docs: the container can't reach them);
  Claude has no balance lookup for a normal key, so every answer's tokens
  are priced (MODEL_PRICES, list rates) and counted per day per model in
  R2 ask/spend/YYYY-MM.json (Kimi answers too; priced only if Moonshot's
  stream carries usage). Last 30 days table: questions, people (ask/stats),
  answers by model, cost. Worker GET /health/spend (owner only). Link to
  console.anthropic.com → Billing for the real Claude credit.
- 2026-11-04: Call Board trains now read a conductor trainee (owner:
  L50231 04 "TT DEMARS … S501" missing; line-up showed "EN S501 · CO
  S501"): screens.js TRAIN_CRAFT adds TT for train crews (ET was already
  read); parseCallBoardNames unchanged (a trainee's name isn't the
  turn's). Trainees never count as the CO / EN: site.js en fallback,
  insights crewOf, alerts on-duty loop skip TT / ET. Needs laptop pull.
- 2026-11-04: **search models chosen on Page Health** (owner: "so I can
  change the model the search uses myself in page health"): section
  "Agreement search models", three roles (owner / members' first /
  members' deeper), choices Opus, Sonnet, Haiku, Kimi K2.6, Kimi K3.1 Pro (added at the owner's ask), Kimi K3.
  Worker GET/POST /health/models (owner only), R2 ask/models.json (ask/
  is never served), saved choice > variable > default; streamModel picks
  Claude or Kimi per role (Claude failing first → Kimi). Every answer now
  sends a `model` event (heading on the page, members' first answer too).
- 2026-11-04: turn alerts no longer lost on a dropped connection ("Turn
  alerts not sent: fetch failed"): the phone list is fetched with
  retryingFetch; alerts that couldn't go (whole send, or one phone) are
  kept in BoardChecker\alerts-pending.json and sent with the next check,
  up to 30 min old (board-auto sendTurnAlerts).
- 2026-11-04: **Claude Opus in the Agreements tab** (owner: "I like opus
  answers"; chose "Kimi first, Opus on demand" and "my answers just with
  Opus"; then "make the deeper search a cheaper anthropic model": members'
  deeper answers use Sonnet, CLAUDE_MODEL_DEEP). Worker streamClaude /
  streamDeep: the slow tier and the could-not-find retry use Claude (24
  passages); a request with the right
  x-owner-key (board-ask.js sends OwnerKey's) is always slow → Opus. Kimi
  k3 if no ANTHROPIC_API_KEY or Opus fails before its first word. NDJSON
  event `model` names who answers (shown above the answer). Steps:
  CLOUDFLARE.md "Claude for deeper answers". ❓ Owner adds the secret
  and re-pastes the Worker.
- 2026-11-04: Pushover works (owner: both findstr ok, test message came
  through on Pushover). **API key tester (TODO #11)** started: owner's
  tester from claude.ai is in tools/ca-model-compare (Netlify site, not part
  of the board site); Kimi + Claude Haiku / Sonnet / Opus on the whole
  Agreement 4.16 + addendum. Not deployed yet; see TODO #11.
- 2026-11-04: owner's phone messages (Microsoft number, sign-in, CATS
  pages, stuck) retried ~2 min per route in the background
  (lib/board/owner-notify.js; board-auto alertPhone / pushOwner); the
  sign-in ones also go as a site alert to phones following the owner's
  code (BOARD_OWNER_CODE, else BOARD_WEEKLY_CODES' first, else JUOD);
  Pushover optional (BOARD_PUSHOVER_TOKEN / BOARD_PUSHOVER_USER,
  docs/board-checker/PUSHOVER.md; owner set it up 2026-11-04, both routes
  tested OK; free trial ends ~2026-12-04: compare routes then, TODO #12).
  Number read from more Microsoft screens (idRemoteNGC_DisplaySign, …).
  Each route logged apart in Page Health (Checker (ntfy) / (Pushover) /
  (site alert)). Test: `node scripts/phone-test.js`. Window quiet about
  ntfy blips under 10 min.
- 2026-11-04: **Garnet line-up · L501 home** section on the Current tab
  (board.html garnet(); snapshot garnetHome) and alerts for the crew in
  Garnet (lined up home from Garnet / ordered / time / reminder; alerts.js,
  before the Sarnia line-up). Owner: only ever one crew in Garnet, the
  501/502 crew that took L502 out, bringing the next L501 home; call =
  order − 2 h. toronto.js garnetHome.
- 2026-11-04: owner on S501 (CO). Alerts for 501/502 fixed: a person
  followed by name code on a 501/502 turn is S501-CO / S501-EN
  (updatePersonTurns, craft from the sighting); own mandatory reset now on
  501/502 too (turnStates pools.s5, per craft); a phone following plain
  S501 gets S501-CO/EN events (phoneEvents). Not for 501/502 (by design):
  position, ahead on/off rest, rescue, may be called.
- 2026-11-03: spareboards' B0 reads "B0: working another job" (owner, EN10:
  "Don't need to put that it goes spare"); pools keep "…, goes spare if
  called" (view.js gangStatus spareboard option).
- 2026-11-03: Toronto trains gone from 41 without reaching the Call Board:
  red "Non-Sarnia Crew" only if no rested crew AND no Sarnia crew was
  predicted for it; a predicted crew (owner: M38331 03, SD09 + SR07) →
  yellow "Possible Non-Sarnia Crew or Train Cancelled" (board-trains.js flagOf).
- 2026-11-03: **reset alerts** (lib/board/reset-alerts.js; board-auto
  resetEventsNow, reads site\data\resets.json from this check): for each
  projected train/job, if its person's reset is needed (owner: "road jobs need about 35
  hours, use that as your marker": pools under 35 h left at the call =
  likely reset, 35–48 h = heads-up; spares: deadline before the job ends,
  yard 8/12 h, road 35 h), the check is re-run with
  that turn on a 32 h reset and whoever then gets that job (same craft) is
  told (kind resetAhead, phone option on by default). Owner: Chain Gang /
  SD / spareboards → the next person; A/B/S1/S3 → the spare who'd fill it;
  "if that person going on reset would cause someone to get a notification
  that they are going to work, make sure they know"; once per train
  (BoardChecker\reset-alerts-told.json). ❓ Not seen on real checks yet.
- 2026-11-03: trips a spare works filling in on another turn now count
  for the spare (collect: backfill → the spare's own turn's turnTrips;
  work(): a fill-in trip is theirs if that turn was their latest own one
  before it). FORMAT 21. Owner asked about COBO (SD08): reset 30th 0559,
  back 30th 2030 → needed by 6th 2030 (S301 fill-ins 27th/28th now counted).
- 2026-11-03: website publish runs in the background (board-auto.js
  site.busy; owner: "the checker is taking too long … it needs to update
  the site its getting stuck here"); one upload at a time. First live
  reset run after the fixes (1027 check): red SR11, SD11, yellow SR06,
  SD07, SR02. Regular yard jobs left out of resets.json (owner: "anyone on
  a regular yard job should be reset cause they have set days off. Its the
  people on the boards that matter"; resets.js BOARD_TURN).
- 2026-11-03: reset due = 7 days after the first time on duty after the
  last reset (owner: "I think the 7 days start when I go onduty, we can
  check that when I get called tonight for 502"); off since the reset =
  nothing due. Confirmed by the owner on SD11 (MAZY): "reset needed by
  4th 0015 … is the correct time" (reset 27th 0559, on duty 28th 0015). Sim on the site's data: 2 red (SR11
  overdue, SD11), 3 yellow (SR06, SD07, SR02).
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
