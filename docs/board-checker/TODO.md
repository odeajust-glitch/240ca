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

