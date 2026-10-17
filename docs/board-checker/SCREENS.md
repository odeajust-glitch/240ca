# CATS screen guide

How to read CATS, as taught by the owner (a working crew member). This is
the source of truth for the screen map and parser in `lib/board/`. When the
owner explains something new about a screen, it goes here first, then into code.

Mechanics (from the Phase 0 probe; see HANDOFF "Phase 0 findings"):
- Each screen is drawn in frame `jacadaframe`. Every mainframe field is an
  absolutely-positioned element, so a row = fields sharing the same top offset,
  and a column = a left offset.
- Keys: PF keys are buttons `acc_F1`…`acc_F24`. Typed fields are inputs
  `txt_Sub0802501055_<n>`.
- Read the screen like a person: drive the page, never replay raw POSTs
  (`sequenceNumber` changes every screen).

## How we capture screens
Run `node scripts/board-probe.js`, sign in, step through CATS in the usual
order, then press Enter. `summary.json` → `screens[]` has, per screen: step
number, `cameFrom` (key pressed and masked text typed), and `screenGrid` (rows
as `top | left:text | …`, names and employee numbers masked; codes, times and
train/turn symbols kept). The owner adds what each screen means.

## The board-check route (owner, 2026-10-15)
Sign in → **3** (Train Service) → **6** Call Board → Enter, F8 to the yard jobs →
F3 → **23** (Chain Gang POS, CC `CO`) → F3 → **41** (47130, E, 24 h).
Screens 19/21 (A/B turns) aren't needed for "when do I go" and are optional.
Option **27** (owner): the SD (engineer) list that goes with the SR trains; the
auto route reads it with CC `EN`. Layout assumed to match 23 until recorded.
Screens 19/21 are assumed to share 23's layout (POOL/TERM/CC prompt, CC TURN T
POS … REST heading); the parser handles any pool. ❓ Confirm on the first run.

## Getting to the board
From the owner's recorded walkthrough (2026-10-14, probe `screens[]`). Meanings
still to be confirmed by the owner.

1. **CATS sign-on** (after Microsoft sign-in). Text boxes: `txt_Sub0802501055_21`
   = employee number; `txt_Sub1202501055_20` = **CATS password** (password box);
   `_22` = `D`, `_23` = `N` (default options, meaning ❓). Enter.
   ⚠ This is a **second credential** inside CATS. Automation must either keep
   the CATS session alive or store this password; the latter needs the owner's
   explicit OK.
2. **Main menu.** Three boxes: `_138` (`45`), `_139` (`SA` = Sarnia), `_140` =
   menu choice. Owner picks **3 = Train Service** and presses Enter.
3. **Train Service menu.** Owner picks **6 = Call Board** and presses Enter.
4. **Call Board prompt** (boxes prefilled `45` / `SA`). Owner just presses **Enter**.
5. **Call Board list: crews ON DUTY** (header TRAINS ON DUTY). Owner, 2026-10-14:
   this screen shows **only who is on duty**, not trains that are merely ordered.
   **Times are on-duty times, 24-hour clock**. Always parse and show times as 24 h.
   **Row kinds:** road trains have a **manifest number** like `A424 61 03`;
   **yard jobs** look like `PR0640`. **Trains always come before yard jobs.**
   **Stop paging (F8) at the first yard job**, i.e. once manifest numbers stop.
   ❓ Where are trains that are *ordered but not yet on duty*? (another screen) Owner presses **F8** to page down until
   they've seen every train currently working. This is the source for
   *"what's been ordered out of Sarnia"* (BOARD-CHECK step 1).
   Each train looks like: train symbol (`A99999`, e.g. Q14851), day (`99`), crew
   rows with a craft code (`CO` …), name (`NAME*+`, where ❓ `*` and `+` mean
   something), a 1-letter flag, a status word, a code like `A999`/`AA99`, and
   date `99/99/99` with time `9999` (ordered or on-duty time? ❓).
   Columns and the `*`/`+` marks: owner will explain once the probe shows the
   real (masked) layout.

`scripts/board-auto.js` follows this route by itself and recognises screens by:
main menu = `MILEAGE` (3 boxes: 45 / SA / selection); Train Service = `CHAIN GANG`
+ `LINE-UP`; Call Board prompt = `CALL BOARD` without `PAGE n OF n`; Call Board
list = `CALL BOARD` + `PAGE n OF n`; pool = `POOL:` + `TERM:` (CC is the last
box); line-up = `TRAIN LINE UP` (boxes station, dir, pool, hours).

