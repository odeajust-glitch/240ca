# HANDOFF — read this before doing anything

Documentation reorganized: **2026-11-07**. Historical statements are evidence from their
recorded dates, not confirmation of today's deployment. Backlog: [TODO](docs/board-checker/TODO.md).

## Latest verified status — 2026-11-07 evening

This status supersedes older rollout statements below, which remain historical evidence.
Reviewed application head: `1a6c728090c39c41d48d59494ecd2b407f1ec1b1`.

- Live browser: **check November 7 20:37; Updated November 7 20:39**, Toronto time.
- Analytics sections verified: Overview, My week, Trains, Turns side by side,
  Call stability, Assignment errors, Stale trains.
- Assignment errors replaces Out of sequence and CATS errors; grouped Wrong pool,
  Wrong spare-job turn and Missing spare job details verified on E27861 07.
- Runaround log, Jobs going spare and Predictions tabs removed; Overview contains
  Call stability and Toronto holds, without the removed prediction/calling-log cards.
  Underlying collection, Current spare jobs and notification rules remain.
- Earlier live verification (20:16 check / 20:18 update): Turn History timeline opens
  first and expanded; Original expected call time / Actual call time labels; five
  date/time ticks; elapsed duration; black Lost Sleep segment, legend and marker times.
  S501-CO L50231 04 showed 0145 original vs 0045 actual, Lost Sleep 1 h.
- Historical opposite L501/L502 comparisons were visibly excluded; the former 47 h
  L50231 02 comparison recovered a November 2 prediction and showed 1 h early.
  This verifies those examples, not every historical trip or summary.
- Subscriber-report persistence/error distinction is committed (aafef71), but
  owner-only Page Health and retention through restart remain **unverified** here.
- Browser observation confirms published page behavior only: exact Windows checkout
  SHA and checker restart were not inspected; no Worker deployment was performed.
- Audit findings and unresolved data/status issues are in TODO #21–23. No railway
  rules changed. Original snapshot/archive remain intact.

## 1. Current project status and branch

- Repository: `odeajust-glitch/240ca`; work on **`claude/vigilant-planck-zawrj4`**.
  Reviewed source head: `34a58378ba14ea12be2a306ff50071c046664938` (2026-11-07).
  No PR or merge to main unless Justin asks. Pull before changes; push small commits.
  One session at a time changes the checker/site; earlier parallel sessions were owner-authorized exceptions.
- Justin is a CN conductor, SR03 (Chain Gang), union rep in Sarnia; Windows,
  non-technical, often on Android. Give exact Command Prompt steps and recommended options.
- Deterministic CATS board reader and prediction engine; Cloudflare Worker + R2 website.
  Latest documented code includes days off/PL, predicted spare jobs, ordered-pool routing,
  reset-break display, Notifications, and the held-away submission form.
- Original handoff reports **280 passing tests**; this documentation work does not establish a new test run.

| Stage | Last documented evidence / outstanding confirmation |
| --- | --- |
| GitHub code | Above source head includes November 7 fixes; code committed does not imply deployment. |
| Windows pull | At least `d8f105b` on November 5; other older notes say commits from `0a09803` were missing. Current laptop SHA unknown; inspect it. |
| Checker restart | Required after a code pull; restart with latest code has not been confirmed. |
| Phone refresh | Required after the checker publishes the new page; latest version not confirmed. |
| Worker deployment | Agreement search verified deployed November 3; later Notifications/form/preferences/model changes still need confirmation or deployment. |
| Real CATS validation | Some earlier features have real-run evidence; checks in section 4 remain open. |

**Site update, 2026-11-07:** Analytics → When now uses three-hour busiest-time bars,
hourly detail, and collapsed weekly activity / Toronto hold tables. Percentages exclude
unknown hold times; ongoing stays included and labelled. Built and checked locally;
laptop pull/restart/publish + phone refresh still required. No Worker change.

**501/502 fix, 2026-11-07:** daily rotation anchored to S501's confirmed L502
on 2026-11-04 (S502 Nov 5); L50231 08 belongs to S501. Use the train's service
identity/date, not rest/PL/position or the number of trains currently visible.
MU is a system placeholder, not a person's owned turn; dated replacement-trip
labels do not control rotation. Availability/goes-spare remains per craft.
Cache FORMAT 22 rebuilds saved site predictions. All 273 board tests pass;
two unchanged agreement-search tests fail in the full suite. Built locally; laptop
pull/restart/publish and real-CATS confirmation pending. No Worker change.

