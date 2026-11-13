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

## Added 2026-10-24 (owner): spareboards, jobs going spare, 501/502, Garnet
- **Call Board** now pages (F8) past the trains through the **yard jobs**
  until **CREWS IN TOWN POOL: S1/SA C+C RESTED/STATUS** (or the last page).
  Yard jobs start with Y. Owner's screenshot (page 5 of 31):
  `YPRS60  REL#2 TU/WE OFF  ON DUTY AT: SARNIA  26/10/23 2245`, then crew
  lines `FO  DESCHENES+  M  MATTHEW` with **no turn**. "CREWS IN TOWN" is a
  line of its own, then `POOL: S1/SA C+C  RESTED/STATUS`. Since 2026-11-03
  (TODO #10) the checker pages on to the last page through the crews in town
  (those pages labelled `crewsInTown`). Owner's screenshots (2026-11-03
  0910): the list is **pages 5–29 of 29**, every page starts with CREWS IN
  TOWN, then `POOL: <name>  RESTED/STATUS` per pool (S1/SA C+C, S3/SB C+C,
  CO "A"POOL, CO "B"POOL, DRAG POOL, SDM POOL, …) and rows
  `01 CO SA02 <name> ** RESTED **`, `03 CO SB05 <name> 26/11/03-1815`
  (rest until), `05 EN SD07 <name> **HT 1104 0635` (hold turn until
  11/04 0635, owner), `TT SB99 << OPEN TURN >>`, `<< NO CREWS IN TOWN >>`. A
  pool runs on to the next page without its heading. Pages 8–10 (owner's
  screenshots): pools 1ST MANIF, 2ND MANDIF, 3RD MANIFE, *330 ASGN,
  502/501 PL, WORKTRAIN; rows with no position and TT / ET = trainees
  (owner); `<< VACANCY >>` = holder off the turn, `<<TEMP VCNY>>` = holder
  working another job for now, `*** OFF ***` = day off (owner); yard jobs
  as `YARD : XSAS01 REL#1 TH/FR OFF  RESTED/STATUS` with crew lines of
  craft + name only (`TEMP FO …` = a temporary fill-in). Owner: "anything
  past the crews in town shows people on their actual home turns" (the
  yard jobs on duty above it may be someone filling in). screens.js
  parseCrewsInTown → summary `crewsInTown` [{ pool, crews: [{ pos, craft,
  turn, status rested/rest/hold/vacancy/tempVacancy/off/open/other, until,
  trainee, temp }] }]; parseCrewsInTownNames (unmasked, in memory) → name
  codes for the people sightings. On duty taken as
  **8 h**. To know whose turn is on a yard job, board-auto.js reads the yard
  jobs and every board (pools, spareboards, 29) unmasked **in memory**,
  matches surname + first initial, and saves only `yardCrew: [{ job, craft,
  turn }]`. The name → turn list lives only in the running window (carried
  between checks; a name on two turns is left unmatched).
  **Filling in** (owner): a spare person covering an absent person's job
  shows on the Call Board under *that job's* turn (e.g. SR03), so train crews
  are matched by name too; where the person's own turn (e.g. B138) differs,
  `backfill: [{ train, craft, job, turn }]` is saved and B138's history shows
  "working SR03", SR03's "worked by B138".