Route for the tool: sign-on → `3` Enter → `6` Enter → Enter → F8 until the first yard job (`PR0640`-style) appears.

Note: the 2026-10-14 run's `screenGrid` was empty because CATS nests text inside
positioned boxes. Fixed: the probe now places every text node by its own box.

## Train Service menu (`45 SA 3`): what's on it
From the 2026-10-14 walkthrough (some words masked). Numbered options, read
with the owner's help to come:
- 005 TERMINAL LINEUP · **006 CALL BOARD** · 009–012 TRAIN SLOW … · 013–015 TRAIN FAST …
- 017/018 … S/B … · **019 A POOL – POS · 020 A POOL – TURN · 021 B POOL – POS ·
  022 B POOL – TURN · 023 CHAIN GANG – POS · 024 CHAIN GANG – TURN**
- 025/026 …MANIFEST… · 027/028 … POOL · 029–031 …PL… · 032/033 330 POOL
- 034–040 other pools · **041 TRAIN LINE-UP** (likely the *ordered* trains ❓)
- Keys: F1 help, F3 exit, F7 up, F8 down.

## Call Board (`45 SA 6`, then Enter): crews on duty
Header: `MM/DD/YY-HHMM CN … PAGE 001 OF 031`, `SARNIA`, `CALL BOARD`, program id
`CNP27N`, then `TRAINS`. Then one block per train:

```
46:A42431 | 109:14 | 154:ON DUTY AT: | 262:SARNIA | 451:MM/DD/YY | 532:0950
100:EN | 136:NAME*+ | 262:JE | 289:xxxxx | 388:S305
100:CO | 136:NAME*+(xxx)x | 289:xxxxx | 388:SB05
```
- **Train line:** manifest symbol, e.g. `A42431 14` = **train `A424`** +
  **routing `31`** + **origin day `14`** (owner, 2026-10-14). The origin day is
  the day the train *originated*, which is **not** necessarily the day a Sarnia
  crew went on it: bypass trains come from elsewhere (e.g. **302 from Winnipeg**
  always lags). **Never use the origin day for the day boundary; use the on-duty
  date column.** Then **ON DUTY AT** Sarnia/Toronto, on-duty date, **on-duty
  time (24 h)**. Identify a train by its number (A424) plus origin day, not routing.
- **Dates are `YY/MM/DD`** (e.g. `26/10/14` = 2026-10-14); the page header is
  `YY/MM/DD-HHMM`. Section heading: `TRAINS ENROUTE`. (Confirmed from the owner's
  screenshot, 2026-10-14.)
