# How the owner checks the board, and how the tool will

Taught by the owner on 2026-10-14. This is the spec for the board check: the
tool should reproduce exactly what the owner does by hand, then flag where
CATS disagrees. Rule cites are from `data/crew_calling_cty.pdf` (TCRC-CTY
Sarnia crew calling procedures, "Road Assignments", pp. 12–17).

## Scope
- **Road work out of Sarnia only.** Yard work is out of scope.
- The owner holds a **Chain Gang (SR pool)** turn. They are *not* on the spareboard.
- The spareboard matters only as the source of crews that backfill holes.

## The daily road sequence out of Sarnia (owner)
1. The first **3** unassigned trains go to **A turns** (SA pool).
2. The next **2** go to **B turns** (SB pool).
3. **Everything after that goes to the Chain Gang (SR)**, including **every
   deadhead ordered**.
4. **Holes** in any of these turns (the turn's owner off, booked rest, etc.) are
   backfilled by **spareboard** employees.
5. **Excluded: the L502 / L501 train.** Manifest numbers starting **`L502`** out
   of Sarnia (**`L501`** coming back from the away-from-home terminal) belong to
   neither A, B nor the Chain Gang. They are skipped when counting the sequence
   (owner, 2026-10-14). Who crews it is still to be asked: possibly the old 330 / S4 pool.
6. **No trains run to Niagara Falls, Port Robinson or Fort Erie** today, so
   that line of the manual doesn't apply (owner, 2026-10-14).

What the manual says (check against the owner's version):
| Rule | Manual says | Owner says | Status |
|---|---|---|---|
| A pool | first **3** unassigned trains **after 0459** daily, by **train ordering time**; Sarnia→Toronto; no deadheads to Toronto, work trains, plows, spreaders or short turns | first 3 | ✅ |
| B pool | "3 turns per day" heading; next **3** after A exhausted; same exclusions | next **2** | ✅ **Settled (owner, 2026-10-14): use 3 A and 2 B.** The counts only change by a vote at a union meeting, so treat 3/2 as fixed unless the owner says otherwise. Keep them as named config values, not literals in code. |
| Chain Gang (SR) | any unassigned train >100 mi one direction after A and B are used; **"NO SCOOP" at home terminal**; **first in, first out at home and away**; continuous rotation; all extras to Niagara Falls / Port Robinson / Fort Erie (**no such trains run now**, per owner); may run Via, A/B turns or 330 if the joint spareboard is exhausted | everything after A/B, plus all deadheads | ✅ (deadheads consistent: A/B "do not deadhead to Toronto") |
| SR missed call | not called again until next due out in rotation | — | |
| Train 330 (S4) | own pool, 3 crews, window time; not part of the A/B/SR count | **L502** (Sarnia) / **L501** (return) is excluded from A/B/SR | ❓ Is L502 today's equivalent of 330? Who crews it? |
| Relief (holes) in SA/SB/SR | 1st available on **Slow board** (2 h call) → junior available (Art. 49.5 a) → junior off 14 h (49.5 b) → bullpen → road availability list → canvass … | backfilled by spareboard | ✅ |

## Day boundary and prep time (owner, 2026-10-14)
- The road day starts with trains **ordered after 0459**, counted by **ordering time**
  (manual p.12; owner confirms).
- CATS often shows the **on-duty / call time**, which is the ordering time minus
  **prep time**. Sarnia thru freight prep is **15 min** (manual p.4: "PREP TIMES",
  Sarnia thru freight / ex shop 15 min; work trains and rescue/relief nil). So a
  job **ordered 0800 is called for 0745**, and the **first A turn can show on
  duty at 0445** (ordered 0500).
- Rule for the tool: **ordering time = on-duty time + prep time** for that train
  type. Allocate by ordering time with the cutoff at 0459. Never treat a 0445
  on-duty time as belonging to the previous day.
- Applies to both trains that are **ordered** (not yet on duty) and trains
  **already on duty**.

## The owner's check, step by step
1. **Establish what's been ordered out of Sarnia** (trains + deadheads, with
   ordering times) for the current day (from 0459?). This gives the order of trains.
2. **Allocate** that ordered list: first 3 → A, next 2 → B, the rest (plus deadheads) → SR.
3. **Find where the owner sits in the SR rotation** (first in, first out), i.e.
   how many SR-bound trains have to go before the owner's turn is up.
4. That gives "I'm N trains away" and, from ordering times, roughly when.

## What the tool will do (same steps, plus an accuracy check)
1. **Read two CATS screens** (names TBD by owner):
   - the **train line-up / orders** out of Sarnia: train id, ordering time,
     destination, whether it's a deadhead, extra, Via, 330, work train, etc.;
   - the **SR (Chain Gang) turn list**: turn order, who holds each turn, status.
   Plus A and B turn lists, and the spareboard for backfills.
2. **Compute the expected allocation** with the rules above (counts from config).
3. **Owner's position:** the number of SR-bound trains ahead of the owner's turn,
   and the ordering time of the train that should be theirs.
4. **Accuracy check:** compare expected vs what CATS actually did:
   - a train given to the wrong pool (e.g. a 4th train to A, or a deadhead to A/B);
   - an SR train given to someone out of rotation (a **runaround**);
   - a hole filled out of relief order (e.g. not the first available on the Slow board);
   - the owner's turn skipped or moved.
   Every flag shows the two snapshots it came from and the rule it relies on,
   for a human to judge. The tool flags; it never files a claim.

## How we prove it's accurate before trusting it
1. **Shadow mode.** Each time the owner does their normal board check, the tool
   runs on the same screens. The owner writes down their own answer
   ("I'm 3rd out, nothing wrong"), and the tool's answer is compared with it.
2. Fix every disagreement, either a parsing bug or a rule we got wrong. Each one
   becomes a test case (masked fixture + expected answer).
3. Trust it only after **~10–15 checks in a row agree**, including at least one
   day with a hole and one with a deadhead.
4. After that, automatic checks: snapshots every 10–15 min while the owner
   chooses, plus an alert when their position changes or a possible runaround
   is flagged.

## Open questions for the owner
1. ~~B turns: 2 or 3?~~ **Answered:** 3 A, 2 B. Only changes by a union-meeting vote.
2. ~~Day boundary~~ **Answered:** yes, after 0459 by ordering time. On-duty shows 15 min earlier (prep), so the first A can be on duty at 0445. Still to confirm: does CATS show the ordering time, the on-duty time, or both?
3. **Which CATS screens** do you look at for (a) what's been ordered out of
   Sarnia, and (b) the chain gang turn order? How do you get to each?
4. **Holes:** when a spareboard person fills a hole in an SR turn, does that turn
   keep its normal place in the rotation?
5. **What's excluded** from the count: L502 is (answered). Anything else? Via,
   work trains, short turns, trains under 100 mi? Who crews L502, and is it the
   old "330"?
6. **Craft:** you're working as a conductor (the CTY procedures), correct?
