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