**Analytics Overview, 2026-11-07:** additive default Analytics section with call
stability, eight-hour craft prediction scores, Toronto holds and likely/possible
calling events, linking to existing details. Shows actual on-duty train date span,
sample counts and missing/ongoing-data caveats. Existing sections retained. Laptop
pull/restart/publish and phone refresh pending; no Worker change.

**Analytics label cleanup, 2026-11-07:** Sleep renamed Call stability; inferred
calls/planning baseline, sample sizes, tracker coverage, unidentified spare-job
fillers and ongoing/unknown holds labelled explicitly. Calculations, rules and
alerts unchanged. Laptop publish/phone verification pending; no Worker change.

**S5 correction, 2026-11-07 (supersedes earlier daily-anchor fix):** the first
regular turn on option 29 is next (owner). Use board position; MU is a system
placeholder and never determines order. Remove inferred MU ownership and
appended next/covered-trip status wording. PL/rest/hold remain per craft.
FORMAT 23 refreshes cached predictions. Laptop rollout pending. The timeline
graph implementation is described below; publication remains pending.

**Call stability timeline, 2026-11-07:** expandable per-record clock timeline
matches the owner's sketch: first seen, saved change markers, fixed eight-hour
block before baseline expected call, and separate inferred-call/removal marker.
Changes from first seen are saved separately; existing scores/shift counts stay
unchanged. Old archived records show a missing-history caveat. FORMAT 24 rebuilds
retained raw checks. 275 board tests pass locally; laptop publication pending.
No Worker change. This completes the previously pending timeline implementation.

## 2. Immediate next actions, in priority order

1. Check current branch/head and [TODO](docs/board-checker/TODO.md) before editing;
   another session may have advanced it. Read the snapshot/archive before changing a feature or rule.
2. Establish the laptop SHA, pull and restart if behind, then wait for a successful check
   and refresh the phone. Record each stage separately; do not call all of this “deployed”.
3. Validate days off/PL, predicted spare jobs and ordered-pool notifications on real CATS
   (section 4), then reset tracker/alerts against PSTS05Y and the saved B111 question.
4. Confirm/deploy the Worker version needed for Notifications and held-away forms;
   complete email setup separately. Verify results before closing any backlog item.
5. Review remaining owner decisions and dated reminders below. Add new asks to TODO;
   move an item to Done with a date only when finished. Update this handoff each session.

## 3. Items awaiting my action

- **Worker and email:** re-paste/deploy `cloudflare/board-worker.js`; set up the Google
  Apps Script and `MAIL_SCRIPT_URL` / `MAIL_SCRIPT_KEY` per [EMAIL](docs/board-checker/EMAIL.md).
  Page Health → Article 18.6(b) submissions: enter conductor/engineer rep emails and crew
  names passcode (`settings/held186.json`). Submit remains off until configured; Export works.
  This form does not close TODO #3 (the separately deferred rep-alert email).
- Confirm Worker `ANTHROPIC_API_KEY` setup; old notes leave it uncertain. Confirm Search
  Review, model labels/fallbacks, Kimi balance and usage pricing on real answers.
- Model tester TODO #11: confirm Netlify import/keys and scored results; settings stay in TODO.
- Owner decisions still open: notify a spare when an expected spare job disappears;
  reset-aware Chain Gang/SD fallback when the spareboard runs out; require two stable
  checks for sleep predictions; runaround alerts/recipients, claim limits/evidence page.
