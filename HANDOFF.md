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
- Plan written: `docs/board-checker/PLAN.md`. **No code yet.**
- Board rules pulled from `data/crew_calling_cty.pdf` and
  `data/crew_calling_manual.pdf` into the plan's rule table.
- **Board site facts (from owner, 2026-10-13):** `https://cats.cn.ca`, sign in
  with name + password, then Microsoft Authenticator (approval lasts ~24 h).
  No CN VPN needed; it's on the public internet.
- **The cloud container can't reach it:** the environment's network policy blocks
  `cats.cn.ca` (proxy CONNECT 403). The owner could allow the domain in the
  environment's network settings, but MFA needs a human anyway, so the probe
  runs on the owner's own computer.
- `scripts/board-probe.js` is written and was tested against a local fake board
  page (it captures tables, a JSON fetch, and scrubs tokens). It opens a visible
  browser and **the owner signs in by hand**, so the script never handles
  credentials. The browser profile persists in `probe-out/profile` so the
  Authenticator approval carries over between runs. `probe-out/` is git-ignored.

## Next action: owner runs the probe, then shares `probe-out/summary.json`
On the owner's machine, in a clone of this branch:
```
npm install
npm install --no-save playwright && npx playwright install chromium
node scripts/board-probe.js
```
Sign in, open the spareboard page, press Enter in the terminal. Share
**only** `probe-out/summary.json` (structure, no names). `board.html`,
`board.png` and `responses/` contain coworkers' names and stay local.

To measure session lifetime: run it again a few hours later and again the next day.
`startedOnLoginPage: false` means the saved session still worked.

Then fill in "Phase 0 findings" and make the go/no-go call with the owner.
Still open: **risk sign-off** before any *scheduled* scraping (PLAN → Risks).
Automating a login that has MFA every 24 h means a human re-approves daily,
or we keep a long-lived session alive. Raise that trade-off with the owner.

## Phase 0 findings
_(empty. Fill in: auth type, HTML vs JSON endpoint, board structure, session
lifetime, any ToS/robots/rate-limit language, go/no-go.)_

## Ground rules for whoever picks this up
- Never commit credentials, raw captures with coworkers' names, or `probe-out/`.
- No polling or scheduled scraping until Phase 0 is a "go" and the owner has
  signed off on the risk.
- Match repo style: CommonJS, small `lib/` modules, comments explain *why*.
- Tests: use built-in `node --test`. Don't add a test framework dependency.
- Develop on the branch above; don't open a PR unless the owner asks.
