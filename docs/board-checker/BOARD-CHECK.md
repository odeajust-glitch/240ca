# How the owner checks the board, and how the tool will

Taught by the owner on 2026-10-14. This is the spec for the board check: the
tool should reproduce exactly what the owner does by hand, then flag where
CATS disagrees. Rule cites are from `data/crew_calling_cty.pdf` (TCRC-CTY
Sarnia crew calling procedures, "Road Assignments", pp. 12–17).

## Scope
- **The tool's only job (owner, 2026-10-15): tell the owner when they go to work
  while they're waiting in Sarnia.** Nothing else: no flags, no checks on other
  crews, no Toronto order. The report shows only that answer; other trains'
  turns, flags and notes are internal working (`--details`), not something to
  raise with the owner. Don't ask questions that don't affect this answer.
- **Main goal (owner, 2026-10-15): predict when the owner goes to work.** The
  report leads with it. Exact Toronto return order matters less.
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
     called while on rest. The call goes **2 h before on-duty**, and:
     - **deadhead:** on-duty = order time (no prep), so **call = order − 2 h**;
     - **train:** on-duty = order − 15 min prep, so **call = order − 2 h 15 min**.
     The person is available only if their **rest ends before the call time**
     (`restUntil < callTime`). Owner's examples, order 1200:
     | Kind | On duty | Call | Rest until 1100 | Rest until 0959 | Rest until 0944 |
     |---|---|---|---|---|---|
     | Deadhead | 1200 | 1000 | skipped | **called** | called |
     | Train | 1145 | 0945 | skipped | skipped | **called** |
     **Rest ending exactly at the call time = available** (owner, 2026-10-17:
     "rest until 0000, so they are available at 0000"; this replaces the
     earlier "exactly equal = still on rest"). HT (hold turn) is unchanged:
     held up to and including the call time.
     Short calls (min 1 h at home) are ignored until the owner says they matter.
   - Flags: an SR train given to someone *behind* a rested-up, available person
     is a possible runaround. A rested person losing their position is too.
7b2. **Chain Gang status marks on screen 23 (owner, 2026-10-14):**
   - **`HT` = hold turn**: treated **the same as rest**. The turn keeps moving
     up the board but **isn't called** while held, so the train passes to the next
     SR person.
   - **`**`** beside a turn: if that turn comes up while marked `**`, it **goes
     spare**. The train goes to the **spareboard** (like a vacant turn), *not* to
     the next SR person, so the SR order isn't affected.
     **Answered (owner):** the turn **still goes out**. A spareboard employee works
     *that turn* (e.g. SR04) to Toronto, and the Call Board shows the turn id SR04
     with the spareboard person's name. So for the rotation, a `**` turn is
     **used exactly like a normal call**: it leaves the Sarnia list. The tool must
     identify crews by **turn id**, not by name.
     **Corrected (owner, 2026-10-15 evening):** the time beside `**` is the
     **RETN** column, when they're due to **return**. It does *not* end the `**`:
     while CATS still shows `**`, the turn **goes spare**, even after that time
     (report shows "goes spare, return <time>"). No day shown = today. (Earlier
     that day it was read as an "until" time; superseded.)
   So for each SR train, in position order: on rest / HT (until after call time)
   → skip to the next person; `**` → that turn uses the train and the spareboard
   covers; otherwise → that person gets it.
7b3. **Returning turns (owner, 2026-10-14):** a Chain Gang turn coming home
   goes to the **bottom of the Sarnia SR order by its outer switch time** (the
   time its inbound train passed the Sarnia outer switch). Several returning turns
   are ordered among themselves by outer switch time. Accuracy check: if CATS
   places a returning turn out of outer-switch order, flag it.
   (Outer switch time: not needed, out of scope.)
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
     SD↔SR**, and S5 turns: the owner believes they are **S501 and S502**. Likely
     the conductor and engineer share the same S5 turn id (e.g. both S502 on
     L502); ❓ confirm. Any other pairing on a road train may be
     a crew-calling mistake.
     **First confirmed catch (2026-10-14):** L50231 had engineer **S502** with the
     conductor on **MU01**. The owner confirmed it's a **miscoding**: it should
     have been the matching S5 conductor turn. Keep this as a test case.
     **MU exception (owner, 2026-10-14):** an **MU** turn can legitimately stand
     in on the **Chain Gang side (SR or SD)** when no SR/SD turn was available
     to send, e.g. E27121 (conductor SR03 + engineer MU02) was fine. **Never on
     A/B (SA, SB, S1, S3).** So MU paired with SR/SD → note only, no flag; MU on
     any A/B train → flag;
   - an **MU (make-up) turn on an A/B train**: always a flag. On a Chain Gang
     train, MU is allowed (no SR/SD turn was available). MU is also used for
     things like short-turn rescues off the spareboard. On S5/L502 it was a
     confirmed miscoding (L50231).
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
   Call lead confirmed: 2 h before on-duty (deadhead: order − 2 h; train: order − 2 h 15).
1. **Screens:** the owner will teach the order of CATS screens: what's been ordered
   out of Sarnia, then the A/B/SR turn lists. Capture it in SCREENS.md, step by step.
2. Does CATS show the **ordered time**, the **on-duty time**, or both?
3. ~~L502~~ **Answered:** S5 turns. A/B/SR go only to Toronto.
4. ~~A/B with no crew in Sarnia~~ **Answered:** still counts as A/B (goes spare).
5. What should a check report back, and how (e.g. phone alert only on change)?

