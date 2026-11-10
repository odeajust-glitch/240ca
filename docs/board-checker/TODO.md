# Board checker: running list of changes to make

Owner's list (Justin, started 2026-10-26). Add new asks at the bottom of
"To do", move them to "Done" with the date when finished. Newest notes last.

## To do

- **Snapshots tab:** still the older layout after Current's was changed 2026-11-10; ask
  whether to switch it too.

- **Names for followers on Page Health:** three answers pending from the owner (capture
  names for everyone each check; OWNER_EMAIL deleted on `board`; layout). See HANDOFF.

### Housekeeping list (owner, 2026-11-10: "put those 2 items on a house keeping list")

Small decisions parked for a housekeeping pass; ask, don't build.

1. **Call timeline headline for early calls: DECIDED 2026-11-10, keep notice given**
   ("Called with 48 m notice" when under 8 h). Alternative was always how early.
2. **Call timeline, where notice starts:** from the turn first lined up for the train
   (now) or from when the train was ordered.


- **Call timeline, new layout**: on the regular page since 2026-11-10 (owner approved). Two
  headline choices still open in Housekeeping.

- **S5 line-up swaps crews right at the call** (found 2026-11-10; 5th, 8th, 9th Nov:
  the other crew shown for one or two checks, then the Call Board has the first). Call
  stability no longer believes it; Current and alerts still see it. Check after the
  laptop runs the 8th's engine fixes.
- **Call stability: same yard job again within 3 days is ignored** (`isDone` in
  insights.js; yard job ids carry no date). Found 2026-11-10, B116 YPRS30 7th → 9th.

1. **Runaround log: check it on real runs**, then decide on alerts (to the
   passed-over turn? the rep?), claim time limits and an evidence page.