- **Spareboards** (`SPAREBOARD INQUIRY`, PSTS02D): conductor fast **3 → 13**,
  slow **3 → 9**; engineer fast **1 → 19**, slow **1 → 17**. F8 until
  `END OF SPAREBOARD`. Columns: name (never kept), TURN (B138), POS, ST, RN,
  RETN, REST (time + day), MTPD, USHR, PD, STT, #S, #O. Menu 1 is ENGINE
  SERVICE (DISTRICT 45 / SUB-DISTRICT SA / SELECTION, PSTS02): 017 ENG SLOW
  BOARD- PSTN, 019 ENG FAST BOARD- PSTN. All four boards (engineer and
  conductor, fast and slow) have a **time box in the top right** (owner,
  2026-10-26): the
  checker types the check's time less 10 min (check at 1800 → 1750), Enter,
  then reads the pages. The box is found as the text box furthest right in
  the top third of the screen. Owner's screenshots (ENG SLOW BOARD, 18:21):
  it's **VIEW TIME( ____ )** after the board name; with VIEW TIME 1811 the
  board listed 5 (EN01, EN10, EN07, EN04 REST 0716 27 in red, EN08 ** HT
  1456 27), empty it listed 3: a view time shows the board as it was then,
  including people who have left it since. Owner chose option A: each board
  is read as it opens (that's what predicts who fills a job), then again
  with the view time (Enter restarts the list, label `<board>-view`); the
  turns only in the second read "left the board in the last 10 min"
  (summary `leftBoard`), never predicted. The site shows each board once
  (owner, 2026-10-28): as it opens, plus those turns in their places with
  the view time beside them in yellow.
- **Jobs going spare**: **3 → 5**, Enter (TERMINAL LINEUP, PSTS27P,
  vacancies only Y). POS, CALL (MM/DD), TIME, TZ, STATUS, TRAIN/DESC,
  ORGSTN, PL, CC, ST (`* **`), RETN (MM/DD), DTTM, TURN (pool + turn:
  S1S103 → S103; yard: the job id), EMP (a name, never kept).
- **501/502**: **3 → 29** (POOL MAINTENANCE INQUIRY, PSTS02E, POOL S5 TERM 0),
  laid out like 23; turns include MU01. **Garnet**: **3 → 31** (502/501 PL @
  GARNET, POOL S5 TERM 1), same layout, ends `END OF POOL LISTING`.
- Masking keeps letter+digit codes (YPRS02) and the new headings (PLANNED,
  RETN…); names are still masked.

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

## Option 4: upcoming days off (owner, 2026-11-05)

Train Service 3 → 4. Nothing to type (the ASSIGNMENT TYPE box A/U/X is left
blank); F8 pages down. Title `UPCOMING DAYS OFF`, screen id PSTS02M.

```
MO/DY/TIME  DDSD  LEAVE-TYPE  STAT  NAME                    ASSIGNMENT
11/06-0001  45SA  OFF               ALDER*+    J  JONAS     U-45SAS1S102ET
11/06-0001  45SA  OFF         A     BIRCH*+    D  DARYL     A-45SAYSBY03YA
11/07-0500  45SA  OFF         A     CEDAR*+    PA PAUL      U-45SAS1S104ET
```

- MO/DY/TIME: when the days off start. **24 h from that time** (owner).
- ASSIGNMENT: type (A/U/X) - district (45SA) - pool + turn (S1 S102; a yard
  job keeps its id, YSBY03) - craft (ET, EN, CO, YA).
- STAT (A / B / blank) and the A/U/X types: meaning not known yet (owner
  "not sure"); shown as is, not used.
- Names are masked like every screen; only turn, craft and times are kept. (The names in the
  example above are made up.)
  Parser: `lib/board/screens.js` parseDaysOff; the rest in `lib/board/daysoff.js`.

## Assignment history for the yard (`45 SA 3` → `7`, YD): owner's photos, 2026-11-12

The same screen the checker reads hourly for trains coming home (ASSIGNMENT HISTORY,
PSTS17A; `POOL OR YD/LO` = S1 and S5 there). Owner typed **YD** in `POOL OR YD/LO`,
left `HOME/AWAY` and `ASSIGNMENT` ("for a specific job") blank, pressed Enter.
`START DATE` came back filled in by CATS (261111, at 09:11 on the 12th). Before
Enter the headings are the train ones (TRAIN ID, ODT-DATE/TIME, INT-TERMINAL, MILES,
DUTY, MISC); with YD they become:

```
X   ASSIGNMENT   ODT-DATE/TIME     DESCRIPTION                  O-T
[]  YEBS03       261111   0600     0600 EASTBD BP T/F
[]  YSTY01       261111   0630     0630 TOWER S/S JT60
[]  YPRS02       261111   0645     0645 PLANK M1/T1
[]  YSBY03       261111   0700     0700 YDM BLOCK 3             0400
[]  YBHS01       261111   0800     0800 BNKHSE S1/S1
[]  YFLS01       261111   0800     0800 FRT LD S4/SX
[]  YSBY06       261111   1430     1430 S/S TEMP YA
[]  YPRS30       261111   1445     1445 PLANK RD W1/T2
[]  YMPS31       261111   1500     1500 PULLER T/W OFF
[]  YINS30       261111   1530     1530 INDTRL SN/SN
[]  YBHS31       261111   1600     1600 BUNKHOUSE W3/T3
[]  YEBS30       261111   1600     1600 EASTBD BP S4/M4
[]  YFXS01       261111   1600     DAY XTRA FRT LD F/CW
[]  YSBY04       261111   1900     1900 YDM BLOCK 4             0400
[]  YPRS60       261111   2245     2245 PLANK F2/S2
[]  YBHS60       261111   2300     2300 BNKHSE F3/S5
VALID HOME AWAY CODES ==> 0 =HOME, 1=>5 =AWAY
ENTER=INQ/DISPLAY CREW INFO   PF1=HELP   PF3=EXIT   PF8=PAGEDN   PF11=PREV MENU
```

- One line a yard job a day, in on-duty order; sixteen fit a page (PF8 for more). No
  names on it. Rows are black and red in threes: banding, as on the train list.
- ASSIGNMENT: the job id. ODT-DATE/TIME: on duty, YYMMDD HHMM. DESCRIPTION: the job's
  own start time and name; an extra job (`YFXS01`) reads "DAY XTRA …" with no time.
- **O-T: overtime on top of the 8 hours, filled in when the crew ties up** (owner,
  2026-11-12: "Yes"). 0400 on the two 12-hour tower jobs (YSBY03, YSBY04), blank on the
  other fourteen. There is no DUTY column: off duty is not on this list the way it is for
  a train; it would be on duty + 8 h + O-T once O-T is in.
- **A blank O-T:** asked as an either/or (exactly 8 hours, or not tied up yet); his "yes"
  is taken as both: blank until the crew ties up, blank after it when there was no
  overtime. So the list alone cannot tell a ticket left open from overtime still being
  worked. Confirm with him before building on it.
- An X beside a line and Enter shows "crew info": not seen yet. On the Housekeeping list
  (TODO, item 11) at his word: a photo when he gets to it.
- **Built 13 Nov** (owner: "We wont need to assume yard off duty times building 3 - 7 YD read, we can also scrap
  info going back to Oct 26th"): `isYardHistory` / `parseYardHistory` (lib/board/screens.js) → `{ job, on, ot }`; the
  checker reads it hourly from three days back, and once from 261026 (scripts/board-auto.js). A blank O-T counts as
  no overtime once the run has left the Call Board (the ticket closed: owner, 2026-11-13, "untill we do the job will
  stay on the call board"). `parseAssignHistory` still only matches a train's line.


## Yardmaster seniority list (`45 SA 3` → `1`, list code 3G YA): owner's photos, 2026-11-13

Owner: "the order is 3 then 1 ... then enter 3g YA 45 SA ... you have to record the names
and their permanent job"; then "add this into the board check only 2 times a day, once the
first check after 0000 and once the first check after 1200". Train Service menu, option 1:
SENIORITY LIST INQUIRY (PSTS02F), empty at first. Typed: LIST CODE `3G` and `YA` (two
boxes), DIST `45`, SUB-DIST `SA`; EMP-NBR, OR NAME, FIRST TV DATE, SERVICE and TEMP ASGN(Y)
left empty. Enter. The title line then reads `YARDMSTRS (LN,HA,SA,OAKVL)`. Seven people a
page, two lines each; PF8 pages down ("PRESS PFKEY8 TO SCROLL", P004-1); the last page says
"END OF LIST" (E008-1). On 13 Nov: five pages, 34 people. **Names below are made up.**

```
LIST CODE: [3G][YA]          SENIORITY LIST INQUIRY                       PSTS02F
                             YARDMSTRS (LN,HA,SA,OAKVL)
EMP-NBR: [      ]  OR NAME: [                  ]       FIRST TV DATE: [      ]
          DIST: [45]  SUB-DIST: [SA]  SERVICE: [ ]  TEMP ASGN(Y): [ ]
RANK   DATE       EMPLOYEE NAME            DIST/SUB   AWARDED      MOVE TYPE   STATUS
                                                       CURRENT ASSIGNMENT
   30  930421  ALDER*+         TJ  TOMAS     45  SA   2610251200       B
                                           YSTY01YA   0630 TOWER S/S  JT60
   60  960713  BIRCH+          PG  PETER     45  SA   2610251200       B         OFF
                                           YSBY01YA   0700 YDM BLOCK 1
  140  150724  CEDAR*+         M   MILO      45  SA   2610251212
                                           EXYA01YA   TRAFFIC COORDINATORS SPARE
  295  231010  GUM*+           K   KURT      45  SA                              VACATION
  410  250925  IVY*+ (NET)     C   COLE      45  SA   2610251200       B
                                           XSAS01FO   REL#1 TH/FR OFF
ENTER=INQ/RESTART   PF1=HELP   PF3=EXIT   PF7=PAGEUP   PF8=PAGEDN   PF11=PREV MENU
PRESS PFKEY8 TO SCROLL                                                     P004-1
```

- RANK: the order on the list. Gaps (30, 40, 60, 140 …): the list covers London, Hamilton,
  Sarnia and Oakville and only 45 SA is shown, so the others' places are missing. The
  DATE column (YYMMDD) is not always in rank order (rank 180 is dated 2015, after 2017s).
- EMPLOYEE NAME: surname with CATS's marks (`*`, `+`, `(NET)`, `(NODP)`; not known what
  they mean), initials, first name. One had no initials shown.
- AWARDED: YYMMDDHHMM, when the current assignment was awarded (most 2610251200, the 25 Oct
  board change). MOVE TYPE: B, F or blank (not known). STATUS: OFF, VACATION or blank.
- Second line, CURRENT ASSIGNMENT: eight letters, job or pool + turn then craft, and its
  description: `YSTY01YA` / `YSBY01`–`06` + `YA` (the yardmaster jobs), `EXYA01YA` (TRAFFIC
  COORDINATORS SPARE: the yardmaster spare turn), `S1S102EN`, `SDSD01EN`, `EXEN08EN`
  (engineer spare), `SRSR10CO`, `SASA07CO`, `SBSB04CO`, yard `YMPS60FO`, `YBHS01S1`,
  relief `XSAS01FO` (REL#1). "OFF" after a relief job's days (TH/FR OFF) is the job's own
  description, not the status. Someone with no assignment (on vacation, off) has no
  second line.
- **TEMP ASGN(Y)** (owner, 2026-11-13: "there is a box that says temp assy(y) put Y in that slot then make the
  seinority list from that infomation"): the checker reads the list twice each time, the box empty (each person's
  permanent job) and then with **Y** (temporary assignments). The layout with Y is not seen yet: a temporary job is
  taken from a second assignment line under the person, or else from the one shown when it differs from the
  permanent one (lib/board/seniority.js `withTemp`). A photo of the screen with Y would settle it.
- **Built 13 Nov:** `isSeniorityList` / `parseSeniorityList` (lib/board/screens.js), read by
  scripts/board-auto.js on the first check after 0000 and after 1200 (Toronto), unmasked
  and in memory only, kept in `BoardChecker\yardmaster-seniority.json` (lib/board/seniority.js),
  never in history\, the backup or the site. Its `key` (SURNAME/I/FIR) is how the boards
  match people.