## Worked example: 2026-10-14 16:17 line-up (owner agrees with the reading; outcome not yet verified)
Today's A/B already used: Z14891 13 SA02, M30241 12 SA03, X38261 13 SA04 (3 A),
A42431 14 SB05, X39291 13 SB06 (2 B); L50231 14 S5. Chain Gang home order at ~16:00:
SR01, SR07, SR08, SR02 (rest → 0100/15), SR05 (HT → 0559/16), SR06, SR04 (`**`),
SR09 (`**` 1600/14). Coming home, by outer switch: SR14 (Z14931), SR03 (owner,
E27121), SR12 (resting in Toronto → 1949).

| Order time | Train | STA | Expected | Reasoning |
|---|---|---|---|---|
| 14th 2330 | DHT141B | ORD | **SR01** | deadhead → next SR; SR01 is 1st, no rest |
| 15th 0015 | E27861 14 | PLN | **SR07** | before 0459, so still the 14th's day; A/B used → SR |
| 15th 0033 | M39671 13 | PLN | **SR08** | same day → SR |
| 15th 0230 | DHT211B | ORD | **SR06** | deadhead → SR. Called ~0030 (≈2 h before): SR02 still on rest to 0100 → skipped, keeps position; SR05 HT → skipped |
| 15th 0400 | L50231 15 | PLN | S5 | excluded |
| 15th 0545 | Z14891 14 | PLN | **A** (1st) | first train after 0459 |
| 15th 0705 | M30241 13 | PLN | **A** (2nd) | |
| 15th 0935 | M39491 14 | PLN | **A** (3rd) | |
| 15th 0956 | X30241 13 | PLN | **B** (1st) | |
| 15th 1100 | A42431 15 | PLN | **B** (2nd) | |
| 15th 1310 | E27861 15 | PLN | **SR02** | back to SR; SR02's rest is over and it kept its spot |
| 15th 1415 | M39291 14 | PLN | **SR04** (spare) | SR05 still HT → skipped; SR04 `**` → turn goes out with a spareboard employee |
| 15th 1500 | M38261 15 | PLN | **SR09** | if its `**` has lapsed; otherwise it goes spare the same way |
| next | — | | SR14, then **SR03 (owner)** | returning turns at the bottom by outer switch time; SR05 rejoins at the top once HT ends 0559/16 |

Note: CATS's planned crew column shows `SA` (A pool) for every planned train,
including ones the 3/2 rule sends to B or SR. Treat it as a default, not a prediction.

## Shadow check #1: 14th 16:17 prediction vs the 15th 01:43 board
| Prediction (14th) | What happened (15th 01:43) | Verdict |
|---|---|---|
| DHT141B (ORD 2330) → SR01 | SR01 now at Toronto (T=1), rest to 0929 | ✅ |
| E27861 14 (PLN 0015) → SR07 | Not run: gone from the line-up | plan changed |
| M39671 13 (PLN 0033) → SR08 | Went on duty **2330 on the 14th** with **SR07** | ✅ by the rules: with E27861 gone, M39671 was the next SR train |
| DHT211B (ORD 0230) → SR06 | On duty 0300 with **SR08** | ✅ by the rules: one SR train fewer ahead of it |
| (not in line-up) | **DHT211C** added, on duty 0300 with **SR06** | ✅ SR02 skipped (rest to 0100 = call 0100, still on rest); SR05 on HT |
| L50231 15 → S5 | On duty 0300, EN **S501** + CO **S501** | ✅ confirms S5 conductor and engineer share the turn id |
| SR03 (owner) behind SR14 by Toronto on-duty time | Owner home first: **POS 5**, rest to 1015 | ⚠ stand-in for outer switch time was wrong; SR14 (Z14931) still out |

Conclusion: no rule broke. Every difference came from the line-up changing
(a planned train dropped, a deadhead added, times moved). Also confirmed:
rest ending exactly at the call time = still on rest (superseded 2026-10-17: now available).
Gaps found and fixed: deadheads on the Call Board weren't parsed; turns out
working (POS 999, `B0` + train) were treated as at home; a snapshot after
midnight can't see the day's A/B trains (now inferred from CATS sending a
train to SR, and from the crew code on ORD rows, e.g. `45SASR0`); the Call
Board clock can be masked, so the probe time is the fallback.

## Shadow check #2: 15th 01:43 prediction vs the 15th 08:13 board
| Prediction (01:43) | What happened (08:13) | Verdict |
|---|---|---|
| M30241 (ORD 0400) → SR02 | On duty 0345 with SR02 | ✅ |
| M39491 → A | On duty 0615 with SA05 | ✅ |
| Z14891 → A | On duty 0945 with SA06 | ✅ |
| E27861 15 → B, X30241 → B, M38261 → SR | Line-up re-planned: E27861 moved to 1610, after M38261 (1600), so now X30241 → B, M38261 → B, E27861 → SR | plan changed (pending) |
First run with screens 19 (A) and 21 (B): same layout as 23, confirmed.
Answered (owner, confirmed 2026-10-15): `B0` on the position screens (19/21/23) means:
- **POS 999 + B0 + a train beside it** (e.g. SR07 · M39671 13): the crew is out working
  **its own turn's** train. Not in the queue.
- **B0 at a normal position with no train** (e.g. SR14 at POS 005): the person is working
  **another job**, so the turn **goes spare** if called (like `**`: the turn still goes
  out, worked by a spareboard employee).
SB02/SB04 "rest" times are **resets**, so an A/B turn on reset goes spare, as the tool does.

## Limits (owner, 2026-10-15)
- Train Line-up (41): **24 hours is the maximum**. Past it, "when you go" is given as
  "the Nth Chain Gang train after the line-up ends", with holds/rest that change N.
