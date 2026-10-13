# Automatic Board Checker — Plan

Status: **planning** · Owner: odeajust · Branch: `claude/auto-board-checker-plan-hdk1n5`
Read [HANDOFF.md](../../HANDOFF.md) first — it holds current state and the next action.

## Goal

Give Division 240 members two things the app can't do today:

1. **Position / ETA** — "Where am I on the board and roughly when will I be called?"
   so a member can plan rest.
2. **Runaround / call-order audit** — detect when someone was called out of
   board order (a runaround / missed turn), and produce a claim-ready summary
   that cites the governing rule from the corpus already in this repo.

## What the rules say (from the corpus — verify page cites before shipping)

Source: `data/crew_calling_cty.pdf` (conductors/trainmen/yardhelpers) and
`data/crew_calling_manual.pdf` (locomotive engineers, 1.1 agreement).

| Rule | Detail | Cite |
|---|---|---|
| Two boards | **Fast** board mans yard + road ≤100 mi one direction; **Slow** board mans road >100 mi | CTY p.2, LE p.2 |
| Order | Joint spareboard is first-in, first-out; turn set by outer-switch time (road) / off-duty time (yard) | CTY p.2–3 |
| Called off slow board | Comes off both boards, goes to bottom of each as of outer-switch time | CTY p.2 |
| Missed call | First-out who misses a call is off both boards 12 h from call time (Art. 56 / LE Art. 54.12) | CTY p.2, LE p.2 |
| Rest | Spareboard may book 6–24 h rest after road, 2–14 h after yard; >16 h rest ⇒ held off both boards until expiry, then bottom (Add. 40E) | CTY p.2, LE p.4 |
| Company business / union | Holds Slow turn, removed from Fast until booking back on | CTY p.2 |
| Call lead time | Spareboard called 2 h before on-duty (road) / ordering time (yard) | CTY p.3 |
| Ties | Ordering is by **on-duty** time; identical on-duty times ⇒ employee's choice | CTY p.4 |
| Deadheading | 1st out deadheads, 2nd out works | CTY p.4 |
| Pools / availability lists | A/B pools, chain gang, 330 pool, road & yard availability lists (seniority order) have their own rules | CTY p.9–15 |

These become the **rule engine's** test fixtures: each rule gets a function and
a unit test built from a hand-written board scenario.

## Architecture

```
            ┌─────────────┐   snapshot    ┌──────────────┐
 board ───▶ │  collector  │ ───────────▶ │ snapshot store│ (/var/data on Render, JSON lines)
 source     └─────────────┘   every N min └──────┬───────┘
                                                 │ diff consecutive snapshots
                                          ┌──────▼───────┐
                                          │ event deriver │  "X left Fast board at 14:02 → called"
                                          └──────┬───────┘
                                   ┌─────────────┴─────────────┐
                            ┌──────▼──────┐             ┌──────▼──────┐
                            │ ETA model   │             │ rule engine │ → violations
                            └──────┬──────┘             └──────┬──────┘
                                   └──────────┬────────────────┘
                                       ┌──────▼──────┐
                                       │ UI / alerts │ public/board.html, optional push/SMS
                                       └─────────────┘
```

New code goes in `lib/board/` (CommonJS, matches the rest of `lib/`):

- `lib/board/collector.js` — fetch the board → normalized snapshot. Pluggable
  source so we're not locked to scraping: `scrape` (Phase 0 decides if viable),
  `paste` (member pastes board text), `screenshot` (OCR, later).
- `lib/board/schema.js` — snapshot shape:
  `{ takenAt, terminal, board: 'fast'|'slow'|'pool:A'|…, positions: [{ rank, empId?, name, status, turnTime, restUntil? }] }`
- `lib/board/diff.js` — consecutive snapshots → events (`called`, `booked_rest`,
  `missed_call`, `added`, `removed`). This is where most bugs will live; fixture-test it hard.
- `lib/board/rules.js` — the table above as pure functions over (snapshot, events) → violations.
- `lib/board/eta.js` — position + historical call rate for that board/time-of-day → ETA band
  (show a range, never a single time).
- Server routes in `server.js`: `GET /api/board/latest`, `GET /api/board/me?name=`,
  `GET /api/board/violations`, all behind a key like `STATS_KEY` until privacy is settled.

Reuse what exists: `lib/search.js` can pull the governing passage for each
violation so the claim summary carries a real page citation, same as `/api/ask`.

## Phases

### Phase 0 — Scrape feasibility spike (probe written; owner to run, see HANDOFF)
Answer one question: **can we reliably read the board automatically?**
1. Board is `https://cats.cn.com`: name + password + Microsoft Authenticator
   (~24 h), no VPN needed.
2. Probe runs on the owner's machine: the cloud container's network policy
   blocks the host, and MFA needs a person.
3. `scripts/board-probe.js` (Playwright): owner signs in by hand in a visible
   browser, the script saves raw HTML, a screenshot and JSON responses to the
   git-ignored `probe-out/`, plus a names-free `summary.json`. No loops, no polling.
4. Record in HANDOFF: auth type (form / SSO / MFA), whether data is in HTML or
   an XHR JSON endpoint, page structure, any rate-limit/ToS/robots language,
   session lifetime.
5. **Go / no-go.** No-go ⇒ fall back to the `paste` source (members paste the
   board text; still gives ETA and audit, just not automatic).

### Phase 1 — Parser + snapshot store
Parser for whatever Phase 0 captured (or pasted board text). Store snapshots as
JSON lines under `ANALYTICS_DIR`-style persistent dir (`BOARD_DIR`). Fixtures
from real captures (scrubbed of names) committed under `test/fixtures/board/`.
Add `node --test` (no new deps) — the repo has no tests yet.

### Phase 2 — Diff + rule engine (the audit)
Events from snapshot diffs; rules from the table above. Output: a violation
list with who, when, which rule, and the cited passage. Human review only —
the app **flags** possible runarounds, it never files claims.

### Phase 3 — Position / ETA
Per-board call-rate history → "you're 4th out on the Slow board; typical
time to call from 4th is 6–11 h." Needs ~2 weeks of snapshots to be useful.

### Phase 4 — UI + alerts
`public/board.html`: board view, "find me", violations list. Optional alerts
("you're 2nd out") — channel TBD (web push is free; SMS costs money).

### Phase 5 — Automation
Collector on a schedule (Render cron job or in-process interval), only if
Phase 0 said go. Polling interval conservative (≥10 min) and jittered.

## Risks / decisions the owner must make

- **Using a member's CN credentials in a scraper may breach CN IT / acceptable-use
  policy** and could expose that member to discipline. Get a clear-eyed call on
  this (and ideally local chairperson sign-off) before Phase 5. Phase 0 is a
  single manual read by the account owner, which is much lower risk.
- **Privacy:** the board lists coworkers' names and statuses. Keep endpoints
  key-gated, don't log names to analytics, scrub fixtures.
- **Credentials** never in the repo, never in chat; env vars / Render secrets only.
- **Accuracy:** diff-inferred "calls" can be wrong (manual board corrections,
  CATS lag). Every flagged runaround must show the before/after snapshots so a
  human can judge.
- Scope: start with **Sarnia Fast/Slow spareboards** only; pools and availability
  lists after the core works.