- **Crew line layout** (owner's screenshot, names omitted here):
  `craft | SURNAME + qualification marks (*, +) | optional (NET) | initials | FIRST NAME | turn id`.
  So the word after the initials **is the first name**. The parser must treat
  everything between craft and turn id as the person's name and never store it
  in fixtures. `(NET)` = **no engineer trainee** (qualified engineer too new to take a trainee; owner). Ignore it.
- **Crew lines:** craft `EN` engineer, `CO` conductor, `ET` (engineer trainee ❓);
  yard jobs use `FO` (foreman) and `S1` (helper ❓). Name with `*`/`+` marks
  = **qualifications** (belt pack / engineer qualified; owner). These are for crew
  callers, so the board check ignores them,
  sometimes a `(…)` code ❓, initials ❓, another word ❓, then the **turn id**.
- **Turn ids seen:** conductors **SA01–SA04** (A pool), **SB03–SB06** (B pool),
  **SR14** (Chain Gang), **MU01** = **make-up turn** (e.g. a short-turn rescue
  off the spareboard; owner). Engineers **S1nn** pair with **SA**, **S3nn** with
  **SB**, **SDnn** with **SR**, and **S502** is S5 (on L50231).
- **Yard jobs start** with a block like `XXXX99 0800 … S1/S1 ON DUTY AT: SARNIA`.
  That's where paging stops (page 3 of 31 on 2026-10-14).

First reading (2026-10-14; on-duty dates were masked, so not certain all are today. M30241's `12` is just its origin day, since 302 comes from Winnipeg):
on duty **at Sarnia**, in time order: L50231 0545 (S5, excluded) · Z14891 0735
**SA02** · M30241 0845 **SA03** · X38261 0945 **SA04** · A42431 0950 **SB05** ·
X39291 1300 **SB06**, i.e. **3 A then 2 B, matching the rule**. At Toronto (crews
heading home): E27531 SA01, M39731 SB03, SQ13931 SB04, Z14931 **SR14** 1645.

## Chain Gang position (`45 SA 23`) (walkthrough 2026-10-14)
Prompt boxes: **POOL `SR`**, **TERM `0`** (`0`=home/Sarnia, `1-9`=away), **CC**
(craft). The owner typed **`CO`** in CC to show conductors only (otherwise each
turn shows EN / CO / B1 rows). F8 pages, F10 switches terminal.
Columns: `CC | TURN | T | POS | EMPLOYEE NAME | ST | RN | (time) | (day) | SC | REST (time) (day) | TURN …`
Home (T=0) order seen, conductors:
| POS | Turn | Notes |
|---|---|---|
| 001 | SR01 | |
| 002 | SR07 | |
| 003 | SR08 | |
| 004 | SR02 | **REST until 0100 / 15th** |
| 005 | SR05 | ST `**` RN `HT` 0559 / 16th; rest 0120 / 15th |
| 006 | SR06 | |
| 007 | SR04 | ST `**` RN `**` 1026 |
| 008 | SR09 | ST `**` RN `**` 1600 / 14th |
| (T=1, away) 001 | SR12 | rest 1949 / 14th |
`B0`: at **POS 999 with a train** beside it = out working its own turn's train; at a **normal position with no train** = working another job → the turn goes spare if called (owner, confirmed). `HT` = **hold turn** (acts like rest); `**` = turn **goes spare** if called (owner). The heading after RN is **RETN** = return time (owner): `**` still goes spare after it. ❓ Still: what do ST/RN/SC stand for? Which
turn is yours? Missing turns (SR03, SR10, SR11, SR13, SR14) are out working.

## Train Line-up (`45 SA 41`): "TRAIN LINE UP FIELD INQUIRY" (program PSTS02H)
Prompt: **STATION `47130`** (Sarnia), **DIR `E`**, POOL blank, **HOURS IN FUTURE `24`**
(default 16). Ends with `END OF FILE`. **No names on this screen** (owner's
screenshot 2026-10-14), so the probe shows it unmasked.

Columns: `TRN ORDER MMDD-HRMN` | `Z` (direction) | **`STA`** | `TRAIN/ASGN` +
origin day | `ORSTN` (origin station) | `INFORMATION` | `ENG CRW` | `TRN CRW`.
- **`STA`: `ORD` = ordered, `PLN` = planned.** Planned times are **estimates**.
- **TRN ORDER** = ordering time `MMDD-HHMM`, 24 h (on duty = order − prep).
- INFORMATION: `TOPC`, then a route/destination code (`200MAC`, `300MAC`,
  `400MAC` → MacMillan Yard, Toronto; `100BIT`; `500GAR` for L502), `A`/`B`
  (deadheads `B`), `EnCo`. Deadheads show `SD DT A1 B`.
- **ENG CRW / TRN CRW = the pool CATS *plans* to use:** `45SAS10`/`45SASA0`
  (S1 / SA, i.e. **A pool**) on every planned train, even ones that will go B or
  Chain Gang by the 3/2 rule. That looks like a default, not the real
  assignment. Deadheads plan `45SASD0`/`45SASR0` (**SD/SR, Chain Gang**). L502
  plans `45SAS50` (S5).

2026-10-14 16:17 line-up (all `E`, origin station 47130):
```
1014-2330 ORD DHT141B 14  SD DT A1 B   SASD0/SASR0
1015-0015 PLN E27861  14  200MAC A     SAS10/SASA0
1015-0033 PLN M39671  13  300MAC A
1015-0230 ORD DHT211B 05  SD DT A1 B   SASD0/SASR0
1015-0400 PLN L50231  15  500GAR A     SAS50/SAS50
1015-0545 PLN Z14891  14  100BIT A
1015-0705 PLN M30241  13  300MAC A
1015-0935 PLN M39491  14  300MAC A
1015-0956 PLN X30241  13  300MAC A
1015-1100 PLN A42431  15  400MAC A
1015-1310 PLN E27861  15  200MAC A
1015-1415 PLN M39291  14  300MAC A
1015-1500 PLN M38261  15  300MAC A
```

## Board screen: _(name as shown on screen)_

Header / prompt line seen: `(9=AAAA, 9-9=AAAA, A=AAAA)` _(owner: what are the
options?)_

### Columns, left to right
Positions (x, px) to be filled in from the masked `screenGrid` of the next probe run.

| # | Heading on screen | Example (masked) | Meaning | x |
|---|---|---|---|---|
| 1 | | `AA99` | | |
| 2 | | `9` | | |
| 3 | | `999` | | |
| 4 | EMPLOYEE NAME? | `NAME+` | Crew member's name. What does `+` mean? | |
| 5 | | `A` | | |
| 6 | | `AAAA` (e.g. REST) | | |
| 7 | | `A9` | | |
| 8 | | `AA` (e.g. CO) | | |
| 9 | | `AA` | | |

### Codes
| Column | Code | Meaning |
|---|---|---|
| | REST | |
| | CO | |

### Paging
_(Owner: does the board run onto more than one page? Which key moves to the next
or previous page? "PREV" appears on screen.)_

## Other boards
_(Fast vs Slow spareboard, pools, availability lists. Is each one a separate
screen, or the same screen with a different selection?)_

## Reading a call / runaround
_(Owner: when someone is called, what changes on the screen? How would you spot
a runaround by looking at the board?)_

## Option 28: crews in the bunkhouse (owner, 2026-10-17)

`3` → `28` (POOL MAINTENANCE INQUIRY, PSTS02E). Don't fill CC. Read the page,
**F8** for the next; once a page has no crew, stop and **F3** back.

```
45 SA                    POOL MAINTENANCE INQUIRY               PSTS02E
   POOL: ( S1 )   TERM: ( 1 ) (0=HOME, 1-5=AWAY, T=TURN)   CC: (  )
CC TURN T POS  EMPLOYEE NAME   ST RN RETN  SC REST    USHR TURN INFO
EN S304 1 001  xxxxx                                       45/SA/S3-1
CO SB04 1 001  xxxxx                                       45/SA/SB-1
B1
EN SD11 1 002  xxxxx                          0754 17      45/SA/SD-1
CO SR05 1 002  xxxxx                          0754 17      45/SA/SR-1
B1
```
- Crews in the away-terminal (Toronto) bunkhouse, an EN + CO pair per POS.
- **POS = the order they come home** (first out).
- **REST = always 8 h after they went off duty** (owner corrected 10 h → 8 h,
  2026-10-17), so off duty = REST − 8 h.
  With the train's on-duty time from the Call Board, that gives the total
  time on duty for the trip. No REST shown = already rested.
- **B1** (brakeman) lines: the position no longer exists in Sarnia; ignore.
- The POOL box at the top (S1) is the *terminal* pool, not the S1 engineer
  pool; ignore it on this page.
- Second new check: not described yet.

## Option 41 for Mac yard: trains home from the bunkhouse (owner, 2026-10-17)

Same Train Line-up screen as Sarnia's 41 (TRAIN LINE UP FIELD INQUIRY,
PSTS02H), filled in as **STATION 41975 (Mac yard, Toronto), DIR W, POOL S1,
HOURS 24**. Same columns: `MMDD-HRMN Z STA TRAIN/ASGN ORSTN INFORMATION
ENG CRW TRN CRW`, ends with END OF FILE.

```
1017-1045 E PLN M30131 17 41975 TOPC 300SAR  A EnCo  45SAS11 45SAS11
1017-1430 E PLN Q13931 17 42368 TOPC 100SAR  A EnCo  45SAS11 45SAS11
1017-1645 E PLN Z14931 17 42368 TOPC 149     A EnCo  45SAS11 45SAS11
...
```
- The trains crews in the Mac bunkhouse (option 28) will take home.
- **Crews are paired with these trains in their option-28 POS order**: the
  first crew home gets the first train, and so on.
- **Type S1 in the POOL box** (owner).
- ORSTN = origin station; rows with other ORSTN (42368, 42397) are taken in
  order like the rest (owner): **all** these trains, in order.
- What to look for and show: owner will say.
- **Flags (owner, 2026-10-17)**, on the Order summary: a Mac yard train that
  drops off this line-up and never shows up on the Call Board (option 6):
  - no crews available in the bunkhouse at the time → **"Non-Sarnia Crew"**,
    train ID in **red**;
  - crews were available → **"Possible Non-Sarnia Crew or Train Cancelled"**,
    train ID in **yellow**.
