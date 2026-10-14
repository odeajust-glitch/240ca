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
- **Crew lines:** craft `EN` engineer, `CO` conductor, `ET` (engineer trainee ❓);
  yard jobs use `FO` (foreman) and `S1` (helper ❓). Name with `*`/`+` marks ❓,
  sometimes a `(…)` code ❓, initials ❓, another word ❓, then the **turn id**.
- **Turn ids seen:** conductors **SA01–SA04** (A pool), **SB03–SB06** (B pool),
  **SR14** (Chain Gang), **MU01** (❓); engineers **S1nn** (with SA crews),
  **S3nn** (with SB), **SD10** (with SR), **S502** (S5, on L50231).
- **Yard jobs start** with a block like `XXXX99 0800 … S1/S1 ON DUTY AT: SARNIA`.
  That's where paging stops (page 3 of 31 on 2026-10-14).

First reading (2026-10-14; on-duty dates were masked, so not certain all are today. M30241's `12` is just its origin day, since 302 comes from Winnipeg):
on duty **at Sarnia**, in time order: L50231 0545 (S5, excluded) · Z14891 0735
**SA02** · M30241 0845 **SA03** · X38261 0945 **SA04** · A42431 0950 **SB05** ·
X39291 1300 **SB06**, i.e. **3 A then 2 B, matching the rule**. At Toronto (crews
heading home): E27531 SA01, M39731 SB03, SQ13931 SB04, Z14931 **SR14** 1645.

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
