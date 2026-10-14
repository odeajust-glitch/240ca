# How the owner checks the board, and how the tool will

Taught by the owner on 2026-10-14. This is the spec for the board check: the
tool should reproduce exactly what the owner does by hand, then flag where
CATS disagrees. Rule cites are from `data/crew_calling_cty.pdf` (TCRC-CTY
Sarnia crew calling procedures, "Road Assignments", pp. 12–17).

## Scope
- **Road work out of Sarnia only.** Yard work is out of scope.
- **Sarnia line-ups only (owner, 2026-10-14).** Trains home from Toronto follow
  a different order, but the Toronto line-ups are reliable, so they're out of
  scope for now. The tool takes the Sarnia SR line-up as CATS shows it (returning
  crews already placed). It doesn't try to work out where arrivals should slot in.
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
   (owner, 2026-10-14). They're crewed by the **S5** turns (owner).
6. **No trains run to Niagara Falls, Port Robinson or Fort Erie** today, so
   that line of the manual doesn't apply (owner, 2026-10-14).
7. **Holes don't move the Chain Gang (owner, 2026-10-14).** If an SR turn shows
   **spare** (vacant) when its train comes up, that train goes to the
   **spareboard**, *not* to the next person on the Chain Gang. The turn still
   uses its place in the rotation, so **the Chain Gang order is unaffected**.
   For the tool, a vacant turn counts as a normal step in the rotation. If the
   next SR person was used instead of the spareboard, that's a flag.
7b. **Rest (owner, 2026-10-14):** this is *different* from a vacant turn.
   - **A/B turns** are never really on rest. But if an A/B crew is on a *reset*
     (which can show as rest), their turn **goes spare to the spareboard**. The
     train still counts as A/B, and the sequence is unchanged.
   - **Chain Gang (SR):** if the SR person due out is **on rest**, the train **goes to
     the next SR person**, and the rested person **keeps their position**. They're
     first in line again as soon as their rest is up.
   - So for the owner's position: people ahead of them who are on rest when a
     given SR train comes up **don't count** for that train. The tool needs each
     SR turn's rest-until time and compares it with each train's **call time**.
   - **Answered (owner, 2026-10-14): compare with the CALL time.** Nobody can be
     called while on rest. So an SR person is available for a train only if
     `restUntil <= callTime`, where `callTime = onDutyTime - callLead`.
     ❓ Call lead for Chain Gang turns: 2 h like the spareboard (manual p.3)?
     Edge case: short calls (min 1 h at home, manual p.1) shorten the lead for
     people who've asked for them. Ignore those until the owner says they matter.
   - Flags: an SR train given to someone *behind* a rested-up, available person
     is a possible runaround. A rested person losing their position is too.
7c. **Cancelled trains (owner, 2026-10-14):** if a train is cancelled, the crew
   that was on it **goes on the next train**, and the order is maintained. For
   the tool: **drop the cancelled train from the sequence**, so it doesn't use up
   an A/B/SR slot. The crew keeps their place (e.g. the 2nd A crew takes the next
   train, which becomes the 2nd A train). Flag it if a cancelled crew lost their
   place or the next train went to someone else.
7d. **Deadheads (owner, 2026-10-14):** a deadhead can be ordered **at any time of
   day**, even before the A/B trains are used up, and it **always takes the next
   Chain Gang turn** out of Sarnia. For the tool: deadheads **never count toward
   the 3 A / 2 B**. Each one is an SR step at its own time, slotted into the SR
   rotation in time order with the SR-bound trains.
7e. **A/B with no crew in Sarnia (owner, 2026-10-14):** the train **still counts
   as A/B**. That slot goes spare to the spareboard; it doesn't slide to the Chain
   Gang, so it doesn't move the owner up.
7f. **Destinations:** A, B and Chain Gang turns **only go to Toronto**. **S5**
   turns work L502/L501.
8. **Not in the A/B/SR count (owner, 2026-10-14):** **work trains** and **short
   turns** go to the **spareboard**. **330 and Via trains** don't appear at all.
   **L502/L501** is excluded (item 5).
9. **Craft:** owner is a **conductor**, so the CTY procedures apply
   (`data/crew_calling_cty.pdf`).

What the manual says (check against the owner's version):
| Rule | Manual says | Owner says | Status |
|---|---|---|---|
| A pool | first **3** unassigned trains **after 0459** daily, by **train ordering time**; Sarnia→Toronto; no deadheads to Toronto, work trains, plows, spreaders or short turns | first 3 | ✅ |
| B pool | "3 turns per day" heading; next **3** after A exhausted; same exclusions | next **2** | ✅ **Settled (owner, 2026-10-14): use 3 A and 2 B.** The counts only change by a vote at a union meeting, so treat 3/2 as fixed unless the owner says otherwise. Keep them as named config values, not literals in code. |
| Chain Gang (SR) | any unassigned train >100 mi one direction after A and B are used; **"NO SCOOP" at home terminal**; **first in, first out at home and away**; continuous rotation; all extras to Niagara Falls / Port Robinson / Fort Erie (**no such trains run now**, per owner); may run Via, A/B turns or 330 if the joint spareboard is exhausted | everything after A/B, plus all deadheads | ✅ (deadheads consistent: A/B "do not deadhead to Toronto") |
| SR missed call | not called again until next due out in rotation | — | |
| Train 330 (S4) | own pool, 3 crews, window time; not part of the A/B/SR count | 330 not seen. **L502/L501** is crewed by **S5** turns, outside A/B/SR | ✅ |
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

## Times
**Always 24-hour clock** (owner). The Call Board shows **on-duty** times; ordering
time = on-duty + prep (15 min for Sarnia thru freight).

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
   - the owner's turn skipped or moved;
   - **engineer/conductor turn mismatch** (owner, 2026-10-14): **S1↔SA, S3↔SB,
     SD↔SR**, and S5 engineer turns (e.g. S502) ↔ the matching S5 conductor turn
     (❓ what that turn id looks like). Any other pairing on a road train may be
     a crew-calling mistake.
     **First confirmed catch (2026-10-14):** L50231 had engineer **S502** with the
     conductor on **MU01**. The owner confirmed it's a **miscoding**: it should
     have been the matching S5 conductor turn. Keep this as a test case;
   - an **MU (make-up) turn on a road train** that should have gone to an A/B/SR
     turn. MU is legit for things like a short-turn rescue off the spareboard,
     but callers sometimes code a turn as MU by mistake.
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
Answered 2026-10-14: turn counts (3 A / 2 B, change only by union vote); day
boundary (after 0459 by ordering time, on-duty = ordering − 15 min prep); holes
(vacant SR turn → spareboard, SR order unchanged); rest (A/B on reset → spare;
SR on rest → next SR person, rested person keeps position); exclusions (work trains and
short turns → spareboard; 330/Via not seen; L502/L501 excluded); craft (conductor).

Still open:
0. ~~Rest cut-off~~ **Answered:** the call time (they can't be called while on rest).
   Still to confirm: is the Chain Gang call lead 2 h?
1. **Screens:** the owner will teach the order of CATS screens: what's been ordered
   out of Sarnia, then the A/B/SR turn lists. Capture it in SCREENS.md, step by step.
2. Does CATS show the **ordered time**, the **on-duty time**, or both?
3. ~~L502~~ **Answered:** S5 turns. A/B/SR go only to Toronto.
4. ~~A/B with no crew in Sarnia~~ **Answered:** still counts as A/B (goes spare).
5. What should a check report back, and how (e.g. phone alert only on change)?
