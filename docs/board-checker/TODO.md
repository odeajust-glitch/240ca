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
6. **Analytics tab, what goes in it next.** Owner to pick from the ideas
   below (first version done, see "Done").

### Analytics ideas (for the owner to pick)

- A1. Charts: on-duty times by hour of day for a search (e.g. when 148
  usually goes), and trains per week as a trend line.
- A2. Time between trains worked for a turn or person (on duty to the next
  on duty), average and shortest.
- A3. Turns side by side: trains and hours on duty per Chain Gang turn over
  a period (who's getting the work).
- A4. Runarounds per turn (ties in with item 1).
- A5. Spare stats: how often each turn went spare / B0 / rest; jobs going
  spare per day and who filled them.
- A6. Pay period view (2 weeks): trains, yard jobs and hours on duty per
  turn or person, to check against pay.
- A7. Hours on duty per week per person (rest and hours-of-service check).
- A8. Least reliable trains: train numbers ranked by how far the first plan
  was off from on duty.
- A9. Prediction accuracy over time, and how early the right crew was
  predicted.
- A10. Download any search as a spreadsheet (CSV).
- A11. Pick a date range (last 7 days, 30 days, custom).
- A12. Keep more than 30 days: Analytics only sees what the site keeps
  (`BOARD_SITE_DAYS`, 30 by default). A small long-term train archive would
  let it look back months.
- A13. Deadheads and cancellations by train number.

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
