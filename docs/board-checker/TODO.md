# Board checker: running list of changes to make

Owner's list (Justin, started 2026-10-26). Add new asks at the bottom of
"To do", move them to "Done" with the date when finished. Newest notes last.

## To do

1. **Possible-runaround log (#5).** A page listing trains that went to a
   different pool or turn than the sequence said (engine `flags`, rule
   'pool'), each linked to its snapshot. Owner wants to add to the idea
   before it's built.
2. **Turn History redesign, step 2.** Step 1 ("Work history" first) is done;
   owner said more changes may follow.
3. **Calendar export (#3)** (not picked on 2026-10-22, still on the list).
4. **Article 18.6(b) rep alert (#4)** (not picked on 2026-10-22, still on
   the list).
5. **Weekly summary (#9)** (not picked on 2026-10-22, still on the list).
6. **Analytics: anything more?** The owner's picks are built (see "Done");
   say what to change once it has run on real checks for a while.

Not wanted (owner, 2026-10-26): a pay period view (A6) and hours on duty
per week per person (A7).

## Done

- 2026-10-26: **Analytics tab**, first version. Search a train number
  (`148` = every x148xx xx: M14831 26, Q14821 03, …; `M148` = only M148s;
  `M14831 26` = that train), a turn (`SR03`, `S501-CO`) or a name code
  (`JUOD`, never kept in the address bar). Shows how many ran, usual on-duty
  times, days of the week, time on duty to Toronto, time held in Toronto
  (14 h+ counted), plan/order accuracy, prediction accuracy, the crews and
  pools that took it (or, for a turn/person, the trains worked most and who
  they worked with), and every run (tap one for its Order summary story).
  With nothing searched: all line-up trains. Code: `public/board-analytics.js`
  (tests `test/board/analytics.test.js`), page `public/board.html`
  (`renderAnalytics`, `analyticsView`).
- 2026-10-26: **Analytics, the owner's picks** (A1–A5, A8–A13):
  - Dates for everything: last 7/14/30/90 days, last year, everything kept,
    or picked dates (A11).
  - Charts: on duty by hour of day and per week, for any search and for
    all trains (A1). Tap a column for its number; "Show as a table" under each.
  - Turn or person: average and shortest time between trains (A2); a turn
    also shows times it went spare and trains it took out of sequence.
  - With nothing searched, sections: **Trains** (least reliable trains (A8),
    never ran by train number with deadheads never called (A13)),
    **Turns side by side** by pool (A3), **Runarounds** (A4),
    **Jobs going spare** and who filled them (A5), **Predictions** day by
    day and how early the right crew was predicted (A9).
  - ⬇ Spreadsheet: any search (or all trains) as a CSV file (A10).
  - Keeps up to a year (A12): BoardChecker\analytics-archive.json, published
    as data/archive.json (only what's older than the site's first day).
    `BOARD_ARCHIVE_DAYS` changes the year. It starts filling from the first
    build with this code, so on day one it only has what the site already has.
- 2026-10-26: **Sleep tracker** (Analytics → Sleep, and on every turn and
  name code search). They go to sleep once the expected call is 8 h away;
  every move of the call after that is kept (another train counts too); the
  real call is on duty − 2 h. Within 30 min of the call they slept on green,
  within 1 h yellow, more red. "Short notice" = lined up under 8 h before.
  `lib/board/insights.js` sleepCheck (line-up crews, Mac yard crews, spare
  turns expected for jobs going spare; Call Board crews and fill-ins, yard
  crews) → data/analytics.json `sleep`, archived too.
- 2026-10-26: **All deadheads grouped as one ("DH")** in Analytics: lists,
  least reliable, never ran; search `DH` for all of them.
- 2026-10-26: **Fixed: Order summary and Article 18.6(b) stuck loading**
  after the Analytics update (code dropped by mistake, put back; a test now
  checks the page's functions are all there).
- 2026-10-26: **Fixed from the Fable review**: archive counted things twice
  when they ran over the site's first day (rests, goes spare, runarounds,
  spare jobs; now one identity each, older copy wins: archive v2,
  BoardAnalytics.joinOld); train list/CSV out of order with archived trains;
  a job going spare every morning counted once; a one-check sequence blip
  kept as a runaround; Turns side by side slow with a year of data (train
  index); "right since" now says when it's "at least" (right from the first
  sighting); predLog kept out of trains.json; Analytics never stays on
  "Loading…" if something fails.
- 2026-10-26: **Fable review suggestions F1–F7** (owner: all): never ran
  split into cancelled / non-Sarnia crew / possibly, flags list (F1);
  501/502 asks conductor or engineer, sleep kept apart as S501-CO/-EN (F2);
  spare jobs per day shows empty days (F3); phone: Turn column stays,
  two columns hidden (F4); spreadsheet times as 2026-10-20 05:00 (F5); held
  14 h+ per week chart (F6); archive one file per month, Analytics opens on
  the last 90 days so only those months load (F7).
- 2026-10-26: **Out-of-sequence tracker** (Analytics → Out of sequence,
  owner: "M38261 26 is ordered for A but the sequence says B … track the
  times it's showing wrong, then the actual crew"): every train shown out of
  sequence, each stretch of checks it showed wrong, the Call Board crew that
  went, and Runaround (still wrong at the end) or Fixed. Line-up "ordered
  for" mismatches are saved per check now (`sequenceAhead`, FORMAT 12).
- 2026-10-26: **Sleep: clearer wording and "taken off"** (owner): "Average
  gap between the call they slept on and the real call", averages when
  called earlier and later; a turn taken off the line-up after going to
  sleep ends that wait (counted on its own, not as a huge miss), and the
  next line-up starts a new one (option A).

