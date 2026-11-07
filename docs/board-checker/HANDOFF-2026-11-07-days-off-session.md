# Handoff from the days-off / PL / spares session (2026-11-05 → 11-07)

Claude session: claude.ai session_01AP9cZuN9352AvkVm7uMr1Z.
Branch `claude/vigilant-planck-zawrj4`, last commit of this session
`e77e9ba`. 277 tests, all pass (`npm ci`, then `npm test`).

**For the chat reading this:** fold what's below into `HANDOFF.md` (the
"What it does now", "Rules settled", "Waiting on the owner" and "Latest"
sections), then delete this file. Some of it is already in HANDOFF.md as
short notes under "Latest" (2026-11-05). This file has the full picture.

Another session (session_01AP9cZud7gx8TSqRyscer6F: resets, 18.6(b) forms,
Notifications tab, crews in town) worked on the same branch at the same time.
The owner said that was fine. Always `git pull` before a change.

**Laptop:** the owner had pulled up to at least `d8f105b` (2026-11-05). The
last change from this session (`e77e9ba`, ordered trains) needs another
`git pull` + restart. Ask him to check `git log --oneline -1`.

---

## What this session built

### 1. Upcoming days off (CATS Train Service 3 → 4)

- **Reading:** option 4, nothing typed, F8 through the pages
  (`scripts/board-auto.js`, label `daysOff`). Screen PSTS02M "UPCOMING DAYS
  OFF": MO/DY-TIME, DDSD, LEAVE-TYPE, STAT, NAME, ASSIGNMENT
  (`U-45SAS1S102ET` = type U, district 45SA, pool S1, turn S102, craft ET;
  `A-45SAYSBY03YA` = yard job YSBY03, YA). Parser: `lib/board/screens.js`
  `parseDaysOff`. Masking allows the date (`11/06-0001`) and the assignment
  (`lib/board/capture.js`). Names masked like every screen.
- **Rule (owner):** each line is a PL of **24 h from the time shown**.
- **Memory:** a line can drop off the "upcoming" list once it starts, so every
  line seen is kept until it ends: `BoardChecker\days-off.json`
  (`lib/board/daysoff.js` load/save/merge). It's passed in each summary as
  `daysOffKnown`.