2. **Turn History housekeeping** (owner, 2026-11-03: "we will get back to it
   later"). Was "redesign, step 2".
3. **Article 18.6(b) rep alert, as an email** (owner, 2026-11-03: skipped for
   now; when it's built, an email notification rather than a phone alert).
4. **My week for everyone:** the Sunday alert goes only to phones following
   JUOD for now; open it up if the owner likes it.
0. **Accounts: only approved people see the site** (owner, 2026-11-09).
   Built in the Worker, not deployed: [ACCOUNTS.md](ACCOUNTS.md). Left:
   Justin's test on `board-test`; paste into `board` unlocked; the "sign
   up to keep access" notice and the 401 → `/account` hop in `board.html`
   (Test tab first); then `LOCK=on` (RailroadTracker set aside by the
   owner, 2026-11-09). Also:
   `isOwner()` trusts the Access email header (see HANDOFF).
5. **Analytics: anything more?** The owner's picks are built (see "Done");
   say what to change once it has run on real checks for a while.

6. **Home turn: a better way to work it out** (owner, 2026-11-03: "expand
   how to determine home position … as more information and checks get
   added"; tabled for now). Today the name code's Home turn is just the
   latest board spot their name was seen on (Person search), so being
   displaced (To Place), filling in on another turn, or a name not read
   all look the same ("not seen"). Ideas when it's picked up: read a CATS
   screen that lists To Place / status codes (status letters are on the
   Reference tab), keep the last home turn while displaced, and say why
   they're off it. **Partly done 2026-11-03** via the crews in town (see
   "Done"): booked-off / vacancy / day off people now show on their home
   turn with why.

7. **Held-away time and penalty miles in Work history** (owner, 2026-11-03:
   later). Each trip home from Toronto: "Held 14:21 → 81.56 penalty miles"
   (off duty at Toronto → on duty home, the Reference tab's penalty table,
   public/board-ref.js penalty). An estimate to check a claim against.

8. **Rest / reset tracker: check it on real runs** (built 2026-11-03, see
   "Done"; reset alerts built too). Then maybe Person search / Analytics views, and the
   hours limits (60 h / 7 days, 192 h / 28 days; owner: "too hard to pass",
   not tracked for now). **Saved question (owner: "save your question …
   see if it gets answered once we do the rest tracker"):** DHT040B 31
   (31st 0900, call ~0700): B111 was first on the conductor slow board but
   B133 (fast board 001) went; owner: B111 "might have not had enough time
   to take a train or dead head, but had enough time for a yard shift".
   Look at B111's reset due time then: a reset needed before a road trip
   would end fits that. Also: the runaround log showed B111's fast-board
   spot (pos 004) instead of the slow board (fixed 2026-11-03).

12. **Pushover trial** (owner, 2026-11-04: "free for 30 days then 5 dollars
   per device … see if its more workable"). Set up per
   docs/board-checker/PUSHOVER.md; near the end of the 30 days compare
   Page Health's alert log: Checker (Pushover) vs Checker (ntfy) vs
   Checker (site alert), which arrived and after how many tries. Then buy
   it or remove the two .env lines. **Set up and tested 2026-11-04**
   (phone-test: ntfy and Pushover both sent): trial ends about 2026-12-04.

11. **Try the different AI API keys with the tester** (owner, 2026-11-03):
   ask several models the same agreement question he already knows the
   answer to and see which is most accurate. 2026-11-04: the owner chose to
   use his tester as built (option B, a separate Netlify site, the whole
   agreement given to every model) rather than build it into the Worker.
   Now in **tools/ca-model-compare/** with Agreement 4.16 + addendum book as
   agreement.txt; cards: Kimi (kimi-k2.6, thinking off), Claude Haiku,
   Sonnet, Opus 5.5 (owner's pick). Keys: MOONSHOT_API_KEY, ANTHROPIC_API_KEY
   (he's getting one at console.anthropic.com), TEST_PASSWORD, set by him in
   Netlify. Suggested later: a free Google Gemini key as another company.
   The container can't reach Netlify's upload host, so the owner imports
   it: Netlify → Add new project → Import an existing project → GitHub →
   odeajust-glitch/240ca; name `ca-model-compare`, branch
   claude/vigilant-planck-zawrj4, base directory tools/ca-model-compare,
   no build command, publish tools/ca-model-compare/public, functions
   tools/ca-model-compare/netlify/functions; variables MOONSHOT_API_KEY,
   ANTHROPIC_API_KEY, TEST_PASSWORD (he sets them). An empty project made
   first was renamed `ca-model-compare-empty` (can be deleted).
   ❓ Linked and keys in? Then his scored results.
   Result so far (owner, 2026-11-04): "I like opus answers" → Opus now
   answers his own questions on the board site, Sonnet members' deeper searches
   (CLOUDFLARE.md "Claude for deeper answers").

13. **Real CATS verification: days off / PL** (carried forward 2026-11-07).
    Check option 4 reads, 24 h memory, withdrawn future PLs, active PL retention,
    <=24 h / 24–36 h road distinctions, yard overlap and trainee exclusions.
    No first real run confirmed; more than 15 pages is a known reader limit.
14. **Predicted spare jobs and notification routing** (carried forward 2026-11-07).
    Match corrected/predicted lists, Filled by, spareboard job rows and later option 5;
    verify first expect-a-call / PL warnings, dedupe, and ordered-out-of-sequence
    trains notifying the next turn in the calculated sequence's pool (owner correction November 7; supersedes e77e9ba). Retain the CATS mismatch flag; verify downstream slot consumption and each craft's recipient on real CATS.
15. **Reset alerts: verify on real runs** (alongside #8, carried forward 2026-11-07).
    Verify call-order allocation, replacement's own reset, Chain Gang/SD next callable
    turn, one spare per job, latest per-reset dedupe and onBreak vs overdue.
    DHT040B 31 / B111 remains unresolved; do not mark #8 complete from code alone.
16. **Worker / phone rollout and held-away form setup** (carried forward 2026-11-07).
    Confirm latest laptop pull/restart/phone page separately from Worker deployment.
    Deploy Worker for Notifications Why/30-day history, resetAhead/held preferences,
    held186 submission and model changes; verify form/engineer details/mobile layout.
    Owner: Apps Script, MAIL_SCRIPT_URL / MAIL_SCRIPT_KEY, rep emails and names passcode
    (EMAIL.md). Export works; Submit setup unconfirmed. Separate from deferred #3.
17. **501/502, MU, Garnet and trainees** (carried forward 2026-11-07).
    Verify alternation/MU craft stand-ins, fill-in alerts, L502 suppression while away,
    station-only Garnet lineup and WADE S501-TT retention/alerts. Daily rotation fix built 2026-11-07; verify it survives MU home/off
    and checker restart on real runs (deployment pending). Ask owner for SD02/YPRS02 Call Board page 4.
18. **Outstanding owner decisions** (carried forward 2026-11-07).
    Notify a spare when expected work disappears? Reset-aware Chain Gang/SD fallback
    if spares run out? Require two stable checks for sleep prediction? Was S108 real?
    Runaround alerts/claim evidence still #1; My week expansion #4 remains undecided.
19. **Other live checks** (carried forward 2026-11-07).
    VIEW TIME; mid-call hold; option 5; stale trains; runaround log; watchdog Windows
    Edge cleanup; Toronto fill-ins; CATS Y/N buttons; Worker 30-min ntfy down alert;
    crews-in-town truncation/unseen pages; Search Review/model labels/fallbacks,
    clean Kimi answers/balance/usage, and names.test.js timing failure recurrence.
20. **Recorded reminders / deadlines** (carried forward 2026-11-07).
    November 23: before deleting suspended Render/Blueprint, check /api/status ready:true;
    deletion not confirmed. Keep RailroadTracker support. About December 4: #12 trial
    comparison. December 31 22:00: Anthropic key expiry (source time zone unspecified),
    replace in Cloudflare and Netlify. Reminder existence/delivery not rechecked here.

21. **Assignment errors audit follow-up (2026-11-07; remains open).**
    Live check 20:37 / update 20:39 (Toronto); last-90-days display: 126 train
    groups, 222 issues, 166 pool/turn marked fixed, 20 missing jobs listed later.
    Saved data generated 2026-11-08T01:39:53.842Z: 76 pool + 109 wrong-turn +
    37 missing = 222 issues. No duplicate identities found within these saved
    arrays using pool=train/month, wrong=train/month/craft/CATS-turn,
    missing=train/month/craft/turn. Cross-type and craft findings are intentionally
    separate (E27861 07 = 1 pool + 2 wrong-turn crafts + 1 missing = 4).
    Archive-overlap and month-boundary identities still need explicit verification:
    display groups by train text + observation month, not canonical service date.
    Do not deduplicate crafts or detector types blindly.
    Concrete UI issue: anaCats includes catsMissingView([]), so E27861 07 shows
    an empty Missing from option 5 panel followed by its actual missing finding.
    Concrete status risk: catsCheck marks fixed when a mismatch disappears while
    the train remains listed; disappearance is not proof the actual crew matched.
    E27861 07 conductor was marked fixed at 1312 with order SR04, but crew later
    shown CO SB06. Review last-order changes before changing status semantics.
    No fixed timestamp later than on-duty was found in saved catsErrors.
    Three pool records have lastWrong later than onDuty: M39491 24, Z14891 24,
    A42431 25. Audit post-departure observations before treating end-state labels
    as proof of a runaround or correction before departure. Pool fixed flag is
    final observed equality, without a stored correction timestamp.
22. **Subscriber reporting real-run verification (2026-11-07; open).**
    Persistence and diagnostic lookup committed aafef71; owner Health visibility,
    successful/failed lookup ages, confirmed zero vs failure, last-good restoration
    after restart, and delivery unaffected still require owner-side runtime evidence.
    Do not close from public page verification or local tests.
23. **Historical call-data completeness (2026-11-07; open).**
    Opposite L501/L502 exclusions and L50231 02 wrong-date recovery observed live.
    Audit remaining trips, archive identities, summary denominator consistency and
    recovery baselines. In particular recovered expected/first-call timestamp may
    coexist with older sleepAt/notice fields; validate/relabel before declaring full
    historical accuracy. Raw history retained; Actual call time remains calculated
    from on-duty minus two hours, not a logged phone-call timestamp.

24. **Review notification logic when an ordered train passes a planned train (2026-11-08, open).**
    Replay A42431 07 and Z14891 06 from November 7, 2026. A424 showed ORD at
    07:50 for 11:00 while Z148 still showed PLN for 08:48 at the 08:15 check.
    Z148's ORD transition was never captured. Justin confirmed the final pool
    sequence was correct: Z148 worked A pool and A424 worked B pool.
    The pool and covering-spare replay was reviewed and its sequence wording
    promoted in `3c0eb43`. Compare retained receipts with the reconstructed alerts
    where available. Review EN11’s separate 07:50 CATS wrong-turn warning for S106,
    subsequently recorded as the job EN11 worked. These checks remain open.

Not wanted (owner, 2026-10-26): a pay period view (A6) and hours on duty
per week per person (A7). Taken off (owner, 2026-11-03): calendar export.

## Done

- 2026-11-10: **Current, new layout** (short rows, Toronto and Garnet folded, who is in
  Garnet, counts on one line, tab bar in one row): approved in Test and promoted.

- 2026-11-10: **Page Health new top** (verdict line, code version in words, name codes
  kept over a restart): approved in Test and promoted.

- 2026-11-10: **501/502 trip missing when one craft was covered** (owner: his
  L50231 08 as S501 conductor was on RYPA's search, not his). A fill-in for one craft
  no longer hides the trip from the other craft (`coveredCraft` / `coveredBy`,
  public/board-turns.js).

- 2026-11-10: **Call stability for 501/502** (owner): last-minute crew swaps no
  longer count as "removed from lineup", S5 fill-ins per craft, L501 home not scored
  against the next L502. Details in HANDOFF.

- 2026-11-09: **Pool filter on "Pools at Sarnia"** (was #25). The pool buttons
  switch each pool on or off and the boards stack in pool order, with All /
  Clear; picks kept on the phone. Previewed in Test, approved by the owner
  and promoted to Current the same day. Still to see on the live board.

- 2026-11-07: **Analytics navigation cleanup and Assignment errors merge — live verified.**
  Runaround log / Jobs going spare / Predictions tabs and related Overview cards
  removed; Out of sequence + CATS errors replaced by grouped Assignment errors.
  Check 20:37, update 20:39 Toronto; E27861 07 expanded and all three types observed.
  Only presentation completion closed; detector/data-quality audit remains #21.
- 2026-11-07: **Timeline presentation — live verified examples.** Turn History graph
  opens first and expanded; labels, five clock ticks, elapsed time, black Lost Sleep,
  legend and marker-time control confirmed at 20:16 check / 20:18 update. Broad
  historical accuracy remains #23; subscriber runtime verification remains #22.


- 2026-11-07: **Call stability timeline** from owner sketch: first seen,
  fixed eight-hour block, saved call changes, inferred call/removal marker.
  Full observed change history retained separately from existing scores.
  Older archived records labelled incomplete; FORMAT 24 rebuilds raw history.
  Local tests pass; laptop publication / real-site verification pending.

- 2026-11-07: **S5 board-position correction** supersedes the dated anchor.
  First regular option-29 turn is next; MU does not affect order. Removed
  guessed MU ownership/status additions; craft eligibility unchanged.
  Implementation verified locally; laptop publication pending.

- 2026-11-07: **Clearer Analytics labels**: Call stability, inferred call times,
  sample counts, available dates, unidentified fillers and hold caveats;
  calculations unchanged. Local checks complete; live publication pending.

- 2026-11-07: **Analytics Overview** (owner approved): new default section with
  four linked summaries and actual train-data dates; existing sections retained.
  Implementation checked locally; laptop publication / phone verification pending.

- 2026-11-07: **501/502 daily rotation** (owner: S501 tonight, alternates daily).
  Anchored to confirmed S501 Nov 4 / S502 Nov 5; L50231 08 is S501.
  MU is a placeholder, never an owned turn or source of daily order. Date-based
  assignments stay stable through rest/PL, MU changes, restart and month rollover;
  craft availability and spare jobs stay separate. FORMAT 22 refreshes site caches.
  Implementation verified locally; live CATS/laptop rollout remains open under #17.

- 2026-11-07: **Analytics → When summaries** (owner approved): three-hour busiest
  windows with counts/bars, hourly detail, collapsed weekly activity (calendar-day rate
  and partial-coverage labels), and Toronto holds as count/share of recorded stays.
  Ongoing stays included and labelled; unknown times excluded. Implementation/tests
  complete; live deployment awaits laptop pull/restart/publish and phone refresh.

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
- 2026-11-03: **Down 1 h → just the owner's phones** (the phones following
  👤 JUOD; OWNER_DOWN_MINUTES / OWNER_CODE), "back" to them too; Page Health
  **Worker timer** line (last run, ntfy topic set, push key set).
- 2026-11-03: **Stuck between the sign-in and the CATS main menu**: Enter,
  then F3, then reload CATS after 5 min (twice), then a fresh Edge; saves what
  the page was and sends your ntfy once. Next: teach it the real notice
  page once the owner shows how he gets past it.
- 2026-11-03: **CATS "Do you wish to place on another assignment?"** answered
  → **sent to your ntfy** with the page's words, its boxes and Y / N
  buttons; your tap or reply (Y, 2=Y, F3…) is typed in. Also for other CATS
  pages it can't get past before the main menu. Every page saved (words +
  picture): Page Health and BoardChecker\assignment-questions.
  BOARD_ASSIGNMENT_ANSWER: ask (default) / Y / N / off.
  No answer in 15 minutes (phone off at work): it types N itself on a yes/no
  page, or forces past any other page (Enter, F3, reload, fresh Edge), and
  tells you (BOARD_ASK_WAIT_MINUTES, BOARD_ASSIGNMENT_FALLBACK).
- 2026-11-03: **Fixed: L502 to the wrong crew.** The two 501/502 crews
  alternate: the crew bringing L501 home gets the next L502 (the site had
  given it to the crew that just left for Garnet). Whether they go spare
  shows once they're off duty.
- 2026-11-03: **Name code search cleaned up** (Turn History): Home turn
  (latest spot), Status (where they are now), Turns seen on (only their own
  board spots), a short Changes list with a button for every check, one date
  style (28th 0120). Fixed: trains worked while filling in on another turn
  (DRDI on SR07) were missing from the name code's Work history.
- 2026-11-03: **Reference tab**: CATS status and ECC codes, job types for
  Eastern Canada, Mac Yard / B.I.T. Yard / Malport track lengths (search a
  track), and the held-away penalty table with a calculator (type the time
  held, or off-duty and on-duty times).
- 2026-11-03: **Turn History tidied**: a turn search also gets the short
  Changes list (button for every check); Orders, Rest and Goes spare folded
  into "More detail" (closed), on turn and name code searches.
- 2026-11-03: **Snapshots: pick an hour, then a time.** The day's hours
  (00–23) as buttons, then just that hour's checks, so the list isn't a
  day's worth of times to scroll through.
- 2026-11-03: Snapshots hours read 0000–2300; **Order summary tiles removed**
  (the numbers are still in Analytics).
- 2026-11-03: **Predicted crew, scored better.** A train's story on the
  Order summary shows how early the prediction was right ("right since …")
  and what it predicted 8 h before the call, when people go to sleep;
  Analytics → Predictions scores that 8-hour prediction too.
- 2026-11-03: **Article 18.6(b): two tiles** instead of four: crews violated
  (held 14 h+) in the last 7 days, and the percentage of Toronto stays that
  were violations in those 7 days.
- 2026-11-03: **Garnet line-up** (option 41, station 47956): when L501 is
  planned / ordered out of Garnet, shown under the 501/502 board and in the
  why for the next L502.
- 2026-11-03: **Analytics → Trains: first row of tiles removed** (went on
  duty, usually on duty, earliest–latest, never ran). Turn and name code
  searches keep theirs. My week for a name code counts a turn only while
  they were on it (and only their craft on 501/502).
- 2026-11-03: **Crews in town read every check** (TODO #10, expanded Call
  Board; owner: "keep reading the crews in town"). The checker pages
  through the whole list (Call Board pages 5–29) and reads each pool's
  crews: rested, rest until, hold turn ("**HT 1104 0635" = held until 4th
  0635, owner), open turn. Owner's choices: read every page (the extra
  time per check is fine); **not shown on the site**, used behind the
  scenes (first by the rest tracker, #8).
- 2026-11-03: **Home turn from the crews in town** (part of #6; owner:
  "anything past the crews in town shows people on their actual home
  turns … a good way to check and see where people are"). The checker
  reads the names on those pages in memory and keeps only name codes:
  each person is seen on their own turn (or yard job, e.g. XSAS02) every
  check, trainees (TT/ET) on the turn they're on, a TEMP fill-in not as
  their own, TEMP VCNY skipped (seen where they're working). Person
  search's Status adds "Crews in town (pool): vacancy (off the turn)",
  "day off", "on rest until …" etc. Nothing else new on the site.
- 2026-11-03: **Reset tracker** (TODO #8 rest tracker + #9 reset tracker;
  owner: "we can't see when someone else needs to be reset … they usually
  don't do it until they are going to call the job, then the next person
  gets an unexpected call"). Per person (name code): duty periods from the
  Call Board and yard jobs, off duty from the Toronto bunkhouse (REST − 8 h)
  or the home REST (− 10 h, or − 24 h when booked 24 h), resets natural
  (32 h off + two free nights 00:00–05:59, at whichever comes later) or
  manual (rest / hold until 0559). Checked against the owner's CATS
  "EMPLOYEE TIME ON DUTY LOG" (PSTS05Y): off-duty times to the minute,
  RESETSYS 26th 0559 and RESETM32 3rd 0754. On the boards: a turn whose
  person needs a reset within 2 days is yellow, within 24 h red, with
  "reset needed by …" (owner). Rules: data/rest_rules.pdf (10.1 reset
  break within any 7 days). Code: lib/board/resets.js, data/resets.json.
- 2026-11-03: **Reset alerts.** When the person projected for a train or
  spare job may be put on a mandatory reset at the call, whoever would get
  it instead is told: "SB04 needs a reset by … and is likely to be put on
  it when called for M38261 03 … B111 is next for it" (under 35 h left at
  the call: a road job needs ~35 h, owner), or a heads-up at 35–48 h
  (pools only); a spare on a yard job: before the 8 h (YSBY 12 h) shift ends. Chain Gang / SD /
  spareboards: the next person; A/B/S1/S3: the spare who'd fill the job.
  Chain Gang / SD (owner, 2026-11-05, after SD02 → EN03 past SD01 **): a
  turn put on a reset doesn't take the train and go spare; the next turn
  that can work it gets it, past ** / B0 turns, and it only goes spare if
  no one after them is available (engine resetJob / firstCallable skipSpare;
  the normal line-up still has ** turns take their train and go spare).
  Once per train. Phone option "would get a train or job because someone
  may be put on a mandatory reset" (on by default).
- 2026-11-04: **Garnet line-up · L501 home** on the Current tab (like
  Toronto line-up · Mac yard): the next L501 out of Garnet, the crew in
  Garnet that takes it (only ever one: the 501/502 crew that took L502
  out), their rest and the call (order − 2 h). That crew's phones get
  lined up home from Garnet, ordered, time change and the reminder.
- 2026-11-04: **Article 18.6(b) in Turn History.** A turn search or a name
  code search shows each Toronto stay held 14 h+ on that crew: the
  conductor gets the grievance letter form filled in from the board (no
  name filled in for a name-code search), the engineer the details to file
  with and a Copy button. Engineers are not under Article 18.6(b) (owner,
  2026-11-05): their details and heading don't name it. Done: the owner
  says the details (turn, train out, off duty, train home, held) are
  enough; no engineer template needed.
- 2026-11-05: **Upcoming days off** (CATS 3 → 4, owner: "do A, B and C"):
  read every check (F8 through the pages), each line 24 h from the time
  shown, remembered until it ends (BoardChecker\days-off.json). A: a "Days
  off" list on the Current tab and "days off …" in each turn's status. B: a
  turn off at the call takes its train and goes spare (every pool, Chain
  Gang and SD too: owner); a spare off is passed over. C: the runaround log says
  "explained: on days off". STAT and the A/U/X types: meaning not known yet.
- 2026-11-05: **L502: no alerts until the crew is back off duty in Sarnia**
  (owner): the 501/502 crew lined up for the next L502 isn't told while
  it's out on a 502, at Garnet or bringing L501 home. And the "when do I
  go" card now says when the train goes spare (S501 on rest until 6th 0640
  past L50231 06's 0145 call: "goes spare").
- 2026-11-05: **The spare expected to cover a job going spare is told
  right away** (owner: "sometimes these don't show and people get surprise
  calls"): from the order, not only once option 5 lists it, with why
  ("SA09 has a PL @ 6th 0001, so its conductor job is going spare: expect a
  call"). The open choice (a) from 2026-11-02, done.
- 2026-11-05: **PL rules** (owner): a yard job that runs into a PL passes
  that spare over (B119: yard 1600, PL 2200 → B105). Road jobs: the PL 24 h
  or less after going on duty → goes spare 100%; 24–36 h → a warning to the
  person who'd take the job if it went spare.
- 2026-11-05: **Reset alerts fixed** (owner): worked through in call order,
  so each spare is told about one job, and a spare who'd need a reset too
  is passed over to the next one who can work it.
- 2026-11-07: **Predicted jobs going spare** (owner: "have it show
  Predicted jobs going spare, and thats based on anything showing on the
  corrected train line up thats not showing there"): Current → Jobs going
  spare, under the corrected list, each with why it goes spare and the
  spare expected to fill it.

### Rescue lineup and missing prediction verification — 2026-11-07 (open)

- Verify RQ13931 on real CATS: option 5 must contain both CO and EN with no
  turn for spare/spare; a named turn on either craft or an absent craft uses the
  Sarnia calling sequence. Call = lineup time minus 135 minutes. Confirm actual
  covering spares and subsequent sequence slots before considering complete.
- Verify X39491 06 now gets its normal Sarnia pool, conductor, engineer and
  expected call after publication. Fixed the suppression path where a remembered
  departure with the same printed identity excluded a current lineup row; current
  lineup now supersedes that memory without double counting. Current confirmed
  Call Board crews remain factual. Regression passes, real CATS verification open.

### Targeted rescue heads-ups — 2026-11-08 (open real-run verification)

- Verify Toronto 41975 rescue heads-ups go only to bunkhouse crews, with fill-in
  mapping retained. Verify Sarnia rescues notify their selected/possible crew and
  anyone whose next train/spare job changes, excluding unaffected pools/turns.
- With/without comparison uses exact symbol + train date and the same departure
  memory as the main engine. Check covering spares, depleted spareboard backups,
  PL warnings, multiple rescues, unread screens and repeat suppression on real CATS.
- Targeted automated alert/engine/spare tests pass; no actual notifications sent.
  Keep this item open until laptop publication and actual recipient evidence confirm.

### Corrected departure / Toronto tie-up verification — 2026-11-08 (open)

- [Error list and fixes](TRIP-DATA-FIXES-2026-11-08.md): verify X39491 06 no
  longer combines duty 8th 0445 (S107/SA05) with off 8th 0149 (SD12/SR04).
- Confirm withdrawn evidence is visible in the story; missing tie-up is shown as
  unavailable/Needs review, not an invented duration. Any later replacement must
  match the corrected departure and crew. Review any affected historical held-away
  record before relying on it; no previous submissions were inspected here.
- 49 targeted tests pass; keep real-CATS/publication verification open. Full dated
  train identity and month remain part of matching. No Worker update required.

### Owner Test: Order summary items 2–6 — 2026-11-08 (awaiting review)

- Preview built: first/latest-order comparisons, six-column table, shortened key
  events with all originals retained, cautious disappeared/no-call-observed wording,
  and day/origin/status/search filters. Earlier Test history example removed.
- Verify on the owner's phone after publication, including X39491 06 first-order
  vs latest-order comparison, open/close details and all-event access, disappeared
  deadhead wording, empty filters and completed/tie-up-not-recorded distinctions.
- Regular Order summary is unchanged. Do not promote until Justin approves.

Order-summary preview approved for promotion (2026-11-08): owner approved items
2–6 and requested the old dropdown appearance. Implemented on regular summary;
shared Test view matches it. Previous “do not promote” note is superseded by this
approval. Keep phone/publication verification open: theme dropdowns, day/origin/
status filters, exact dated train links, first/latest comparisons and all-event access.

### Filing form usability items 5–7 — 2026-11-08 (publication verification open)

- Implemented inline selected-trip form, four filing steps, separate missing-fields,
  configuration/lookup errors, review with explicit confirmation, and success reference.
- Verify after pull/restart: selected stay stays beside its form in Article 18.6(b)
  and Turn History; phone layout, required fields, craft destination, full review,
  edit invalidation, draft export and setup reasons. Do not send a test filing to a rep.
- References are client-generated, included in outgoing text, and recorded locally
  only after the service returns success; inbox delivery is not tracked. Local receipt
  history is not a server duplicate guard. Existing backend duplicate rules unchanged.
- Owner confirmed times accurate: preserve existing calculations/summary labels.
  Engineer filing workflow was explained only; do not implement suggestion 2 without
  owner decision (earlier details/Copy-only instruction versus current shared form).
- Four mocked submission regressions and 26 site/trip tests pass. Real publication,
  visual review and any actual filing confirmation remain unverified. No Worker update.

### Owner Test: collapsible Current boxes — 2026-11-08 (awaiting phone review)

- Implemented Test-only preview of latest saved Current board; tap any box header
  to expand/collapse. Native keyboard operation and arrows; initially open. Preserve
  contents, section order, pool/spare-job controls and session collapse state.
- Prior Order-summary Test preview replaced; approved regular Order summary remains.
  Regular Current/snapshots unchanged. Owner key and health authorization remain required.
- Verify after pull/restart: mobile headers and counts, all available sections,
  open/close behavior, pool/corrected/CATS tabs, and preserved collapsed state.
  No live or phone verification claimed. 26 site/filing tests and syntax pass;
  local browser check blocked by missing Chromium. No Worker update required.
- Owner clarified engineers may use shared filing form: earlier Copy-only instruction
  is superseded; workflow decision is resolved. Publication checks remain open.

Current accordion promotion — 2026-11-08: Justin verified Test (“Works great”)
and approved promotion. Supersedes awaiting-Test-review item above. Enabled shared
headers on Current; verify production after publication, including section shortcuts,
notification jumps, pool/spare-job controls and Arrange. Snapshot layout unchanged.
26 site/filing checks and syntax pass; no Worker update required.

### S5 equal-position Garnet tie-up — 2026-11-08 (live verification open)

- Fixed Current selecting S501 for L50231 09 after terminal-1 tie-up while S502
  was home: both had local position 001 and alphabetical tie selected S501.
- At tied positions only, home precedes away/outbound; actual different positions
  remain authoritative. MU and PL/rest/hold do not decide order; craft coverage stays separate.
- Verify after pull/restart and fresh check: L50231 09 predicts S502 CO/EN as applicable,
  S5 board S502 first; S501 Garnet rest/PL remain factual. Verify next alternation and
  notification agreement without sending test notifications. FORMAT 28 rebuilds caches.
- 69 engine/site tests pass. Owner's screenshots are evidence of old bug, not live
  verification of fix. No Worker deployment required.

### S5 full-cycle audit — 2026-11-08 (open defects and real-data verification)

See [full evidence/reproductions](S5-CYCLE-AUDIT-2026-11-08.md).
- Known-crew shortcut matches workingOn symbol without date; future ORD L50231 09
  can incorrectly inherit prior L50231 crew. Require dated evidence; regression TODO.
- Same shortcut assigns both crafts from one working row, bypassing engineer TV/rest.
  Preserve separate factual craft/fill-in confirmation; regression TODO.
- Simplified Why omits S5 location/position selection reason; preview concise reason
  in Test. Current order 0400 versus When duty 0345 wording needs separate review.
- Fourteen reconstructed phase checks pass, both rotations; 123 pass, 2 known TODO
  failures in combined engine/site/alerts/spares/rotation run. No real sends.
- Raw full-cycle masked captures remain missing: bundled real fixtures have no S5.
  Replay terminal, departure, return, home rest, PL and spare/MU transitions; compare
  actual notification evidence. Do not close on reconstructed tests alone.
- Live browser Updated Nov 8 13:59 / snapshot 13:57 still showed old S501 prediction
  for L50231 09. Prior fix 664c40c publication remains unverified; preserve that task.

### S5 Why preview — 2026-11-08 (owner review pending)

- Test-only L502 Why: lined-up CO/EN, other regular crew status (Garnet/L501/etc),
  existing spare cover when available. Removes other-train calling list only in preview.
- Verify after publication on phone: full dated train ID, each craft's spare state,
  other crew's rest/PL/returning details and missing-status fallback. Await approval
  before promotion. No fixes to the two known-crew-shortcut audit defects in this UI change.
- Syntax and six sample rendering checks pass; live publication unverified.

### Analytics Overview guide — 2026-11-08 (Test review pending)

- Built grouped Test directory for all seven active tabs, plain-language descriptions
  and buttons to existing destinations. Date/week controls remain on destination pages;
  search cleared on navigation so the selected tab actually opens. Removed tabs remain absent.
- Test selector retains Current/S5 Why pending review. Regular Overview unchanged.
- Verify phone layout, every Open destination, returning to Test, and both preview
  choices after normal pull/restart/publication. Do not promote until owner approves.
- Syntax/catalog/navigation checks and 26 site/filing tests pass. No live visual
  verification, Worker update, calculations or notifications changed. S5 defects open.

Analytics Overview promotion approved — 2026-11-08: owner requested push.
Approved seven-tab guide now on regular Overview with working Open buttons;
shared Test preview remains. Prior wait-for-approval requirement satisfied for
Analytics Overview only. S5 Why approval and two S5 defects remain outstanding.
Verify production mobile layout and all seven destinations after laptop publication.
26 site/filing tests plus syntax/rendering checks pass; no Worker update.

Review coordination — 2026-11-08 evening: 751e7e4 promotes reviewed Current,
Analytics and Article 18.6(b) previews from another session. Do not repeat promotion.
[Updated handoff](HANDOFF-2026-11-08-SESSION.md) records original review queue and
verification needs; inspect fresh head/session results. Two S5 audit defects remain
open. This documentation update establishes no live verification or task closure.
