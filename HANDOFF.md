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
- The docs don't give a URL for the board. The only system they name is
  **"CATS"**, the system the CMC (Crew Management Center) uses.

## Next action: Phase 0 scrape spike. BLOCKED on the owner for:
1. **The board URL**, or the name of the app/site members use to view the board.
2. **How you sign in:** plain username/password, CN SSO, MFA/phone prompt?
   Does it only work on CN's network/VPN?
3. **Where to run the test.** The cloud container can only reach the public
   internet (through a proxy). An intranet or VPN-only site means the probe
   runs on the owner's machine with `node scripts/board-probe.js`.
4. **Risk sign-off.** Using a member's login in an automated tool may break CN
   IT policy. The owner should decide this knowingly (see PLAN → Risks).
   Phase 0 is a single manual read by the account owner.

Once you have 1–3: write `scripts/board-probe.js` (Playwright; creds from env
vars `BOARD_USER`/`BOARD_PASS` only; save HTML + screenshot to git-ignored
`probe-out/`; add `probe-out/` to `.gitignore`). Run it once, then record the
findings below and make the go/no-go call with the owner.

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
