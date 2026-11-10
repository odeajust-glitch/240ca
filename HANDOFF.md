# HANDOFF — read this before doing anything

## Current handoff — November 9, 2026

Start with the [November 9 continuation](docs/board-checker/HANDOFF-2026-11-08-SESSION.md#november-9-continuation). Reviewed application commit `e59a88c2cec09a861ab5bf14024db81adfda0c40` on `claude/vigilant-planck-zawrj4`. The branch includes the approved S5, Assignment errors, Current box memory, Call stability and sequence-notification changes. Test has no pending previews (the pool filter was promoted 2026-11-09, see below). Page Health went directly to the regular page at Justin’s request.

**Call stability, 501/502 fix, 2026-11-10 (owner: "the 502 / 501 call stability data is
messed up", then "fix the tracker"):** on the live data 22 of 39 S5 records were "removed
from lineup", 8 "unavailable", and no L502 call was recorded after 4th Nov. Causes, all
in `sleepCheck` (lib/board/insights.js): (1) the line-up swapped the two 501/502 crews in
the last check or two before the call (5th 0046, 8th 0259, 9th 0058), the real crew was
logged "taken off" and its wait thrown away minutes before the Call Board showed it; (2)
a fill-in on S501 dropped both crafts (same turn number); (3) L501 home was scored
against the next L502 ("30 h early"). Now: someone else shown on a turn's train waits
`SWAP_WAIT` (30 min) for the Call Board or the line-up to settle it (`offAt`); back on
the same train = same wait; a turn on a train for under 30 min when it goes with others
is no wait at all; an S5 fill-in replaces only its own craft; an L501 on duty never ends
an L502 wait (L501 itself is not scored: no expected call for it). Replayed over all 27
live day files: S5 → 19 calls + 14 taken off (each one a job a spare or MU crew filled),
0 unavailable; other pools lose 81 "removed" records, 74 of them a one-check flicker or
a turn that then worked that train (this also answers the old "one-check flickers" ❓).
Rebuilt from the day files every publish: no FORMAT bump, no Worker change. Laptop
pull/restart pending. 274 of 288 tests pass here (the same 14 fail without the change).
**Not fixed, ask Justin:** (a) the line-up itself still swaps the S5 crew right at the
call (Current and alerts see it; the 9th's swap came after the 8th's engine fixes, but the
laptop's version then isn't known); (b) `isDone` ignores a spare lined up for the same
yard job again within 3 days (yard job ids have no date; seen: B116 YPRS30 7th → 9th).
Also: this cloud session started on the stale 3rd Nov checkout again and was reset to
the GitHub branch (never push from that state).

**S5 swap watch (plan agreed with Justin 2026-11-10; he is on S501):** each night's
L502 is checked from the live day file the next morning (a scheduled message wakes the
session; trace the line-up crew per check from 15 min before the call until the Call
Board shows the train). Pass = the same crew from the last PLN check through the Call
Board. Past swaps all came on the first check after the call time. Justin's part: pull
the laptop, read the code version on Page Health, and on a night he is called look at
option 29 at the call (his row and S502's). Five clean nights in a row on the new code,
at least two of them S501's and two S502's = done; a swap on the new code = fix the
engine (known-crew shortcut, S5 audit). Results:

| L502 | Crew that went | Line-up at the call | Laptop code | Result |
|---|---|---|---|---|
| 05 | S502 | S501 at 0046 | before 8th fixes | swap |
| 08 | S501 | S502 at 0259 | before 8th fixes | swap |
| 09 | S502 | S501 at 0058 | not known | swap |

**Saved B111 question looked at, 2026-11-10 (another session, started by Justin: "start
with the rest tracker … the site should know who has enough time left for a road trip").
Nothing built, no code changed.** From the live day files for DHT040B 31 (TODO #8): the
site had B111 (slow 001) for DHT040B (call 0700) and B133 (slow 010, **fast 001**) for
A42431 31 (call 0845); CATS did the opposite, and B111 went to Toronto on A42431 (on duty
1045, working SA01). So B111 was not short of time for a road trip, and its reset was
fresh (hold until 30th 0559, then YBHS01 30th 0800). Not explained by rest, reset, PL or
B0. Other deadhead spare jobs (DHT249C 30, DHT377B 30) went down the slow board with the
first one passed, so "deadheads come off the fast board" does not hold in general: do not
build that. Asked Justin why B133 got the deadhead. Also noted: `spareFills` (spares.js)
does not use resets.json; only reset-alerts.js does (yard 8 h / YSBY 12 h / road 35 h),
so Current's "Filled by" can still show a spare who would be reset. Offered to make
spareFills pass those over; waiting for his answer. This cloud session too began on the
stale 3rd Nov checkout (kept locally as branch `stale-2026-11-03-backup`, never pushed).

**Pool filter promoted, 2026-11-09:** Justin approved the Test preview on his phone
("The change looks good. Update it on the real site"). Current and Snapshots → Pools at
Sarnia: the pool buttons are a filter (`pools(s, picked)`, `poolBody`, `poolPicks` in
public/board.html); each pool switched on adds its board under the others in pool order,
with All / Clear. Picks saved per device (localStorage `boardPoolFilter`); nothing saved →
the tracked turn's pool, else the first. A saved pick now wins: the tracked turn's pool is
no longer switched to on every refresh. A screen chip or an alert's turn switches that
pool on (not saved) and scrolls to its heading. Test is back to "No items awaiting
review." Checked locally in a browser on sample data (3 pools); the promoted version is
not yet seen on the live board. Laptop pull/restart/publish and phone refresh pending; no
Worker change. Full suite: 337 of 339 pass; the two failing Analytics Overview tests
failed before this work too.

**November 9, later session — site accounts (in progress).** Justin wants the site visible only to approved people. Cloudflare Access was tried on a new test Worker `board-test` (https://board-test.sarniaboard.workers.dev, same code and bucket as `board`) and dropped (free plan stops at 50 people). Built instead: accounts inside the Worker — read [ACCOUNTS.md](docs/board-checker/ACCOUNTS.md). Sign-up = name, email, PIN (CN employee number), hire date, email confirmed by a code; the page and emails must stay non-descript (no Sarnia, no CN: Justin's ask); Justin approves each by eye on `/account` (owner key); locked by the `LOCK=on` variable. State when this session ended:

- Code and tests are committed and pushed (`cloudflare/board-worker.js`, `test/board/accounts.test.js`). **Not deployed anywhere**: Justin pastes the Worker himself. He was given the `board-test` steps (Access off, delete `OWNER_EMAIL`, add `OWNER_KEY` + mail secrets, `LOCK=on`, paste). Ask him how the test went before doing more.
- Members tab added to `public/board.html` at Justin's ask (owner key only; Waiting / Approved, Access Member|Admin, Remove access; Worker action `role`). Needs the laptop publish and the Worker paste; checked here in a browser against the Worker code only.
- Tested by Justin on `board-test` 2026-11-09: sign-up, emailed code and approval from the Members tab worked. He pasted the accounts Worker into **both** `board-test` and `board` (main, unlocked) on 2026-11-09 evening; a later Worker change needs both pasted again (copy page: https://claude.ai/artifact/Ko95qHHnGfvW9r1m7suiNu, rebuilt by hand each time). Built 2026-11-10 in `board.html`, waiting for the laptop publish: the "sign up to keep access" banner (shows only when the Worker variable `SIGNUP_NOTICE=on`, the site is not locked and the device is not signed in) and the hop to `/account` when data comes back 401. **Banner back on in code later on 2026-11-10 at Justin's word** (`SIGNUP_BANNER = true`; it still needs `SIGNUP_NOTICE=on` on the Worker and the laptop publish). Sign-in now lasts until 30 days without a visit (his choice), 20 codes a day per email. One device per account (his choice: a sign-in elsewhere signs the first device out). Members tab lists Admins separately. The "account lost when made Admin" report was the laptop-deleting bug before the restart; a later Admin change worked. Earlier that day: banner switched off in code (`SIGNUP_BANNER = false` in `board.html`; Justin: "take the banner off until we get the login issues resolved") — turn it back on only when he says the login works. Login issue he hit twice: no code arrived and the page didn't say why; fixed in the Worker 2026-11-10 (the page now says: no account / waiting / already has an account / removed / asked too soon), needs pasting into both Workers. Note both Workers share one bucket, so **accounts are shared between `board-test` and `board`**. Left: he confirms codes arrive, banner back on, `SIGNUP_NOTICE=on` on `board`, members sign up, then `LOCK=on`. RailroadTracker is set aside (Justin: "Let's forget about the railroad app for now").
- **Real cause of the 2026-11-10 login trouble (members vanishing, codes not arriving): the laptop's site update deleted `accounts/` on every publish** — it was missing from `KEEP_PREFIXES` in `lib/board/r2.js`. Fixed and tested 2026-11-10; it only takes effect once the laptop has pulled and the checker is restarted. Every account made before that is gone; Justin signs up again. Any new Worker-owned R2 folder must be added to that list.
- Found on the way, not fixed: `isOwner()` trusts the `cf-access-authenticated-user-email` header and any `*.cloudflareaccess.com` token. With Access off and `OWNER_EMAIL` set, a stranger could send that header and pass the owner checks on `/health*`. The accounts list does not use it (owner key only). Have `OWNER_EMAIL` deleted wherever Access is off, or fix `accessEmail()`.
- Also this session: the local checkout was stale (Nov 3 history) and was reset to the GitHub branch; Justin sent a test alert himself with `node scripts/alert-check.js <CODE>` (worked). 14 tests fail in the cloud session with or without this change (same 14 before it).

**Reset tracker fix, 2026-11-09 (third session, started by Justin: "check how the reset
tracker is going, I think it might be missing some"):** his PSTS05Y log for the conductor
on **SA02** (he wrote SA07; the four trains in the log are SA02's) showed 7DY RESET
261111 0444, the site had 14th 0559 with no colour. Cause: off 5th 1020, on duty 7th 0600
= 43 h with the nights of the 6th and 7th "free", so the site logged a reset 7th 0559;
CATS did not, because the call (about 0400) disturbed that night (rest rules: two periods
"undisturbed by the company"). Now `naturalReset(a, b, call)` in lib/board/resets.js ends
the night test at the call, taken as on duty − 2 h (`CALL_MIN`); the 32 h still run to on
duty. Recomputed from the live day files: SA02 → 11th 0444, yellow, to the minute; none
of the other 68 turns changed. resets.json is rebuilt every check, so no FORMAT bump and
no Worker change. Laptop pull/restart pending. Also checked from live data (2026-11-09
1642): 15 board turns show nothing; 14 are right (reset 9th 0559 or 0700, not on duty
since, so no clock running); **S108** shows nothing because its name code is shared and
nothing is known before 6th 0455 (❓ could say "not known" instead of blank: ask). 11 of
310 turn trips in 9 days weren't credited to the current holder, all 1st–4th Nov, before
they were seen on the turn (SR03 = Justin's own, 4 trains: he was displaced then). Full
suite 339 of 341 (the same two Analytics Overview tests fail).

**Pool labels, 2026-11-09 (owner, straight to Current):** in Pools at Sarnia the buttons
and headings read Drags (SD), 1st Manifest (S1), 3rd Manifest (S3) (`POOL_LABELS` /
`poolLabel` in public/board.html). Wording only: snapshot pool names, jumps and saved
picks are unchanged. Analytics uses the same three names (its Pool picker and "Pools that took it" lists; `ANA_POOLS`, board-analytics.js `POOLS`). Laptop publish pending.

Justin confirmed the Page Health live check on November 9. Resume the Analytics review with **Stale trains**, then consistent filters. The dated handoff below preserves earlier deployment observations and settled rules.

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
  Two sessions may work at once (owner, 2026-11-09: "Change the rule. You working on the
  login is fine. I have another chat doing changes"): one on the **accounts/login** work
  (`cloudflare/board-worker.js` Accounts section, `test/board/accounts.test.js`,
  `docs/board-checker/ACCOUNTS.md`), one on the board page and checker. Each stays in its
  own files, pulls before pushing (rebase, never force-push), and when editing this
  handoff or TODO keeps the other session's sections. No third session without Justin's say.
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
- **Ordered Sarnia routing:** verify the next mismatched ordered train uses the
  calculated sequence for conductor/engineer and notification recipients, consumes
  that sequence's slot, and retains the CATS mismatch warning. Earlier e77e9ba
  routing to CATS's pool is superseded by the owner's November 7 correction.

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

- **Ordered Sarnia trains follow the calculated calling sequence** (owner correction,
  2026-11-07; supersedes the earlier CATS-pool override). Select the next turn and
  engineer from that sequence's pool and consume that pool's slot. A differing CATS
  ordered pool remains a mismatch flag, not a prediction override. Already-confirmed
  called/on-duty crews remain factual records. Toronto selection and 501/502 rules
  are unchanged.

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
  (00:00–05:59); manual rest/hold to 0559 also recorded. A night is not free when the
  call for the next duty (on duty − 2 h) falls in it (owner's PSTS05Y, SA02, 2026-11-09). Latest confirmed due formula
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
- **Sarnia rescue trains** (owner, 2026-11-07): an R-prefixed rescue on the
  Sarnia lineup is not excluded by the underlying Toronto-bound manifest number.
  If option 5 lists both conductor and engineer spare and neither row has a turn,
  show both crafts spare. If either craft is missing or any turn is listed, use
  the normal calculated Sarnia calling sequence. Expected call = lineup time
  minus 2 h 15 m. Match option-5 rows to the same rescue/time, not another day's run.
  Confirm actual cover and subsequent slot counts on real CATS.
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
- Site: https://board.sarniaboard.workers.dev — open link, Access off (accounts lock being built, 2026-11-09: ACCOUNTS.md). Worker + R2
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

Ordered Sarnia correction, 2026-11-07: removed the CATS ordered-pool override.
Partial-day inference still uses confirmed departures, not an unworked ordered
row's crew code. FORMAT 25 refreshes cached site predictions. Committed does not
confirm laptop pull/restart, publication, or real-CATS notification validation.

Rescue-lineup implementation: both-craft unassigned option-5 rescues display
spare/spare without allocating a regular turn; other rescues use the normal sequence.
FORMAT 26 rebuilds site caches. Missing non-Toronto predictions now say crew
prediction unavailable and retain a calculated call; the former blanket Toronto
fallback was misleading. A current Sarnia lineup row now supersedes an older remembered departure of the
same printed train identity, restoring normal sequence prediction without double
counting; confirmed current Call Board crews remain factual. Live verification
remains open. No Worker deployment performed.

Owner Test tab (2026-11-07): hidden unless this browser has an owner key and
the existing health endpoint confirms owner access. Direct #test rendering checks
the same gate. Initial preview uses saved Turn History data in compact trip cards;
the regular Turn History UI remains unchanged. Future candidate layouts belong in
Test until Justin approves promotion. Opening previews does not change assignments
or send notifications. Pull/restart/publication and owner-phone visual verification
remain pending; no Worker changes.

Rescue heads-up targeting — owner correction, 2026-11-08: Toronto option 41975
rescues notify only crews waiting in the bunkhouse. Sarnia rescue heads-ups go
to predicted/possible assignees and turns whose expected train/job changes because
of that rescue, not every home board. Compare the full current assignment states
against the same check rerun without that exact rescue (symbol + originDay),
including spare coverage, backup and PL warnings; keep other rescues and actual
Call Board evidence. Existing rescue preference and deduplication remain. No real
notification tests were sent. Laptop pull/restart, live recipients and delivery
verification remain pending; no Worker change.

Call timeline colour update — owner, 2026-11-08 (supersedes black Lost Sleep):
all shared call timelines now use yellow for an early-call gap of 30 minutes or
less and red for more than 30 minutes. Green vertical bars mark the original
eight-hour planning window boundaries when within the observed axis; the actual
call marker remains separate and visible when times coincide. Late-call colours
remain yellow up to one hour / red beyond. Lost Sleep durations, axes, timestamps
and railway calculations are unchanged. Nine timeline tests pass; publication
and visual verification pending. No Worker change.

Call timeline purple waiting — owner clarification, 2026-11-08: late waiting
runs from the original expected call until the actual call, inferred as confirmed
on-duty minus 120 minutes. Ordering first-observed time is not the endpoint.
Purple replaces the prior late yellow/red bands; early Lost Sleep remains yellow
<=30 minutes / red >30 minutes. Axis extends to a later actual call even if an
older record lacks ordered markers. Removed records are not shown as called.
This is call-plan displacement, not measured sleep or the separate collector's
15-minute stale-train threshold. Shared renderer covers Analytics, Turn History
and owner Test. Ten timeline tests pass; live verification pending. No Worker change.

Owner Test preview replacement — 2026-11-08: owner declined promotion of the
trip cards. Removed the isolated card preview and its styling from Test; regular
Turn History stays unchanged. Test still defaults to JUOD and supports name codes
and turns, now showing condensed history-note changes with full train ids.
Unchanged statuses and position-only changes are folded into the complete original
notes disclosure; each displayed change can expand its original note and snapshot.
Raw saved history and calculations remain unchanged. Syntax and sample rendering
checks pass; laptop publication/owner visual review pending. No Worker change.

Approved Changes-section promotion — 2026-11-08: owner approved the simplified
notes preview. Turn/name-code History Changes now show newly changed note segments,
with per-check full notes and every-original-note disclosures. Position-only and
unchanged status repetitions stay in the full history. Now, work history cards,
call timelines, railway calculations and notifications are unchanged. Owner Test
uses the same approved renderer. Syntax, condensation and raw-note preservation
checks pass; live publication remains pending. Order summary is review-only.

Order-summary trip correction — 2026-11-08: changed departure time/crew/station
withdraws the old Toronto off-duty match and away-crew mapping; crew-only corrections
are no longer skipped. Original events remain with explicit withdrawal/correction
entries. Invalid legacy rows cannot feed positive durations or held-away totals.
FORMAT 27 rebuilds retained snapshots. 49 targeted tests pass; laptop publication
and real-CATS verification remain pending. Error/evidence/fix list:
[Trip data fixes](docs/board-checker/TRIP-DATA-FIXES-2026-11-08.md).
No calling-rule, notification or Worker change.

Owner Test Order-summary preview — 2026-11-08: replaced the previous history-note
example (already promoted) with the owner's requested items 2–6. Six-column
summary shows full dated train ID/status, first plan, latest order, actual duty,
and differences from first plan/latest order. Expanded facts retain first-order
comparison, first-seen, crew, off-duty and duration. Key events retain movements
over 30 min plus all non-movement events; every original event is expandable.
Origin/day/search and evidence-based status filters are preview-only. Disappearance
is labelled no call observed, not proof of cancellation. Only verified owner-key
browsers can render Test. Regular Order summary, Changes, cards, calculations and
notifications are unchanged. Syntax/sample/filter/access checks pass; owner visual
review and publication pending. No Worker change.

Order-summary promotion approved — 2026-11-08: owner approved Test items 2–6
for the regular Order summary. Shared renderer retains six-column summary,
first/latest-order comparisons, key events with every original event expandable,
evidence-based disappearance labels and status/day/origin/search filters. Dropdowns
and search use the prior Order-summary theme styling and friendly day labels.
Chronological row order, full dated-ID deep links, snapshot links and share links
are retained. Test remains owner-key gated; regular summary remains public.
No railway/notification changes. Publication and live visual verification pending.

Article 18.6(b) filing usability — 2026-11-08: approved items 5–7 implemented.
Selected stay's form appears immediately below its row/card. Four filing steps,
separate missing-field/setup reasons, a complete review and explicit confirmation
precede Submit. Editing invalidates review. Successful service response shows a
client-generated reference included in the submitted/exported text; last 50 receipt
references stay on that device (no added name/PIN storage). This is service acceptance,
not verified inbox delivery. Failed sends retain retry and show the error. Export
remains available for drafts. Times, held calculations, violation tiles and craft
eligibility/workflow remain unchanged; engineer workflow decision remains open.
Four mocked submission tests and 26 existing site/trip tests pass; no real submission
sent. Laptop publication and phone review pending. No Worker change.

Owner-only Test: collapsible Current boxes — 2026-11-08. Replaces the approved
Order-summary preview (regular Order summary retains those changes). Latest saved
Current sections keep their contents/order and render as native expandable boxes:
tap the whole header, or Enter/Space; initially open, open/closed state retained
within this page session, including pool/spare-job tab rerenders. Owner key plus
successful health authorization required, checked again after loading. Regular
Current and snapshots unchanged. Syntax and 26 site/filing tests pass. Local browser
visual check unavailable (Chromium not installed); laptop publication and owner-phone
verification remain open. No railway, notification or Worker changes.

Engineer filing clarification — owner, 2026-11-08: earlier engineer details/Copy-only
restriction is superseded; engineers may use the shared filing form. This resolves
the previously open workflow decision; no change to railway/held calculations.

Collapsible Current boxes promoted — owner approval, 2026-11-08: owner reported
Test works and requested promotion. Current now shares the approved native header
expand/collapse behavior. Initially open; Current and Test keep separate session
open states. Pool/spare-job tabs retain state; Arrange and Snapshots stay unchanged.
Screen shortcuts and notification section jumps open a collapsed destination before
scrolling. Test retains the shared layout. 26 site/filing checks and syntax pass.
Owner verified the Test version; production pull/restart/publication verification
remains pending. No railway, notification-delivery or Worker changes.

S5 Garnet tie-up correction — owner evidence, 2026-11-08: S501 tied up in
Garnet (terminal 1) and S502 home both showed local position 001; alphabetical
tie-breaking incorrectly put S501 on L50231 09. Equal positions now break by
location: home before away, outbound L502 last. Distinct positions remain primary;
PL/rest/hold and MU do not reorder crews, craft coverage remains separate. Shared
engine feeds Current predictions and S5 display order; notification routing unchanged.
FORMAT 28 rebuilds cached site snapshots. 69 engine/site tests pass, including both
turn directions, row order, MU/PL, per-craft coverage and distinct positions.
Owner reports preceding notification correct; no notification sent during testing.
Pull/restart and live confirmation L50231 09 -> S502 remain pending. No Worker change.

S5 full-cycle audit — 2026-11-08: [findings and evidence](docs/board-checker/S5-CYCLE-AUDIT-2026-11-08.md).
14 reconstructed cycle stages pass across engine/board/notification states;
123 tests pass, two explicit TODO defects remain: dated-identity bypass and
one-craft-to-both confirmation in known-crew shortcut. Simplified Why lacks S5
selection reason. Live remained Updated Nov 8 13:59 / check 13:57, still S501
for L50231 09: prior fix not confirmed published. Saved history notes reviewed;
no raw full-cycle S5 fixtures available. No app/rule/notification changes in audit.

S5 Why simplification — owner request, 2026-11-08: Test-only Current preview
replaces the L502 calling-sequence list with the crew lined up (CO/EN separately)
and the other regular S5 crew's recorded status (e.g. in Garnet or returning on
L50131). Retains rest/PL/status details and available spare-cover explanation;
no MU ownership inference, other-train list or recalculation. Regular Current Why
and all other trains remain unchanged pending approval. Syntax and six rendering
checks pass; publication/phone review open. No Worker or notification change.

Analytics Overview directory preview — 2026-11-08: Test defaults to a new grouped
guide for all seven real Analytics tabs, with descriptions, evidence caveats and
working buttons opening existing Analytics destinations. No fabricated statistics.
Groups: Start here, Your work, Compare work, Calling and waiting, Check assignments.
Test selector preserves pending Current/S5 Why preview. Regular Overview and all
calculations/notifications unchanged. Syntax, exact-seven destination/exclusion/
navigation checks and 26 site/filing tests pass; phone/publication review pending.
No Worker update. S5 audit defects remain open.

Analytics Overview promotion — owner approval, 2026-11-08: “Push the analytics
change.” Regular Analytics Overview now uses the approved grouped seven-tab guide
from Test, with working destination buttons and descriptions. Test retains the shared
preview and separate Current/S5 Why choice; S5 Why is not promoted. Replaces prior
Overview display only; underlying detail pages, collection/calculations and notifications
unchanged. Syntax, public/Test rendering, destination/isolation checks and 26 site/
filing tests pass. Pull/restart/publication/phone verification pending; no Worker update.
This supersedes Analytics Overview's awaiting-promotion status in the session handoff.

Session handoff refreshed — 2026-11-08 evening: [latest continuation](docs/board-checker/HANDOFF-2026-11-08-SESSION.md)
records promotion commit 751e7e4 from the separate review session. Do not duplicate
its work. Original review sequence after Overview: Assignment errors, Call stability,
Stale trains, filters; first verify promoted work and reconcile that session's results.
Two S5 engine audit defects remain open. Documentation-only update; no live verification.