- Owner evidence requested: was S108's job real? Send Call Board page 4 for the SD02 /
  YPRS02 name-match issue. STAT A/B and A/U/X meanings remain unknown and unused;
  other leave types were deferred (“don't worry”). MU tags no longer determine the daily rotation (see the dated fix above).
- **2026-11-23:** historical reminder to delete suspended Render service/Blueprint;
  check `/api/status` is `ready:true` first. No deletion confirmed. Keep RailroadTracker support.
- **About 2026-12-04:** Pushover trial ends; compare arrival/retries across Pushover,
  ntfy and site alerts, then buy or remove its two environment settings (TODO #12).
- **2026-12-31 22:00:** documented Anthropic key expiry; replace in Cloudflare and
  Netlify. Source does not specify the time zone. Earlier reminders were recorded as set;
  their current existence/delivery has not been checked here.

## 4. Features built but awaiting real-world CATS testing

- **Days off 3 → 4:** no “skipped Upcoming days off 4”; Current → Days off shows From/Turn.
  Verify 24 h memory, withdrawn future PL removal, active PL retention, <=24 h and
  24–36 h road cases, yard overlap, and ET/TT exclusions. Reader caps at 15 pages;
  more pages could incorrectly drop future remembered entries. No first real run confirmed.
- **Predicted jobs going spare:** compare against later option 5; corrected/predicted
  lists, spareboard job rows and alerts must agree on Filled by and call order.
  Check first “expect a call” and PL “you may be called” alerts in Notifications.
- **Ordered-pool routing:** after `e77e9ba`, next ordered out-of-sequence train must
  notify CATS's pool's next turn, retain the mismatch flag, and consume that pool's slot.
- **Resets:** compare data/resets.json due times with CATS PSTS05Y; confirm onBreak
  instead of overdue while off since before deadline, possible resets, and shared codes.
  Missed trips, unread names or a mid-week history window can make results wrong.
  Verify call-order allocation, next eligible Chain Gang/SD turn, craft, deduplication,
  and spare's own reset. Saved DHT040B 31 / B111 vs B133 question remains TODO #8.
- **501/502 and Garnet:** validate alternation/MU stand-ins, fill-ins' own-turn alerts,
  L502 suppression while away, per-craft tracking, and Garnet station-only 41 reads.
  A Garnet reminder worked November 4; that does not validate every subsequent change.
- **Trainees:** WADE S501-TT retention while away and alerts after return; manual-add
  alert worked November 4, broader real-run validation remains open.
- **Phone/Worker:** engineer details + Copy under conductor form, mobile off-duty
  layout, Notifications Why/filter/history (30 days; older Worker only last 50), held
  14 h+ persons-only alerts and resetAhead/held preference retention; email Submit setup.
- **Other still-open checks:** VIEW TIME, mid-call hold, option-5 checking, stale trains,
  runaround log, watchdog Edge cleanup on Windows, Toronto fill-ins, first CATS Y/N
  prompt/buttons, Worker 30-min ntfy down alert, Search Review/models/clean Kimi answers.
  Crews-in-town log should report N people; check seen.crewsInTown/history pools and
  JUOD Person search; pages 7 and 11–29 unverified, list sometimes cut short (~36 vs ~90).
  `names.test.js` failed once then passed (timing); watch recurrence.

## 5. Railway rules settled with the owner — DO NOT CHANGE

The following rule block is retained verbatim from the original handoff. Exact examples,
implementation notes and superseded wording remain in the snapshot; newer dated rules
below qualify older notes. Do not resolve an uncertainty by inventing a railway rule.

- **PL rules** (daysoff.js plFor / offAt / maybeOff), measured from going on
  duty (call + 2 h) to the PL's start: already on at the call → off; a **yard
  job** (8 h; YSBY 12 h) running into the PL → that spare is passed over
  (B119, yard 1600, PL 2200 → B105); a **road job** with the PL **24 h or
  less** after on duty → the turn takes its train and **goes spare, 100%**,
  every pool incl. Chain Gang/SD (owner: "this is wrong, it will go spare"
  about skipping), a spare is passed over; PL **24–36 h** after → the turn
  keeps it and whoever would take it if it went spare is warned once (kind
  `mayCall`: "B119: you may be called for … SR10 has a PL @ 7th 1600 (30 h
  after going on duty), so its conductor job may go spare"); a spare with a
  24–36 h PL keeps the job and the next spare is warned. Only the reset
  "what if" run skips a PL turn, like **.
- **A days-off line is 24 h from the time shown**; a trainee's (ET/TT) line
  changes nothing.
- **Alert wording:** "The turn goes spare (PL @ 6th 0001)." with the reason in
  brackets; "(spareboard covers)" dropped (cards the same).

- **An ordered train goes by the pool CATS ordered it for** (owner,
  2026-11-07: "Ordered trains should move the notification to the next
  person who would go since sometimes their planned trains don't always go
  when they say"): A42431 07 ORD for A as a 4th A → the next A turn and S1,
  not the sequence's B; it takes an A slot, so the B slots stay for the next
  trains; the "ordered for A but the sequence says B" flag stays.

- Option 5 (jobs going spare) can be wrong; **the order the site works out is
  right** (2026-11-02, E27861 02: CATS listed SA09, the order had SR05).
- L502: the two 501/502 crews **alternate** (owner, 2026-11-03): the crew
  bringing L501 home takes the next L502; spare or not is only known once
  they're off duty.
- Toronto: PLN train → next crew in bunkhouse order even if resting; ORD →
  next crew rested by the call; none rested → possible Toronto South crew.
  Mac yard call = order − 2 h; Sarnia = order − 15 min prep − 2 h.
- Yard jobs are 8 h, **YSBY jobs 12 h** by default (owner, 2026-11-03;
  site.js yardMinutes).
- A/B slots per road day: first 3 after 0459 → A, next 2 → B; called trains
  count first.
- Rows with TV beside a name don't count as that person's turn.
- MU turns are placeholders, not in any pool. An A/B train with MU on it:
  the A/B turn goes spare and is shown (not Chain Gang, SD or 501/502).
- Stale train: still planned 15 min+ past its call; pauses when the plan
  moves later.


### Additional settled rules and qualifications from dated notes

- **Chain Gang / SD normal vs reset:** SD works like SR. Normally a `**` / B0 / PL
  turn takes its train and goes spare; `**` remains spare while shown even past RETN
  (return, not expiry). B0 at normal position means working another job; POS 999 with
  a train means out on its own train. In the reset what-if, skip ineligible turns,
  including `**` / B0 / PL, to the next callable turn; spare only if none are available.
  Example: SD02 / M39491 call 5th 0226 → SD04, not EN03 (SD11 hold, SD01 `**`).
- **Reset calculation:** later of off + 32 h and 05:59 on the second free night
  (00:00–05:59); manual rest/hold to 0559 also recorded. Latest confirmed due formula
  is first on duty after reset + 7 days **minus 1 minute** (PSTS05Y 261111 0244).
  No next duty since reset → nothing due. Yellow <=2 days; red <=24 h. Regular yard
  holders excluded; 60 h/7 days and 192 h/28 days not tracked (owner deferred).
  Exact assignment-history off duty first; bunkhouse/away REST −8 h; home REST −10 h
  (−24 h if booked 24 h); estimates flagged. ±30 min changing reset → possible;
  colours/alerts use earlier deadline if uncertain. Off before deadline and now past it
  → onBreak, no colour, “counts at … if not called before”; before deadline retains colour.
- **Reset alerts:** pool road job <35 h left at call → likely; 35–48 h → heads-up;
  spare deadline before end of job (yard 8 h/YSBY 12 h, road 35 h). Re-run with 32 h reset,
  same craft: Chain Gang/SD/spares → next eligible person; A/B/S1/S3 → covering spare.
  Process jobs in call order, retain likely resets for later jobs, use each spare once,
  check replacement's own reset; heads-ups layered on top, not retained. No spare → no
  reset alert; Chain Gang “may be called” separate and not reset-aware. Latest dedupe:
  turn + deadline + who's next + likely/heads-up, **not older “once per train” wording**.
- **Spare jobs:** option 5 can omit jobs; expectedJobs/spareJobs use PL/rest/hold/`**`/B0/
  MU/no free turn, per craft, call order, each spare once. Same trainDay when option 5
  later lists it → no duplicate alert (S5 also gets lineup day). Yard option-5 job without
  `**` while prior shift still on duty → grey “probably not spare”, no spare/alerts;
  normal if CATS still lists it after tie-up. Spareboard B0 says “working another job”.
- **501/502 / MU / Garnet:** regular board position determines the next turn
  (owner correction, 2026-11-07). The dated daily anchor is superseded. MU is an
  unowned placeholder; no inferred MU trip assignment or rest-based reordering.
  Availability/goes-spare remains per craft after selecting the regular turn.
  Only one crew at Garnet, returning L501;
  call = order −2 h. Keep MU/fill-ins per craft; Garnet alerts also reach working spares
  by own turns, requiring their names from departing Call Board. L502 alerts held until
  crew off duty in Sarnia; L501 home alerts continue. CO/EN alerts labelled separately;
  plain S501 gets each craft once. No S5 position/ahead-rest/rescue/may-call by design.
- **Toronto:** turns away never receive Sarnia trains until back on Sarnia list.
  Planned-train selection vs ordered selection above remains distinct. Missing train
  with no rested/predicted Sarnia crew → “Non-Sarnia Crew”; with predicted crew →
  “Possible Non-Sarnia Crew or Train Cancelled”. Outer-switch return order remains out of scope.
- **ET/TT:** trainee days off listed only; never remove a regular crew or create spare work.
  Slots S501-TT/S102-ET stay separate from CO/EN; trips follow corresponding craft;
  no holder rests/reset/position alerts or board colours. Keep while away/working,
  30 min home grace, max 4 days unseen; not read on Garnet 31 or bunkhouse 28.
- **Notification timing/wording:** train switch waits one check (5 min); no repeat within
  6 h unless ordered since; one reminder per train; mid-call hold delays next lined-up.
  Ordered suppresses separate same-train time-change; catsWrong once per CATS listing.
  Pending sends retry next check up to 30 min old. Person alerts stop when replaced;
  trainee receives crew lined-up/ordered/time/on-duty/rescue, never holder reset/position.
  Held 14 h+ only to followed persons on crew at on-duty, once per trip; initial lookback 2 days.
- **18.6(b):** engineers are not covered; details + Copy sufficient, no engineer template.
  Later form replaces old grievance-letter/link notes; name-code search never autofills name,
  trainees excluded. Retain details and separate craft recipients; submission cap 30/day.

## 6. Current features and system architecture

- `scripts/board-watchdog.js` runs `board-auto.js` every 5 min in Edge; `runRoute`
  reads Call Board/crews in town, pools 23/19/21/27/25/26, Sarnia 41, spareboards
  13/9/19/17 (VIEW TIME now−10 min), 5, 29, 31, Toronto 28/Mac 41, Garnet 41, days off 4.
  Garnet now uses **station 47956 only**, clearing DIR/POOL/hours (old W/S5 guess superseded).
- `lib/board/screens.js` parses; `engine.js` predicts; `daysoff.js` attaches off ranges;
  `spares.js` covers vacancies; `resets.js` tracks persons; `reset-alerts.js` simulates;
  `trainees.js`/`fillins.js` retain slots. Assignment history 3→7 hourly (S1/S5, HOME/AWAY 1;
  S5 choice unconfirmed); backfill November 4 read 199 trains/195 off-duty times.
- `site.js` builds page/data; `r2.js` uploads in background, one upload at a time;
  `public/board.html`, `board-analytics.js`, `board-ref.js`, `board-ask.js` render UI.
  Analytics: year/month archive, sleep, predictions, runarounds, errors, CSV, My week.
- Site: https://board.sarniaboard.workers.dev — open link, Access off. Worker + R2
  `board-site`; owner key enables Page Health, Notifications, Search Review. Search:
  Worker BM25/R2 + selectable Kimi/Claude; owner Opus, members deeper Sonnet.
  Questions/answers kept 60 days; owner review; model/spend details in snapshot.
- Web push subscriptions R2 subs/; owner sign-in/stuck messages via ntfy/Pushover/site.
  Data `C:\Users\odeaj\BoardChecker`; daily backup after 03:00, 14 state zips plus
  finished history, no .env/names.json. RailroadTracker reads site; relay never configured
  on laptop, retained for app support. Box arrangement is local to each phone/browser.

## 7. Deployment and testing instructions

- Laptop code `C:\BoardChecker-code`; data/.env `C:\Users\odeaj\BoardChecker`.
  Chrome Remote Desktop “BoardChecker” works; no automatic start after Windows restart.
  Stop checker with Ctrl+C, then in Command Prompt (confirm branch before pull):

```bat
cd C:\BoardChecker-code
git branch --show-current
git pull
git log --oneline -1
node scripts/board-watchdog.js --me SR03 --every 5
```

- A successful check publishes index.html from public/board.html; refresh phone after it.
  Documentation-only changes require no checker restart, phone refresh or Worker deploy.
  Historical package-file conflict recovery exists in snapshot; inspect local changes
  before discarding them. Never overwrite owner's local work blindly.
- Worker changes deploy separately: Cloudflare → Workers & Pages → board → Edit code →
  paste fresh `cloudflare/board-worker.js` → Deploy. Use GitHub Copy raw file or freshly
  opened Notepad; verify a new-version word. Configure secrets separately; Paid plan required
  for search. Variables, cron and restore: [CLOUDFLARE](docs/board-checker/CLOUDFLARE.md).
  Agreement PDF changes: `node scripts/search-upload.js` uploads changed index/docs.
- Code validation: `npm ci`, then `npm test` (built-in node --test); docs-only work checks
  preservation, links and diff. Never name a notification-sending script *-test.js.
  `node scripts/alert-check.js CODE` sends real tests; excludes JUOD-following phones
  unless `--all`. `node scripts/phone-test.js` tests owner routes.
- Never commit credentials/raw coworker captures/probe-out; never ask for .env contents or
  VAPID private key. Check setting presence without showing values. Existing VAPID key retained
  by owner; rotation requires phone resubscriptions. Microsoft sign-in from .env, phone approval;
  refresh only R/“signin”, reminders 12 h/2 h before expiry. Do not retry automated TOTP
  absent explicit owner request. CATS assignment prompt defaults ask, then **N** after 15 min;
  Y requires owner to call in, never default Y. Exact recovery/wait/configuration in snapshot.

## 8. Links to the task list and historical documentation

- [TODO — authoritative backlog](docs/board-checker/TODO.md): retain incomplete work;
  built does not mean deployed/tested. Later open verification items are appended there.
- [Verbatim snapshot, 2026-11-07](docs/board-checker/HANDOFF-SNAPSHOT-2026-11-07.md): all
  original text, examples, commands, session IDs, earlier deployment claims and fixes.
- [Existing historical archive](docs/board-checker/HANDOFF-ARCHIVE.md): unchanged history
  through its recorded sessions. Search both histories before changing a rule/tab.
- [Board specification](docs/board-checker/BOARD-CHECK.md), [screen map](docs/board-checker/SCREENS.md),
  [alert review](docs/board-checker/ALERT-REVIEW-2026-11-05.md), [Pushover](docs/board-checker/PUSHOVER.md).
- The days-off session handoff was already folded in and deleted before this cleanup;
  its full folded contents remain in the snapshot. Older statuses are historical, not current instructions.

Timeline colour: fixed baseline, green unchanged, yellow absolute call shift up to 60 minutes, red above 60. Order status is first observed ORD, not an exact CATS order timestamp. Older records may lack it. This measures planning opportunity, not actual sleep.

Timeline refinement: axis starts at first observed assignment; original planned call is firstCall (fallback expected). Green starts eight hours before that original call. Axis ends there unless an observed ordered call is later. Numbered markers require a successive call-time change greater than 30 minutes; all changes remain in the list. 276 board tests pass. Publication pending.

Original-plan reliability summary added above call timelines: firstCall-based within-30-min and over-one-hour early/late shares, capped eight-hour window loss averaged among early records, and observed successive changes >30 min in original window. Expand metrics for underlying records (latest 200 displayed, full totals). Exclude removed/missing-time records; preserve old baseline scoring. 278 board tests pass. Laptop publication pending; no Worker update.

Mobile navigation reordered: Current / Turn History; Order summary / Article 18.6(b) / Analytics; Agreements / Reference / Snapshots; Page Health / Search Review / Notifications beneath for authorized viewers only. Six-column responsive grid provides full-width rows and minimum 44px button height. Existing access checks retained. Laptop publication pending.

Turn History work rows now load matching saved call timelines on expansion, joined from live and trip-date archive records. Match exact turn/craft identifier, full train id and on-duty timestamp; unavailable history is explicit. No railway rules or Worker changes. Laptop publication pending.

Timeline readability: responsive unlabeled bar, separate wrapping timestamp facts, short early/on-time/late result, significant-change count, observed stability duration and collapsed event/help text. Later-than-on-duty events hidden from older records that remained open across trips; raw records retained. 278 board tests pass; publication pending.

Owner display wording: early actual-call-to-original-plan segment is black, with Lost Sleep showing the full time gap. Help clarifies this is call-time displacement, not measured sleep. Calculations unchanged. Publication pending.

Timeline verification refinement: common record cleanup removes changes observed after on-duty from timeline and summary counts. Only L501/L502 opposite-direction baseline mismatches recover the first saved prediction matching the full actual train id; otherwise explicitly unavailable and excluded from both summary denominators. Never force predicted time equal to actual. Other train families unchanged. Timeline legend and ordered-square markers plus readable marker-time list added. 279 board tests pass. Laptop publication and live validation pending.

Historical same-number/different-run-date correction: reject mismatched full dated train ids in call comparisons (for all numbered train families), recovering earliest saved actual-trip prediction when present, otherwise explicitly unavailable and excluded. Preserve legitimate cross-train lineup changes except settled opposite L501/L502 rule. Raw history retained. Publication pending.

Subscriber reporting: owner-only last successful summary cached in BoardChecker data subscriber-health.json; restored as stale on restart. Independent diagnostic lookup awaited before health publication. Missing/unreadable subscription files do not replace confirmed list with zero. Page Health shows checked/confirmed age and safe lookup error. Delivery uses original non-diagnostic subscription behavior. 280 existing board tests plus reporting regression pass. Laptop pull/restart and live verification pending; no Worker change.
