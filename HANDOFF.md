# HANDOFF — read this before doing anything

Last updated: 2026-10-13 · Branch: `claude/auto-board-checker-plan-hdk1n5`

**If you are a new Claude session:** read this file top to bottom, then
[docs/board-checker/PLAN.md](docs/board-checker/PLAN.md). Don't start coding
until the "Next action" below is unblocked. **Update this file at the end of
every session**: state, decisions, what you tried, what's next.

## ⚠ SCOPE (owner, 2026-10-15): ONLY "when do I go to work"
The owner runs board checks only while waiting in Sarnia, because the line-ups
are unreliable. The tool's one job is telling them when they'll be called.
Don't add predictions, flags or questions beyond that. The default report
prints just that answer (`--details` for the working). Route: Call Board, 23
(CO), 41. Screens 19/21 are optional.

## 2026-10-15: rules confirmed
`**` time = until (no day = today); B0 at a normal position = working another
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
