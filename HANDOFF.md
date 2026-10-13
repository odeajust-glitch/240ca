# HANDOFF — read this before doing anything

Last updated: 2026-10-13 · Branch: `claude/auto-board-checker-plan-hdk1n5`

**If you are a new Claude session:** read this file top to bottom, then
[docs/board-checker/PLAN.md](docs/board-checker/PLAN.md). Don't start coding
until the "Next action" below is unblocked. **Update this file at the end of
every session**: state, decisions, what you tried, what's next.

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
