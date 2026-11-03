# Board checker: running list of changes to make

Owner's list (Justin, started 2026-10-26). Add new asks at the bottom of
"To do", move them to "Done" with the date when finished. Newest notes last.

## To do

1. **Runaround log: check it on real runs**, then decide on alerts (to the
   passed-over turn? the rep?), claim time limits and an evidence page.
2. **Turn History housekeeping** (owner, 2026-11-03: "we will get back to it
   later"). Was "redesign, step 2".
3. **Article 18.6(b) rep alert, as an email** (owner, 2026-11-03: skipped for
   now; when it's built, an email notification rather than a phone alert).
4. **My week for everyone:** the Sunday alert goes only to phones following
   JUOD for now; open it up if the owner likes it.
5. **Analytics: anything more?** The owner's picks are built (see "Done");
   say what to change once it has run on real checks for a while.

Not wanted (owner, 2026-10-26): a pay period view (A6) and hours on duty
per week per person (A7). Taken off (owner, 2026-11-03): calendar export.

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
- 2026-10-30: **Fixed: tracking still showed the old turn** after someone
  else took it (owner: "it should say I'm not found since there is a new
  person on SR03"). Now "Not found on a turn now", and that turn's alerts
  stop for them, until they're seen on a turn of their own again.
- 2026-10-30: **Fixed: two phones showing different boards.** One had the
  page open from earlier; a newer board only put an "Update" bar at the top.
  The Current tab now loads the newer board by itself, and checks as soon
  as the phone comes back to the page.
- 2026-10-30: **Removed the AI (Anthropic API) check** of each report: no
  more `AI CHECK` lines, no API key needed.
- 2026-10-31: **Fixed: EN03 got no alerts in Toronto** while working S301
  (the trip looked over once the train out left the Call Board). And an
  "ordered" no longer comes with a separate "time change" for the same train.
- 2026-10-31: **Calmer "lined up" alerts** (owner: option C). A change to
  another train waits one check (5 min) and is sent only if it's still
  there; a train already told about in the last 6 h isn't sent again
  (unless it's been ordered since). A reminder before the call comes once
  per train.
- 2026-10-31: **Watchdog closes Edge and starts fresh when stuck.** If
  reloading CATS doesn't get back to the main menu within 10 min, or a check
  fails again right after the reload, the watchdog closes the checker's Edge
  window and starts it again (what the owner was doing by hand).
- 2026-11-02: **Visitor count** (owner: option B). ⚙ Settings → Visitors:
  how many times the page was opened each day and on how many phones, last
  30 days, plus "Don't count this phone". Nothing about who.
- 2026-11-02: **Sign-in reminders instead of the automatic one.** No fresh
  Microsoft sign-in when you go on duty any more; your phone gets a reminder
  12 h and 2 h before the ~24 h sign-in runs out (press R or send "signin"
  to renew).
- 2026-11-02: **Health line, only for the owner**: under "Updated …", last
  check, Microsoft sign-in and when it runs out, watchdog restarts today,
  alerts sent/failed today, phones getting alerts, code version. Needs
  OWNER_EMAIL set on the Worker.
- 2026-11-02: **Laptop backup** to Cloudflare once a day after 03:00 (the
  checker's memory and each finished day of history; not passwords or crew
  names). How to restore: docs/board-checker/CLOUDFLARE.md. Also fixed: site
  updates were wiping the visitor counts.
- 2026-11-02: **Who gets alerts, and what was sent** (in the owner-only
  health line): how many phones, which turns and name codes they follow, and
  the latest 50 alerts with who they were for.
- 2026-11-02: **Visitor numbers only for the owner** (like the health line);
  everyone else's Settings has no Visitors section.
- 2026-11-02: **Owner key** for the health line and visitor numbers (the
  site stays open, no email login): OWNER_KEY on the Worker, opened once per
  device as …/#ownerkey=<key>.
- 2026-11-02: **CATS option 5 checked against the order.** Jobs Going Spare
  shows the corrected list (default) and "As CATS shows" with wrong turns
  marked; the spare CATS would call gets "CATS shows you to work … but that's
  the wrong turn"; every error kept in Analytics → CATS errors (with the
  crew that went). Open: also add jobs the order says go spare that option 5
  doesn't list (owner's choice a, not picked yet).
- 2026-11-02: **Page Health tab** (owner's key only) with the checker's
  health, who gets alerts and the alerts sent; the main screen keeps only the
  Microsoft sign-in countdown.
- 2026-11-02: **Down banner** for everyone when the board checker hasn't
  checked for 3 h+, and **tracked spares show both boards** (fast and slow)
  on one line.
- 2026-11-02: **Stale trains**: a train still planned 15 min+ past its call
  gets a "Past call … · not ordered" badge; Analytics → Stale trains keeps
  how long each sat (pausing when the plan moves later), how it ended and
  the crew; an optional phone alert for the crew lined up for it.
- 2026-11-02: **Runaround log** (Analytics → Runaround log), all boards: when
  a train goes, each job's crew against the order at the last check before;
  likely / possible / explained, with the snapshots. No alerts yet.
- 2026-11-03: **Housekeeping**: HANDOFF.md cut to the current state (the
  full old one kept as docs/board-checker/HANDOFF-ARCHIVE.md); Netlify
  publishing removed (the site is Cloudflare only); the Render relay kept
  (owner uses the RailroadTracker app).
- 2026-11-03: **My week**: Analytics → My week (each turn or name code
  followed on the phone, Sunday to Saturday: trips, time on duty, holds,
  rests, calls vs the one slept on, runarounds, stale trains, CATS errors),
  and a Sunday 9 AM alert with last week's summary, JUOD only for now.
- 2026-11-03: **Missing from option 5** tracked in Analytics → CATS errors:
  jobs the order says go spare that option 5 didn't list for 30 min or more,
  whether CATS listed them later, and the crew that went.
- 2026-11-03: **Phone alert to everyone when the checker is down 3 h+**, and
  "back" when it recovers, sent by the Worker (needs the VAPID_KEYS secret
  once; CLOUDFLARE.md).