- **Rows:** each pool / spareboard row gets `off: [{ from, until }]` for its
  turn and craft side (`daysoff.js` attach). A **trainee (ET / TT) line
  affects nothing** (owner: "their jobs never go spare … they do not need to
  be replaced"). It's listed but never put on a row.
- **Status text (owner's wording):** `PL @ 6th 0001 · goes spare`, plus
  `until 7th 0001` once it has started (`lib/board/view.js` gangStatus).
- **Current tab "Days off" section:** just **From** and **Turn** (craft chip,
  "off now"). The owner had Until / Type / pool / trainee notes taken out.
  Screen chip "Days off 4".

### 2. PL rules (owner) — `daysoff.js` `plFor` / `offAt` / `maybeOff`

Measured from **going on duty** (call + 2 h) to the start of the PL:
- Already on at the call → off.
- **Yard job** (8 h; YSBY 12 h) that runs into the PL → that spare is passed
  over. Example: B119, yard 1600 (call 1400), PL 2200 → B105.
- **Road job**, PL **24 h or less** after on duty → the turn **takes its train
  and goes spare, 100%** (every pool, Chain Gang and SD too; owner: "this is
  wrong, it will go spare" about skipping). A spare is passed over.
- **Road job**, PL **24–36 h** after → the turn keeps it, but the person who'd
  take it if it went spare is warned once (kind `mayCall`):
  "B119: you may be called for … SR10 has a PL @ 7th 1600 (30 h after going
  on duty), so its conductor job may go spare." A spare with a 24–36 h PL
  keeps the job and the next spare is warned.
- Only the reset "what if" run (reset-alerts) skips a PL turn, like `**`.

### 3. Spares told from the order, not only option 5

- Owner: "sometimes these don't show and people get surprise calls."
  Every job the **order** has going spare lines up the spare expected to
  cover it right away (`lib/board/spares.js` `expectedJobs` / `spareJobs`;
  `alerts.js`). This covers any reason: PL, rest, hold, `**`, B0, MU, and
  **no turn free** ("No Chain Gang conductor is free, so the conductor job
  is going spare: expect a call.").
- Text: "B126 lined up: Z14891 05 planned for 6th 0545, expected call 6th
  0330. SA09 has a PL @ 6th 0001, so its conductor job is going spare: expect
  a call."
- Spares go in call order, each used once. When option 5 lists the job later,
  it's the same train name (`trainDay`, e.g. "L50231 06"), so **no second
  alert**. 501/502 jobs from option 5 get the line-up's day too, so they're
  not counted twice.
- The engine gives the reason per craft: `spareWhy` / `engineerSpareWhy`
  ("has a PL @ …", "is marked **", "is on rest until …").

### 4. Alert wording (owner)

- Turn going spare: **"The turn goes spare (PL @ 6th 0001)."** The reason is
  in brackets; "(spareboard covers)" was dropped. The cards say the same.
- 501/502: "S501 conductor …" / "S501 engineer …", never "S501-CO".

### 5. 501/502

- **L502 alerts held** until the 501/502 crew is back **off duty in Sarnia**
  (out on a 502, at Garnet or bringing L501 home → no L502 alerts; engine
  `s5Away`). They still get their L501 home.
- "When do I go" cards say "goes spare" with the reason, per craft.
- **Conductor and engineer apart:**
  - Alerts are separate and labelled.
  - A phone on plain "S501" (from before the craft question) gets each
    craft's alert once, and the page asks it once: Conductor / Engineer /
    Both, apart (`board.html` `Alerts.replace`).
  - Tracking on the page is per craft: the 501/502 row, "CO S501" in a crew,
    and the 1st / 2nd S501 in "S501 + S501" (board.html `marked(turn, craft)`,
    `markTurn`). The tracking card uses S501-CO's facts.
  - whengo.json has `S501-CO` / `S501-EN` lines (site.js).
- The Garnet line-up line under the 501/502 board was taken out (its own
  Garnet section shows it).

### 6. Reset alerts (built by the other session; two fixes here)

`lib/board/reset-alerts.js` `resetEvents`, owner: "fix both":
- Worked through **in call order**: a likely reset is kept for the jobs after
  it, so each spare is told about **one** job (it was B130 three times).
- The person it lands on is **checked for their own reset**. If they'd be
  reset too, it moves down the board: "B130 would be next, but needs a reset
  by 7th 0800 too. If so, B126 is next for it."
- Heads-ups (35–48 h) are worked out on top of the likely resets, not kept.
- No spare left → no reset alert (the separate Chain Gang "may be called" is
  not reset-aware; offered to the owner, not asked for yet).

### 7. Spareboards show each spare's job (owner)

On the four spareboards, a line under the turn, across the row:
"→ L50231 06 (S501's job) · call ~6th 0145". It comes from option 5 and the
order (`spareJobs`), the same list as the alerts. It's on its own row
(`tr.jobrow`) because beside the turn it pushed Status off a phone screen.

### 8. Name matching (bug found from the owner's CATS photos)

`screens.js` `nameKey` is now **SURNAME/I/FIR**: the first 3 letters of the
first name too.
- SD01's holder (WILSON D DONAL…) was matched to yard job YEBS04's S1
  (WILSON D DYLAN).
- SD02's holder (RITZER M MATHE…) was matched to YPRS02's S1 (RITZER M
  MARCUS).

CATS cuts first names to 4–5 letters on the boards and shows them in full on
the Call Board, so 3 letters match on every screen. `turn-holders.json`
relearns under the new keys (people away or working match again once seen at
home).

### 9. Ordered trains go by CATS's pool (owner, 2026-11-07) — Rules settled

"Ordered trains should move the notification to the next person who would go
since sometimes their planned trains don't always go when they say."
- A line-up train that's **ORD** uses the pool CATS ordered it for (crew code),
  even against the sequence. It takes **that pool's** slot, so the B slots
  stay for the next trains. The "ordered for A but the sequence says B" flag
  stays (engine slot loop + prediction `byOrder`).
- Case: A42431 07 ORD for A as a 4th A of the road day (M39491 06 SA02,
  M30241 05 SA03, Z14891 06 SA04 on duty) → the next A turn + S1, not
  SB05 + S305. M38261 07 / E27861 07 become B #1 / #2.
- Before it's ordered, a planned train still goes by the sequence.

### 10. Small things

- Screen chips: "Garnet line-up 41" and "Road jobs" (was crewsInTown /
  "Crews in town") jump to their sections. A chip with nothing to show on that
  check is greyed out, not a link.
- `test/board/daysoff.test.js` holds most of this session's tests.

---

## Waiting on the owner / to check on real runs

- ❓ Days off 4 on real CATS: confirm no "skipped Upcoming days off 4" in the
  log. STAT (A/B) and the A/U/X types: the owner is "not sure"; shown nowhere,
  not used. Leave types other than OFF: "don't worry".
- ❓ First "expect a call" alerts to spares (B126, EN01, EN09 etc.) and the
  24–36 h PL warnings: check Page Health → latest alerts / the Notifications
  tab.
- ❓ After `e77e9ba`: the next ordered-out-of-sequence train should go to
  CATS's pool. Check the alert went to that pool's turn.
- **Offered, not answered:**
  - Tell a spare when the job they were told to expect goes away ("B126:
    Z14891 05 no longer goes spare").
  - The reset alert falling back to the next Chain Gang / SD turn when the
    spareboard runs out.
- `names.test.js` failed once and passed on re-runs (timing). Watch it.
