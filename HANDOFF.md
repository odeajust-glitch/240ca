# HANDOFF — read this before doing anything

Last updated: 2026-10-13 · Branch: `claude/auto-board-checker-plan-hdk1n5`

**If you are a new Claude session:** read this file top to bottom, then
[docs/board-checker/PLAN.md](docs/board-checker/PLAN.md). Don't start coding
until the "Next action" below is unblocked. **Update this file at the end of
every session**: state, decisions, what you tried, what's next.

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

## Next action: owner re-runs the updated probe on the spareboard screen
The first run (2026-10-13) captured the login but not the board itself, because
CATS draws its screens inside a frame and the probe only read the top page.
The probe now captures every frame. Re-run it the same way (Windows: from the
unzipped folder in `C:\Users\odeaj\OneDrive\Desktop`), **after downloading
the branch ZIP again**:
```
npm install
npm install --no-save playwright && npx playwright install chromium
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

**Run 2:** _(pending: board screen layout, frame structure, form field names,
session reuse.)_

**Go / no-go:** not yet. Reading looks technically possible. Still open:
board layout (run 2), session lifetime, and the owner's risk sign-off on
automated logins (MFA every ~24 h means a human approves daily at minimum).

## Ground rules for whoever picks this up
- Never commit credentials, raw captures with coworkers' names, or `probe-out/`.
- No polling or scheduled scraping until Phase 0 is a "go" and the owner has
  signed off on the risk.
- Match repo style: CommonJS, small `lib/` modules, comments explain *why*.
- Tests: use built-in `node --test`. Don't add a test framework dependency.
- Develop on the branch above; don't open a PR unless the owner asks.
