# HANDOFF — read this before doing anything

## Yardmaster spare jobs: WHO GETS THEM — STARTED 13 Nov 2026 (evening), NOTHING BUILT; going through his CATS screens first

**Owner, 13 Nov:** "how to determine who gets yard spare jobs", then, correcting me: "not yard spare jobs,
yard master spare jobs. There is no logic built in yet and there are a few more screens to work thru".
This is the next step after the section below (which only records the YA jobs going spare and shows them on
the test site's Analytics). Nothing predicts who fills a YA job; the yardmaster spareboard is not read, and
no seniority or qualified-yardmaster list is read.

**What the Sarnia calling manual says** (`data/crew_calling_cty.pdf`, "Relief – Yardmasters", p. 20, dated
2011): by **seniority**, not first in first out like the fast and slow boards: (1) senior qualified
unassigned yardmaster available for a 2 h call at straight time; (2) the same who can give on-time relief;
(3) senior qualified regular yardmaster (on rest days) for a 2 h call at time and a half, if it doesn't
interfere with their own job; (4) the same, on-time relief; (5, 6) senior qualified unassigned yardmaster
working under 4.16 (a qualified YM working as a conductor, as SA01 did on YSBY04 28 Oct and YSBY06 31 Oct),
2 h call, then on-time relief; (7, 8) the same under any other agreement (5.1); (9) canvass any qualified
yardmaster in seniority order. Locomotive engineers only at the canvass. The yardmasters' own agreement is
not in the corpus. **Not confirmed with him that Sarnia still works this way.**

**To ask him as the screens come** (railway questions: ask, don't guess): which screen is the yardmaster
spareboard and what order it is in; does the manual's ladder hold; is the call 2 h before the start; can a
qualified yardmaster on a pool or spare turn be told apart anywhere on CATS.

**Seen on the way, not his ask, nothing built (yard crews FO/S1, not yardmasters):** replaying the 29 live
days, the site named the right spare for 61 of 118 FO/S1 yard jobs; 36 of the 57 misses were the right
spares on another job starting at the same time. In 12 of 12 FO+S1 pairs where one spare had never worked
FO, that spare took the S1; the manual's "same on-duty time: the employee chooses" fits the rest. Scripts were
in the session's scratchpad only; redo from the day files if he asks.

**For the next session:** this one also began on a stale checkout (50 commits behind the branch); fetch the
branch and read this file from it before anything else.

## Yardmaster jobs going spare (CATS CC YA) kept and shown — BUILT 13 Nov 2026 (laptop `lib/board/site.js`, `lib/board/insights.js`; page `public/board.html`, test site only). WAITING ON ONE LAPTOP PULL + RESTART (the next publish redoes all 30 days: FORMAT 29 → 30, one slower publish); then his look at Analytics → Yardmaster jobs on board-test

**Owner, 13 Nov:** "can you see YM jobs that go spare, if you have been recording them can you show me what
you know". **What was found:** CATS's option 5 lists yardmaster jobs with CC **YA** (his own screen of 24 Oct,
in `screens-extra.test.js`: "002 10/24 0630 … YSTY01 … YD YA … YSTY01"; "YM" appears nowhere in 29 saved days).
`parseTerminalLineup` reads them every check, and the laptop's history (`BoardChecker\history`, 90 days) keeps
the masked screens with them; but since 24 Oct, at his word ("Yardmaster jobs (CC YA) go to the yardmaster
spareboard, not ours"), `snapshotOf` dropped them before anything was saved, so **no published file ever had
them** (saved vacancy crafts: CO, EN, FO, S1 only). The laptop could not be reached from the session (no
Remote Control folder), so the history was not read directly. **Seen in the published days (told to him):**
the YA jobs are YSBY01–06 and YSTY01; YSBY02 "temporary vacancy (working another job for now)" 3–4 Nov (crews
in town); the Call Board named the turn of who worked a YA job three times: YSBY04 24 Oct 1900 "YT SD10",
YSBY04 28 Oct 1900 and YSBY06 31 Oct 1430 "YA SA01"; option 4 "OFF" on YSBY03 6 Nov and YSBY01 13 Nov.

**Built.** (1) `snapshotOf` keeps option 5's CC YA rows as `yardmasterJobs` in each check (pos, at, status,
train = the job, pool, cc, st, returns, turn; never the EMP column), **apart from every other list**: `ours`,
`vacancies`, `vacanciesCats`, `vacanciesPredicted`, alerts and spares.js still leave YA out, unchanged.
FORMAT 30 so the cached days are redone from the history at the next publish (the 30 days the site keeps;
option 5 has been read since 24 Oct). (2) `insights.js` `yardmasterCheck`: one entry a job and start (`at`
resolved), first / last listed, checks, status; the shift on the Call Board within 4 h of the start (`onDuty`,
and the crew line: "YA SA01" when the person is on a board the checker reads, `''` when not; a later check
naming nobody doesn't wipe a named turn); `finish()` → `analytics.json` `yardmasterJobs`. (3) Page: Analytics →
**"Yardmaster jobs"** (`ANA_SECS` 'ym', pushed only when `PREVIEW`, like the likely-call test; `anaYardmaster`):
a note, three tiles (going spare, shift seen, worked by someone on a board), by job / day of the week / worked
by, and every one newest first (job, starts, first listed → last listed, worked by). Until the laptop runs
this code the page says "No yardmaster jobs going spare in the dates picked."

**Checked.** Suite **568 of 568** (`insights.test.js`: grouping by job and start, the next day's is another,
the Call Board shift matched by job and within 4 h, a later blank crew doesn't wipe SA01, never in spareJobs;
`screens-extra.test.js`: the YA row kept as `yardmasterJobs`, still not in the three vacancy lists; broken on
purpose seven ways, all caught). `buildSite` run on a one-check history made from the test fixture with his
24 Oct option 5 layout: the day file (format 30) has the row, `analytics.json` has YSTY01 with "YA SA01", the
regular list only YPRS02. In a browser over real board-test as him: the tab, the real file → "No yardmaster
jobs …"; with three **made-up** entries added to the real file → the page drawn at 390 px, no sideways scroll,
no errors. Board-test and board as a member, board as him: no tab. **Not checked:** the real history on the
laptop (the first real list appears after his pull + restart); the yardmaster spareboard itself is not read,
so "worked by" is often blank.

**Still his:** "YM": CATS writes YA; asked whether he meant something else.

## Yard off duty from CATS's own O-T (3 → 7 with YD), never the Call Board — BUILT 13 Nov 2026. The read feeds both sites' data (laptop); what the page does with it is TEST SITE ONLY (My stats' yard view, and a test-site reset tracker). LIVE: the laptop runs `64e328b` since 07:12 Toronto (he pulled and restarted); the backfill from 26 Oct ran at 07:08 and matches his photo. The `b329d94` Worker PASTED INTO BOTH ("pasted both workers, check it"), checked about 07:25. WAITING ON his look on board-test

**Owner, 13 Nov:** "Do not use the call board to determine off duty since if they forget to tie up it will sit there.
We have to manually close our ticket in the computer, untill we do the job will stay on the call board", then "We
wont need to assume yard off duty times building 3 - 7 YD read, we can also scrap info going back to Oct 26th to get
off duty times and you can match them to the people who worked it if we have enough data". Earlier that day: yes to
the reset tracker going by real yard ends (the ⚠ section below: now built this way instead).
- **The read (`scripts/board-auto.js`).** After the hourly train read: 3 → 7, POOL OR YD/LO `YD`, HOME/AWAY blank,
  START DATE three days back (so a ticket closed a day or two late is read again), F8 to the end (10 pages at most;
  stops when a page brings nothing new). Saved as `yardHistory`, masked like every screen (the description reads
  AAAA; job, date, times and O-T kept; no names on this list). **The first check after the restart does a one-time
  backfill from 261026**, to the end (150 pages at most); `BoardChecker\yard-backfill-done.json` marks it done, only
  when it paged to the end. To read it again: delete that file, or `node scripts/assign-backfill.js 2026-10-26 yard`
  for another start. Trouble skips it (logged) and it tries again an hour later. Window line: "Yard assignment
  history (backfill from 261026) (3 → 7, YD): N page(s), N yard shifts over N day(s), N with O-T."
- **Reader.** `screens.js` `isYardHistory` (ASSIGNMENT HISTORY and an O-T heading: the train list has none) and
  `parseYardHistory` → `{ job, on, ot }` (minutes; null when blank; the O-T cell by the heading's place, else four
  figures at the end after a description of two words or more). `summary.js` → `yardHistory`. `resets.js` →
  `acc.yardOT[job/on] = { ot, seen }`, the latest read winning (`collect`, `merge`).
- **When a yard shift ended (`MyStats.otOf`):** 8 h + O-T. A blank is no overtime only when it was read after the
  run had left the Call Board (the ticket closed, as he says); read while it was still listed, not known yet. The
  Call Board only tells those two apart, never gives the time. A run is matched by job and on-duty time (30 min).
- **Matched to who worked it:** by job and on duty, to each person's named yard shifts (the names read off the Call
  Board, as before): their record's shift gets `oe`, the end by CATS. Not when they came off the job's crew lines
  more than 30 min before that while it was still on (someone took over: their own last stays), nor when it would
  run into their next trip. Days a job's list could not say who came in (`unk`) stay unmatched; the crew info page
  (Housekeeping item 11, his photo pending) would be the way.
- **My stats, the test site's yard view:** a shift ends at `oe` (exact, no ~) where CATS has it, else 8 / 12 h (~).
  **Gone:** `cb` / `ob` (the Call Board's and the crew line's ends) and `boardEnd`; `merge` drops them from kept
  records. **Kept:** `ru`, the "on rest until" their crew line went to after the shift (now looked for from an hour
  in to 12 h past the end, any gap in the checks), so "Rest you booked" = rest until − the CATS end. Reworded: "N of M
  yard timed by CATS", "Shifts with their end from CATS", "Yard shifts that ran over" ("Shorter than its job's
  length" only when a 12 h job had under 4 h of O-T), the captions and footnote ("8 hours after it went on duty plus
  the O-T CATS shows for it, never by the Call Board"). `data/yardjobs.json` (`yardJobs(yard, { ot })`): the runs on
  the Call Board and on the list joined; length, middle, over and longest by O-T; the "early" figure gone.
- **Reset tracker for the test site: `data/resets-test.json`.** The same tracker, with each named yard shift ending
  8 h + O-T where CATS has it (`MyStatsFiles.yardEnds` → `acc.yardEnds`, `resets.js offDuty` how `yard O-T`), else
  8 / 12 h. The page reads it only under `PREVIEW` (`resetsFile`; falls back to resets.json; read again when the owner
  key turns PREVIEW on). **The main site, the alerts and My stats' own resets go on by resets.json (8 / 12 h).**
  The same as resets.json until O-T is read.

**Checked.** Suite **568 of 568**. New tests: the reader on his photo's page masked as saved, and with no heading;
the summary; `yardOT` collect / merge; `otOf` (filled in; blank read after / before the closing; still listed; never
seen; 30-min match; another job); a shift's `oe` (1 h 16 of O-T; one that would run into the next shift; a blank once
closed; someone gone early); the per-job figures by O-T; the test-site tracker's ends and the page's choice of file;
the site build writing `resets-test.json`. **The 29 published days rebuilt: 2016 of 2016 main-site My stats drawings
and spreadsheets the same as before, all 168 people.** With made-up O-T (no real read yet): 555 of 595 yard shifts
get an end; the page drawn in a browser over the real board-test with the owner key: `resets-test.json` asked (404
for now), resets.json used, no errors, no sideways scroll. **On real data, the rest-until theory holds:** of 71
shifts with a rest booked, rest until − the 8 / 12 h end is a whole number of hours in 46 (43 of them exactly 10 h),
most of the rest within a minute or two. So "on rest until" counts from the off-duty time the crew enters, which is
8 h + O-T for most shifts. A few are 5 to 15 min short: crews off a little before 8 h, which a blank O-T can't show.
**Not checked:** the real screen (his laptop's first read is the test): the box labels with YD, where the O-T cell
sits, the last page's F8, how far back CATS keeps the yard list, and whether CATS carries the yard read's START
DATE into the next train read (that read leaves START DATE as CATS has it; three days back is within its 8 pages).
**Seen live, 13 Nov about 07:15 Toronto (read only: /health, data/2026-11-13.json, yardjobs.json,
resets-test.json).** His first pull at about 06:56 got `eec4d11` (before this push at 07:00); by 07:12 the laptop
reported `64e328b`. **The backfill read at 07:08: 342 yard shifts, on duty 26 Oct 0600 to 13 Nov 0800, 17 to 20 a
day, 89 with O-T filled in.** **The 11th is his photo exactly:** YSBY03 0700 and YSBY04 1900 at 240 min (0400), the
other 14 of the photo blank; the next page's YINS60 2330 60 min, YFLS60 and YMPS60 2359 blank. YSTY01 on the 11th is
blank: the 2 h 10 "over" the Call Board gave it was the ticket closed late, as he said. `resets-test.json`: 263 named
yard shifts ended by CATS. `yardjobs.json`: YSBY01 to YSBY05 12 h jobs (all O-T 0400), YSBY06 8 h, the rest 8 h;
YMPS31 ran 15 min or more over on 9 of 18 runs (longest 11 h 50), YMPS60 4 of 17; most jobs 0 or 1. Runs not timed
are the Call Board's 23 to 25 Oct (before the backfill's start) and today's still on. **Rest check with the real O-T:**
of the 71 shifts with a rest booked (all now have O-T), rest until − (8 h + O-T) is a whole number of hours in 60 (46
from the old 8 / 12 h), within 2 min in 3 more; the other 8 are blank-O-T shifts 5 to 19 min short of 10 h (crews off
a few minutes before 8 h: YFLS60 / YMPS60 2359 jobs off about 0740 to 0752; a blank O-T cannot show it).
**The Worker paste, checked 13 Nov about 07:25 Toronto (his word: "pasted both workers, check it"; read only,
counts only):** both `board-test` and `board` answer the owner key's `GET /auth/stats?code=`: a bad code 400 with
the name-code message, a code with no record `{ state: ok, other: true, stats: null }`, a yard worker's code their
record (14 yard shifts, 11 with `oe`, 1 `ru`, no `cb` / `ob`; the 3 without an end are 23 to 25 Oct, before the
backfill's 26 Oct). **In a browser on the real board-test with the owner key (nothing intercepted, nothing
written):** `PREVIEW` on, `resets-test.json` read, My stats' lookup box opened that code: "<code>'s page, opened
with the owner key", the yard sections, "11 of 14 yard timed by CATS", "2 of 11 shifts 15 min or more over", no
errors, no sideways scroll. A backfill from 23 Oct would time those 3: `node scripts/assign-backfill.js 2026-10-23
yard` on the laptop (offered, not asked for).
**Next:** his look on board-test (a yard worker's My stats through the lookup; the board colours from
`resets-test.json`). The main site only at his word.

## Job Aids: "Days out of Sarnia: add each pool to your calendar" — a calendar file (.ics) for each pool from the pools' rotation — BUILT FOR THE TEST SITE ONLY, 13 Nov 2026 (`public/board-ref.js`, `public/board.html`; page only). WAITING ON ONE LAPTOP PULL; then his look and a real import into his Google Calendar

**Owner, 13 Nov, latest:** "I dont want a calendar of what jobs were worked for pools in job aids, I want there to be a
way to add the days out for each pool rto your calendar". **Done:** the record of trips worked (the "Days out of
Sarnia, a calendar for each turn" section built earlier the same day: `tripsOut`, `daysOut`, `outBox`, `.outcal`)
is gone from the page and the code. The section left is the rotation one, renamed and re-ordered: **a download
button for each pool** (1st Manifest (S1), 3rd Manifest (S3), A pool (SA), B pool (SB), 501/502, each with its
colour) and **All pools**, each file naming its own calendar (`X-WR-CALNAME:Days out: A pool (SA)`; file
`days-out-SA-from-2026-11-13.ics`); **one turn only** (a select, then "Download SA05's days out"; a turn typed in
the search is put there); **starting** (a date, today by default) and **for** 1, 3, 6 or 12 months (3); how to
import; then "Due out, the week from …" (the seven days) and "The rotation" (the fit lines). Seen in a browser
over the real board-test as him: S1 276 events (3 months), A pool 276, all pools 1,012, SA05 for 1 month 10, 501/502
from 1 Dec for 1 month 31; no sideways scroll, no errors; members on both sites and him on the main site: no section.
Suite **563 of 563**. The old section's notes (below, "first built as") are kept for the history only.

### First built as "Due out of Sarnia" (13 Nov, earlier); what still holds

**Owner, 13 Nov, with a photo of his own Google Calendar** (October, an all-day event per turn per day,
S1 turns in green, SA turns in yellow): "I want you to be able to export something like this so you can see
what pool jobs are due out of Sarnia on a particular day".

**Found:** the pools go out in a strict rotation: each day the same number of turns, in turn-number order,
round and round. S1 3 a day of S101–S110, A pool 3 of SA01–SA09, S3 2 of S301–S306, B pool 2 of SB01–SB06,
501/502 1 of 2. **Every trip out in the trains file (16 Oct to 13 Nov) fits it: 284 of 284.** His calendar
fits it too (8 Oct S104 S105 S106 / SA02 SA03; 10 Oct S101 S102 S110 / SA01 SA08). (The trips-worked calendar
built first had said these pools have no set days: wrong; that calendar is gone now at his word.)

**What he sees on board-test (owner key, `PREVIEW`).** Job Aids → **"Due out of Sarnia: S1, S3, A pool, B pool,
501/502 by day"** (after the yard jobs): a date (today by default) and the seven days from it, each with the
turns due out, a colour a pool (S1 green, SA yellow as on his calendar; S3 blue, SB purple, 501/502 orange;
today's row marked); "The rotation": each pool's turns a day, its turns and "matched N of N trips since …"
(⚠ "not holding" under 90%); "Put it on your calendar": pool buttons (all on), a turn (every turn, or one),
how far ahead (1, 3, 6, 12 months, default 3), **"Download the calendar file (.ics)"**: an all-day event per
turn per day, named by the turn (SUMMARY `S104`, UID `S104-20261114@sarnia-board`, CATEGORIES the pool),
from the date picked. How to import is on the page (Google: Settings → Import & export on a computer, a
calendar per pool for its colour; iPhone: open the file, Add All; a newer file into a fresh calendar).

**How the rotation is worked out (`fitRotation`).** Live, from `data/trains.json` each time the tab opens:
trips out of Sarnia in the last 21 days of the file (a turn once a day), the turns seen twice or more (a
stray turn is left out, and its trips), trips a day = trips ÷ days with trips, then the place in the order
that fits the most trips. So it follows the pools if a turn is added or the order moves; it can't foresee
it. Turns as `crewTurns`: the Call Board's engineer and conductor (EN / CO / LE; a trainee riding is not
the turn, nor the trainee slots 98/99); the bunkhouse pairing (`awayCo` / `awayEn`) only where the Call Board
had no conductor / engineer (it guessed wrong once: RM39491 10 named SA05, who went out on M30241 09).

**Where.** `public/board-ref.js`: `EPOCH`, `dayNo`, `fitRotation`, `fitsOf` (cached on the state),
`icsFor`, `dueBox`, `wireDue`, `paintLive` (both live boxes; `paintOut` in the API), the section in `render`.
`public/board.html`: `.duegrp` and `.pS1`… colours, `.duet`, `.duefit`, the date and select rules.

**Checked.** Suite **562 of 562** (`test/board/ref.test.js`, 3 new: the fit from a month of trains made
from the rotation gives his calendar's 8 and 10 Oct, the board's own 11–13 Nov, 501/502 by day, a stray
turn left out, too few trips → nothing; the file: VCALENDAR, 11 events a day, lines folded at 75, one turn
every third day, one pool; the gating and the 7 rows; broken on purpose eight ways, seven caught, the eighth
(the offset's sign) gives the same days). In a browser over the real board-test as him: the week (13 Nov:
S102 S103 S104 / SA02 SA03 SA04, the board's own S102 + SA02 that morning), the fit lines (58 of 58, 42 of
42, 58 of 58, 42 of 42, 17 of 17), 8 Oct picked (his calendar's days), the file downloaded (1,012 events for
3 months), SA05 alone (every third day). Members on both sites and him on the main site: no section. **Not
checked:** a real import into Google Calendar or an iPhone; a real phone.

## Job Aids: yard jobs, their days off and the relief rotations — BUILT FOR THE TEST SITE ONLY, 13 Nov 2026 (`public/board-ref.js`, one line in `public/board.html`; page only, no Worker change). WAITING ON ONE LAPTOP PULL; then his look and his answer on YEBS03's weekends

**Owner, 13 Nov:** "read the handoff, I want to add some information to the Job Aid section", then "I want to
add the yard jobs and their schedule and rotations. Can you pull all this info". Built on the test site only
(the rule he has kept for everything; he was told so and did not say otherwise).

**Where it came from.** No sheet: read off the main site's 29 saved days (`data/<day>.json`, read only;
yard jobs from 24 Oct to 12 Nov): every yard job's on-duty time on the Call Board (`yardJobs`, 377 runs),
who held each job (`people`, `own: true`, from the crews in town) and who worked it (`own: false`), each
shift matched to its run so a 2300 / 2359 job counts on the day it goes on duty. `data/yardjobs.json` is not
published yet (not pulled), so it was not used. **Agrees with:** CATS's own headings "XSAS01 REL#1 TH/FR OFF"
and "XSAS03 REL#3 MO/TU OFF" (the crews-in-town test fixtures) and his own XSAS01 reading of 11 Nov (Sat/Sun
YBHS01, Mon/Tue YPRS02, Wed YPRS30). Every relief job comes out five days on, two off. The scripts were in
the session's scratchpad only (not kept); the method is above, and the numbers are in the code's comments.

**What he sees on board-test (owner key, `PREVIEW`).** Job Aids → a new folded section, second, **"Yard jobs:
start times, days off and relief"**: (1) **Each job**: the 16 regular jobs by on-duty time, the crew's two days
off and which relief covers them (YBHS60's Saturday is XSAS05 as YBHS61; YEBS03's Thu/Fri is XSAS05 as YEBS04
at 0700); (2) **Relief jobs: their week**: XSAS01 to XSAS05, days off and each day's job with its start, from
the day after the days off; (3) **Tower (YSBY, 12 h)**: YSBY01/02 and YSBY03/04 take turns 2-2-3 over two
weeks (week A began Mon 26 Oct and 9 Nov); "This week" and "Next week" are worked out from the phone's date;
(4) **Extra jobs** (YFXS01, YFXS03, YHXS01, YMXS01, YMXS02, YSBY05) with how often the checks saw them; a
footnote saying where it came from and that a bulletin or a change of card changes it. The tab's search finds
a job, a relief or "tower". **No names anywhere.** A member on either site, and his own view of the main site,
get the tab exactly as before.

**13 Nov, later: "can get rid of the covered by column for the non relief jobs".** Done: the Each job table is
Job · On duty · Crew off (YINS30 keeps "Runs Mon–Fri only" under its name); who covers what is only in the relief
jobs' table now. The search no longer lists a regular job for a relief's name (the relief's row names its jobs).

**Not certain, told to him / to ask:** ❓ **YEBS03 on Sat and Sun** (the checks show XSAS01, a YINS60 holder
and spares on it, the own crew once in three weekends): the page says "not clear from the checks". YFLS01's
Sunday, YSTY01's and YSBY06's weekends: no relief job seen (other yard crews and spares): put as such. The
crafts (FO, S1, YA, EN) are left off. Only three weeks of data: each weekday seen three times.

**Where.** `public/board-ref.js`: `DAYS`, `YARD_JOBS`, `RUNS_AS`, `RELIEF`, `TOWER`, `EXTRAS`, then
`yardCover`, `towerOn`, `reliefWeek`, `yardSection`; the section in `render` behind `state.preview`.
`public/board.html` `renderRef`: `refState.preview = PREVIEW`. **To change a rotation:** edit `RELIEF` (each
job's "covered by" is worked out from it). **To promote:** drop `state.preview ?` in `render` (and the
`refState.preview` line), and change the gating test in `test/board/ref.test.js`, quoting him.

**Checked.** Suite **548 of 548** (`test/board/ref.test.js`, 4 new: relief five on / two off and on known
jobs, CATS's two headings and his XSAS01 reading; each job's days off and cover; the tower against all 21
days the checks saw; the gating and the search; each broken on purpose four ways, a test fails every time).
In a browser at 390 px, this branch's page over the real sites (nothing saved, every non-GET stopped):
board-test as him: the section, no sideways scroll, every table inside its box, the search for XSAS02,
YBHS60 and "tower"; board-test and board as a member, and board as him: the tab as before, no section. No
page errors. **Not checked:** a real phone; page styles other than light.

**Also for the next session:** this session too began on a stale checkout (42 commits behind
`origin/claude/vigilant-planck-zawrj4`; fast-forwarded). `node_modules` was empty: `npm ci` before `npm
test` (without it 18 tests fail for missing packages).

## The Call Board dropped his CO line; the 501/502 board's MU01 had the wrong name — both fixed 13 Nov 2026, about 06:05 Toronto (laptop + page). ON `claude/vigilant-planck-zawrj4` (his "Yes" to putting this work there, the Toronto fix below). WAITING ON ONE LAPTOP PULL + RESTART

**Owner, 13 Nov about 05:47 and 05:52 Toronto, two photos of Current:** (1) the 501/502 board's **MU01 CO "out
working on L50231"** had the name of the MU01 who had been in the Toronto bunkhouse: "⟨he⟩ is not working
502"; (2) "It also doesn't have me on the call board": **L50131 12 showed only "EN S501"**, his CO S501 missing.

**(2) Why: a train's last crew line at the top of the next Call Board page was dropped.** Read from the live
site's day files (turn ids only): L50131 12 had "EN S501 · CO S501" on every check from 12th 20:05 to 13th 05:33
and at 05:49, and only "EN S501" at **05:41**, the check where M39671 11 first appeared, which also lost its
"CO SA02" (back at 05:49). `parseCallBoardPage` started each page with no train, so lines before the page's
first heading were thrown away. **Fixed:** `carriedOn` / `callBoardPageNo` in `lib/board/screens.js`: the train or
yard job a page ends on carries on into the very next page (PAGE n + 1 only), in `parseCallBoardPage`
(summary.js passes the carry), `parseCallBoardNames` and `parseTrainCrewNames` (board-auto.js passes
`nameCarry` / `trainCarry`, like the yard jobs' `yardCarry`). The crews in town end it. His phone still showed
the 05:41 board at 05:52.

**(1) Why: an MU turn was named by its number, and MU01 was two people at once** (the CO on L50231, and the
bunkhouse's MU01, who went home on E27331 13 as his own spare turn). The turn list picked the Call Board's
newest "MU01" trip, the wrong one for the 501/502 row. **Fixed:** an MU turn is never named by its number
anywhere (`namesByTurn` leaves MU turns out; the page's `crewTag` / `crewIn` skip them). Each MU row is named
from its own screen in the newest check: board-auto.js tags 29 / 31's name rows (`learn`, label `s5` / `garnet`),
`recordMakeUps` keeps them with the Call Board's MU crew lines as `@mu` (stamped with `probedAt`), and crew.json
carries `mu: { taken, boards, trains }` (`makeUpNames`; board names from site.js `BOARD_NAME`). The page:
the 501/502 / Garnet boards' MU rows (`poolBody` → `muTag`), a Call Board MU line the spare's own turn didn't
replace (`crewLine`), a Toronto crew on its way (`wayCrew`); on that snapshot only, otherwise no name.
**Found on the way, fixed:** a working pool row's name ran into the train after it (29's MU01 read as
"⟨surname⟩ ⟨initial⟩ ⟨first⟩, L"): `parseBoardCrew` now stops a name at a train symbol.

**Checked.** Suite **551 of 551** (`test/board/callboard-pages.test.js` 2: the 05:41 layout on three pages, made-up
names; `test/board/makeup-names.test.js` 5; the two names tests that expected an MU01 by number changed). Ten
pieces broken on purpose, a test failed every time. In Chromium at 390 and 1280 px over the 15 Oct fixture with
a stand-in 501/502 board and Call Board (made-up names): the MU01 row and each train's MU01 named from their
own rows; with an old names file, MU01 has no name; no page errors, no sideways scroll; the Toronto box as before.
**Not checked:** real CATS (a page that really splits a train; 29 by name on the laptop), the published site.
**After his pull + restart:** the 501/502 board's MU01 and the Call Board's MU lines against CATS.

## Home Screen icon with the Chrome badge — 13 Nov 2026 (owner's two phone screenshots). Nothing changed; steps given

His Android home screen had the old installed app ("Line-up", 240 icon, opened with no address bar) and now
a "Sarnia Board" icon **with the Chrome badge**: a shortcut, which opens in a Chrome tab. **The site is
installable:** Chrome's own check (DevTools `Page.getInstallabilityErrors`, a normal profile, phone size)
gives no errors on `board` or `board-test`; `manifest.webmanifest`, the 180/192/512 icons (right sizes) and
`sw.js` (with a fetch handler) answer 200 through the lock (`OPEN_FILES` in the Worker). So it was added as a
shortcut, most likely because the old app is still installed (Chrome offers no install then, and "Add to Home
screen" makes a shortcut), or "Create shortcut" was picked. Told him: remove the badged icon; look in the app
drawer for "Line-up" / "Sarnia Board" and add that; if none, ⋮ → Add to Home screen → **Install**; if Chrome
offers no Install, uninstall the old app in Android Settings → Apps and try again. Offered (not built): the
page's "How to get alerts" Android line could say to pick Install, not Create shortcut.
## ⚠ Yard shift ends from 3 → 6 are when the tie-up was ENTERED in CATS, often late — found 13 Nov 2026. SETTLED: he said read 3 → 7 YD and never the Call Board; BUILT (the section at the top). The Call Board ends below are gone from the code

**Owner, 13 Nov:** said yes to switching the reset tracker to the real yard end times, and asked "What screen are you
seeing, option 3, then option 7 ?". **Answer:** 3 → 6 (the Call Board report: the yard jobs list and the crews in
town). The checker reads 3 → 7 (Assignment History, PSTS17A) only for the S1 and S5 trains, hourly; **not YD**.
**Checked against his 3 → 7 YD photo of 12 Nov (the 11th's jobs; docs/board-checker/SCREENS.md "Assignment history
for the yard"; O-T = overtime on top of 8 h, blank = 8 h):** 3 → 6 ends agree within about 20 min for 9 jobs, but
YSTY01 +2 h 10, YBHS01 +3 h 27, YSBY03 and YSBY04 +1 h 30 (O-T 0400: 12 h shifts; 3 → 6 said 13 h 30). The crews'
"on rest until" times give it away: YBHS01 and YFLS01 (0800 jobs) rest until 0200 = off at 1600 with 10 h booked,
YSBY03 (0700) until 0500 = off 1900, YSTY01 (0630) until 0030 = off 1430, all matching O-T; CATS showed the tie-up
hours later (YFLS01 at 1856, 1936, 1919 on three days). Over the 29 days, 207 own-line book-offs: 104 tied up
within 15 min of "rest until − 10 h", 53 15 to 60 min after, 44 over an hour after (6 had under 10 h booked). **So
the job leaving the Call Board and the crew line going on rest are the same CATS event (the tie-up entered), and
the earlier "173 of 175 agree" check proved nothing about the real off duty.** The test site's "ran over" and the
"rest you booked" (measured from that time) are off on those days. **Proposed to him:** read 3 → 7 with YD in the
checker (hourly, like the trains; skipped if it fails; a laptop pull + restart), length = 8 h + O-T (blank once
the crew is on rest = 8 h), rest booked from that end; then My stats' yard view and the reset tracker on it (test
site first). **Waiting on his yes.** Until then nothing more is switched.

## Yard shifts: each person's own end and the rest they booked — BUILT FOR THE TEST SITE ONLY, 13 Nov 2026. THE OWN END (`ob`) IS WITHDRAWN (it was the tie-up entered, see ⚠); the rest booked (`ru`) stays, measured from CATS's end (the section at the top)

**Owner, 13 Nov:** asked "Can we add a check in for the end of yard shifts for the board checker or did we add it in
already" (answered: already in, see the section below), then offered "time each crew member's own end from their
status, so one person going home early shows up for them" and "show the rest each person booked after a yard
shift": **"Yes"**.
- **Laptop:** `collectYard` keeps `bookoff[job]`: each crew line of a yard job in the crews in town (snapshot `town`,
  "YARD <job>") going from "status not known" (working) to "on rest until …": `{ line ("FO", "S1 (temporary)"),
  w (last working check), at (first on rest), until }`. `build` (`ownOff`): a yard shift gets `ob` (halfway between
  w and at; the first in the shift, a check within 30 min, 1 h to the job's length + 4 h) and `ru` (the rest booked)
  from **their** line: the job's own line for its holder, the "(temporary)" one for someone filling in; craft from
  the shift (`cc`) or, for a holder, the craft they are on it as at the newest check; no craft: an end only when all
  the job's own lines went off within 10 min, a rest only when all booked the same. Capped at the next trip.
- **Page (yard view only):** a shift's end is `ob`, else `cb` (the job left the Call Board), else 8 / 12 h. "Your yard
  job" adds "Rest you booked after a shift" (usually, shortest, longest) and "Back on duty before your booked rest
  was up" (a check mark when it happened) and says how each shift was timed; "Every shift" shows "rest booked to …";
  the spreadsheet gets a "Rest booked until" column. Without the yard view: the same to the byte (1008 drawings).
**Checked.** Suite **544 of 544** (`mystats-yard.test.js` 13: the collector, own line / temporary line / craft from
now / no craft (agree, disagree), the view's order, the page, the spreadsheet, back early); 10 breaks on purpose,
a test failed every time. On the 29 published days: 61 of 595 yard shifts get their own end and rest (own crew lines
in town exist from 3 Nov; crafts are mostly unread before the restart); where a job end exists too, all 45 agree
within 10 min; rests booked: 8.7 h to 10 h (p10 to p90). JAM1's 3 Nov shift: their own line went on rest at 1556
(the old rule had them leaving at 0917). **Not checked:** a spare's "(temporary)" line in real use; a real phone.

## My stats for yard workers: the eight items, and the owner's look at any name code's page — BUILT FOR THE TEST SITE ONLY, 13 Nov 2026. WAITING ON (1) THE WORKER PASTE (copy page rebuilt; board-test at least) AND (2) ONE LAPTOP PULL + RESTART

**Owner, 13 Nov,** shown the eight items (the review below): **"Let's do that. Push to the test site. Also build in
the ability to search other name codes so I can see other My Stats pages so I can verify the information"**.
**What he sees on board-test with the owner key (`PREVIEW`), My stats tab:**
- **"Open another name code's page"** box at the top: type a code (BRW1 style split codes too), Open, "Back to mine".
  The page says "XXXX's page, opened with the owner key". Members and the main site: no box.
- **The yard pieces (on his own page and any code's):** yard shifts end when their job left the Call Board (1);
  "Yard shifts that ran over, and early finishes" with a bar a shift (2); "Your yard job" at the top: job, craft,
  usual start, usual length, shifts elsewhere, days off with a reason, how many timed (3); "You and the yard" in
  place of the pool message (4); "shift" for "trip" and no road-only rows for someone with only yard shifts (5);
  the calendar marks days off the board gave a reason for, and "Days your job went spare for your craft" replaces
  the old any-craft count (6); "Spares on your yard crews" (7); "How each yard job runs", the jobs they worked
  first, the rest folded (8). The spreadsheet takes the Call Board ends too.
**How:**
- **Worker** (`myStats`): `GET /auth/stats?code=XXXX` for the owner key only (owner session or key header): that
  code's record, `{ state: 'ok', code, other: true, stats }` (`stats: null` if none); a bad code is 400. **A
  member's or an Admin's `?code` is ignored, as it always was** (they get their own). **Copy page rebuilt at
  `b329d94`** (https://claude.ai/artifact/Ko95qHHnGfvW9r1m7suiNu, 2087 lines; read back after publishing and decoded:
  byte for byte the file). It is the `3f24ee2` copy page plus this route only. **A session that rebuilds the copy
  page from a branch without `b329d94` takes the owner's look out.**
- **Laptop** (all new fields; every old field byte for byte the same: checked on all 168 records):
  `lib/board/mystats.js collectYard` keeps per run `gone` (the first check without it) and `crew` (turns on its
  crew lines), per job and run the vacancy list's crafts (`spare`), Train Service 4's days off lines (`booked`),
  and when the checks ran (`cover`). `public/board-mystats.js build`: a yard shift gets `cb` (`boardEnd`: halfway
  between the last check listing the job and the first not; trusted only with a check within 30 min after, the
  start seen, 2 h to its length + 4 h; capped at the next trip's start; none when they left the crew lines early),
  `cc` (craft, from the reset tracker's yard sighting: `lib/board/resets.js collect` now keeps `p.craft` as `cc`,
  **so only from checks made after the restart**; or a spare's crew line), `yw`. The record gets `yoff`: days on a
  turn of their own with no duty where the board said why (`booked`, `spare` for their craft or, craft unknown, two
  crafts, `norun` while the checks covered its start), kept through `merge`. Off duty (`off`) stays the 8 / 12 h
  the rest of the site uses. `pools.json` gets `yard` (`yardSummary`, 5 people or nothing, band ends halfway between
  two people); `data/yardjobs.json` (`yardJobs`): per job its usual start, its length (12 h where its runs usually
  go 10 h or more, else 8 h: `lengthFrom`; found: YSBY06 runs 8 h), runs, timed, middle length, over 15 min, early
  30 min, longest. No person in either.
- **Page:** `BoardMyStats.html(..., { yard: true, yardJobs, other })` and `csv(..., { yard: PREVIEW })` only under
  `PREVIEW`; `data/yardjobs.json` fetched only then. **Without `yard` every page and spreadsheet is the same to the
  byte as before** (checked: 168 people x 3 ranges x 2, old module against new).
**Checked.** Suite **541 of 541** (`test/board/mystats-yard.test.js`, 10 new; `accounts.test.js` the owner's look;
`mystats-review.test.js` two pinned lines moved, quoting him). **20 breaks on purpose** (members could look up,
no code check, yard view / box / jobs file for everyone, each trust rule of `boardEnd`, yard view not applied, days
off off the calendar, one spare craft enough, `yoff` not merged, 4-person comparison, the YSBY length rule, no cap,
an end for someone who left early, a road row back, `gone` never set, road vacancies as yard, craft not kept, the
jobs file not written): a test failed every time. **The main site's 29 published days rebuilt locally** (the
pools part came out identical to the published `pools.json`): 471 of 595 yard shifts get a Call Board end, 242 a
spare on the crew, 18 days off with a reason (13 booked, 5 spare), 7 yard workers in "You and the yard", 28 jobs.
In a browser, this branch's page over board-test's live data with those records stood in (in that browser only):
his own page, JAM1 (a split code: a yard job holder), CLLE (a yard spare), CRSC, COBO (road: no yard pieces),
"ab" (not a code), ZZZZ (nothing kept), Back to mine; light, dark, Departure Board, Retro, Mario; no page errors,
no sideways scroll. A member stand-in on board-test and him on the main site: no box, no yard pieces, no jobs
file asked for.
**Checked against the crews' own status, 13 Nov (his question: "Can we add a check in for the end of yard shifts for
the board checker or did we add it in already"; answered: already in, nothing to add):** every check also saves each
yard job's crew status by craft (snapshot `town`, pool "YARD <job>": "status not known" while working, then "on rest
until …", then "rested"). Over the 29 published days, the check where a craft went from working to "on rest until"
was the same check the job left the Call Board in **173 of 175** regular yard shifts (the other 2: one job's S1 booked
off 51 min and 2 h 45 before the rest of the crew: someone going early, which a crew-status end would catch per
craft) and **18 of 18** YSBY shifts: CATS's own book-off. So the YSBY yardmaster shifts of 12 h 40 to 15 h 50 are real,
not a listing left up. Not used yet: the "on rest until" time itself (the rest each person booked after a yard
shift); offered to him.
**Not checked:** the Call Board ends against a real time sheet (they match CATS's book-off; a time sheet can still
differ); crafts before the restart (most yard holders' craft comes only from new checks, so "spare for your craft"
waits on that); a real phone.
**For members (only at his word):** drop `PREVIEW` from the three places in `renderMine` (`yard`, `yardJobs`,
`csv`), keep the box owner-only; change `mystats-yard.test.js`'s gating test, quoting him.

## My stats for someone working only yard jobs — reviewed 13 Nov 2026 at his asking. All eight items BUILT for the test site (the section above)

**Owner:** "Review my stats tab for someone working just yard jobs and see if we need more data points so they have a
more complete picture there".
**How (read only, nothing saved on the sites):** the main site's 29 published days (16 Oct to 13 Nov 0134) downloaded
to the scratchpad; every record rebuilt the way `lib/board/site.js` does (`collectYard`, `People.mergeStretches`,
`Resets.merge`, `MyStatsFiles.update`): 168 people, **58 yard-only** (no road trips; 36 hold a yard job, 16 are
spares, 6 both). `BoardMyStats.html` run on every record; two real yard-only pages (a night yard job holder, a
yard spare) drawn in the real main-site page as the owner with `/auth/stats` stood in, in that browser only.
**Found:**
- Every yard shift's off duty is assumed (411 of 411: 8 h, 12 h on YSBY), so hours, longest duty, time off between
  shifts and the 7-day totals are guesses. **The Call Board says more:** checks are about 8 min apart; of 311 runs of
  8 h jobs, 165 left the Call Board within 15 min of 8 h, 83 (27%) 30 min to 4 h over, 6 over 30 min early; of 62
  YSBY runs, 19 left 30 min or more early. 14 + 2 runs stayed listed far too long (up to 3 days: ignore). `yardRuns`
  (`collectYard`: first / last per run) already holds this; `yardTrip` ignores it. Not checked against a time sheet.
- Road pieces show empty for them: held away 0 h, the turn table's road columns ("—"), call miss columns, "called
  under 8 h" for their own job (no call), held 14 h. No round trips or line-up sections (hidden, fine).
- "You and your pool" says "Not enough to compare yet ... 10 days in a row on one pool" and never can (yard is no pool).
- 42 of the 58 have days left out (3 to 10 Nov, before the checker change; recorded again since 12 Nov 0010,
  `yardFrom`). Next reset due shown for 1 of 58 (hidden next to the left-out days; should come back from about 14 Nov).
- No yard shift has "worked with" (0 of 411).
- "Goes-spare notes on your turn" counts the job on the vacancy list for any craft: a holder's 30 Oct note was the S1
  going spare on a night the holder worked; the vacancies carry `cc`, the note does not.
- Booked days off (Train Service 4, `daysOff`, since 5 Nov) are not used by My stats: 28 lines in all, 7 on yard jobs.
**Put to him (numbers as sent):** 1 real shift ends from the Call Board (check a week against one member's own times
first); 2 overtime and early finishes; 3 a "Your yard job" summary; 4 "You and the yard" in place of the pool message
(same privacy rules); 5 yard wording ("shift") and no road-only rows for someone with no road trips; 6 days off on
the calendar (booked off, and the job spare for their own craft) and the goes-spare count by craft; 7 worked with on
yard shifts (crafts, a spare's turn); 8 how each yard job really runs (job level, for bidding). All from the checks
already saved; no checker change for 1-8. Test site first as usual.

## A yard FO's name questioned — 12 Nov 2026, about 23:30 Toronto. CLOSED: his CATS photos match the site; NOTHING CHANGED

**Owner, 13 Nov,** with a screenshot of Current's Chain Gang box (SR08's row): he thinks the surname the site
shows for the FO of YPRS60 and YBHS31 "is supposed to be" SR08's (no names here: the three share the name code
BRWA, split on 11 Nov into BRWA = SR08, BRW1 = YBHS31's FO, BRW2 = YPRS60's FO).
**Checked (both sites, the 04:21 UTC check's crew.json, read only):** SR08 has its own name everywhere (Current, Turn
History for SR08 and BRWA, the BRWA prompt). The other surname is only on `YBHS31-FO`, `YPRS60-FO` (and, with
another initial, `YSBY06-YA`), and CATS gave it in two places: the Call Board's on-duty crew for YPRS60 at 12th
2245 (`parseYardCrewNames`, crew.json `working`) and crews in town (`parseYardOwners`). Names are read as text,
no OCR. **YPRS60's FO went on duty at 12th 2245 while SR08 was on rest until 13th 0135**, so they are different
people, as the 11 Nov split already has them. Told him; asked him to look at YPRS60's FO on CATS 6: if CATS shows
SR08's surname there, a photo, and find where the read goes wrong.
**His photos, 12 Nov 23:44 to 23:46:** CATS 28 (POOL SR, TERM 0) has SR08 at POS 005 with the same name as the site;
CATS 6 has YPRS60 (2245, ON DUTY 26/11/12 2245) with the FO the site shows, both on the Call Board part and under
crews in town ("<< WORKING >>"). So the site is right: two people. Their codes check out with lib/board/people.js:
SR08's name gives BRWA; YPRS60's FO's gives BRW2 (the code + surname hash; the first-three-letters hash is BRW1's,
another person, YBHS31's FO), as the page's BRWA prompt shows. Every tab scanned as him on the main site: the
other surname only in Yard jobs on duty (Current, Snapshots). Told him.

## Toronto line-up named the wrong person on MU01 — fixed 12 Nov 2026, about 21:40 Toronto (laptop + page). ON `claude/vigilant-planck-zawrj4` SINCE ABOUT 22:05 at his word ("Yes", asked whether to put it there). WAITING ON ONE LAPTOP PULL + RESTART; then compare with CATS 28

**Owner, 12 Nov about 21:11 Toronto, two photos:** CATS option 28 (Pool Maintenance Inquiry, POOL S1, TERM 1:
the bunkhouse) beside the site's "Toronto line-up · Mac yard" (the 20:51 check): "This is showing the wrong
crew on the train". E27331 13 (PLN 2359) had **SD08 + MU01**: SD08's name was right, but MU01 showed a
different person from the one 28 had at POS 001. The other three crews matched 28.

**Why.** The page names a turn from one turn → name list (`namesByTurn`, crew.json `turns`), built from the
Call Board and the Sarnia pool and spareboard screens. Option 28 was read by name only for the people search
and fill-ins, never for the names on the board. **MU01 is a placeholder (make-up) turn that many people get**,
so the list had whoever held "MU01" last somewhere else. A spare covering a regular turn in the bunkhouse
had the same problem. Also found: pool-row names kept two-letter initials as part of the surname ("DG" →
"Grove Dg, D"); 28 has one (S109's), and the fix would have shown it.

**Built (`cf6daaf`; no Worker change, no paste; made in a session on `claude/wrong-crew-train-dzel7q`, which
holds the same commits):**
- **Laptop** (`scripts/board-auto.js`): each page of 28 read by name goes to `names.bunk` (`parseBoardCrew`,
  which now gives `pos`). `lib/board/names.js` `recordBunkhouse` keeps it in names.json as `@bunk`, stamped
  with the check's `probedAt`. `namesByTurn` skips it, so the turns' names are unchanged. `boardPersonName`
  drops one- or two-letter initials (as `nameParts` does).
- **Site** (`lib/board/site.js`): crew.json gets `bunk: { taken, rows: [[pos, "EN" | "CO", turn, "Last, F"]] }`
  only when 28's names were read in the newest check (`bunkhouseNames`). `taken` is the snapshot that check's
  board is (index `latest`), not the check's own time.
- **Page** (`bunkName`, `bunkCrew`, `southCrew` above `toronto()` in `public/board.html`): the Toronto box's
  bunkhouse crews, Toronto South's "First in line" and "Also in the bunkhouse, no train yet" take the
  bunkhouse's name at that position **on that snapshot only**. Anywhere else (an older snapshot, a newer board
  while the page stays open, a names file from before this change), a regular turn takes its turn's name as
  before and **an MU turn gets no name, never someone else's**. Crews still on the way keep the turn names (from
  the Call Board). docs/board-checker/ACCOUNTS.md has the crew.json format.
- **Until the laptop has this code**, nothing changes on the site: the page and crew.json come from the laptop.

**Checked.** Suite **531 of 531** after rebasing on the alert change and the visible code (`8cd9b36`) (`test/board/toronto-names.test.js`,
5 tests: 28's rows in the layout of his photo with made-up names, the site build with two checks, the box with
and without the names, the older table layout). Each piece was broken on purpose six ways, and a test failed every
time. In Chromium at 390 and 1280 px, the page was loaded over a site built from the 15 Oct fixture, with a
stand-in bunkhouse, Mac yard line-up and a locked crew.json (made-up names; sign-in and `api/crewkey` stubbed).
On Current and Snapshots, E27331's row reads "SD08 ⟨name⟩ + MU01 ⟨28's name⟩". Without `bunk`, MU01 has no
name. No page errors, no sideways scroll.
**Not checked:** real CATS (28's unmasked read on the laptop), the published site, a real phone.
**After his pull + restart:** compare the Toronto box with CATS 28 (each POS, EN and CO).

**Not changed, could come up:** an MU turn elsewhere (a Sarnia train on the Call Board, a crew on its way to
Toronto) is still named by the turn list. That is right when only one MU01 is on the Call Board, and wrong
if two are (a conductor and an engineer both on MU01). Not raised with him yet.

## The "a Toronto South crew may get it" alert taken off — 13 Nov 2026, at his word. WAITING ON ONE LAPTOP PULL + RESTART (the checker's own code)

**Owner, 13 Nov:** "can we remove the notification for possible toronto south crew on train". It was the
alert (owner, 2026-10-25) to the bunkhouse crew first in line when an ordered Mac yard train had no crew
rested by its call: "<turn>: <train> is ordered for … (call …) and no crew in the bunkhouse is rested by
then (you're on rest until …): a Toronto South crew may get it." (kind `mayCall`, under the phone's "may be
called" option). **Taken off in `lib/board/alerts.js`:** no `south` worked out in `turnStates`, no alert in
`turnEvents` (a phone's remembered `south` is dropped on the next check), and no "first in line for …, a
Toronto South crew may get it" in the "tracked" message. **Left as they were:** the Sarnia "may be called"
alert (same option), the crews' own lined-up / ordered / time-change alerts home from Toronto, and the
page's **"possible Toronto South crew"** label on Current's Toronto line-up (information, not a
notification: told him it stays unless he says). `torontoSouth` stays in `lib/board/toronto.js` for that
label. Test rewritten (`test/board/alerts.test.js`, "no Toronto South crew may get it alert any more",
quoting him). Suite **523 of 523**.

## The test site's pieces on to the main site — 12 Nov 2026, about 21:00 Toronto, at his word ("1-8. 10, 11, 12, 13, 14, 15, 16"). ON FOR EVERY MEMBER, BOTH SITES, in the code (page only). WAITING ON ONE LAPTOP PULL. 9 not picked; 16 HELD BACK (it cannot show as built: told him)

**His answer** to the sixteen-item list below ("Reply with the numbers to push"): **"1-8. 10, 11, 12, 13, 14, 15,
16"**, read as every item but 9 (the "." a typo for a comma). Page only (`public/board.html`, `public/board-ask.js`
comments): no laptop code, no Worker, no paste.

**On for every member, both sites, now:**
1. Current: the four menus (Trains, Pools, Spareboards, Other) gone; the "No change until" chip stays. The menus'
   code went with them (`screenGroups`, the `[data-jump]` wiring, `JUMPS`, `SCREENS`).
2. The box is "Follow a turn (alerts)" in the page itself (the label; `siteReviewPaint` is gone); a followed
   turn's card has "Turn History →"; on Snapshots the box, its label and the alert instructions are left off and
   the card comes after the hours. **Also changed, told him:** My week's empty line said "(Find a turn, on
   Current)"; it now says "(the Follow a turn box, on Current)".
3. The pinned strip with ▲ Top (`pinPaint`); `html { scroll-padding-top: 56px; }` in the styles in place of the
   inline style the test site set.
4. Back = the tab before (`setMode`'s `pushState`, the `popstate` handler).
5. Turn History's layout of 10 Nov: `turnPanel` and `workHistory` have one layout each (the older ones deleted),
   person search folds, "Looked up lately" (the list was already kept on every phone, name codes never in it).
6. My stats' jump list. 7. Article 18.6(b) as rows (`ana2Stack` in `renderHeld`). 8. Analytics' Overview as
   "Analytics pages" (`compact: true`) and the section row wrapping on a phone.
10, 11. Agreements: `renderAsk` passes `preview: true` (the name of the option in board-ask.js is unchanged).
12. Snapshots drawn like Current (`sectionsGrid` draws the `NEW` boxes whatever the tab; Snapshots' counts tiles
   and `strip()` deleted; its boxes wired by `wireCurrentBoxes`).
13, 14. Members: `review = membersOwner` (him, either site); Page Health has no Who gets alerts on either site.
   **An Admin** keeps the cards as before but gets pick 1's heading "(the owner and Admins see this)"
   (`membersHead` for everyone who sees the tab): the rest was built and checked for him only (Who gets alerts and
   the names need his Page Health data; "N name codes are waiting for your OK" would be wrong for an Admin). Told
   him; his to say if Admins should get the one-line layout.
15. The compact header on a phone (smaller title, no second line, tighter sign-up banner). The TEST SITE badge
   stays the test site's.

**How the styles moved:** every rule that was under `body.preview-site` is now under `body.everyone`, and
`<body class="everyone">` is in the page, so each rule keeps the same weight against the page styles' own rules
as it had on the test site (dropping the prefix would have let e.g. the k- styles' `.rail .turnpick button`
rules repaint the "Turn History →" link). The badge is the only rule left under `body.preview-site`.

**Still the test site's:** 9 (My week's "Sleep this week", not picked); the TEST SITE badge; the purple pieces
(habit tag, "How this train has gone"; the likely-call line and spareboard odds are off everywhere); Analytics →
Likely-call test (tabled to 24 Nov).

**16 held back, told him:** the "newer version" bar has never been able to show, the test site included.
`checkSiteVersion` HEADs the page and needs an ETag, Last-Modified or Content-Length; Cloudflare compresses the
page (text/html, br/zstd) and drops all three (seen with curl and in a browser, 12 Nov): `tag` is empty and it
returns. The Worker sets `etag` (`head.httpEtag`); JSON and JS files keep theirs. Offered: the laptop writes the
page's fingerprint into `data/index.json` at each publish (`buildSite`, lib/board/site.js) and the page compares
it on the poll it already makes (a laptop change: pull and restart), or drop it.

**Checked.** Suite **523 of 523** (4 new in `test/board/test-site-promoted.test.js`; `site-review`, `current-review`,
`members-review`, `ask-review`, `ask-examples` changed to the promoted state, quoting him). 20 breaks on purpose
(each piece gated again, the body class gone, the badge for everyone, the sleep box, the newer-version bar or the
purple ungated, the menus back, the Days off rule back on the test site only, ...): a test failed every time.
In a browser: the live sites' answers recorded once (the 21:00 check of 12 Nov) and replayed to every look, the
clock held, every request that is not a GET stopped but the owner sign-in, the page's own HEAD answered without
a version tag as the live sites do, `data/patterns.json` held back from every look (no purple) and the badge hidden
in every look (the same header height on both sites); scripts and pictures in the session's scratchpad only:
- **Him on the main site with the new page = him on the test site with the old page, every tab, text and layout**
  (each element's place, size, font, colours, white-space, position): the same but Analytics' row ("Likely-call
  test", the test site's). The old page was looked at twice: the first look fetched live and caught Search Review
  before its day list came; the second, from the recording, matches. The pinned strip, its list of tabs, Back (3
  steps, Back opens the tab before) and a stand-in Agreements answer the same.
- **Him on the test site, old page and new: the same on every tab** (his view did not move).
- **A member on the main site, old page and new:** the header's second line off; "Follow a turn (alerts)" and
  "Turn History →"; the menus gone; Turn History for SR03 3,603 → 2,129 px with "Looked up lately"; My stats' jump
  list; 18.6(b) as rows (1,722 → 3,468 px); Analytics 2,826 → 1,163 px; Agreements' examples and folds, the
  stand-in answer drawn (3 passage buttons, Copy answer; before: plain text); Snapshots 9,161 → 7,216 px; the
  strip; Back 3 steps (before: Back left the site). Nothing else differs. No page errors, nothing wider than the
  screen.
- **An Admin** (stand-in: that session with role admin, the owner's list as the Worker gives an Admin): Members
  differs by its heading only; no Who gets alerts, no phones-with-no-account list, no errors.
- **360 px dark (a member), 1280 px (a member and him):** every tab, no page errors, nothing wider than the
  screen; the strip, Back and the stand-in answer work.
- **Item 16 in a browser on both live sites:** a HEAD of `/` and `/index.html` comes back with no ETag,
  Last-Modified or Content-Length (zstd); `data/index.json` and `board-turns.js` keep a weak ETag.
- **Not checked:** a real phone; an iPhone (from its Home Screen icon there is no Back button; an older iPhone may
  count a tab opened from the address as a step, the known edge); page styles other than light and dark; a real
  Agreements answer (none sent on purpose); an Admin's real account; the published page (needs his pull).

**What he must do:** one laptop `git pull` (the page is copied on the next check; a restart is not needed for
the page, but Page Health will say "Restart needed" until he restarts, as after any pull).

## What is on the test site and not the main site — listed for him 12 Nov 2026, about 20:35 Toronto. HIS PICKS ("1-8. 10, 11, 12, 13, 14, 15, 16") ARE ON FOR EVERY MEMBER: the section above

**Owner:** "review the test site, list what needs to be pushed to the main so I can review". Read as: everything
behind `PREVIEW` that a member does not get, as a numbered list for him to pick from. Nothing changed.

**How it was looked at.** This checkout was stale (`056ebc9`); fast-forwarded to GitHub (`19d3573`) first. The
laptop runs `19d3573` (`/health` → `laptop.code`), so both sites serve the newest page. Both live sites opened
as him (owner key placeholder, `boardNoCount`, every non-GET stopped but `auth/owner`), 390 × 844, light, on
the 20:28 check: every tab, `innerText` of `#view` main against test, SR03 looked up (`#turn=SR03`, SR03 in
`trackTurns` in the browser only), three tab changes. No page errors, no sideways scroll, nothing saved.
**The same on both sites, to the letter:** Order summary, Job Aids, Job postings, Notifications.

**The list given to him (his numbers; each is page only, a switch to drop plus its test; no Worker paste):**
1 Current's four menus off (`menusOff`) · 2 "Follow a turn (alerts)" + "Turn History →" on a followed turn's
card + the follow box off Snapshots (`siteReviewPaint`, `paintTracked`, rail CSS) · 3 the pinned strip with
▲ Top (`pinPaint`) · 4 Back = the tab before (`tabStepWanted`; 3 steps on test, 0 on main) · 5 Turn History's
layout of 10 Nov (`turnPanel` tn2, `workHistory` work2, person search folds, `recentChips`; SR03 2,244 px vs
3,627) · 6 My stats' jump list (`mineJump`) · 7 18.6(b) as rows (`ana2Stack` in the held view; 2,417 vs 3,883
px, the rows are taller) · 8 Analytics Overview as "Analytics pages" + the section row wrapping (`compact:
PREVIEW`, `.ana2 .anatabs` CSS; 2,928 → 1,306 px) · 9 My week's "Sleep this week" (not looked at today) · 10
Agreements' examples and two folds · 11 Agreements' answer tools (formatting, [n] passages, add-a-document
offer, "Didn't find it?", Copy answer); 10 and 11 are one switch (`preview: PREVIEW` in `renderAsk`) unless
split · 12 Snapshots drawn like Current (`fresh`; 9,179 → 7,313 px) · 13 Members: Who gets alerts moved from
Page Health, names beside phones with no account · 14 Members cleanup (picks 1, 3, 4, 5, 6); 13 and 14 are one
switch (`review`) unless split · 15 the compact header (no second line: told him it sits against his "2 leave
it", the name staying as it is) · 16 the newer-version bar (`checkSiteVersion`; not seen today).
**Left off the list as staying on the test site at his word:** the purple "usually" tags and "How this train
has gone"; Analytics → Likely-call test (tabled to 24 Nov). The likely-call line and spareboard predictions are
off on both.

**Found, told him, nothing changed:** the board-test Worker has **no `KIMI_API_KEY` and no `ANTHROPIC_API_KEY`**
(its Search Review: "KIMI BALANCE couldn't read it (KIMI_API_KEY is not set)" and "ANTHROPIC_API_KEY isn't set";
the main Worker has both), so a question asked in Agreements on board-test cannot be answered (`kimiChat` /
the Claude call throw): item 11 cannot be tried there for real. The fix is his (a secret on the board-test
Worker in Cloudflare). Not asked to verify by sending a question (nothing sent from a session). Also only a
Worker difference: "Emails sent today: 7 of 95" on main, "7 of 70" on test (Members).

**Not checked:** a real phone; an Admin's view; page styles but light; items 9 and 16 in a browser.

## Is the call prediction worth it? Read 13 Nov 2026 on all 28 saved days, at his asking. Nothing built. TABLED UNTIL 24 NOV at his word: review and plan then (check-in booked)

**Owner, 13 Nov:** "Can you give me a summary on if the call prediction would be effective with the data you
have now. Give me examples of when it was better than what was showing and give me examples of when it was
not good at all, explain if it would be beneficial with the data collected now and give recommendations on
how to proceed". Answered in chat (not a page); the figures below are what he was told.

**How it was read.** `docs/board-checker/likely-call/per-train.js` (reads `data/trains.json`; replays every
check as `Patterns.score` does, matching `score` to the check: test 79 / 68 held, before 896 / 698), then
splits the totals by train, own history or not, and two plain yardsticks the page doesn't show: a window of
the same width centred on the line-up's call, and "told later but came near or before the line-up's call".
Files of 00:58 UTC 13 Nov: 239 Sarnia runs, 16 Oct to 12 Nov, 975 checks of 226 trains; each train's own
window stood on a typical 15 past runs (6 to 26).

**What he was told.**
- Overall a small gain: the likely time within an hour of the real call 54% vs the line-up's call 49%
  (typically 58 vs 63 min off); the window held 79%, about 4.3 h wide; the same width centred on the
  line-up's call would have held 67%.
- **Four trains carry all of it** (own history): Z148 (55% vs 26%; 50 vs 107 min; usually ~2 h after the
  line-up), M382 (61% vs 43%), L502 (shows 0400 every day, usually on duty 0245: 30 vs 60 min typical),
  M396 (43% vs 34%). Together 59% vs 48%, 47 vs 65 min. **No better:** A424 (the line-up is already right;
  window 20–35 min wide, hence A42431 11's "0 of 4" on a 30-min-early call), M302 (level), M394 (worse:
  40% vs 46%). E278: both bad, window 10.6 h wide (useless). Trains without 6 runs of their own (a third of
  checks): level (48% vs 48%). Over a day out: no better.
- The risk: told "an hour or more later than the line-up", 41 of 237 still came within 30 min of the
  line-up's call or earlier (1 in 6); M382 19 of 55 (1 in 3).
- Examples given: better: Z14891 09 (line-up 10th 0130, likely 0445, called 0505; also Z14891 01, 28),
  M39671 10 (line-up 11th 1848, likely 2046, called 2100), M39671 09 (line-up 11th 0040, likely 10th 2331,
  called 2330), E27861 12 (line-up 1055 a day ahead, likely 1630, called 1915). Not good: Z14891 03 (line-up
  4th 0330 right, likely 0645, window 0450–0915, called 0345), Z14891 30 (called 0515, window from 0704),
  M38261 24 (called 1115, window from 1255), E27861 11 (line-up right at 1655, likely 2230, window 18 h),
  A42431 11, and the days neither could see (M38261 07 11 h late, M30241 28 10 h, X27691 06 28 h; 25 trains
  6 h or more off the line-up in 28 days).
- **Recommended:** finish the test and read it on the 25th (2 days in, 19 trains, is too early); then, if
  anything goes to the main site, only the trains that beat the line-up (today Z148, M382, L502, maybe M396),
  only under 16 h out, as a plain note beside the line-up's time, never in place of it, with the window never
  starting after the line-up's call (held 80% vs 79%, 4.4 h vs 4.3 h wide; Z148 84% vs 76%); nothing for
  E278, A424, M302, M394 or trains with few runs. Keep collecting and recheck per train each month.
  **His answer: "set a reminder to come back and check it nov 24, we can review it and make a plan then.
  Untill then lets table this".** Don't raise the prediction or the test page before then.
- **The check-in:** booked into this session (`send_later`, `trig_01AtgyUENL3iCG9X8UUfmahx`) for **24 Nov
  08:00 Toronto**: pull, run the script on that day's `trains.json`, a short summary in the 13 Nov shape
  (what changed, examples from the test days, train by train; the 24th itself still running), a proposed
  plan, then stop for his say. **The older check-in for 25 Nov 09:00** (`trig_011nxqHjHiKJRurCmD1Wx64i`, into
  an older session, totals only, booked 10 Nov) **is switched off, not deleted,** so he isn't told twice:
  turn it back on with `update_trigger` enabled true if he asks.

## Likely-call test page made simpler — 13 Nov 2026 (`public/board.html`, page only; still TEST SITE ONLY). WAITING ON ONE LAPTOP PULL; then his look

**Owner, 13 Nov:** "I want to review the likely call test in analytics to try and simplify it. It needs to
be simple with minimal explanation so guys seeing it will understand it." Built and pushed without a pick
list (he asked for the result, not options); told him what came off and that any piece can come back.

**Now (Analytics → Likely-call test, `likelyTest`).** The heading and "Day N of 14 · dates"; one sentence
("Each planned Sarnia train is checked a few times before it is called: did the real call land inside the
likely window?"); three tiles: **called inside the likely window** (with "N of N checks · the window is
usually X h wide"), **called within an hour of the likely time**, **called within an hour of the line-up's
call**; one line: "So far the likely time is beating the line-up" / "the line-up is beating the likely
time" / "about even" (5 points either way, as before), or "Too early to tell" under 40 checks; then
**Trains so far**, one row a train ("5 of 6" = times in the window), opening to each check in plain times:
how far out, line-up call, likely time (new: the window's middle, `mid`), window, and in window / called
earlier / called later. On a phone the page is about 1,450 px with the rows shut (was 3,350).
**Off the page (all still in data/patterns.json `score`, so the 24 Nov read is unaffected):** the table by
distance (`test.byAway`), "Before the test" (`before`, the replay of 207 trains), the early-calls tile
(`early`, `earlyCovered`), the closer / further counts, "(all trains)" (`own`) and "How it is scored".
Their styles went too, and the table exception in `ana2Stack`.

**Who sees it: the test site only, at his word (13 Nov: "Leave it on the test site for now").** Board-test
with the owner key (`PREVIEW`); a member sees no such page on either site. Don't ask again before the 24th.

**Checked.** Suite **507 of 507** after rebasing on the Members work (`test/board/likely-test-page.test.js`, 3: the tiles, the verdict's
three wordings and too early, the times on an opened check worked by hand, what came off, the three empty
states; run against the old page all 3 fail, and with the verdict's threshold broken one fails). In a
browser, this branch's page over the live board-test files as him: 390 and 340 px, light and dark, 1280
px; rows open and shut, Show all; no page errors, no sideways scroll. Note for a fresh container: `npm
ci` first, or 15 tests fail on missing packages (jszip and the like), not on the code.
**Not checked.** A real phone.
## Tab review round 3: Members — 12 Nov 2026, 19:15 to 19:55 Toronto. His two asks (`71a4fa0`) and his picks 1, 3, 4, 5, 6 of the eight (`f57b390`) BUILT FOR THE TEST SITE ONLY (page only), WAITING ON ONE LAPTOP PULL; then his look. The Worker (copy page, `e3e7936`) PASTED INTO BOTH, seen 12 Nov about 20:55

**Owner, 12 Nov about 19:15 Toronto:** "Start members, I would like to clean up the members tab, move the
'whos getting alerts' to members from page health. The list of turns being tracks that don't have an
account, i want to see the owner of the turn/name code". Read as two picks to build now (test site only,
his review rules: see the tab-by-tab section) and a round 3 look for the cleanup, to put to him and wait.

**BUILT, `71a4fa0`, all in `public/board.html` behind `PREVIEW` (board-test with the owner key). No laptop
code, no Worker change, no paste.** New test file `test/board/members-review.test.js` (3); one line of
`health-review.test.js` changed (the Notifications button is now written twice in the page, one drawn at a
time). Suite **501 of 501** after rebasing on the other session's 18.6(b) commit (`6b56377`).
- **Where.** Just above `renderMembers`: Page Health's Who gets alerts block taken out of `renderHealth` into
  `whoGetsAlerts(S, o)` (with `crewFits`, `crewOnTurn`, `crewNameOf`; `o.members` draws it in the Members
  tab's own style), then `accountFor`, `looseNamed`, `looseRowHtml`, `agoStamp`. In `renderHealth`:
  `const who = PREVIEW ? '' : whoGetsAlerts(…)`, and the Notifications button wired only if it is there. In
  `renderMembers`: `const review = PREVIEW && membersOwner`, `whoHtml` after the member lists, the
  no-account rows through `looseRowHtml`, a sentence added to that list's note, the Notifications button
  wired. `loadHealthCrew` draws Members again when the names arrive (test site only). Styles: `.members
  .mwho`, `.members .mhas`.
- **What he sees on board-test.** Page Health: no Who gets alerts (nothing else changed: the text of the
  page differs by that section only). Members, after the Members list and before the phones with no
  account: "Who gets alerts" (the phone count, "Followed turns and people" folded, the same tables and names
  as Page Health had, the Notifications tab link). **Phones with no account:** beside each turn, whose turn
  it is from the crew names file (while it is out on a trip, whoever is working it: the same name Who gets
  alerts shows); beside each name code, the person it belongs to; a code not known yet but on a turn, the
  name on that turn. **My addition, told to him: "has an account: <member>"** when that person already has
  an account (their saved name code, else exactly one approved member whose name fits "Last, F"): that
  phone only needs signing in. On the 12 Nov 19:23 report, 5 of the 8 phones were people with accounts
  (his own JUOD phone, an Admin's two older ones, two others); 3 were people with none.
- **Checked.** The suite; each piece broken on purpose seven ways, a test failed every time. In a browser,
  this branch's page over the live data (in the browser only; every non-GET stopped; `boardNoCount` set;
  the answers recorded once and replayed, the clock held, for old against new): **on the main site as him,
  Page Health, Members and Current are the same to the letter (HTML) with the old page and the new**, at
  390 px, before and after the rebase. On board-test as him: 390 light and 1280 dark, the fold opened (no
  table wider than its box, no sideways scroll), the tab drawn again (the fold stays open), the
  Notifications link opens Notifications, no page errors. Every name matched by hand against the member
  list (not written here).
- **Not checked.** A real phone. An Admin's view (the code gives them neither piece: `membersOwner` only;
  the test pins it). Page styles other than light and dark. The published page (needs his pull).
- **To promote:** drop `PREVIEW` from `const who = …` in `renderHealth` and from `const review = …` in
  `renderMembers`, and from the `loadHealthCrew` line; change `members-review.test.js`, quoting him.

**Round 3: the Members tab looked at** (board-test and the main site as him, 390 px; both Workers' answers
to `/health/accounts` read for counts and field names only). The tab is the same page on both sites and
both Workers answered 35 approved accounts. Put to him in his order:
1. **"(only you see this)" in the heading shows to Admins too** (two Admins see the tab). Idea: "(you and
   your Admins see this)", and for an Admin "(the owner and Admins see this)".
2. **"Started signing up, email not confirmed" never shows:** neither Worker has the 11 Nov code
   (`unverified` is missing from `/health/accounts` on both sites). Not a page change: the Worker paste
   waiting since 11 Nov (section "Unconfirmed sign-ups" below), both Workers.
3. **8,482 px on a phone** (8,899 with Who gets alerts on the test site): 35 cards of about 190 px each, all
   facts and buttons open; Who gets alerts and the phones with no account sit under all 35. Idea: one short
   line per member (name · name code · last seen) that opens to the full card and its buttons, with the
   counts at the top.
4. **The same thing said twice:** "8 phones get alerts without a known member…" (the Worker's count) right
   above "Phones with no account (8)" (the laptop's list). Idea: one heading, one explanation.
5. **Remove access sits beside Access on every card** (it asks first). Idea: inside the opened card only
   (goes with 3).
6. **18 of 35 have no name code saved**, so My stats does not work for them; only seen card by card. Idea:
   the count at the top and who they are, folded. No message to them (his rule).
7. **"Follows: 1 name code (1 phone)" does not say which code** (16 of 35 cards). The Worker knows a
   follow only by its hidden number; the laptop knows the code. Naming it needs a Worker change: asked
   whether he wants it.
8. **"Approved" reads Nov 10 on every card** (the day accounts began). Idea: off, or inside the opened card.
Also told him, not an item: the phone that follows only **SR03** (last changed 22 Oct) is not kept after
the cut-off (only phones following his name code are), and SR03 now shows another person on the boards: if
that phone was his, it stops on the 18th. And: where should Who gets alerts sit (bottom, beside the phones
with no account, as built; or top)?

**His picks, 12 Nov about 19:36 Toronto: "1, 3, 4, 5 and 6, and give me the updated worker to post".** Not
picked: 2 (the Worker paste, which is what the second half of his message asks for), 7 (naming the code a
member follows: a Worker change) and 8 (the Approved date). Where Who gets alerts sits: **his answer, 12 Nov
about 19:54 Toronto: "leave it at the bottom"** (beside the phones with no account, with the jump to it at the
top). Not to be asked again.

**BUILT, `f57b390`, behind `PREVIEW` like the two asks (`review` = `PREVIEW && membersOwner`, now decided
at the top of `renderMembers`).** Suite **504 of 504** (2 more tests in `members-review.test.js`, which draw
the tab with made-up members three ways: him on the test site, him on the main site, an Admin; each piece
broken on purpose seven ways, a test failed every time).
1. **Heading:** `membersHead`: "(you and your Admins see this)" for him, "(the owner and Admins see this)"
   for an Admin. An Admin never has `PREVIEW` (it needs the owner key), so the Admin wording shows only once
   promoted.
3. **One line per member** (`memberLine`, Admins and Members; waiting and declined keep their cards): name,
   name code ("no code", or "CODE · to OK" in the accent colour when it waits for his OK), last seen short
   (`seenShort`: "Today 06:53", "Yesterday 18:45", "9 days ago"); tap opens the full card, every fact as
   before. Cards left open, and the no-code fold, stay open when the tab is drawn again (after an action).
   **The counts at the top** (`topHtml`): Waiting · Email not confirmed (when the Worker sends it) · Admins ·
   Members · Who gets alerts · No account, each a button that jumps to its heading (`m-wait` …; lands at
   56 px, under the pinned strip). Name codes waiting for his OK are named there too.
4. **One heading, one explanation:** the Worker's "N phones get alerts without a known member…" line is
   left off when the laptop's list is there; the list's note now opens with what those phones are and how
   they get matched.
5. **Remove access** is at the foot of the opened card, under a dashed line, 14 px below Access (still asks
   first).
6. **"N of 35 have no name code saved, so My stats can't find their record"**, folded under the counts;
   each name opens that member's line.
On board-test as him (live data, this branch's page, nothing saved): 8,899 → 4,444 px at 390 px (3,693 at
1280); every line one row (44 px) at 390, some names wrap at 340; jumps, the fold, a name opening its card,
Remove access asking first (dismissed), drawn again: open cards kept. 390 light, 340, 1280 dark: no sideways
scroll, no page errors. **The main site's Members, Page Health and Current: the same to the letter (HTML),
old page and new.** The new lines use `--rule` (the old cards' `--line` is not defined anywhere in the page,
so they fall back to a light grey on dark styles; left alone). Not checked: a real phone; styles other than
light and dark; an Admin's real view.
**To promote:** drop `PREVIEW` from `const review = …` in `renderMembers` (that promotes the two asks too),
or keep `review` for the two asks and give these pieces their own switch; change the tests, quoting him.

**The Worker he asked for: the copy page https://claude.ai/artifact/Ko95qHHnGfvW9r1m7suiNu, unchanged,
version `e3e7936`, 2046 lines.** Decoded here: it is byte for byte `e3e7936`'s `cloudflare/board-worker.js`
= `881e02d` (unconfirmed sign-ups, the sign-up wording) + the owner-only test alert route of another
session. **That route's two commits were not on this branch: cherry-picked here (`e439cbc`, `1b3be4d`), so
the branch's Worker is now exactly the copy page's** (their warning: a copy page rebuilt from a branch
without it loses the route). No Worker change of this session. He pastes it into both Workers; afterwards
`/health/accounts` should carry `unverified` on both (look, counts only).
**(13 Nov 00:55: the copy page is now `3f24ee2`, 2079 lines: this same Worker plus the screenshot mark's
numbers, so one paste covers both. See "Screenshot mark" below; checked byte for byte, the route kept.)**

**Worker pasted into both, 12 Nov about 19:50 Toronto ("I pasted both workers"); seen from here at 19:52, read
only:** on `board` and `board-test`, `/health/accounts` carries `unverified` (3 on each: the accounts are
shared), `GET /health/test-alert` answers 405 "POST only" (the route is there; nothing was sent), and
`/account` has the new sign-up wording ("Next: email me my code", "Step 2 of 3"). So the Members tab on both
sites (owner and Admins, not gated) now shows "Started signing up, email not confirmed (3)".

**Where Who gets alerts sits, explained to him with the numbers (board-test, 390 px, after the paste):** the
counts at 635 px, Waiting at 635, "email not confirmed" at 711, Admins 1,442, Members 1,576, **Who gets alerts
3,098** (228 px tall shut, 1,581 open), Phones with no account 4,702; page 5,955. At the top it would push
everything after it down by 228 px shut. Recommended to him: leave it where it is (beside the phones with no
account, the same subject; the top kept for what needs his action), or move the two together to the top.

**Seen again 12 Nov at 19:55 Toronto (read only, field names and counts):** the two Workers are NOT on the
same version. `board-test` runs `3f24ee2` (the screenshot mark session's: `ownerMark`, and a `mark` on all 35
accounts); **`board` runs `e3e7936`** (no `mark`, no `ownerMark`). Either he pasted `board` before the copy page
was rebuilt for `3f24ee2` (about 19:52) and `board-test` after, or he is part-way through pasting the new one
for the other session. **19:57: he pasted `board` again ("pasted board again"): both Workers on `3f24ee2` now
(`ownerMark`, a `mark` on all 35 accounts, on both).** Both have the unverified
list, the sign-up wording and the test alert route. **Told him: paste the copy page (now version `3f24ee2`)
into `board` once more**; that is the screenshot mark's (another session's), nothing of this round.

**LIVE ON THE TEST SITE since the 1949 check (published 19:51).** He pulled and restarted: the laptop's report
at 19:52 runs `adb089b` (folder the same), which holds `71a4fa0` and `f57b390`. Read at 19:57 to 19:59, the real
published pages, nothing put in place: his board-test Members has the new heading, the counts row (with "Email
not confirmed 3"), one line per member, Who gets alerts at the bottom, names and "has an account" in the
no-account list; his board-test Page Health has no Who gets alerts (the trace box is there). The main site's
Members is the old layout, now with "Started signing up, email not confirmed (3)" (the Worker paste; that
section is not gated). No page errors. At 19:59 no check had run since 19:51: he was pulling again (the other
sessions' `3f24ee2` and `fe570e8` came after `adb089b`).

**Waiting on him:** his look at board-test's Members and Page Health and his say on each piece (keep, change,
drop or promote). Next in the tab review: round 4, Turn History, on his word.

## Screenshot mark (a hidden account number in every screen) — ON FOR EVERY SIGNED-IN ACCOUNT, BOTH SITES, in the code since 13 Nov 2026 00:51 at his word (`3f24ee2`). WAITING ON (1) THE WORKER PASTE INTO BOTH (copy page `3f24ee2`) AND (2) ONE LAPTOP PULL. Until the paste nothing is drawn for anyone. **13 Nov: photos of the screen don't trace, so a faint VISIBLE code is BUILT FOR THE TEST SITE ONLY, his own view (`f8d1573`, page only), WAITING ON ONE LAPTOP PULL; then his look (a real photo on his phone)**

**13 Nov, the owner, having tried it:** "The screenshot reviewer, it works great for direct screen shots, but
doesnt work for pictures of screen shots, is there anyway to fix this" ("pictures" taken as a photo of the screen
with another phone). **Answered: not the hidden mark.** It is 1 shade out of 255; a camera's blur, noise, moire and
processing wipe it out (the 12 Nov test's photo stand-in: 0 of 16), and anything strong enough for a camera to
read is strong enough for people to see. **The fix offered: a faint visible code as well** (the open "faint
visible number" question below, now raised by him). Mocked up in a test browser only (`visible-capture.js` under
screenshot-mark; board-test as the owner key, read only, nothing on the site): a 4-character stand-in code (the
account's same 20-bit number would fit exactly: Crockford base 32, 32^4 = 2^20), tiled at a slant over the whole
screen in the same see-through top layer, 15 px bold, at 4%, 6% and 9%. Through the 12 Nov photo stand-in made
harsher (`treatments.photo`, then 1 px more blur, 1100 px, JPEG 70) the code read by eye at all three on light
pages, and at 6% and 9% on dark (4% barely). Shown to him as pictures, recommended: about 5% on light pages, 7% on
dark; keep the hidden mark (invisible, read by the phone; every screenshot so far still traces); the Trace box
gets "or type the code you see". It would show members their pages are marked (the other open question).
**Asked: build it on the test site first, his own view only?** Not checked: a real camera, how it looks on his
phone.

**His answer, 13 Nov: "build it on the test site, 5% light 7% dark". BUILT (`f8d1573`, `public/board.html` only; no
Worker change, no paste), WAITING ON ONE LAPTOP PULL.**
- **What he sees on board-test (owner key, `PREVIEW`):** one more see-through layer (`#shotcode`, taps go through)
  with his account's code, the hidden mark's same number as 4 characters (`ShotMark.codeOf`: Crockford base 32, no
  I, L, O or U; **the alphabet must never change**), 15 px bold at a slant, black at 5% on a light page, white at
  7% on a dark one (follows a change of page style). The owner key's code is `8MGZ` (from the Worker's
  `ownerMark`). Page Health → Trace a screenshot gets **"A photo of a screen?"**: type the code (small letters,
  spaces, O for 0 and I/L for 1 all fine; `markOfCode`), Look up names the account from `/health/accounts` (the
  trial's number is left out: it was never drawn as a code); "No mark found" adds "type the code you see on it
  below". **A member on either site, and him on the main site, get neither** (checked in a browser).
- **Laid out scattered, not in rows:** 40 codes in a 400 x 880 CSS px tile, at least 77 px apart round its edges,
  no spot more than 77 px from one (`SHOTCODE_AT`, toroidal Poisson-disk, seed 1). **Why:** the mock-up's even
  150 x 104 grid gave emailed (JPEG 90) screenshots of dark pages a second spacing that the reader's `find_period`
  took for the hidden mark's: 6 of 8 read against 8 of 8 without the code. Tried four layouts over 8 views of
  board-test as him (Current at 4 scrolls, My stats at 2, Analytics, Page Health), light and dark, 6 kinds of
  sharing each: scattered 400 x 880 brings dark emailed back to 8 of 8 and costs nothing anywhere else (a 192 x 128
  grid, lined up with the mark's tile, fixed emailed but read 0 of 8 at text-message size on dark).
- **Checked.** Suite **526 of 526** (`test/board/shotmark.test.js`, 3 new: every one of the 2^20 numbers has its
  own code and reads back; typed codes; test-site gating, his strengths, the scattered layout's spacing, the code box
  on the test site only, matched against the Worker's numbers, no new request); 13 breaks on purpose (no `PREVIEW`
  test, other strengths, the box for everyone, a changed alphabet, the trial matched, O not read as 0, no repaint
  when the test site switches on, taps blocked, the old grid back, two codes too close, a code missing): a test
  fails every time. **In a browser, this branch's page over the live data, read only:** as him on board-test, light
  and dark, the layer is drawn with his code at 5% / 7%; typing `8MGZ` (and "8 m g z") names "the owner key";
  another code says no account has it; "AB" asks for 4 characters; **the hidden mark with the code over it, final
  layout, 224 reads (Python reader, the 12 Nov sharing stand-ins): never worse than without the code, no wrong
  account**; the page's own Trace box read his dark-page emailed and Messenger-style copies as "the owner key".
  The code read by eye through the harsh photo stand-in, light and dark. A member stand-in on board-test (made-up
  answer, no owner key) and him on the main site: hidden mark only, no code, no code box.
- **Noticed, not changed:** at text-message size (640 px wide, JPEG 60) the hidden mark often says "not sure" on
  dark pages (1 or 2 of 8, with or without the code; light 5 or 6 of 8): two accounts' numbers differ from his in only
  6 of 20 pairs, so at that size the margin over the next closest isn't met. It never named a wrong account.
- **Not checked:** a real photo with a real phone (moire, glare): the first thing to ask him after the pull; an
  iPhone's own rendering of the code font; page styles other than light and dark.
- **For members (only at his word):** drop the `PREVIEW` tests in `paintShotCode` and `traceSection`/`traceResult`
  and change the tests, quoting him. Members would see the code: that tells them pages are marked (the other open
  question). No Worker change needed (the numbers already come from the secret).

**Seen 12 Nov at 19:55 Toronto by the Members session (read only):** `board-test` runs `3f24ee2` (`ownerMark`,
a `mark` on all 35 accounts); `board` still runs `e3e7936` (no marks). The main Worker needs the `3f24ee2` copy
page pasted once more: told him. **19:57: pasted ("pasted board again"); both Workers on `3f24ee2`, seen.** At
19:59 the laptop still ran `adb089b` (before `3f24ee2`) and no check had run since 19:51: he was pulling.

**Owner, 13 Nov, having tried the test-site version on his phone: "I pulled it, trying it now, works
great, push to the main page".** Done as he had been told it would be for members: the number now comes from
a secret the Worker keeps, so nobody can work out another account's number from an email or fake one.
- **Worker (`cloudflare/board-worker.js`, just above `profileOf`):** `shotmarkSecret` makes a random 32-byte
  secret on first use and keeps it in **`accounts/shotmark.json`** (publishes keep `accounts/`; never
  served). **It must never be changed or deleted: every screenshot taken before would then match no one.**
  `shotmarkOf(env, id)` = 20 bits of HMAC-SHA-256(secret, `shotmark:` + account id). `/auth/me` adds `mark`
  for a signed-in (approved) account, the owner key's session included (id `owner`); `/health/accounts`
  adds each account's `mark` and `ownerMark` **for the owner only** (an Admin gets none: with them a
  screenshot could be faked to point at someone else).
- **Page (`public/board.html`):** `paintShotMark` draws the layer for any signed-in account whose `/auth/me`
  has a number, on both sites (no `PREVIEW` test now); none, nothing drawn. Page Health's "Trace a
  screenshot" is on both sites (the page is his alone); it matches against every account's number from
  `/health/accounts`, plus the test-site trial's number for the owner key (the plain hash, `markOf`), so his
  trial screenshots still trace. Before the paste it says so: "This site's Worker doesn't give out the
  account numbers yet ... paste the new Worker code into both Workers."
- **Copy page rebuilt** (https://claude.ai/artifact/Ko95qHHnGfvW9r1m7suiNu, version `3f24ee2`, 2079 lines):
  the branch's Worker, which is the `e3e7936` copy page's (unconfirmed sign-ups, sign-up wording, the
  owner-only test alert route) plus this. Read back after publishing and decoded: byte for byte the file.
  **A session that rebuilds the copy page from a branch without `3f24ee2` takes the mark's numbers out.**
- **Checked.** Suite **505 of 505** (`test/board/accounts.test.js` "screenshot mark": the number for an
  approved account and the owner key, none while waiting for approval, stable, different per account, not
  the trial's hash, the same after a fresh copy of the Worker on the same bucket, the secret kept under
  `accounts/` and not served, the owner's list carries the numbers and an Admin's does not;
  `test/board/shotmark.test.js` changed to the promoted state, quoting him; one pinned line of
  `test/board/members-review.test.js` moved with the trace box). Each piece broken on purpose three ways
  (drawn without a valid number, the Worker giving no number, Admins given the numbers): a test fails each
  time. In a browser, this branch's page over the main site's real data (nothing saved): **with today's
  Worker** a member and the owner get no layer, Page Health has the box, and the trial screenshot traces
  with the "paste the Worker" line; **with the new Worker's answers stood in** (a number in `/auth/me`, the
  numbers in the owner's list, in that browser only) a member's screenshot (light, dark, Messenger-style,
  text-message size, cropped) named that member's account 20 of 20, the owner's named the owner key, the
  trial's the trial, a pre-mark screenshot "No mark found". **A member's view on both sites is the same to
  the letter with the old page and the new while the Worker gives no numbers.**
- **Not checked:** the Worker itself on Cloudflare (only Node with a stand-in bucket); a real member's phone;
  an iPhone's own screenshots.
- **The paste, checked 13 Nov about 01:05 UTC (his word: "pasted it into both, check it"; read only, counts
  only):** both Workers serve `3f24ee2`: `/health/accounts` lists 35 accounts, every one with a number, all 35
  different, and `ownerMark`; `/auth/me` as the owner key's session carries the same number; **both sites give
  every account the same number** (one secret, one bucket); `unverified` is there and `GET /health/test-alert`
  answers 405 (the other session's route is in). **The page is not yet:** the laptop runs `adb089b` (pulled
  just before `3f24ee2`), so both sites still serve the test-site version (no mark for members). **Waiting on
  one more laptop `git pull`** (no restart); then look: `#shotmark` on both sites as the owner, a fresh
  screenshot traced on Page Health.
- **After his paste, look (read only, counts only):** `/auth/me` as the owner session carries `mark`;
  `/health/accounts` carries `ownerMark` and a `mark` on every user; then, after the pull, the layer on
  both sites (as the owner, `#shotmark` present) and a trace of a fresh screenshot.
- **Still his (asked 12 Nov, not answered; not raised again unless he does):** a faint visible number as
  well; telling members that pages are marked to their account (recommended to him). Members have not been
  told. The number is never the name code.

**History: the test-site build (12-13 Nov), now superseded by the above.**
**Owner, 12 Nov evening:** "can we make it so scren shots are blockable, or we would have a a way to track
screen shots maybe. Would it be possible to bake a hidden id number in the backround that is not visible to
people but if I gave you a picture of a screen shot or a screen shot, you would be able to know what account
it came from". Answered with a test (blocking: not possible from a website; tracing: yes, numbers below and
in [screenshot-mark/README.md](docs/board-checker/screenshot-mark/README.md)), then asked: build it on the
test site; hidden only or also a faint visible number; tell members. **His answer: "Build it on the test
site first".** The other two are still his (not answered): built hidden only.

**What he sees on board-test (with the owner key; `PREVIEW`).** Nothing new on the board itself: one
see-through layer over every page (`#shotmark`, `position: fixed`, top z-index, taps go through), its 8 × 8
tile marking his own account's number 1 shade out of 255 (darker on a light page, lighter on a dark one; it
follows a change of page style). On Page Health, under "The board checker": **"Trace a screenshot"**: pick
a picture, the phone reads it (nothing is sent anywhere; the only request is the Members list) and says
"Taken on <account>", with how many of the 20 number cells match it and the next closest, or "No mark
found". **To try it:** a screenshot of board-test (sent to himself through Messenger and saved, if he
likes), then Page Health → Trace a screenshot. It should name "the owner key (your own devices)", or his
own member account if his phone is signed in with his email. A member on either site gets neither, and
his own view of the main site neither.

**Where.** In `public/board.html`, just above `modeCurrent.onclick`: the `ShotMark` block (the fixed layout,
`cells`, `tileRGBA`, `accountId` = the Worker's own account id from the email, `markOf` = 20 bits of
SHA-256 of `mark:` + that id, and `decode`, the Python reader ported), then `paintShotMark`, `traceSection`,
`traceCandidates`, `pixelsOf`, `traceWords`, `wireTrace`. Hooks: the load-time `auth/me` handler (`SHOT_ME`),
`siteReviewPaint`, the Settings `apply` (a `board-theme` event), `renderHealth` (the section and its wiring),
and the `#shotmark` style rule. **The layout must never change** once marks are out (older screenshots
could no longer be read); the Python reader carries the same numbers and a test checks they agree.

**Checked.** Suite **495 of 495** (`test/board/shotmark.test.js`, 5: the layout against the Python reader's,
the account id against the Worker's own formula, the tile, reading made-up light and dark pages, a smaller
noisy one and a crop with nothing from plain pages, and the test-site gating; each broken on purpose four
ways, a test fails every time). In a browser, this branch's page over the real board-test data as him
(phone size, 3×; nothing saved): the layer drawn; measured, light: half the pixels exactly 1 shade darker;
dark: 1 lighter; taps reach every button under it; Page Health's box read his screenshot as taken (light
and dark), Messenger-style, text-message size and cropped to one box: all "Taken on the owner key", 20 of
20 cells, 2 to 4 s each in that browser; the same screen without the mark and a member's screenshot of the
main site: "No mark found". **A member's view on both sites is the same to the letter with the old page and
the new** (nine tabs), and his own view of the main site has neither piece. The JavaScript reader and the
Python one give the same answers on the same pictures.
**Fixed on the way (both readers):** two fill colours a few shades apart were read as one, which drowned the
mark on a made-up dark page; each pixel now goes to its nearest fill within 3 shades. Re-run on the real
screenshots: the same results as before (normal sharing all read; no false mark, no wrong member).

**Not checked.** A real phone: how faint it looks to him (the first thing to ask), how long the box takes,
an iPhone's own screenshots (Safari draws with WebKit; iPhone screenshots are Display P3 PNGs), Safari's
private browsing (it can add noise to what a page reads from a picture). Page styles other than light,
dark and the Departure Board. Real Messenger, WhatsApp and text messages (stand-ins only).

**To put it on for members (only at his word):** his answers to the two open questions (a faint visible
number as well? tell members, recommended?), and a Worker change: each account's number from a secret
(`/auth/me` hands it to the page; `/health/accounts` lists them for the trace), so nobody could work out
another member's number from their email and fake a screenshot. Then drop the `PREVIEW` tests in
`paintShotMark` and `renderHealth` and change the gating test, quoting him.

## Whole-site layout and structure review — November 12, 2026, afternoon (a separate session). His picks 1, 3, 5, 6 and 7 are BUILT FOR THE TEST SITE ONLY (`79fc425`, page only), WAITING ON ONE LAPTOP PULL; then his look on board-test. 2 and 11 TURNED DOWN ("2 leave it and leave 11"): do not raise them again. Nothing is on the main site. The tab-by-tab review below carries on as it was

**Owner, 12 Nov: "Review the entire site, suggestion improvements to the layout or structure."** Taken as
one round across all the tabs, under the same rules as the tab-by-tab review below (look for real, a short
ranked list, then stop and wait; build only what he picks, test site only; nothing he has said no to). It
is about how the tabs fit together, not what is inside each one: rounds 1 and 2's items were not gone over
again, and each tab still gets its own round.

**How it was looked at.** Both real sites through the saved owner key, read only (every request that is not
a GET stopped, `boardNoCount` set, nothing pressed that saves): the main site as a member (the stand-in
described below) and the test site as him, at 390 × 844 and 1280 × 800, light style, on the checks of 1200
to 1355 Toronto. Every tab opened and measured (where the page starts, its height, tables against their
boxes), the Track box opened and cancelled, Settings opened, SR03 looked up in Turn History and carried to
the other tabs, a followed turn tried by putting `trackTurns` in the browser's storage, Back pressed after
three tab changes. No page errors, no failed requests, no sideways scroll of the page on any tab at either
width. The live sites were still the page before `6403bde` (the counts line was still on Current).

**The twelve items, in his order (wrong or misleading, hard to find on a phone, missing, could come off).**
1. **Back leaves the site.** A tab change is not a step the phone remembers: every tab writes its address
   with `history.replaceState` (the history's length was 3 before and after three tab changes; Back from
   Order summary landed on the sign-in address). On Android the back swipe closes the board. Idea: each tab
   change is a step (`pushState` and a `popstate` handler that calls `setMode`).
2. **Three names.** Every tab is headed "LINE-UP SNAPSHOTS · Sarnia road · what CATS showed when each check
   ran" (that describes the Snapshots tab, the last of ten; `<title>` the same); the Home Screen icon is
   "Board" / "Sarnia Board" (board.webmanifest). ❓ His to name. The compact header (test site) already
   drops the second line.
3. **"Find a turn" follows, it does not find.** Typing a turn there opens "Track SR03 · Alert me when …"
   (twelve boxes); finding is Turn History's "Look up a turn". The same box and "How to get alerts on this
   phone" also head Snapshots, a past check: with one followed turn the snapshot starts at 871 px on an 844
   px screen (rail 503 px). A followed turn's chip opens the alert choices; nothing leads to its history.
4. **The top takes 40 to 49% of a phone's first screen on every tab.** A member: title, 10 buttons in 4
   rows (178 px) and "Updated": 342 px, the page starts at 354 px (481 on Current, 653 with a followed
   turn, the first train at 982: off the first screen). Him and Admins: 14 buttons in 5 rows (224 px), 384
   to 416 px. Idea shown to him as a picture (the live page re-arranged in a session's browser only): four
   groups, Board (Current, Order summary, Snapshots) · My turn (Turn History, My stats) · Records
   (Analytics, Article 18.6(b)) · Reference (Agreements, Job Aids, Job postings), with the open group's
   pages on a line under it, a group opening on the page last used in it, and the four owner tabs behind
   one "Owner" button. In the picture the page starts 151 px higher (first train at 659 instead of 811).
   Nothing runs off the screen (he turned the swipe row down on 10 Nov: not offered). Cost, told to him:
   four places stay one tap, the others become two. It is Current's item 8 again in another form (left
   unpicked, "his taste"): said so to him.
5. **The tabs scroll away and nothing brings them back.** `.top` is not pinned and there is no "top"
   button; My stats is 13,290 px on a phone, Current 8,806, a turn's history 3,486, Analytics' Overview
   2,826 (Notifications 67,265, his own round). Idea: a thin strip pinned while scrolling (the open tab's
   name, tap for the tabs), or a "Top" button.
6. **My stats: 19 sections, no way to jump** ("Every trip" is at 12,142 px). Current has jump buttons and
   folding boxes; My stats has neither. Idea: the same jump row, or folds remembered per phone.
7. **Analytics stacks three rows of tabs and the second runs off the screen:** its seven sections are a
   swipe row showing 356 of 663 px (Call stability, Assignment errors and Stale trains off the edge), the
   thing he had fixed on the main tabs on 10 Nov; My week adds a third row (its content starts about 750
   px down). Overview is 2,826 px describing those seven sections (his approval of 8 Nov: put as taste).
   Idea: wrap the section row into full rows; Overview as one line a section with its number.
8. **A turn looked up in one tab is forgotten in the next.** SR03 in Turn History, then Analytics: empty
   search; Current: not marked. Six boxes (Find a turn, Look up a turn, Find a train, Analytics' Search, Job
   Aids, Agreements). Turn History already offers followed turns as a chip ("Your tracked turns"). Idea: the
   last turn or name code looked up offered the same way in the other boxes (never in the address bar for a
   code), and "in Analytics" / "on the board" links on a turn's page.
9. **My week and My stats are apart.** My week is the second section of Analytics (the turns followed on
   the phone); My stats is its own tab (the member's own name code) with its own "Week by week". ❓ Asked
   him whether My week should move to the top of My stats, with a link from Analytics.
10. **Headings come five ways,** and two tabs open on a page with another name (Article 18.6(b) → "Held in
    Toronto 14 h+"; Order summary → the date). Idea: one pattern (small line the tab's name, big line what
    is on screen, the controls under it).
11. **Settings:** Page style's 67 choices sit between Profile and the two short things after it (Current
    page, Home Screen), which are below the fold of the box (1,041 px in a 774 px box). Idea: Page style last.
12. **On a computer** every tab but Current and Snapshots runs the full 1,248 px (Agreements' question box;
    Order summary's rows with the arrow 1,200 px from the time), and Current's left column is empty below
    Find a turn for about 5,000 px. Idea: a reading width of about 900 px. Low if nearly everyone is on a phone.

**Already built on the test site and waiting on his word (not new, told to him as such):** the compact
header (about 60 px back), Turn History with Now first (on the main site Now is about 2,500 px down a
turn's page), 18.6(b) and Snapshots as rows.

**Suggested to him if he would rather I chose:** 1, 3, 5, 6, 7 and 11 (page only, nothing moves); 4 is the
big one and his to look at first; 2 and 9 need his answer; 8, 10 and 12 after.

**His answer, 12 Nov about 15:40 Toronto: "2 leave it and leave 11".** Read as: the name on the page stays
as it is (item 2: "Line-up Snapshots" and its second line, and the icon's "Board"), and Settings keeps its
order (item 11). **Both are turned down: not to be raised again, here or in the Settings round.** He named
nothing to build, so nothing was built: he was asked in the same reply whether to go on my picks less 11
(1, 3, 5, 6, 7), with or without 4. Items 8, 9, 10 and 12 are neither picked nor turned down.

**His pick, 12 Nov about 16:00 Toronto: "1, 3, 5, 6, 7 (Recommended)"**, tapped in answer to "Items 2 (the
site's name) and 11 (Settings order) are left as they are. Which of the rest should I build on the test
site?" (the other choices were those plus 4, and nothing yet). **Not picked:** 4 (the tabs in four groups),
8, 9, 10, 12. **Turned down:** 2 and 11.

**BUILT, 12 Nov 16:05 to 16:35 Toronto, `79fc425`. All of it is in `public/board.html` behind `PREVIEW`
(board-test with the owner key): no laptop code, no Worker change, no paste. A member on either site sees
the page exactly as before.** New test file `test/board/site-review.test.js` (7). Suite **489 of 489**.
- **Where.** One block of helpers just above `modeCurrent.onclick` (headed "Whole site, reviewed with the
  owner 2026-11-12"): `tabOfAddress`, `tabStepWanted`, `tabTapped`, `TAB_BUTTON`, the `popstate` listener,
  `siteReviewPaint`, `pinClose` / `pinTabs` / `pinPaint`, `mineJumpHtml` / `mineJump`. A line each in
  `setMode` (the step, and `pinPaint()`), where `PREVIEW` is switched (`siteReviewPaint()`), `trackSummary`
  and `paintTracked` (the History button), `renderMine`'s `draw`, `analyticsOverviewGuide` (`compact`) and
  `anaHome`. `let tabQuiet` beside `firstTabOpen`. Styles in one block after the test site's own rules
  (`.pin`, `.msjump`, `.ov2`, and rules under `body.preview-site`).
- **What he sees on board-test, by item.**
  1. A change of tab is a step: `setMode` adds one (`history.pushState`) when the tab really changes, the
     first tab is up and the page has been touched; Back and Forward open the tab the address is for
     (`tabOfAddress`; a tab the viewer does not have opens Current). Moving about inside a tab (another
     snapshot, another turn) still rewrites the address in place, so Back from Snapshots goes to the tab
     before, not through every check looked at. The two lines of the other session that open Page Health by
     its address are as it left them (its test pins them).
  3. The box on Current reads "Follow a turn (alerts)" (`siteReviewPaint`; the published page still says
     "Find a turn"). A followed turn's card has "Turn History →" (a followed person opens on their own code
     kept on the phone, else the turn they are on). On Snapshots the box, its label and "How to get alerts
     on this phone" are left off and the card comes after the day and the hours. **My reading, told to him:
     the card itself stays on Snapshots** (it says where the turn stood in that check); he had been told
     "take it off Snapshots" of the box. With one followed turn, his Snapshots starts at 810 px (was about
     913 for him).
  5. Once the tab bar is off the top: a 50 px strip pinned there with the open tab's name (tap: every tab
     this viewer has, in full rows, the page's own buttons pressed for real) and "▲ Top". A box jumped to
     stops 56 px down so its heading clears the strip (`scrollPaddingTop`); the rail on a computer and the
     Arrange bar stick below it. Drawn on every tab and at every width.
  6. My stats: under the heading, "Jump to a section (18)", folded (open or shut kept on the phone,
     `mineJumpOpen`), each section a button in My stats' own style. With the strip's "▲ Top" it is one tap
     down and one back.
  7. Analytics on a phone: the section row wraps into full rows (3 rows, 132 px, was one sideways row of 50
     px showing 356 of 663). Overview is "Analytics pages", a line each for the six pages with its figure
     (or its question), and the whole guide he approved on 8 Nov folded under "What each page answers, and
     using the records", word for word. The page went from 2,868 to 1,306 px.
- **To promote a piece:** drop its `PREVIEW` test (and the `body.preview-site` prefix of its styles) and
  change the test that pins it, quoting him. They do not lean on each other, except that 6 is better with 5.
- **Checked.** The suite. In a browser, this branch's page put over the real sites' data (in that browser
  only; `boardNoCount` set; every request that is not a GET stopped; nothing saved): **as him on board-test
  at 390 and 1280 px, light and dark,** all 14 tabs clicked and each showing its own heading, three tab
  changes then Back three times and Forward once, the History button and Back from it, Snapshots with a
  followed turn, the strip (shut, open, a tab picked from it, Top), a jump in My stats (the section lands at
  56 px, the strip ends at 50), Analytics' row and Overview and a line tapped: no page errors, no sideways
  scroll, nothing off the edge. **As a member on both sites: Current (scrolled 3,000 px), Turn History,
  Order summary, 18.6(b), Analytics, Agreements, Job Aids, Job postings and Snapshots are the same to the
  letter with the old page and the new, over the same answers** (a followed turn in the browser's storage);
  My stats has its 18 sections and no jump list, no strip after scrolling, Analytics' row and Overview as
  before, and tab changes add no steps.
- **Not checked.** A real phone, and Back on a real Android phone above all (a browser's own Back button
  here); an iPhone opened from its Home Screen icon (it has no Back button: the strip is what it gains);
  page styles other than light and dark (the strip and the lists use each style's own colours and the tab
  buttons' own rules); the published page on board-test (it needs his pull).
- **Known edges.** In a browser that cannot say whether the page has been touched (older iPhones), a tab
  the page opens by itself from its address counts as a step. A step is added for any change of tab,
  including the page's own jumps (a train in Analytics opening Order summary, "Open the Members tab").

**Waiting on him:** one laptop `git pull` (a restart is not needed for a page change; the next check
publishes it), then his look at the five pieces on board-test and his say on each (keep, change, drop, or
promote). Still open from the list: 4 (the grouped tabs: he has the picture), 8, 9, 10, 12.

**Not checked.** A real phone or a real member's account; an iPhone; any page style but light; the sign-in
page and grievance.html; Members at phone width (still loading when looked at; it drew at 1280 px). There
is no count of which tabs members open, so the grouping and its order are a judgment, not a measurement.
The session's scripts and pictures were in its scratchpad only (not kept); the picture sent to him was
`tab-bar-idea.png`.

**Also for the next session:** this cloud session too began on a stale checkout (`f5b27e2`, 10 Nov) and was
fast-forwarded to GitHub before anything was read (`git fetch --deepen=120`, then `merge --ff-only`; the
shallow clone first said "unrelated histories").

## Tab-by-tab review — started November 12, 2026. ONE TAB PER ROUND. Rounds 1 (Current) and 2 (Page Health): his picks are ON FOR EVERY MEMBER, BOTH SITES, in the code since 12 Nov 13:45 Toronto at his word (`6403bde`), WAITING ON ONE LAPTOP PULL (page only). The counts line is off Current at his word. The purple pieces stay on the test site. Round 3 (Members) started 12 Nov evening: its section is at the top of this file

**Owner, 12 Nov (max effort):** "review the Sarnia board site one tab at a time, looking for improvements
worth trying on the test site", then "Start with the current, page health then members tab". **His rules
for this review:** look at each tab for real (a browser, the test site, live data, phone width first, then
desktop) and read the code behind it; bring a short ranked list (wrong or misleading first, then hard to
read or find on a phone, then what a member would want that is missing, then what could come off); a
question that depends on how the railway works is asked, not guessed, and a settled rule is not changed;
**then stop and wait**; build only what he picks, and only so it shows on the test site (`PREVIEW`);
nothing to the main site or to every member "until I say so in so many words"; tests and the page loaded in
a browser before every push; one tab per round. Not to do: any notification, alert, email or test message
to members; a full name anywhere; a pull request; the git branch `main`; raising again what he has said no
to. **Keep this list up to date after each tab.**

**Order.** His three first; the rest is my order by how much members would use each (not confirmed by
him), from the tabs the page itself had on 12 Nov:
1 **Current** (reviewed, below) · 2 **Page Health** (owner) · 3 **Members** (owner, Admins) · 4 Turn History
· 5 My stats · 6 Job postings · 7 Order summary · 8 Analytics (Overview, My week, Trains, Turns side by side,
Call stability, Assignment errors, Stale trains; Likely-call test on the test site only) · 9 Article
18.6(b) · 10 Agreements · 11 Job Aids · 12 Snapshots · 13 Notifications (owner) · 14 Search Review (owner)
· 15 ⚙ Settings (Profile and name code, Page style, Arrange the boxes, Add to Home Screen) and the sign-in
page. Seen while listing them, for their own rounds: Notifications is 67,000 px tall on a phone and
Members 8,300 px; Page Health and Search Review leave the last snapshot's address in the address bar.

**How a session sees the page as a member (worked out 12 Nov).** The proxy adds the owner key to every
request, so the owner-only answers always come back as if you were him: a browser with no
`boardOwnerKey` still gets Page Health, Search Review and Notifications, because `/health` answers. To see
what a member sees: (1) sign the browser in with `POST auth/owner` (a session named "Owner" with an
ordinary member's rights: crew names, the My stats tab with his own record); (2) leave
`localStorage.boardOwnerKey` unset (no owner tabs, `PREVIEW` off even on board-test); (3) answer `GET
/health`, `/health/…` and `/stats/days` inside the browser with the 404 the Worker gives everyone else
(Playwright `route.fulfill`); (4) `boardNoCount = '1'` in the init script; (5) stop every request that is
not a GET (`route.abort`) except `auth/owner`, so a stray tap can save nothing. It is a stand-in, not a
real member's account or a real phone: say so. His own view is the same with `boardOwnerKey` set to any
placeholder (`PREVIEW` on at board-test). A session's first load as the owner has no My stats tab until a
reload (the sign-in cookie arrives after the tabs are drawn); his phone keeps the cookie. Tracked turns
were tried by putting `trackTurns` in the browser's storage, never by pressing OK in the Track box.

### Round 1: Current — reviewed 12 Nov 2026, 07:35 to 08:10 Toronto, on the checks of 0735 to 0801

Test site, member view and his own view; 390, 360, 340, 820 and 1280 px; light and dark. Every box
photographed; every train's Why opened on all three line-ups; all 21 jump buttons; Find a turn and the
Track box opened (never OK); 13 kinds of tracked turn; Settings, Arrange, folding; every table measured
against its box; the figures checked against `data/2026-11-12.json`, `whengo.json`, `people.json` and
`trains.json`. No page errors, no sideways scroll of the page at any width.

**Shown to him as ten items (his priority order). Each is a page change unless it says otherwise.**
1. **The card under Find a turn leaves things out.** (a) A spare lined up for a *predicted* job is told
   nothing: tracking B139 at 0801 the card read "Conductor fast 006: available · Conductor slow 001:
   available" while the fast board row and "Predicted jobs going spare" had B139 for E27861 12, call
   ~12th 1655 (EN05 the same for M39671 11's engineer job). Cause: `factsOf` in public/board-turns.js
   reads `s.vacancies` only, never `s.vacanciesPredicted`; `whengo.json` has pool turns on the Sarnia
   line-up only (23 turns, no spare, nobody away). That function also builds `data/turns.json` on the
   laptop, so for the test site the line is added in the page (`trackSummary`), not there. (b) A crew away
   gets "Predicted home on M39931 13 (PLN 12th 2300)" with no call time; the Toronto row beside it has
   "call ~12th 2045".
2. **A day off shown "Active now" for someone the Call Board has working.** SA08: option 4 line OFF 11th
   2140 to 12th 2140 (kept 24 h, `daysOff[].on`); the A pool board showed `**` until the 0334 check and not
   from 0358; option 5 stopped listing the job then; Z14891 11 was ordered by 0601 and on the Call Board at
   0609 as `EN S109 · CO SA08` with no fill-in; `people.json` has the same name-code hash as SA08's own
   from 4 Nov right through the trip. The page then said all three at once: Days off "Active now" SA08;
   Pools "out working on Z14891; PL @ 11th 2140 · goes spare until 12th 2140"; Call board, SA08's own
   conductor. ❓ **Asked him:** was the day off cancelled, and should the site drop an active day off once
   it sees the person on duty on their own turn (or the `**` gone)? Showing it is a page change; what the
   engine and the alerts do with that day off is the checker's (a laptop pull, every member): not offered
   as a test-site item.
3. **"The big time is on duty (planned or ordered)" is not so.** The big time is `t.order`, the time on
   CATS's line-up; a train's crew goes on duty 15 minutes before it and the call shown is 2 h 15 before it
   (Z14891 11: 0815 on the line-up, on duty 0800 on the Call Board; the Calling sequence box says "Order
   time is on duty plus prep"). The 8 Nov S5 audit left the same question open (finding 4).
4. **"Yard jobs · on duty" lists shifts that ended long ago.** At 0801: YMPS31 on duty 9th 1500 (57 h past
   an 8 h shift, a trainee alone on it), YSBY06 5 h past, counted in "11 jobs". On the 11th, 165 of 189
   checks listed at least one job more than an hour past its shift; on the 12th every check. It is
   Housekeeping item 7's open ticket. ❓ **Asked him:** how long past the 8 h (12 h in the tower) before a
   job is taken as a ticket left open and set aside.
5. **"Tap a train for why that crew" does not say why.** The fold shows the day's calling sequence, then
   "No matching spare-job cover is saved for this train in this check." (on every train with nobody going
   spare) and "CATS details: TOPC 400MAC A EnCo · 45SAS10 / 45SASA0". The checker's own sentence is in
   every check and unused since `bcb88fa` (7 Nov): `t.reason`, e.g. "A and B used up for this road day →
   Chain Gang. Skipped (keep their place): SR04 on hold turn until 13th 0559; … No Chain Gang turn
   available → spareboard." Not found in the notes: whether he asked for it to go.
6. **"Conductors free 21 / 28 · Engineers free 0 / 3" counts the spareboards only** (`strip2`: turns on a
   fast or slow board whose status is exactly "available"), and reads as every conductor. A spare whose
   status is "PL @ 13th 1400" (a day off that has not started) is not counted free.
7. **Tables that run off the phone's edge.** Jobs going spare: the table needs 401 px (431 px for the
   predicted one) in a 356 px box at 390 px wide, so the Turn column ("returns …", the turn going spare) is
   cut and only shows on a sideways swipe inside the box, with no sign it scrolls; the middle column wraps
   to two or three words a line and the box is 1,592 px tall for six jobs (2,013 px at 340 px). Days off:
   names 19 px off the edge at 390 px, 49 px at 360 px. Yard jobs: the Off column 31 px off at 360 px.
   Every pool board, the Call board and the Calling sequence fit.
8. **The board starts below the first screen.** First train row at 811 px on a 390 × 844 phone (944 px
   with a tracked turn); 841 and 974 px on 360 × 780. Above it: tabs 178 px, Find a turn 113 px (247 px
   with a card), the date 30 to 60, the four jump buttons 98, the counts 61. With the compact header
   (already a test-site preview) and the jump buttons folded away: 645 px (778 with a card). The jump
   buttons all work; they still carry CATS option numbers ("SD 27") where the boxes say "Drags (SD)",
   "Road jobs" lands on the Call board, and "Garnet 31" has no board to go to when nobody is at Garnet.
   "Updated Nov 12, 08:03" sits two lines above the check's own time, 08:01.
9. **A crew is written three ways.** Train line-up "CO SA01 … / EN S101 …"; Toronto "S108 … + SA07 …"
   (engineer first, no CO or EN); Call board "EN … · CO …"; Garnet "S501 CO … · EN …". In the line-up rows
   CO, EN and the call share or split lines as the names happen to fit, so the call is in a different
   place on each row; on the Call board a line can break between "CO" and its turn. Sarnia calls read
   "call 12th 0745", Toronto and Garnet "call ~12th 0855", worked out the same way. ❓ **Asked him:** which
   order.
10. **Small wording.** "EN06 ⟨name⟩ filling in on SD04 ⟨the same name⟩" (a turn out working shows who is
    working it, so the fill-in line names one person twice); Garnet's Details says "The Garnet board
    wasn't read in this check" when it was read in all 60 checks that day and showed nobody; "Conductor:
    spare (S502 … spare)" in L502's Why; a tracked yard job reads "is on the vacancy list" where the box
    is called Jobs going spare.

**Noted, not put to him as picks.** L502 is planned for 0400 on every one of 27 runs kept and went on duty
at 0245 on 15 of them (30 minutes or more before the plan on 17), so its "call 13th 0145" on the main site
is usually an hour late: the likely-call test covers it and is his to decide on the 24th (moved from the 25th). The preview's
"likely call" line is 1.7 to 1 against the page in the light style (only he sees it): told him. A name
with no first initial (SA07's): the crew names' own loose end.

**Not checked.** A real phone or a real member's account; an iPhone; any page style but light and dark;
the down banner and a check where a CATS screen was not read (not seen live); a board with no trains.
Nothing was pressed that saves: no alert, no Track OK, no Settings Save.

**His answers, 12 Nov about 08:35 (his words in quotes):**
- **Item 2 / question A.** He quoted the Call Board's line for Z14891 11 and said **"It went this
  morning"**: SA08's own conductor worked the train, so the day off the page still listed was not taken.
  He has not yet said in words that the site should drop a day off when it sees that; put back to him as
  the rule item 2 would use (a day off is over once its person is on the Call Board on their own turn),
  page only, test site.
- **Item 4 / question B.** No cut-off in hours. **"We can add a check it's similar to how we get the off
  duty times for trains coming back to Sarnia"**: read the yard jobs' real off duty from CATS, the way
  the checker reads Assignment History for trains (PSTS17A, 3 → 7, about once an hour, `POOL OR YD/LO` =
  S1 and S5, `HOME/AWAY` = 1; `parseAssignHistory` only knows a train's line). **Asked him for two
  things before anything is built:** what he types in `POOL OR YD/LO` (and `HOME/AWAY`) to list the yard
  jobs, and a photo of what comes back. It is a checker change (one more read an hour, skipped if it
  fails; a laptop pull and restart; the read cannot be test-site only, what the page shows from it can).
  It is also what Housekeeping item 7 (real yard hours) needs. Item 4 waits on this.
- **Item 9 / question C.** **"Can switch it. But it doesn't really matter"**: conductor first in every
  box if item 9 is ever picked; low on the list.
- **His picks:** not yet. He asked what "the numbers you want tried" meant; explained (the ten items are
  numbered; he names the ones to build on the test site). My suggestion to him if he would rather I
  chose: 1, 2, 3, 5, 6, 7 and 10 (sure, and none waits on anything); 4 waits on the CATS screen, 8 is his
  taste, 9 he says does not matter.
- **"yes"** to saving on the branch the laptop pulls: from here this session pushes to
  `claude/vigilant-planck-zawrj4` (fetch and rebase first, as the others do).

**His pick, 12 Nov about 08:50: "Go"**, to "If you'd rather I choose, I'd build 1, 2, 3, 5, 6, 7 and 10. Say
go and I'll do those." Not picked: 4 (waits on the yard screen, below), 8 (the first screen: his taste, not
asked again), 9 (crew order: "doesn't really matter"). **Turned down:** nothing in so many words.

*(Since 12 Nov 13:45 these are on for every member and item 6's counts line is taken out: see "His say on
rounds 1 and 2" further down. What follows is how it stood while it was on the test site only.)*

**BUILT, 12 Nov 08:55 to 09:25 Toronto. All of it is in `public/board.html` behind `PREVIEW` (board-test
with the owner key): no laptop code (`lib/`, `scripts/`), no Worker change, no paste. A member on either
site sees the page exactly as before.** New test file `test/board/current-review.test.js` (10). Suite
**472 of 472**.
- **Where.** One block of helpers between `changes2` and `strip2`, headed "Current, reviewed with the owner
  2026-11-12: TEST SITE ONLY": `LINEUP_NOTE`, `whySaid`, `dayOffWorked`, `dayOffNotTaken`, `lessDayOff`,
  `statusShown`, `cardLines`. Then a `PREVIEW` branch in each caller, the older line kept beside it:
  `strip2`, `lineup2`, `lineupWhy`, `s5CrewWhy`, `onDuty` (+ `fillIn`), `garnet2`, `daysOff`, `poolBody`,
  `trackSummary`, `vacancies`. Styles after `details.cur2[hidden]`: `.whysaid`, `.vac2`, and two rules
  under `body.preview-site` (the class the page sets with `PREVIEW`).
- **What he sees on board-test, by item.**
  1. The card under Find a turn: a spare lined up for a predicted job gets "Lined up for E27861 12 (CO,
     planned 12th 1910, call ~12th 1655, off the Conductor slow board). Not on CATS yet: the line-up has no
     turn free (no Chain Gang conductor is free)."; a Chain Gang turn the same as "May be called for …"; a
     crew away gets ", call ~12th 2045" after its train home; the 501/502 crew that took L502 out (or
     whoever is filling in on it, by craft) gets "Home from Garnet on L50131 12 (ORD 12th 2130), call
     ~12th 1915". Done in the page (`cardLines`), not in `factsOf`, which also builds turns.json.
  2. A day off whose own person has gone on duty on that turn since it began, with nobody filling in
     (`dayOffWorked`: road turns, CO or EN, on duty at or after the day off's start): out of "Active now"
     into "Listed, but working" with "on duty 12th 0800 on Z14891 11, nobody filling in"; the heading
     counts it as "not taken"; the note is off its pool row and off its card ("out working on Z14891").
     **Shown only: the line-up and the alerts still read the day off as CATS listed it** (said on the page).
  3. Under the line-up: "The big time is the one on the CATS line-up (planned or ordered). The crew goes on
     duty 15 minutes before it (a deadhead at that time), and the call is 2 hours before on duty."
  5. A train's Why opens on the checker's sentence (`t.reason`, its "Called ~…" left off since the row has
     the call), above the likely-call test's notes; "No matching spare-job cover is saved…" is gone. L502's
     too (it answers the 8 Nov S5 audit's finding 3).
  6. "Spare conductors free 21 / 28 · Spare engineers free 0 / 3".
  7. Jobs going spare as short rows like the train line-up (`details.cur2.vac2`): time, job, craft and
     PLN / ORD chips, whose job it is "(spare)", "cover B104", "call ~12th 1330"; Details has the reason
     for a predicted job, the wrong-turn and not-tied-up notes, the full cover line with who was skipped,
     "CATS lists …" and "Returns …". No table left. Days off: long names wrap. At 420 px and under, Days
     off and Yard jobs get tighter cells and a yard crew may wrap. Measured after: no table wider than its
     box at 390 or 360 px; the box 1,054 px for six jobs at 390 px (rows shut).
  10. "EN06 ⟨name⟩ filling in on SD04" (the job's turn bare); Garnet's Details says "Nobody is shown at
      Garnet yet." when option 31 was read; L502's Why says "Conductor: (S502 ⟨name⟩ spare) · B137 ⟨name⟩";
      a tracked yard job "is listed in Jobs going spare"; Sarnia calls read "call ~12th 0745" on the rows
      and in the Why's cover line, like Toronto's.
- **To promote a piece:** drop that caller's `PREVIEW` test (for the styles, the `body.preview-site`
  prefix), and change the test that pins it, quoting him. One piece at a time is fine: they do not lean on
  each other, except that 2's three places (box, pool row, card) belong together.
- **Checked.** The suite. Each piece broken on purpose eleven ways (shown to every member, or the day-off
  conditions loosened): a test fails every time. In a browser, this branch's page put over the real sites'
  data (in that browser only; `boardNoCount` set; nothing saved, every non-GET stopped): **a member's
  Current and Snapshots, all eleven pools on, every fold open, ten tracked turns, are the same to the
  letter with the old page and the new, on both sites, three times over** (one thing aside: the reset
  colour on a spare's job row, which the page paints only on a full redraw, old page and new alike). His
  own test-site view at 390, 360 and 1280 px, light and dark, every piece read back from the live 0852 to
  0908 checks: B139's card, SA08's day off, S101's left standing (EN02 was working that job), SR03's and
  SR07's train home, S501's L501. No page errors, no sideways scroll. Every tab clicked as the owner on
  the test site and as a member on both: each shows its own heading.
- **Not checked.** A real phone. Page styles other than light and dark (the new rows are the line-up's own
  row, which every style already dresses). A job CATS lists under the wrong turn, or with its earlier
  crew not tied up, in the new rows: in the test only, none was on the board. (The published page after
  his pull was looked at later that morning: below.)
- **Left alone on purpose.** Turn History's "Now" for a spare (the same facts, its own round). What the
  engine and the alerts do with a day off not taken. The likely-call line's pale purple (his test).
- **A limit of item 2, told to him 12 Nov 11:40.** `dayOffWorked` looks only at the check on screen: once
  the person ties up at the away terminal and leaves the Call Board, nothing in that check says they
  worked, so the day off reads "Active now" again until its 24 hours are up (SA08: from about 1600 to
  2140 that day). To hold it, the page would have to look back through the day's earlier checks (it
  has them loaded) or the laptop would have to say so. Not built: his to ask for.

**Found while building, NOT changed (put to him):** Days off names whoever is working the turn, not who is
off. With S101's engineer off and a spare (EN02) working S101's job, "Active now" read "S101 ⟨EN02's
person⟩ EN"; before the job went out it had read the holder's name. It is the crew names rule (a turn out
working shows who is working it) reaching a box where the turn's own person is the point. The pool row
reads the same way.

**Yard Assignment History: his three photos, 12 Nov 09:11 (item 4, and Housekeeping item 7's real yard
hours). NOTHING BUILT.** Laid out in [SCREENS](docs/board-checker/SCREENS.md), "Assignment history for
the yard". In short: the same PSTS17A screen with **YD** typed in `POOL OR YD/LO`, `HOME/AWAY` left
blank; `START DATE` filled itself in (261111 at 09:11 on the 12th). The columns change to ASSIGNMENT,
ODT-DATE/TIME, DESCRIPTION, **O-T**: there is no DUTY column, so no off duty to read as there is for a
train. O-T was 0400 on YSBY03 and YSBY04 (the 12-hour tower jobs) and blank on the other fourteen,
YFLS01 among them (the job his housekeeping note says a trainee left open). **Asked him:** is O-T the
overtime on top of 8 hours, and when is it filled in; does a blank mean 8 hours or not tied up yet; and
what an X beside a job and Enter ("crew info") shows, since that may be what tells a ticket left open
from overtime. The reader would be a checker change (a laptop pull and restart; the read runs for both
sites, what the page shows from it can stay on the test site).
**His answers, 12 Nov about 09:35: "Yes, yes add the 3rd thing to house keeping".** Read as answers to
those three, in order: O-T is the overtime on top of 8 hours, filled in when the crew ties up; a blank is
both of what I asked (an either/or of mine: 8 hours once tied up, and blank until then); and the crew
info page is Housekeeping item 11 in TODO, a photo from him when he gets to it. **So item 4 and the yard
hours stay unbuilt until that photo.** The same message of mine had also asked whether Days off should
always show whose turn it is, and said Page Health starts on his word: neither is taken as answered by
"Yes, yes"; he was told how I read it and asked to say if a yes was meant for either.

**THE BUILD IS LIVE ON THE TEST SITE since 12 Nov 09:56 Toronto, and seen there.** He pulled `67dac13` at
09:38 (his screenshot; the start line went in as "de …", so the checker was down for about ten minutes
until he retyped it), "It's running" at 09:48; the first check after it (0953) published the page at
09:56, running code `67dac13`. Looked at on the real sites straight after, nothing put in place by hand:
- **His view on board-test** (`PREVIEW` on), 390 px: every piece showing on the 0953 check. "Spare
  conductors free 21 / 28"; the new note; a train's Why opening on the reason; "call ~12th 1000"; Jobs
  going spare 8 rows, no table; Days off "1 active · 4 upcoming · 1 not taken" with SA08 under "Listed,
  but working"; the fill-in lines naming one person; "Nobody is shown at Garnet yet"; the card for B139
  (its predicted E27861 12), SR03 (", call ~12th 2045"), S501-CO ("Home from Garnet on L50131 12 …") and
  SA08 (the day-off note gone). No page errors, no sideways scroll, no table wider than its box.
- **A member on the main site and on the test site:** none of it. "Conductors free", the old note, the
  "No matching spare-job cover" line, the two tables, Days off's two groups, SA08's status with its PL
  note, "wasn't read". No page errors.
**Waiting on him now:** his look at it on his phone and his say on each piece (keep, change, drop, or
promote); whether Days off should name whose turn it is; the word to start Page Health (round 2). The
laptop shows updates waiting on GitHub after `67dac13`: notes only, nothing to pull for.

**For round 2 (Page Health), seen on the way:** any push to the laptop's branch, notes only included,
turns Page Health's GitHub row red ("N newer updates waiting: git pull, then restart") and its verdict
to "needs you" (`codeRows`: `c.behind > 0` is `bad`). He was told the updates sitting there on the 12th
were notes and need no pull.

**Also seen at 08:09 that morning:** both sites served the page of `61d6b10` and Page Health's running
code was `61d6b10`, level with GitHub: the pull and restart the block below waits on are done. The other
session ("Turn history work schedule insights", branch `ccr-83c63a33-26zny2`) pushed a notes commit at
08:31 and was idle after it. This session's own branch is `ccr-bc91e48e-oqfmn2`, kept level with the
laptop's.

### Round 2: Page Health — reviewed 12 Nov 2026, 10:35 to 11:05 Toronto. Items 1 to 5 built 11:40; on both sites since 13:45 ("His say on rounds 1 and 2", below)

**Owner, 12 Nov about 10:35: "Start page health"** (before giving his say on round 1's pieces, which stay
on the test site as they are). Looked at as the owner on the test site and the main site (the page is the
same on both: only he sees it), 390, 360 and 1280 px, light and dark; every section read back; each
figure set beside the raw answers of `/health`, `/health/alerts`, `/stats/days`, `/health/held186` and
`/health/accounts` (counts only; nothing pressed: no Save, no tick box, no Forget). Three other states
were looked at by standing in for the health report in the browser only: all good, the checker down
3 h 20 m, a restart needed with the sign-in run out. No page errors, no sideways scroll, no table wider
than its box at any width.

**Shown to him as seven items.**
1. **"N things need you" is red when nothing does.** That morning: "3 things need you", one of them real
   (Microsoft sign-in with 1 h 50 m left). (a) The GitHub line counts every update: the laptop asks
   `git rev-list --count HEAD..FETCH_HEAD` (`refreshCodeBehind`, scripts/board-auto.js) and `codeRows`
   marks any count above zero bad, "git pull, then restart"; the two waiting were this session's notes.
   53 of the last 150 commits on the laptop's branch touched notes only. (b) "Alerts today: 91 sent, 1
   failed (last failed 02:55: SR01 is back on the board …)": bad all day after one failed send, and a send
   failed on 15 of the last 19 days in the alerts log. The line quotes the alert, not why it failed: the
   log keeps counts only, though `sendPush` returns the reason and whether the phone was gone. A phone
   that had unsubscribed (404 / 410) is deleted there and then and still counts as failed; others are
   tried again next check (S109's 22:48 on the 11th went at 22:52) and still count.
2. **A sign-up waiting for approval is not on the list.** One had been waiting since 08:40 that morning
   (`/health/accounts`: 1 pending, 34 approved); Page Health said nothing. Name codes waiting for his OK
   (My stats) would be the same: none that day (14 confirmed, 20 with no code). Told him about the one
   waiting in the same message.
3. **The lines put the point last and do not say what to do.** "Microsoft sign-in: 22 h 09 m ago; runs out
   ~Nov 12, 12:31 (1 h 50 m left)". With the checker down (stood in for), one problem reads as five
   lines: Laptop last checked, Your phones told it was down, Down alert, Last failed check, Watchdog
   restarts; none says the checker is down or to restart it.
4. **A long page with set-and-forget things in the way** (3,944 px at 390 px): the rep-email and passcode
   form always open (the 18.6(b) box is 712 px); Visitors lists 19 days of zeros from before counting
   began on 2 Nov; "CATS pages it asked you about" was two entries from 8 Nov as raw screen text (610 px);
   "Alerts sent" is a box holding one link.
5. **No address of its own.** The address bar keeps the last tab's (`#current`, or a snapshot's), so a
   reload or a saved link lands elsewhere. Search Review the same.
6. **Members seen today beside Visitors.** That morning: "27 phones" against 29 of 34 members seen
   (`seenAt`); the 10th and 11th read 148 and 88 phones (sessions' browsers, the known note). Offered
   once before for the Members tab, never answered.
7. **Rows that only matter when wrong** (Worker timer, Laptop backup, Health sent, Watchdog restarts 0,
   Last failed check "None recorded"): eleven rows, 633 px, when all is well. Could fold under the
   verdict. His 10 Nov approval was of this top as it is: put to him as taste.

**Asked him:** when a failed alert should count as needing him (suggested: only when it failed for a
reason other than the phone having unsubscribed and did not go through on the next try).

**For whoever builds from this.** 1(a) and 1(b) need the laptop (the report is made there:
`refreshCodeBehind`, `writeAlertsLog`, `Health.alertsToday`), so a pull and restart, and they change his
own page on both sites; 2 to 7 are `renderHealth` / `healthRows` in the page. Page Health is his alone,
so "test site only" here means behind `PREVIEW` so he can set board-test beside the main site.
**Answered by the look:** the GitHub row does work on the Windows laptop (it reported 1, then 2, waiting
that morning), the old ❓.

**His pick, 12 Nov 11:12: "Go"**, to "Which of these seven to build, by number, or go for my pick: 1, 2, 3, 4
and 5", in the message that also carried the one question (when a failed alert needs him: "only when it
failed for a reason other than the phone having unsubscribed, and it didn't go through on the next try"),
so that rule is taken as agreed. Not picked: 6 (members seen today) and 7 (folding the quiet rows).

*(Since 12 Nov 13:45 the page half is on both sites: "His say on rounds 1 and 2", below.)*

**BUILT, 12 Nov 11:15 to 11:40 Toronto. Two halves; suite 481 of 481 (9 new in
`test/board/health-review.test.js`). No Worker change, no paste.**
- **The laptop (it needs the pull + restart; nothing a member sees):** `lib/board/health.js`: `behindOf`
  takes a second count, the updates waiting that touch `CODE_PATHS` (everything but `*.md`, `docs/`,
  `test/`), and reports it as `code.behindCode`; `noteFailure(l, r)` keeps on an alert's log entry
  whether the phone was gone and what the push service said; `alertFailures(jsonLog, today, now)` says
  what became of the day's failed sends: `gone` (the phone had unsubscribed, removed), `retried` (the same
  alert reached a phone within 35 min), `pending` (failed inside the last 35 min), `open` (failed for a
  reason and never went: the one kind that needs him, with `lastOpen`), `unknown` (lines from before
  this, no reason kept). `scripts/board-auto.js`: `refreshCodeBehind` asks git the second question;
  `Health.noteFailure` at the four places a phone is sent an alert (turn alerts, job postings, My week,
  held 14 h+); the JSON alerts log line carries `gone` and `errors` when a send failed (the Desktop text
  log is unchanged); the report's `alerts` has the new figures beside `sent` / `failed` / `lastFailure`.
  The main site's Page Health ignores all of it.
- **The page, behind `PREVIEW` (his Page Health on board-test; the main site's is the same to the letter
  as before):** `codeRows` says "N newer updates waiting, notes only: nothing to pull for" and does not
  mark it; the Alerts row words each kind and is marked only for `open`; `accountsWaiting()` asks
  `/health/accounts` (counts and the oldest time only, at most once a minute) and `healthRows` adds
  "Sign-ups waiting" and "Name codes waiting"; `healthVerdict` uses a row's `say` (the sign-in: "runs out
  in 1 h 09 m (Nov 12, 12:31). Press R in the checker window, then approve it on your phone."), shows
  the checker being down as one line with the last problem and what to do, leaves the rows that only
  repeat it off the list, and has an "Open the Members tab" button; the rep-email form folds once both
  emails, the passcode and the sender are set; Visitors starts at the first day counted; CATS pages
  older than two days fold; "Alerts sent" is a line under Who gets alerts; Page Health and Search
  Review have addresses (`#pagehealth`, `#searchreview`; `ownAddress`, `ownerTabWanted`, `firstTabOpen`).
- **To promote:** drop the `PREVIEW` tests in `codeRows`, `healthRows`, `healthVerdict`, `renderHealth`,
  `paintHeldSettings`, `ownAddress` and where `accountsWaiting()` is called; the laptop half is already
  for both sites.
- **Checked.** The suite. In a browser, this branch's page over the real sites' data (in the browser
  only; nothing saved; the figures the laptop will send after its pull stood in for): on board-test as
  him, the real report of 11:20 ("4 things need you": the old GitHub and alerts lines still, since the
  laptop had the older code, the new sign-in line, and the sign-up waiting since 08:40), the report as
  it will be ("notes only", "1 with no reason kept", not marked), the checker down (one line), both
  addresses opened cold, 390 and 1280 px; the button to Members. **On the main site as him: Page Health
  and Search Review the same to the letter with the old page and the new** (owner-only answers held
  steady for both looks). A member's Current and Snapshots the same to the letter on both sites; every
  tab clicked as him and as a member. No page errors.
- **Not checked.** The laptop half on the laptop: `git rev-list … -- <paths>` on Windows (run here on
  Linux and in a test repository), a real failed send written by the new code, the report's new figures
  arriving. After his pull: Page Health on board-test should read "notes only" when only notes wait, and
  the Alerts row should name what became of a failed send from then on (the 02:55 one that day stays
  "no reason kept"). A real phone.

**The purple "likely call" line is OFF the test site's line-up since 12 Nov 11:40 (owner, with a
screenshot of board-test: "can you take out the purple predictive text").** `const TRAIN_LIKELY = false;`
beside `SPARE_PREDICT` in board.html; `likelyCall` answers nothing, so the line and its "When it is
likely to be called" note in the row's Why are gone. **The two-week test still scores the window**
(Analytics → Likely-call test, to 24 Nov: the laptop builds it from the saved checks). Left on, and
asked him about: the purple "usually +1.3 h" chip and "How this train has gone" (the habit, not the
prediction). His screenshot showed round 1's Why and the "~" call working on his phone.

**WHERE EACH TAB STANDS (the running list; keep it current).**

| Tab | Found | He picked | Now | Not picked / turned down |
|---|---|---|---|---|
| 1 Current | 10 | 1, 2, 3, 5, 6, 7, 10 ("Go") | 1, 2, 3, 5, 7, 10 on for every member (`6403bde`, after his pull) | **6 turned down after seeing it: the counts line is taken out** ("it does but take it out"). 4 waits on his "crew info" photo (Housekeeping 11). 8 (first screen) his taste, not asked again. 9 (crew order) "doesn't really matter" |
| 2 Page Health | 7 | 1 to 5 ("Go") | on both sites (`6403bde`, after his pull); the laptop half running since 11:46 | 6 (members seen today), 7 (fold the quiet rows) |
| 3 Members | 8 (and his two asks) | his two asks (Who gets alerts moved here, names beside the phones with no account); then 1, 3, 4, 5, 6 | on both sites since 12 Nov evening at his word (his picks 13 and 14 of the test-site list), for him; an Admin gets pick 1's heading only (the section at the top of this file) | 2 is the Worker paste (copy page given; pasted). 7 (name the followed code: a Worker change) and 8 (Approved date) not picked. Who gets alerts stays at the bottom ("leave it at the bottom") |
| 4 to 15 | — | — | not started (order at the top of this section) | — |
| Whole site (layout and structure; another session, 12 Nov afternoon) | 12 | 1, 3, 5, 6, 7 | on for every member since 12 Nov evening at his word (picks 2, 3, 4, 6, 8 of the test-site list; the section at the top of this file) | **2 (the site's name) and 11 (Settings' order) turned down: "2 leave it and leave 11"**. 4, 8, 9, 10, 12 not picked |

Open with him: whether Days off should name whose turn it is; whether a day off that was worked should stay
"not taken" after the person ties up away from home; what to do with the purple "usually" tag (below).

### Agreements tab: sample questions and how to ask — 13 Nov about 01:20 (12 Nov 20:20 Toronto). BUILT FOR THE TEST SITE ONLY 12 Nov about 21:00 Toronto ("Push these changes to the test site"); waiting on one laptop pull, then his look

**Owner: "I want to improve the agreement tab, I would like to add some sample questions and explanations. Can
you provide example of good questions to ask, and the type of questions to ask. Explain how AI can be more
useful than a normal search engine and its limitations".** Looked at as a member on the main site (390 px) and
read `public/board-ask.js` and the Worker's `ask`: a word search (BM25, `lib/search.js`) picks the passages (9
a question, `TOP_K`; 24 for a deeper search or the owner, `TOP_K_DEEP`), then the model writes from only those,
told to cite pages and say when it can't find it (`kimiMessages`). Each question stands alone (no memory).
**The sample questions were tested without asking the site** (no POST to `api/ask`: it costs and lands in his
Search Review): the six everyday PDFs fetched from `/docs/` and indexed with the repo's own `lib/indexer.js` and
`SearchIndex` in a session's scratchpad, each question run against the craft's documents (top 9). The mileage
guidelines are a text file the site does not serve (`/docs/mileage_guidelines.txt` 404), so no mileage sample.
Everyday wording against the agreement's: "How long can they keep me in Toronto?" 0 of 9 useful passages (it
found letters signed in Toronto); "What am I paid when I am held at the away-from-home terminal more than 14
hours?" 7 to 8 of 9, Article 18.6 first. "What do I get if a junior guy gets called ahead of me?" 0 of 9;
"What is a runaround and how is it paid?" 9 of 9.

**Proposed (picture sent to him, drawn in a browser only):** under the question box, "Try one (it fills the box;
then tap Ask)" with six questions for the craft picked (none picked: three of each); two folds below the notes,
"How to ask a good question" and "What it does better than a search engine, and its limits". The texts are in
the session's reply to him of 12 Nov about 20:20. Samples (each found the right part in the test):
conductor: held away more than 14 hours (Article 18.6); runaround; called and then cancelled; book rest, how
much; working a general holiday; how trains go to the A and B pools in Sarnia (crew calling, p. 14).
engineer: held at the away-from-home terminal; deadheading; book rest; called off the spare board;
bereavement leave; general holiday. Both: rest at the home terminal under the duty and rest rules.
To build on his word (test site only): `board-ask.js` (the list, a tap fills `#askq` and does not send), its
styles, and the craft buttons choose which six show.

**BUILT, 12 Nov about 21:00 Toronto. Owner, shown the picture: "Do you have any suggestions for this or ways to
improve it. Push these changes to the test site, then get back to me".** `public/board-ask.js`: `EXAMPLES` (six a
craft; the engineer list has "What is the most mileage an engineer can run in a month?" in place of the general
holiday one: it finds the mileage guidelines' monthly limit in the top three), `HOW` and `WHY` (the two folds,
shut by default), `setExamples(on)` (adds them, or takes them away), `paintExamples()` (the craft picked, else
three of each; also called from `setCraft`); `render` takes `opts.examples`. `public/board.html`: `renderAsk`
passes `examples: PREVIEW`; styles `.asktry`, `.askhow`. The laptop publishes `board-ask.js` with the page on
every check (`site.js`), so a pull is enough. New test `test/board/ask-examples.test.js` (4): every example
run through `SearchIndex` over the repository's own `data/` agreements (about 5 s), the "keep me in Toronto"
claim, the tap never sending, test site only. Suite 512 of 512; four breaks on purpose all caught. Browser,
both files put in place over the live data (in the browser only; every non-GET stopped and none attempted):
him on board-test at 390 light and 360 dark (three of each with no craft, the lists change with the craft
buttons, a tap fills the box and sends nothing, folds shut then open, no sideways scroll, no errors); **a
member's Agreements tab the same to the letter as before on both sites.** To promote: `examples: true` in
`renderAsk` and the test that pins it.

**Search Review, counted (questions and answers not copied anywhere), 4 to 12 Nov: 21 questions, 11 from
members.** Every one of the 21 answers has Markdown marks (`**`, `#` headings, `- ` bullets) that the tab
shows as typed characters (`.askanswer` is plain text). 4 of the 11 members' questions and 7 of his 10 ended
with "could not find". Put to him as suggestions, nothing built.
**Suggestions put to him, 12 Nov about 21:15 Toronto (his order; nothing built, waiting for his picks):**
1. The box promises "the rules or CROA awards", but the CROR, GOI and CROA awards are not searched unless
   added: offer "Add the CROR to this search?" when a question names them. 2. "the documents below" are the
   chips above: reword. 3. Draw the answers' bold, headings and lists, and make each [n] open its passage.
4. When it can't find it: the wording tip and the examples right there; and (a Worker change, checked against
   Search Review first) railway words the search reads as the agreement's ("PL" → personal leave, "DH" →
   deadhead, "kept in Toronto" → held at the away-from-home terminal). 5. Copy an answer with its pages.
6. Keep the last answer on the phone. 7. Pick the examples from what members ask (so far: crew calling 6,
   held away 5, vacation and leave 5, discipline or grievance 2; counted, not read). 8. The grey example in
   the empty box repeats the first example: "Type a question, or tap one below".

**His pick, 12 Nov about 21:20 Toronto: "Go with your pick: 3, 2, 1, 4 and 5". BUILT FOR THE TEST SITE ONLY about
22:10, waiting on one laptop pull; nothing to the main site.** All in `public/board-ask.js` behind `opts.preview`
(`renderAsk` passes `preview: PREVIEW`; the switch was `examples` before) plus styles in `board.html`. A block of
pure functions near the top ("Answer tools ... TEST SITE ONLY"): `answerHtml(raw, n)`, `notFound`, `plainText`,
`refsIn`, `MENTIONS` / `mentioned`. `setPreview(on)` adds and removes the pieces (`.asksugg`, `.asktry`, `.askhow`,
`.askcopy`), so a member's tab is built exactly as before.
- **3.** On the test site an answer is drawn from its Markdown (`stream`: `md = preview`; each answer keeps its own
  passages in `run._cites`, so after a deeper search an earlier answer's [n] still opens its own). Bold (an
  italic word inside it too), italics, `#` headings, `-` / `*` bullets with indented sub-points, numbered lists, a
  `>` quote, a `---` line; each [n] (also [1][2], [1, 2]) up to the passage count is a button: the passage opens
  under its paragraph with "Open at page N", tap again to close (`showPassage`). Run over all 28 answers kept in
  Search Review (counts only): no `**` or `#` left, 239 of 239 passage numbers drawn as buttons, tags balanced,
  nothing unescaped.
- **2.** The note reads "Answers come only from the documents picked above" (three notes share `.askhint`; the
  first is "Tap one to add it", which a browser look caught: the test pins it).
- **1.** Typing a question that names the CROR (or "rule 42"), the GOI, dangerous goods, discipline, CROA or the
  engineer operating manual, while that document is not searched: "The CROR isn’t being searched. + Add CROR".
- **4.** After an answer (the last one, after any deeper search) that says it could not find it: "Didn’t find it?"
  with the wording tip and three examples that fill the box.
- **5.** "Copy answer" beside "Try a deeper search" once an answer is done (not on "couldn't find it"): the
  question, the answer without its marks, only the pages it cites, and "A search aid, not legal advice: confirm
  with your Local Chairperson".
- **Checked.** New test `test/board/ask-review.test.js` (7); suite 519 of 519; eight breaks on purpose all caught.
  In a browser over the live sites with both files put in place, every "Ask" answered by a stand-in stream built
  from the repository's own agreement passages in the Worker's event shapes (`route.fulfill` in that browser:
  nothing sent, nothing spent, nothing in Search Review): him on board-test at 390 light and 360 dark, the CROR
  offer and "+ Add", a found answer (no marks, 7 passage buttons, [2] opened and closed, Copy read back from
  the clipboard), a not-found answer after a deeper search (the box, an example filling the box), "No matching
  passages" (the box, no Copy); no sideways scroll, no page errors. **A member on both sites: the tab, and the
  tab after an answer, the same to the letter as before.** Not checked: a real answer from the Worker (not sent
  on purpose), a real phone, iPhone.
- **To promote:** `preview: true` in `renderAsk` (it carries the examples and the folds too), and the tests that
  pin `preview: PREVIEW`.
- **Seen live on the test site, 12 Nov 21:27 Toronto,** after his pull (the laptop on `19d3573`): the real
  published page as him (examples, the two folds, "the documents picked above", the CROR offer; a stand-in
  answer drawn with 7 passage taps, [1] opening its passage, Copy read back; a stand-in "could not find" with
  the box and no Copy); a member on both sites: none of it. No real question asked since the pull (Search
  Review, counted). **Promoted since by another session at his word** (`0e26826`, his items 10 and 11 of its
  list): `renderAsk` passes `preview: true`, so his next pull puts all of it on both sites for every member.

### Engineers held 14 h+: the AD claim reminder — 13 Nov about 00:15 (12 Nov 19:15 Toronto). ON FOR EVERY MEMBER, BOTH SITES, since 12 Nov about 19:45 Toronto at his word ("push the AD reminder to main"); waiting on one laptop pull

**Owner: "for the article 18.6 (b) can you add a reminder that an AD claim needs to be filed and to talk to
their Local Chair person. This applies to engineers only".** Built behind `PREVIEW` (his view on board-test):
"Engineer: an AD claim needs to be filed. Talk to your Local Chairperson." ("Local Chairperson" as the site
already says it elsewhere; "AD claim" in his words, not spelled out). Where: (1) the claim form, right under
Conductor / Engineer, shown only while Engineer is picked (`enAdNote`, toggled in `wireClaim`'s `update`);
(2) on an engineer's held trip in a turn or name-code search (`held186`); (3) once at the top of the 18.6(b)
tab, "Engineers held 14 h+: …" (`heldView`, `adTop`). The claim's text and where Submit sends it are
unchanged. Test `test/board/held-ad.test.js` (3); suite 498 of 498. Checked in a browser over the live data:
on board-test as him, the tab's line, the form hiding and showing it as the craft is switched, S302's three
held trips in Turn History each with it; a member's 18.6(b) tab and an engineer's form the same to the letter
as before on both sites. **Not done, put to him:** the "held 14 h+" phone alert (laptop, every member who
follows a crew member) still says only "Open the board's Article 18.6(b) tab to send it to your rep" for an
engineer too. To promote: drop `PREVIEW` in `enAdNote` and change the test, quoting him.
**LIVE FOR MEMBERS on both sites, seen 12 Nov about 21:10 Toronto** (the laptop on `9319053`, which holds
`8511d2e`): a member on the main site, the real published page, reads it at the top of the 18.6(b) tab.
**Promoted, 12 Nov about 19:45 Toronto: "push the AD reminder to main".** `enAdNote` no longer asks `PREVIEW`;
the test pins it the same on both sites. Checked in a browser as a member on both sites with the new page: the
line at the top of the tab, the form hiding and showing it (Conductor → Engineer → Conductor), S302 typed into
Turn History: 3 held trips, each with it (the published page: none). Suite 501 of 501. The alert question is
still open.

### The four menus at the top of Current (Trains, Pools, Spareboards, Other) — 12 Nov evening. REMOVED ON THE TEST SITE at his word; members keep them

**Owner, 12 Nov about 18:00 Toronto: "Can we clean up what's in the trains pools spareboard and the last drop
down menu in that group of 4".** Looked at on both sites (a member on main, him on test, 390 px, the 1745
check): every button tapped. All 21 land on their box, and a box folded shut opens. Your other session
("Site layout and structure review") was **running** at the time and has test-site changes on the same page
(`79fc425`): told him, nothing changed here. Put to him, with a picture of each (now, and cleaned up, drawn in
a browser only):
1. **CATS option numbers on the buttons** ("Line-up 41", "SD 27", "Conductor fast 13"): the boxes never use
   them. Names as the boxes and the pool buttons have them ("Drags", "1st Manifest", "Sarnia line-up").
2. **Pools out of order** (Chain Gang, A, B, SD, S1, S3) where the pool buttons run A, 1st Manifest, B, 3rd
   Manifest, Chain Gang, Drags, 501/502, Garnet: same order.
3. **"Bunkhouse 28" sits in Pools** and lands on the Toronto box, the same place as "Toronto line-up 41": one
   "Toronto" button, in Trains.
4. **"Road jobs" in Other lands on the Call board**, the same place as "Call board" in Trains: off.
5. **Boxes with no button:** Calling sequence and Changes (and To check, when it shows): add to Other.
6. A pool button switches that pool on beside the ones already showing (for this visit, not saved on the
   phone), so tapping three pools stacks three boards. ❓ Asked him: keep, or show only the one tapped.
The menus list the CATS screens read in that check, so a button vanishes when a screen was not read; the
cleaned-up menus would list the boxes instead (a box with nothing to show greyed, as now).

**His answer, 12 Nov about 18:10: "I want them removed not fixed".** Built for the TEST SITE ONLY: in `show`,
`const menusOff = PREVIEW;` leaves the four menus off Current and Snapshots (the "No change until" chip that
shared their row stays). Members on both sites keep them, the same to the letter (checked in a browser over
the 1804 check). On his test-site view the first train row moved up 106 px (1,101 → 995 with two followed
turns). Test in `current-review.test.js`; suite 490 of 490. To promote: drop `PREVIEW` there (then `screens`,
`screenGroups` and the `[data-jump]` wiring can go, and `SCREENS` / `JUMPS` if nothing else uses them). The
other session was idle (waiting on him) when this was built.

### His say on rounds 1 and 2 — 12 Nov about 11:55 Toronto: on to the main site

**His words, in full**, in reply to the list of what to check on the test page (Current: 1 the counts line says
"Spare conductors free"; 2 his card shows "Home from Garnet on L50131 12 …, call ~1915"; 3 B139's or B106's card
names its job; 4 the note under the line-up; 5 tap a train, the reason comes first; 6 Jobs going spare is short
rows; 7 SA08 under "Listed, but working"; 8 a fill-in line names the person once. Page Health: five more):
"The counts line near the top says "Spare conductors free". it does but take it out Your card under Find a
turn shows "Home from Garnet on L50131 12 …, call ~1915". yes 5 yes 6 yes . You can push all this to the main
except the purple predictive stuff which i believe you removed".

**How it was read (told to him in the same reply, before his pull, so he can say otherwise):**
- **"take it out" = the whole counts line comes off Current** ("N trains · N ordered · Conductors free 21 / 28 ·
  Engineers free 0 / 3"), not only the word "Spare". The train count is still in the line-up's heading. If he
  meant only the word: put the line back with `strip2` from `290d077` and "Conductors free".
- **"all this" = everything in that message: round 1's pieces and round 2's Page Health pieces.**
- **"the purple predictive stuff"** stays where it was: the likely-call line off everywhere
  (`TRAIN_LIKELY = false`), the "usually +1.3 h" tag, "How this train has gone" and the spareboard odds on
  the test site only. None of it went to the main site.

**What changed, `6403bde` (page and tests only: no laptop code, no Worker, no paste).**
- **Current, every member, both sites.** The `PREVIEW` tests are gone from the review's pieces. A box that
  Snapshots' older layout also draws takes a **`reviewed` argument** (`pools` → `poolBody`, `vacancies`,
  `daysOff`, `onDuty`); only the short-row layout passes it (`sectionsGrid`'s `NEW` map), so **a member's
  Snapshots is the same to the letter as before** (its own round, 12 in the order; on the test site Snapshots
  draws like Current, an earlier preview that is still his to decide, so it has the pieces there).
  `lineupWhy`'s fourth argument is now `fresh` (the short-row line-up: "call ~", no "No matching spare-job
  cover…" line; the row itself puts `whySaid` first). `lineup2`, `garnet2`, `s5CrewWhy`, `whySaid`,
  `statusShown` no longer ask which site. The card under Find a turn (`cardLines`) is for every member on
  every tab. The Days off and Yard phone-width rules are under `body.current` (and `body.preview-site`).
- **The counts line:** `strip2` is deleted and Current draws nothing in its place; Snapshots' older layout
  keeps its own (`strip`, "Conductors available (spareboard)"). The `.cur2-strip` styles are left in the page.
- **Page Health and Search Review, both sites:** the `PREVIEW` tests are gone from `healthRows`, `codeRows`,
  `healthVerdict`, `renderHealth`, `paintHeldSettings`, `ownAddress`; the old verdict and the "Alerts sent"
  box are deleted. Opening by address needs the health report (only his key gets one); a member with
  `#pagehealth` in the address stays on Current.
- **Tests:** `current-review.test.js` (now 11) and `health-review.test.js` (9) pin the pieces as on for
  everyone, the older layout as it was, and the purple pieces as still gated. Suite **482 of 482**. Each
  piece broken on purpose 27 ways (gated again, the older layout changed, the counts line back, the purple
  ungated): a test fails every time.

**Checked in a browser before the push (this branch's page over the live sites' data, in the browser only;
`boardNoCount` set; nothing saved; every non-GET stopped), on the 1200 and 1313 checks of 12 Nov:**
- **A member on the main site, Current = what he looked at on the test site, to the letter**, once the counts
  line and the purple tag are taken off what he saw. The card under Find a turn the same. A member on the
  test site the same as on the main site.
- **A member's Snapshots: the same to the letter, old page and new, on both sites.**
- **His own view on the test site:** Current and Snapshots the same as published less the counts line; the
  purple tag still there (only he sees it).
- **Page Health on the main site with the new page = the test site's as published, to the letter** (the
  owner-only answers held steady for both looks); Search Review the same. `#pagehealth` and `#searchreview`
  open cold on the main site as him; as a member they land on Current with no owner tab.
- Read back as a member on the main site at 390 px: no counts line, no purple, 9 reason sentences for 9
  trains, "call ~", the new note, Jobs going spare 9 rows and no table, Days off "1 active · 4 upcoming · 1
  not taken" with SA08 under "Listed, but working", fill-in lines naming one person, the cards of SA08, SR03,
  B139, B106, S501-CO and YEBS30. First train row at 735 px on a 390 × 844 phone, from 811. 360, 820 and
  1280 px, light and dark: no sideways scroll, no table wider than its box, no page errors. Every tab opened
  as a member: its own heading, no errors.
- **Not checked:** a real phone or a real member's account; an iPhone; page styles other than light and dark.
  At 340 px the pool boards and the Calling sequence sit 17 to 18 px off the edge, old page and new alike
  (the old page's Jobs going spare, Days off and Yard did too, 51 to 95 px: those now fit).

**What he must do: one laptop pull.** `public/board.html` is copied to the site on every check
(`buildSite`), so the page changes at the first check after `git pull`, restart or not. Told him to do the
usual pull **and** restart all the same: without the restart Page Health says "Restart needed … Ctrl+C and
start it again" (the folder's code is newer than the running code), which is not so for a page-only pull.
**Found, not changed:** that line is the same kind of false alarm as the notes-only GitHub line was; telling
them apart is a laptop change (which of the pulled updates touch `lib/` or `scripts/`).

**LIVE ON BOTH SITES, seen 12 Nov 18:27 Toronto** (he pulled after 17:18; the laptop runs `f44ab69`, which
holds `6403bde`). The real published pages, nothing put in place: a member on the main site and the test site
has no counts line and no purple, 10 reason sentences for 10 trains, the new line-up note, Jobs going spare as
rows (no table), the card's "Home from Garnet on L50131 12 (ORD 12th 2130), call ~12th 1915"; Snapshots'
older layout as before (its counts and tables). His Page Health on the main site opened at `#pagehealth`:
"All good", GitHub "1 newer update waiting, notes only: nothing to pull for" (the first real notes-only
reading, the old ❓ answered), Alerts "161 sent, 1 failed: 1 with no reason kept". No page errors.

**15:25 Toronto, 12 Nov: NOT PULLED YET.** The laptop is on `290d077` and both sites serve the page from
before `6403bde` (the counts line still on Current): watched read-only from 13:32 to 15:22. So **the look at
both live sites after his pull is still owed** (a member on each site: the pieces on, no counts line, no
purple, Snapshots as before; him on the main site: Page Health the new way, the two addresses). The other
session's notes (`69501ed`, the whole-site layout review at the top of this file, idle and waiting on his
picks, nothing built) went on top of `f35ae76` at 14:00, so his `git log --oneline -1` after the pull starts
with whatever is newest then, not `f35ae76` as he was first told: told him. **If that session is told to
build, it changes the same page as this review: one at a time** (told him). Seen live while waiting: the test
site's Page Health reads "1 thing needs you: GitHub: 3 newer updates waiting (1 of them changes the checker
or the site): git pull, then restart" (the laptop's second count at work on a real mix of notes and code);
the main site, still on the old page, "3 newer updates waiting: git pull, then restart". A check failed at
14:46 ("CATS did not answer within a minute") and the next ones went through by themselves.

**Page Health seen live on the test site after his pull and restart (12 Nov 11:50, laptop on `290d077`,
running since the 11:46 check).** Opened cold at `#pagehealth`. "1 thing needs you: 1 sign-up is waiting for
your approval, since Nov 12, 08:40: Members tab." with the button (by 13:15 it read "All good": approved).
Alerts today "108 sent, 1 failed: 1 with no reason kept", not marked (the 02:55 one, from before the reason
was kept). GitHub "Not checked yet", then `behind 0, behindCode 0` from 11:55: **the second git question
answers on the Windows laptop** (the old ❓). The rep-email form, the old CATS pages and Visitors' zero days
folded; 2,973 px from 3,944. The main site at the same minute still read the old way ("1 thing needs you:
Alerts today: 108 sent, 1 failed (last failed 02:55 …)"), and members on both sites had none of the Current
pieces. **Still not seen:** a notes-only update waiting (this push is the first chance: after it the row
should read "N newer updates waiting, notes only" only if nothing but notes waits), and a failed send
written by the new code.

**The purple "usually +1.3 h" tag: his question, 12 Nov 11:45, "What does the tag tell exactly, is it +1,3 h
from the time shwoing or just in general". NOTHING BUILT.** In general: it is that train number's habit,
`drift` in `lib/board/patterns.js`: over its runs in the last four weeks (8 or more), the middle figure of
**on duty minus the first time the line-up showed for it** (`onDuty − firstPlan`). It is not worked from the
time showing now. Three things found while answering, put to him:
1. **It does not know the train has already moved.** At 11:46 that day: M38261 12 first showed 1500 and was
   showing 1427, tag "usually +1.3 h" (the habit points to on duty about 1615, not 1427 + 1.3 h; by 13:13
   the line-up had it at 1622). E27861 12 first showed 1310 and was showing 1910, already six hours later,
   and still carried "usually +5.3 h". Only a train that has not moved (L50231 13 at 0400, Z14891 12 at 0545)
   reads right against the time showing.
2. **It is 15 minutes short against the big time.** The figure runs to on duty, which is 15 minutes before
   the line-up time, so a train that goes dead on its first plan scores −15 (A424's middle figure) and M382's
   75 minutes is 1 h 30 on the line-up's own clock.
3. **"1.3 h" is 1 h 15 m written as a decimal**, and reads like 1 h 30.
Offered him: take the tag off with the rest of the purple; or have it give a time on the line-up's clock
("usually goes ~1630": first plan plus the habit) and drop it once the train has moved that far; or leave it.

## Call stability: the plain call card — ON FOR EVERY MEMBER in the code since November 12, 2026, at his word; "expected" is his pick ("Proposed"). WAITING ON ONE LAPTOP PULL + RESTART (no Worker paste)

**His pick is made (06:40 Toronto): "Proposed".** Asked "As now or Proposed" a second time, with his own
EN09 call laid out both ways, he answered **"Proposed"**. `callRule()` in board.html now returns
`{ rule: 'before' }` for everyone: "expected" is what the board was showing 8 hours before the call
came; for a turn lined up later than that, what it showed when lined up. The pick box
(`ana2RuleSwitch`), its styles, its click handler and the `boardCallRule` device setting are gone;
the plain note and "How to read a call" say the new rule. `callCard` in board-analytics.js still
has both rules (`opts.rule`; `'eight'` is its default and what its own tests mostly use): the page
never asks for `'eight'` any more, so that branch can be deleted in a tidy-up. A turn taken off
has no call to count back from and keeps the eight-hour figure. "More numbers" still holds the
older figures. Live figures under it: Sarnia 22% when expected / 28% over an hour earlier, Mac
yard 63% / 9%. Checked with this branch's files on the real sites: six real calls on the main
site as a member (EN09 "11 h 05 m earlier", SR02 "1 h 47 m later", SB05 "9 h 45 m earlier"),
every place on the test site with the owner key in dark, the main site at 1280 px: no page
errors, no sideways scroll, no pick box. Suite 462 of 462. **Everything in the "STILL HIS TO PICK"
section further down is history now.** At that moment neither site had the earlier commits
either (he said "it's pulled"; both still served the page from before `7edd4aa` and the 16
records): the checker may not have been restarted. Ask him to restart, then check again.

**Later the same morning (06:32 Toronto): the tracker fix for the wrongly matched calls is in, at his word.**
Asked what items 2 and 3 on the waiting list meant, he was told (2 = As now or Proposed, 3 =
whether to fix the tracker for the 15 calls) and answered **"3"**: read as yes to 3. If he meant
something else, `git revert` the commit named "Tracker: a trip is never scored against a wait first
seen after it went on duty". `lib/board/insights.js`, `sleepCheck`: when the turn was already on
duty before the open wait was first seen, that on-duty is not the call for it. A different train:
skipped, and the wait for the next trip stays open (it used to be closed and lost). The same train
(a gap in the checks): no record, the wait closed. `finish` also leaves such records out of what
the site publishes, so the ones already saved go at the next check. On that morning's live file it
leaves out 16 of 1,336 records (one more had happened overnight: EN04 on DHT056B 12), none of them
a taken-off record; "over 1 hour early" against the first time shown goes from 268 to 253. The
card's "Not scored" group will read empty except for older archive months. **This one changes
counts on both sites (Call stability's older figures, My stats) and needs the laptop's pull +
restart like the rest.** `test/board/call-wrong-trip.test.js` (4). Suite 463 of 463. Not checked:
a real run of the checker on the laptop; the rule was run on the live file, not on the saved checks.

**Owner, 12 Nov, after the card had been on the test site as a preview for an hour (the laptop had
already pulled it): "Push these changes to the main. Update the handoff and any house keeping
items".** "The main" is the main site, as with My stats ("push it to the main page"); the git
branch named `main` is from 17 October and was not touched.

**What changed for that.** One switch in `public/board.html`, in the manner of `MINE_ALL` /
`MINE_MORE`: **`const CALL_CARD = true;`** with `callCardOn() = CALL_CARD || PREVIEW`, which now
stands where the preview test stood in every call-card branch. `true` = every member on both
sites; `false` = exactly the state before (the card for the owner on the test site only, the old
graph everywhere else): one word's way back. A test (`call-card-page.test.js`, the first one) holds
the switch and quotes him: turning it off is his to say. Nothing else moved: the card, its words
and its counts are as he saw them on the test site.

**What a member sees after the laptop's next pull + restart.** Every place a call was drawn shows
one card (`BoardAnalytics.renderCallCard`): a headline, **Expected / Called / Warning / Why**, a
small picture with its words on it (Lined up, Expected, Called; no key), and two fold-outs ("Every
change the board showed (n)", "i · How this is worked out"). Places: Analytics → Call stability
(the rows, the Sarnia / Mac yard cards, "Calls by how far off", By turn, "How to read a call"
behind an "i"), a turn or name-code search, My week, Turn History (each trip's line and the opened
trip), Order summary's "The crew's call".
- Under 8 hours' warning is always the headline ("Called with 48 min warning"), on-time and late
  calls too. Within 30 minutes reads "Called when expected", with "after 3 changes" when the time
  moved by more than 30 minutes in between. The Warning line ends with what the board was saying
  ("the board still showed 11th 1655 when the call came" / "the time last changed 10 min before
  the call").
- "Taken off before the call", the reason first; on a line-up under 30 minutes and taken off again
  folds away under the list ("29 short waits not listed").
- Why is one or two plain sentences on 784 of the 914 calls that have one, built only from what the
  tracker saved; every saved reason is in the first fold-out.
- **"Expected" for members is the eight-hour figure the site already keeps** (`z.expected` at
  `z.sleepAt`), the first time shown beside it when they differ; a call with no such figure falls
  back to the first time shown. `callRule()` returns `'eight'` for everyone off the test site,
  whatever a device has stored.
- "More numbers" on the Call stability page still holds the older figures in the older words (the
  recorded eight-hour baselines, the first time shown, changes during the plan), folded.

**I took "Push these changes" as yes to three things the card does that I had said needed his
yes**, because they are part of the card as he saw it; said so to him, and each is undone
separately if he says no:
1. **15 calls are "Not scored"**: the board first showed the turn lined up only after it had already
   gone on duty. 13 are a later trip's line-up matched to a trip already under way (SD09 on M39671
   23: on duty 25 Oct 0400, first seen lined up 1134 for X27331 26) and used to read as 10 to 23
   hours early: about one in eight of the "over 1 hour early" calls.
2. **24 calls are "Called with no warning"** with no expected time and no picture: the first
   line-up seen was after the call time (SR09 on X39661 23). They are a sixth line on the cards
   ("No warning: nothing on the board first"), not in the five groups.
3. Words in the graph's purple ("later") lean toward the page's ink so they can be read (2.6 to 1
   before; 3 to 1 or better in every page style now). The band on the picture is unchanged.

**(History: picked later that morning, see the top.) How "expected" was worked out while it was his to pick.** The eight-hour figure, as it has always been
worked out, is the first time the board showed the call 8 hours or less away, *whenever that check
came*: only 660 of the 1,065 recorded figures were really 7.5 hours or more ahead; 252 appeared
later on a turn already lined up; 31 were set by a check **after** the call. Members now see these
as today's rule reads them:
- **EN09 on YMXS02, 8 Nov** (his 10 Nov example): lined up 1412 for 0205 next morning; the board
  flipped to 1500 at 1421; called 1500. Reads: expected 1500, "right on time" (the headline is
  still "Called with 48 min warning").
- **SR02 on X39291 05, 7 Nov**: a 0241 that was on the board for 23 minutes the evening before became
  the figure; the board had said 1523 for eight hours when the call came at 1710. Reads: "14 h 29 m
  later than expected".
- **SB05 on X30241 17, 19 Oct**: 20th 1055 / 0845 on the board until the call at 19th 2300; the check
  ten minutes after the call showed 2300, and that became the figure. Reads: "Called when
  expected", with "on the board only from 19th 2310, after the call" under it.

A proposed rule is built beside it (`opts.rule: 'before'` in `callCard`: what the board showed 8
hours before the call came; lined up later than that, the time it showed when lined up). **Only the
owner sees it, only on the test site**: a dashed box "For you to pick" at the top of its Call
stability page and above any turn's calls, two buttons **As now** / **Proposed**, with those three
turns to tap; kept on that device as `boardCallRule`. Under Proposed the three read "11 h 05 m
earlier", "1 h 47 m later" and "9 h 45 m earlier"; 265 of 1,060 calls land in a different group;
Sarnia goes from 25% when expected / 11% over an hour earlier / 40% over an hour later to 22% / 28%
/ 29%, Mac yard from 55% / 5% / 29% to 63% / 10% / 16%. **When he picks:** Proposed → make
`callRule()` return `{ rule: 'before' }` for everyone; either way then delete the other branch of
`callCard`, `callRule`'s device read, `ana2RuleSwitch` and its CSS, and the rule tests that no
longer apply. My recommendation to him was Proposed.

**Not changed, his to say (all on the Housekeeping list in `docs/board-checker/TODO.md`, items 8
to 10):** the tracker bug behind the 15 (`lib/board/insights.js` scores a wait opened after the
on-duty time against it; the fix changes today's counts and needs a laptop pull); a call 31 to 60
minutes early being amber on its row and red on the picture; the old graph code
(`renderCallTimelineV2`, `callReasons`, `renderCallReasons`, `ana2Examples`, the `!callCardOn()`
branches), kept as the way back and to be deleted once he has lived with the card; his three "what
bothers me" lines from the first message, which arrived as "...".

**Checked on real data, 06:15 to 06:28 Toronto, with the card switched on** (this branch's page
files put in place in the browser here only, `boardNoCount` set, nothing pressed in Members):
- **The real main site as a member (no owner key):** the Call stability page whole; ten real calls
  opened in dark at 390 px and measured (no label on another, none cut off, nothing wider than its
  card); Turn History in its regular table layout with SR11 and S501-CO, Order summary's crew call,
  My week with a followed turn, a by-how-far group, the two new groups, How to read, the short
  waits, More numbers, By turn's "Show all", a turn search; 390 px and 1280 px; 21 page styles
  between two passes with every kind of text measured (lowest 3 to 1, the purple headline in the
  Game Boy style). No page errors, no sideways scroll, no old graph left, **no pick box**.
- **The test site with the owner key:** the same places, the pick box there and working both ways.
  **The test site without the key:** the card, no pick box.
- Earlier the same morning, as a preview: the card run over all 1,323 live call records in code
  (no errors, no broken text); 16 real calls at 390 px, light and dark; a name-code search (his own
  code, counts only); all 22 page styles.
- Suite 459 of 459 (with the other session's new test from the same morning).
**Not checked:** a real phone (a browser at phone width only); the `k-` page styles; a person
followed by name code in My week; either site after the laptop's next pull (the card is not on the
main site until then).

**Where it is.** `claude/vigilant-planck-zawrj4` (the branch the laptop pulls) and this session's
`ccr-83c63a33-26zny2`, same commit. The preview commits were `bbff903` and `b5a6116` (05:50); the
laptop had pulled those by 06:15 (both sites served the gated code, the preview live on the test
site). The switch-on commit is `7edd4aa`, pushed 06:28; it sits on top of another session's two
Members commits from the same morning (`e2d5475`, `7596f40`: phones with no account), replayed onto
them with no conflict. **Neither site has the card for members until the laptop pulls `7edd4aa`.**

**Files.** `public/board-analytics.js` (after `renderCallTimeline`: `callCard`, `callWords`,
`callLastWord`, `callWhy`, `callStory`, `callPicture`, `renderCallCard`, `callSummary`,
`callSummaryByTurn`); `public/board.html` (`CALL_CARD`, `callCardOn`, `callRule`, `callOpen`,
`callRowWords`, `SLEEP_NOTE_PLAIN`, the `.callcard` / `.cc-*` / `.cs2-turn*` / `.cs2-rule*` styles,
and a card branch in `anaHome`, `anaMyWeek2`, `callReviewRecord`, `showCallReview`, `sleepTable`,
`anaSleepAll`, the Order summary fold, the two `work-call-*` handlers, `ana2OriginStats`,
`ana2OriginCard`, `ana2CallPage`, `ana2CallRows`, `ana2CallList`, `ana2SearchCalls`; new
`ana2RuleSwitch`, `ana2ReadCall`); `test/board/call-card.test.js` (16) and
`test/board/call-card-page.test.js` (10: the page's own functions as a member, as the owner on the
test site, and with the switch off). `lib/` is untouched. The findings page from step 2:
https://claude.ai/artifact/CqaYd9Yg8zRaa8QdKgJp2c.

**Waiting on Justin:** (1) one laptop `git pull` + **restart**, so both sites have the card, the
picked rule and the tracker fix (no Worker paste); (2) a no to any of the three things above, if he
has one. (His three "what bothers me" lines from the first message, which arrived as "...": asked
what they were, he said "Ignore that". Closed, do not ask again.)

**Also seen at about 06:25 while here (counts only):** both sites serve the My stats review
(`MINE_MORE = true` in the page, `data/pools.json` published): that pull is done. **Neither Worker
has the unconfirmed sign-ups paste yet** (`/health/accounts` has no `unverified` list on either):
still waiting on him, copy page https://claude.ai/artifact/Ko95qHHnGfvW9r1m7suiNu. 34 members.

## My stats reviewed — November 12, 2026, 00:05 Toronto. The laptop has pulled it (seen about 06:25 on 12 Nov, both sites). The new sections are ON FOR EVERY MEMBER since 00:10 at his word

**12 Nov, about 06:25 Toronto:** both sites serve this work (`const MINE_MORE = true;` in the page, `data/pools.json`
published, 3.9 kB). Not opened as a signed-in member since the pull: the page was checked before it, on a
copy with real records. Nothing below is waiting on a pull any more; the Worker needed no paste for it.

**00:10, owner, after the report and the preview, asked "Show the new sections to every member?":
"Push it".** `MINE_MORE = true` in `public/board.html` (every signed-in member, both sites; `false` =
the test site with the owner key only). A test in `mystats-review.test.js` holds both switches and
quotes him: changing either is his to say. Checked again with the switch in its real state on the
local copy, as an ordinary member: 18 sections, 11 drawings, the spreadsheet button, eight page
styles clean. Suite 432 of 432. **Not answered by "Push it", still open:** whether the reset
tracker and Turn History should take the same corrections.

**Owner (max effort, five steps):** "Check the numbers ... work every figure on the page out
again from the saved checks ... Fix what you find. Each fix gets a test ... Look at it the way a
member does ... in light, dark and at least two of the other page styles ... Check the Members tab
buttons ... Add what would make the page more useful. Build the ones that need no more history ...
A comparison with other people must never show another person's own numbers ... Make the data more
visual ... **Do not switch anything on or off for members without asking me.**"

**State.** On `claude/vigilant-planck-zawrj4`. Suite **431 of 431** (34 new: `test/board/mystats-review.test.js`,
one in `resets.test.js`). **No Worker change, so no paste.** Changed: `public/board-mystats.js`
(most of it), `lib/board/mystats.js`, `lib/board/site.js`, `lib/board/resets.js` (`collect` / `merge`
only), **`scripts/board-auto.js` (the checker: one flag)**, `public/board.html` (`MINE_MORE`, `renderMine`).
**All of it waits on one laptop `git pull` + restart.** Pull **before 23 November**: until then the site
still holds every day since the names began (24 Oct), so every record is rebuilt in full; after that
the oldest days are kept as they were first built (`my-stats.json`).

**What was wrong (each has a test).** Checked by rebuilding all 168 people's records and setting
them beside the names the checker read off the Call Board (the reset tracker's by-name trips) and
the raw snapshots. Trip list or hours changed for **143 of 168 people**; trips 1,023 → 1,286.
1. **Yard shifts counted once a job, not once a day** (a turn's history keeps one line per train
   *name*; a yard job's name is the same every day). Yard shifts 151 → 537. DYRI 2 → 8.
2. **Since 3 Nov the crews in town list every yard job's own people, and anyone TEMP on it, all
   day every day**: whose job it is, not who came in. A job's own crew had no shifts at all; a
   TEMP person had one every day the job ran. Now a yard shift counts by name only while the job
   is on the Call Board, or when the job's own crew lines show their turn; the other days are
   **"not recorded"** (`unk` on the record: 45 people, 329 days) and are left out of every count
   of days, with a notice at the top of their page. **The checker change below ends this from the
   pull on.**
3. **A trainee's slot gave the turn's holder the trainee's train, and gave the trainee every train
   of the turn** ("EN S304 · ET S303 · CO SB04"). ADAH 8 → 2 trips; JOHE 12 → 10.
4. **Make-up turns (MU01…) are placeholders**: three people at once got every train one worked. MIDE, NICI.
5. **A train kept on a turn's record as "working SA05 (CO)"** (a stale spare-to-turn match) went
   to the turn's holder. BUSM lost two trains he was never on (one overlapped one he worked).
6. **Called, then replaced before on duty, counted as worked.** BRCU E27861 09, SOJA L50231 06,
   GAMA M39671 04, MASM / TRHO Q13931 08.
7. **A train renumbered while the crew was on it counted two or three times.** NIKE, COBD, BRCU, NICI.
8. **88 pairs of overlapping trips** (someone on two trains at once) → 0.
9. **A trip on someone's first day went to nobody; one first seen on their last day went to them.**
10. **"Most on duty in any 7 days" was wrong for three of the 14 checked, each falsely over the
    60 h limit**: BUSM 68 h 03 → 42 h 48, ADAH 60 h 46 → 19 h 22, JOHE 60 h 51 → 44 h 53.
11. **Board places**: nobody on 501/502 had any (their lines read "position 001 (CO):"); a move
    between boards was measured as one climb; a climb started from the call's own "out working".
12. **Resets**: one shown from time off nobody saw (start of the checks); the next-reset date
    ignored a call already in hand; none can be told around the unrecorded yard days.
13. **A yard shift was given the previous day's call**; time off after an assumed 8 / 12 h yard
    shift was flagged "under 12 h" as if read (now marked ~ and drawn as a ring).
14. **Would have begun 23 Nov**: a trip from the evening before the first day the site keeps was
    in both the kept record and the build, so it would have counted twice (`merge`).
15. **Page styles** (measured in all 68, photographed in light, dark, retro, mario and others):
    the heading, note and footnote sat on the page backdrop and could not be read in 7 styles
    (now on the sheet); the calendar's day numbers fell to 2:1 in white-on-dark styles; the pale
    fill is `transparent` in retro and tablet (the "At home" bar and every shaded strip vanished);
    accent = amber in 8 styles (going out and coming home looked the same: now solid / striped /
    hollow); big figures wrapped in the pixel-font styles (now shrunk to fit); the place-on-board
    labels piled up; wide tables gave no sign they scroll sideways.
**JUOD himself:** 12 trips, 90 h 37, 12 of 19 days, 6 round trips, calls, resets (26 Oct 0559,
3 Nov 0755, 7 Nov 0559), due 15th 0449: all unchanged and right. Changed: place on the board
"3 times measured" (was 4: one mixed two boards), 7 h 09 a place (was 8 h 19), 42 h 52 home to the
next call (was 45 h 08); his 501/502 places are now read.

**New on the tab, `MINE_MORE` (true since 00:10 on the 12th; false = test site + owner key only;
the corrected numbers are for everyone either way):** the days hour by hour (duty, held away, booked rest, the call, resets);
hours in the 7 days ending each day beside the 60 h line; each round trip as a bar; each call
against the one slept on, and each train against its first plan; place on the board over time;
when each turn goes on duty; **"Duty and rest beside the rules"** (longest duty, shortest time off
at home / away, called under 8 h after going off, on duty before the booked rest was up, most in
any 7 and 28 days, held 14 h or more, a dot for each time off); the reset clock; **"You and your
pool"**; jobs filled in on; **every trip as a log, and as a spreadsheet** (on a phone it goes
through the share sheet, `navigator.share`, because a plain download from the home-screen app can
strand an iPhone on a preview; elsewhere it downloads `my-trips-<date>.csv`).
**Colours:** the tab now makes its own pale fill from each style's ink and sheet (`--ms-pale`),
uses outlines instead of shadows, and keeps every mixed colour inside an `@supports` block with a
plain fallback before it (iOS 15 and older have no `color-mix`). A test reads every page style's
colours out of `board.html` and holds the calendar's day numbers at 3:1 or better in each, so a
new style that breaks it fails the suite.
**The pool comparison:** `data/pools.json` (written by the site build, `lib/board/mystats.js pools`):
per pool an average and a band, nothing else: no hashes, no turns, no lists. At least 5 people or
not given; each end of the band is the midpoint between two neighbouring people's figures, so no
number published is one person's own; rates to 0.1, times to 5 minutes. A pool too small to give
(501/502 is four people at most) is set beside "every road pool together", and that only when the
people outside the given pools number none or five or more. The member's own figure is worked out
on their own phone from their own record. On the 11th's data: SR 8, B 13, SA 9, SD 8, S1 9 people.

**The checker change (for the board / checker session).** `scripts/board-auto.js`: a name on a yard
job's own crew lines is now sighted with `duty: true`, and the summary says `yardDuty: 1`.
`lib/board/resets.js collect`: on a check that says so, a yard shift is counted for exactly those
names (marked `sure`), own crew included; `acc.yardFrom` = the first such check. Older checks read
as before. **So from the pull on the reset tracker stops counting someone listed TEMP on a yard
job as working it every day**, and counts a yard job's own crew when they are on its lines (a
regular yard job's holder is still left off the reset board). **Could not be run against real CATS
from here**: after the pull, look at one day file's `resets.trips` for a `sure` yard trip and at a
yard holder's My stats.

**Found, NOT changed (they are the board's, ask Justin):**
- **The reset tracker (`resets.js work`) counts as duty**: a call replaced before on duty; a stale
  spare-to-turn match; a new holder's predecessor's inbound trip (SHLE DH27331 06); every train of
  the turn a trainee is on. So the board's reset colours can differ from My stats, which now works
  its resets out from its own trips (BRCU: needed by 14th 0129 on the board, 17th 1459 by his trips).
- **Turn History** shows a yard job once however many days it was worked, and has items 3, 4 and 5
  above (`personHistory` in `board.html`; My stats' strict rules are a switch on the shared copy).
- **Name-code hashes can be worked back** (about 600,000 possible codes): the existing person-search
  gap, not a new one.

**Checked:** every count on the page against a minute-by-minute recount for all 168 people (0
differences); trips against the by-name sightings; 14 people in detail (JUOD, DYRI, BRCU, JAGR,
MIDE, SCME, ADAH, CHST, MASM, COBD, NIKE, NICI, BUSM, JOHE); every person's page drawn with no
error; the real `board.html` and the real Worker code on a local copy with the live data, as a
signed-in **ordinary member**, 390 px: all 68 page styles measured (no sideways scroll, nothing
past the edge, no cut text, no drawing label outside or on another, text contrast), seven kinds
of member; **the Members tab's "XXXX is theirs" / "Not theirs" worked end to end** (waits → theirs
→ stats show; not theirs → shut; changing the code asks again; a member cannot confirm their own).
**Not checked:** the checker change against CATS; the live sites and the laptop's own build (only a
local copy); a real phone (the spreadsheet's share sheet was only stood in for; an old iPhone's
fallback colours were not seen); yard holders' shifts from 3 Nov until the pull (not in the
checks at all); who worked what before 24 Oct (no names); off duty times marked ~. In the 12
pixel-lettering styles the section headings are 8 px, as on every other tab (each style's own rule).

**Seen on the live sites at 00:04 on the 12th (owner key, counts only):** neither site has this
commit yet (no `MINE_MORE` in the page, no `data/pools.json`); both have the laptop's pull of
`e662679`. **Neither Worker has the unconfirmed sign-ups paste** (`/health/accounts` has no
`unverified` list), so the copy page at `881e02d` is still waiting to be pasted into both. 34
approved members, none waiting for a name code OK.

**Private preview for him** (his own record with the new sections on, built by this code from the
checks up to 11 Nov 2222; the spreadsheet button is hidden there, a preview cannot hand over a
file): https://claude.ai/artifact/7pnMxDbxvYb2M9A4hr5dv5 (the same link as before, updated 12 Nov).
His own pool comparison there still says "not enough yet" (9 days on 501/502 on the 11th); from the
10th day it is set beside every road pool together.

**❓ For Justin:** (1) the pull (it now carries the new sections to every member); (2) ~~show the
new sections to every member?~~ answered 00:10: "Push it"; (3) should the reset tracker and Turn
History take the same corrections; (4) still open from before: a notice to members, Admins
confirming codes, the person search; the Worker paste of `881e02d` into both Workers.

## Test alert route on the Worker — November 11, 2026, 22:50 Toronto. ON `claude/vigilant-planck-zawrj4` SINCE 12 Nov EVENING (cherry-picked as `e439cbc`, by the Members session); PASTED INTO BOTH 12 Nov about 19:50 (the route answers; no test alert sent)

Owner asked to send a test notification to SD02 from a cloud session; that could only be
done on the laptop (`node scripts/alert-check.js SD02`; the push key and the phone list are
there). He then said: "add the send test alert route to the Worker". **Worker:**
`POST /health/test-alert { to, all?, dry? }` (`testAlert`), owner only (404 otherwise, like
`/health`): the same message and the same rule as `scripts/alert-check.js` ("Test: SD02" to
the phones following a turn or a name code; phones that also follow `OWNER_CODE` / JUOD are
skipped unless `all`; `dry` only counts), sent with the Worker's own `pushAll` (which gained
a `dry` option), so it needs the `VAPID_KEYS` secret on that Worker (503 with the reason
when it is missing). Answers `{ following, skipped, sent, failed, dropped }`. Steps in
[CLOUDFLARE.md](docs/board-checker/CLOUDFLARE.md) "Test alert from the Worker". Suite
**398 of 398** (a new test in r2.test.js: owner only, dry run, the owner's phone skipped,
`all`, a craft follow, a name code, no key).
- **This session was given the branch `ccr-1807ddfe-7kgr2g`**, restarted from
  `claude/vigilant-planck-zawrj4` at `46918bd`; the change is one commit on top and is
  **not on `claude/vigilant-planck-zawrj4`** (another session was pushing there at the same
  time). **Merge it there before the next Worker change, or the next copy page loses the
  route.**
- **The copy page is rebuilt for `e3e7936`** (https://claude.ai/artifact/Ko95qHHnGfvW9r1m7suiNu,
  version and 2046 lines on the page; checked in a browser that it gives back exactly the
  file). It is `881e02d`'s Worker plus this route, so one paste covers the unconfirmed
  sign-ups and the sign-up wording too. **A session that rebuilds the copy page from a branch
  without `e3e7936` takes the route out again.**
- **No page change:** there is no button; the route is for a session holding the owner key
  (this environment's proxy adds it for `board` and `board-test`) or `curl`.
- **Not sent, not seen on the real sites:** no test alert has gone to SD02 (one phone was
  following it at 22:30). After the paste: `{ "to": "SD02", "dry": true }` first, then
  without `dry`, at Justin's word.

## Unconfirmed sign-ups on the Members tab — November 11, 2026, 22:10 Toronto. WORKER PASTED INTO BOTH 12 Nov about 19:50; `unverified` seen on both (3)

Owner (someone was sent the email code but never showed for approval): "add the section for
people who haven't confirmed their email". **Worker:** `GET /health/accounts` also returns
`unverified` (sign-ups that have not entered their emailed code, newest first; in a list
of their own so a page that only knows `users` is unchanged; still cleared after two
days), and `approve` now works on one of them: PIN and hire date deleted, status approved,
their code record deleted, and an email telling them to use **Sign in** (their device has
no sign-in yet, so they still need a code by email: a mistyped address cannot get in).
`delete` already worked. **Page (`renderMembers`):** "Started signing up, email not
confirmed (N)" under Waiting for approval, each with Email, PIN, Hire date, Started,
**Approve anyway** (asks first) and **Delete**. Shown only when the Worker sends the list.
Suite 397 of 397 (a new test in accounts.test.js). **The copy page is rebuilt (version on
the page).** Not seen on the real site; the Members tab section not opened in a browser.

## Sign-up page wording — November 11, 2026, 21:00 Toronto. PASTED INTO BOTH WORKERS 12 Nov about 19:50; seen on both `/account` pages

Owner: "Can you make the instructions at the sign up site clearer. A lot of people are not
understanding they need to verify with a code from their email." In the Worker's
`ACCOUNT_PAGE` only (no logic changed): the sign-up form opens with the three steps (form,
**the 6-digit code from the email**, approval); its button reads "Next: email me my code";
the code screen is headed "Step 2 of 3: enter the code from your email", says "You are not
signed up yet", names the address the code went to, and its button reads "Confirm my
email", with what to do if no email comes; the waiting screen is "Step 3 of 3". Sign-in's
code screen is unchanged apart from the box label. Suite 396 of 396; both screens looked at
in a browser at phone width against a stand-in. **The copy page is rebuilt for this commit
(version on the page); Justin pastes it into both Workers.** Not seen on the real site.

## My stats — ON FOR EVERY MEMBER in the code, November 11, 2026, 20:20 Toronto. WAITING ON ONE LAPTOP PULL

**Owner (after asking what a name code's history could show him): "Very detailed statistics,
trends. Anything you can think of" ... "Make it so this page is only available to the
person who owns the account. They can see theirs and no one else's." Then, shown a preview:
"Yea. Can you push it to the test page". Then: "push it to the main page".**

**Where it is.** On `claude/vigilant-planck-zawrj4`: `13a1b85` is the feature, the commit
after this note's first version set **`MINE_ALL = true`** (the tab for every signed-in
member on both sites) and reworded the name code hint in Settings ("For My stats and your
job posting alerts"). Suite **394 of 394**.
- **Done by Justin, seen from here at 20:15:** the Worker is pasted into **both** Workers
  (the copy page is at `13a1b85`; `GET /auth/stats` answers on `board` and `board-test`) and
  the laptop pulled `13a1b85` (the bucket has `board-mystats.js` and the records).
- **Checked on the real sites at 20:15, with his owner key:** `/auth/stats` gives his own
  record (JUOD, 12 trips, 24 Oct to 11 Nov) on both; the record's file asked for directly is
  a 404; the real board-test page opened at `#mystats` in a browser at phone width draws the
  tab with the same numbers as the preview, no page errors, no sideways scroll.
- **The tab sits beside Turn History, 20:35 (owner: "can you put current, turn history and
  my stats in the same row"):** the button moved to third in the bar; on a phone the first
  row is Current, Turn History and My stats, a third each (`body.has-mine`, set by
  `paintMine`); with no My stats (signed out) Current and Turn History keep half each.
  Checked on the real page file against a stand-in Worker at 390, 340 and 1280 px.
- **Waiting on Justin: one more laptop `git pull` + restart** (a page change only, no paste).
  Until then the published page still has `MINE_ALL = false`: test site, owner key only.
- **Not checked:** the tab as a regular signed-in member sees it on a phone (only the owner
  key could be used from here); the Members tab's "XXXX is theirs" / "Not theirs" buttons on
  the real site. Private preview from before the merge:
  https://claude.ai/artifact/7pnMxDbxvYb2M9A4hr5dv5.
- **What members will meet:** no name code saved → the tab tells them to save it in
  ⚙ Settings → Profile; a code that does not match their sign-up name, or a shared code →
  "waiting to be confirmed", and **it sits there until Justin presses "XXXX is theirs" on
  the Members tab** (nothing alerts him: look down the Members list for "My stats waits for
  your OK"). Not announced to members.

**What it is.**
- **Laptop** (`lib/board/mystats.js`, two small places in `lib/board/site.js`): every site
  build works out each person's record with `BoardMyStats.build` (their trips with off duty,
  how the call moved, plan / order times, who with; rests; resets and the next one due; their
  place on their own board each time it moved; runaround-log entries and stale trains while
  they were on the turn), joins it to what earlier builds kept (**`BoardChecker\my-stats.json`**,
  400 days, so the page reaches back past `BOARD_SITE_DAYS`) and writes
  **`<site>\accounts\stats\<name-code hash>.json`**, one per person (168 files, 0.9 MB on the
  11th's data). Under `accounts/` on purpose: the Worker already never serves that prefix and
  the publish never deletes it, so nothing is exposed whichever of the pull and the paste
  comes first. A record holds nothing that changes every check (days, not minutes, for the
  turns; no "last seen"), so a file only uploads when something happened to that person.
- **Worker** (`myStats`, `codeState`, `codesOfName`, `CODE_GROUPS`): **`GET /auth/stats`**
  gives a signed-in approved member the record for the name code **saved on their own
  account**. Nothing in the request picks whose. Because a member types their own code, it
  only counts once it is known to be theirs: it matches the name they were approved under
  (first two letters of the first name + first two of any later name), **or the owner said
  so on the Members tab** (`codeOk` = the code confirmed; changing the code asks again;
  `codeNo` = "not theirs"). A code in `CODE_GROUPS` (a third copy of the list; a test holds
  it equal to `lib/board/people.js`) always waits for him. Only the owner key confirms, not
  an Admin. `/auth/me` now also says `statsCode` (none / ok / wait / no): that is how the
  page knows the Worker has it. The owner's own devices use the code in `accounts/owner.json`.
- **Page** (`public/board-mystats.js` = the numbers and the drawing, shared with the tests;
  in `board.html`: the `modeMine` button, `renderMine`, `paintMine`, `#mystats`, and on the
  Members tab a "Name code" line per approved member with "XXXX is theirs" / "Not theirs"
  for the ones waiting). **`MINE_ALL = true` since 20:20 on the 11th: every signed-in member,
  both sites.** `false` takes it back to the test site (board-test + owner key) only.
- **On the page:** trips / hours / days worked / calls within 30 min; where the time went
  (on duty, held away, home); the hour of day they go on duty (out / home); days of the week;
  a calendar of hours a day; week by week and month by month; every round trip; how the call
  moved against the one slept on; plan and order times against on duty; call after rest, rest
  booked, place on the board and how fast it moves; resets; turns side by side; who they
  worked with; runaround-log entries and stale trains. Dates: last 30 / 90 days / everything.

**Checked:** the 394 tests (`test/board/mystats.test.js`, two new ones in
`accounts.test.js`: own record only, another member's code waits, a shared code waits, only
the owner confirms, the file is never served, a removed member gets nothing). The real
`board.html` in a browser against a stand-in for the Worker with his real record: the tab
draws at phone and desktop width, light and dark, no sideways scroll, no page errors, and
each state (no code, waiting, not theirs, nothing kept, old Worker) says the right thing.
`personRecord` is a copy of `personHistory` in `board.html`; a test holds the two equal.
**Limits, told to him:** Turn History's person search still shows anyone's trips to any
member who types their code (he asked for this page to be private, not that one); the data
files it reads (`people.json`, `turns.json`) are still there. A member whose CATS first
name differs from the one they signed up with (Bob / Robert) waits for his OK. Two people
whose names make the same code, not yet in `CODE_GROUPS`, would both pass the name check:
split the code as usual, then it waits for him. Old files stay in the bucket after a person
drops out of the record (the publish never deletes under `accounts/`).

**❓ For Justin:** the pull above; a notice to members about the new tab (not sent); whether Admins should be able to confirm a code; whether the person search in Turn
History should be narrowed now that this page exists.

## Phones with no account, listed on Members — November 12, 2026

**Cut-off built the same day (owner: "7 days from when we locked the site"): from 19:00 Toronto
on 2026-11-17 the laptop sends alerts only to phones with an account** (`Health.membersOnly`,
`NO_ACCOUNT_CUTOFF`; used by `alertPhones()` in scripts/board-auto.js for turn alerts, the weekly
and the held-away alerts). A phone with no account is skipped, not deleted: it works again once
its owner signs in and saves its alerts. **The owner's own phones carry no account (owner key), so
any phone following the owner's name code (`BOARD_OWNER_CODE`, else the first `BOARD_WEEKLY_CODES`,
default JUOD) is kept.** Not covered: the Worker's own "checker is down / back" message still goes
to every phone (needs a Worker change), and `scripts/announce.js` is unchanged. The Members tab
shows the date. To move or drop the date, change `NO_ACCOUNT_CUTOFF` in lib/board/health.js.

Owner wants to message people privately to make an account "before their notifications don't
work anymore". Built **without a Worker change** (he could not paste until later): the laptop's
subscriber report (`Health.subscribersOf`, served to the owner in `/health` as
`laptop.subscribers.noAccount`) now lists each phone with no `account`: its turns, the name
codes it follows (with their current turn) and when it last changed. The Members tab (owner
only) shows it as "Phones with no account". Needs a laptop pull + restart. Checked with
stand-in data in a browser; **not yet seen with real data**. A phone's owner is not known, only
what it follows. Nothing cuts alerts off for phones without an account today; if he wants that,
it is not built. Rough reading on 12 Nov before this: 8 such phones; turns SB02, SD05, SD08, SR03;
codes CHNI, COSM, WADE and one not yet seen (plus his own).

## Two page styles added — November 11, 2026, 23:55 Toronto

Owner: "Can you add an EA Sports and Blades of Steel". Both are in ⚙ Settings → Page style → Games
(now 21): `k-easports` (black and silver scoreboard, red accent) and `k-blades` (ice white, navy,
red and blue lines, blocky lettering). CSS only, beside the other `k-` styles in public/board.html;
colours and lettering only, no logos. Checked at phone width on the test site.

## Add to Home Screen — built November 11, 2026, 23:40 Toronto (not gated; live on both sites once the laptop pulls)

Owner asked for an install feature. The manifest, icons, head tags and a push-only service
worker were already there; this filled the gaps. **No Worker paste needed** (it already serves
`/manifest.webmanifest`, `/sw.js` and the icons openly, with the right type).
- `public/board.webmanifest`: "Sarnia Board" / "Board", start and scope `/`, dark `#12191b`, 192 + 512 icons and a separate maskable 512.
- Icons redrawn by `scripts/make-icons.js`: dark tile, white "SB", teal rail (was "240" on teal). The iPhone icon stays `board-icon-180.png` (an `/apple-touch-icon.png` path would need a Worker change).
- `public/board-sw.js` (published as `/sw.js`): now also registered on page load, and has a fetch handler for page loads of `/`, `/index.html`, `/board.html` only: network first, last good copy kept in cache `board-shell-1` for when the network fails. `data/`, `api/`, `auth/` and everything else are never touched or saved.
- `public/board.html`: `#a2hsset` in ⚙ Settings, one-time banner `#a2hsnote` (dismissal in `localStorage.a2hsDismissed`), iPhone steps `#a2hsios`; Android uses `beforeinstallprompt`. All hidden when opened from the icon. `black-translucent` status bar, with `body` padded by the top safe area and a dark strip behind the clock in standalone mode.
- Checked in a browser: iPhone banner → steps, second visit no banner, standalone hides both, Android prompt called, offline reload shows the saved page (tested against a local copy; Playwright routing gets in the way of a service worker offline test on the real site). **Not yet tried on a real phone** — the owner has a test list.
- A phone that already had the old icon keeps the old icon and name until it is removed and added again.
- **13 Nov 01:23, his Android phone:** a silent Chrome notification each time he opens the board: "Line-up · Tap to
  copy the URL for this app · Share · Open in Chrome browser". That is Chrome's own notice for a site kept as an
  old-style home-screen shortcut opened full screen (no address bar); a full install (WebAPK) does not show it.
  "Line-up" is not the manifest's name ("Board" / "Sarnia Board"), so his icon is an old shortcut. Checked read
  only: on both sites Chromium finds no installability errors, the manifest parses, `sw.js` is active, and the
  manifest, icons and `sw.js` are served before the sign-in check (`OPEN_FILES`). Told him: remove the "Line-up"
  icon, then ⚙ Settings → Add to Home Screen (or Chrome ⋮ → Install app); if the notice still comes, long-press
  it to turn it off. Nothing changed. Not seen: whether his reinstall gives the full app.

## Split name codes review — done November 11, 2026, 21:35 Toronto (waiting on Justin)

Booked review ran against live `data/people.json` (laptop on `def1438`). Clean: COBD, BRWA,
BRW1, BRW2, JAM1, MAD1, MAR1, MAR2. Asked Justin about five things, build nothing until he
answers (needs rules by turn **with a date range**; `retie` is turn-only):
1. COBR owns SR01 and SB03 at once 24–25 Oct. **Answered 21:55: the second COBR "was sr01 before the change". Built: `DATED` in lib/board/people.js (code, turn, until/since) → `splits.dated`, `retie(…, taken)`; SR01 before 2026-10-25 1216 goes to COBD. Needs a laptop pull + restart; then check COBD shows SR01 24–25 Oct and COBR only SB03. Add further hand-placed stretches to `DATED`.**
**22:15: owner sent the 25 Oct change of card sheet (before/after only). It confirmed 1, and settled: MARI's YBHS01 shifts 24–25 Oct → MAR1, MARO's YSBY04 shifts 24–25 Oct → MAR2 (both now in `DATED`, pushed, need pull + restart). Still asked: MADE's own YPRS30/YINS30 on 3–4 Nov (looks like MAD1, the trainee, before YMPS31) and whether a third person shares MADE (a yard spare on XSAS05 with the same initials on the sheet); MARO's YSTY01 on 1 Nov (MAR2?); JAMC's four yard shifts 24–25 Oct (both people were spare then). BRWA group needs nothing.**
**22:30: MADE's own YPRS30 / YINS30 on 3–4 Nov → MAD1 (the trainee; in `DATED`, pushed). Yard on-duty sightings never saved a craft, so MADE's older yard shifts (24–28 Oct) cannot be split by TT; left on MADE unless he says.**
**22:40: MARO's YSTY01 on 1 Nov → MAR2 (owner: yes; in `DATED`, pushed). No third person on MADE (the XSAS05 spare is a different code). Only JAMC's four yard shifts of 24–25 Oct are still open.**
**23:00: JAMC settled by the XSAS01 rotation (Sat/Sun YBHS01, Mon/Tue YPRS02, Wed YPRS30, Thu/Fri off, read from its holders' shifts in people.json): YBHS01 on 24 and 25 Oct → JAM1; YPRS02 and YFXS03 stay on JAMC. Review finished; all moves are in `DATED`, pushed, waiting on a laptop pull + restart, then verify on the live site.**
**23:00 Toronto (21:57 by the site clock): laptop pulled to `2c56e67`; every `DATED` move verified on live `data/people.json`, and the Assigned line is off the Yard jobs box on both sites, 13 tabs, no errors. Review closed. YFLS01 listing only a TT long after its shift: answered 12 Nov, a trainee who forgot to tie up their ticket; the shift is still 8 hours. New Housekeeping item 7 (yard shifts overtime checker), not built.**
2. MADE owns YPRS30 / YINS30 on 3–4 Nov while also owning B111; plus YPRS60, YINS60, YMPS60 shifts 24–28 Oct (MAD1's?).
3. MARO on S502 and YSTY01 at the same time 1 Nov; YSBY04 shifts 24–25 Oct (MAR2's?).
4. MARI on YBHS01 24 and 25 Oct while owning S306 (MAR1's?).
5. JAMC on YBHS01 and YFXS03 at the same time 25 Oct; many YPRS60 / YFLS60 nights (JAM1's or his own spare work?).

## Current handoff — November 11, 2026, 19:40 Toronto (end of a long session)

**Where things stand.** Branch `claude/vigilant-planck-zawrj4` at `c2d4134` plus this note; the
laptop is running `c2d4134` (checked 19:29, newest check 1923); both Workers run `08e6109`
(the last Worker change; the copy page has it). Suite **384 of 384** with `npm ci`. Nothing
is waiting on a pull or a paste. Each item below has its own dated note further down this
file (search for the words in bold); the Housekeeping list in
[TODO](docs/board-checker/TODO.md) has the small open decisions.

**Done this session (10th evening → 11th evening), all at Justin's word:**
- **Yard job names** (whose yard job it is, from the crews in town): live on both sites
  since 19:55 ("Whether to put yard job names on the main site yes").
- **Shared name codes split** (COBR/COBD, BRWA/BRW1/BRW2, JAMC/JAM1, MADE/MAD1, MARI/MAR1,
  MARO/MAR2), the prompt when one is searched, old history re-tied by turn: live.
- **18.6(b) on Page Health:** how many were sent, and who submitted and when: live
  (records start 11 Nov, the day of the paste).
- **Line-up wording:** "(SD04 Name spare)", no "goes": live.
- **Extra yard jobs** (job id `Y?X…`): the crafts option 5 leaves out are predicted and
  alerted: live. **Unfilled regular jobs** (YBHS61, YEBS04): watched only (`vacanciesWatch`).
- **Job postings:** read from CATS's Circular Inquiry hourly; the **Job postings** tab;
  cancelled postings; **alerts by account** (name code + choices on the member's account,
  his who-may-post rules, reminders before the 1200 close); the option in the Track box;
  the name code in ⚙ Settings; the on-page "new" count and line: all live on both sites.
- **Reference is now "Job Aids"**; **Agreements** has the Conductor / Engineer buttons
  and document chips: live on both sites.
- **Calling sequence:** a train called to the wrong pool no longer uses the A/B turn it
  skipped: live.

**Added after the summary above was written, 2026-11-11 20:45:** yard job names went to
both sites (19:55); **the Yard jobs box now shows who is actually working each job**
(owner, with two Call Board photos beside the site: "The call board has the right jobs
but wrong people currently working it listed"; "it is getting the jobs working confused
with how it lists the 'home turn' in option 6"). The site only ever showed a yard job's
worker when the checker could match them to a spareboard turn, so a regular or a relief
crew on the job was missing and the "Assigned" line under it (the crews in town's home
turns) read as the crew. Now `parseYardCrewNames` (screens.js) also gives each person's
name and the job's on-duty time, and carries a job across pages (its line can end one
page and its crew start the next); `recordYardWork` / `workingByJob` (names.js) keep it
in names.json as `@yardwork|<job>|<on duty>` and publish it in the locked crew.json as
`working: { "<job>|<on duty>": [[craft, "Last, F"]] }` (jobs read in the last two checks
only). Page: `yardWorking` (the crew, with the spare's turn where they are one) and
`CREW_WORK`. **The "Assigned" line was taken off this box at 21:00 (owner: "Can remove the
assigned from yard jobs on duty. Just show who's working it now"); `yardAssigned` is gone.
Whose job it is still shows in Days off and in a yard job's Turn History heading.** Members with crew names only; without
them the box is as before. Test in names.test.js (the layout of his photos, made-up
names), suite 385 of 385. **Checked in a browser on the main site with a stand-in crew
per job; NOT yet with the laptop's real read: needs a pull and restart, then compare
with CATS.** ⚠ My first version used the page's `mode` inside a top-level function and
the whole page failed to load ("Couldn't load the snapshots"); the tests did not catch
it, the browser check did, before anything was pushed. **Always load the page in a
browser before pushing a board.html change.**

**Not confirmed on a real device (say so if asked):** a job posting alert or reminder
actually arriving on a phone (only Justin's account, JUOD, has them on); the extra-job
prediction on a real listing; the `vacanciesWatch` record.

**Booked into this session:** tonight **21:30 Toronto, the split name codes review** with
Justin (show each code's turns and dates, he says which stretches move; manual moves need
rules by turn *with a date range*, not built). Other sessions' reminders still standing:
the email limit (13th), the alerts grace period (17th), Render (23rd), the likely-call
test (25th; moved to 24 Nov 08:00 into another session on 13 Nov, see the top of this file). **The S5 swap watch has no one booked and found a swap on the new code on
the 11th: see "S5 swap watch" below; the engine fix is the next real piece of work.**

**Waiting on Justin:** (MAR2 for YSBY02's YA stays: "Yes", 2026-11-11. **No notice to
members about job posting alerts or the changed name codes: "No", 2026-11-11; do not send
one or offer it again.**) Which Agreements documents count as "commonly used" (my pick stands until he says); the
permanent-posting rule ("for now", to review); the order between jobs called at the same
time (a YMX job always takes an S1: answered "Yes" 2026-11-11, as the rule already has it);
"members seen today" on the Members tab (offered).

**Small cleanups left:** the `sample` code in scripts/board-auto.js (keeps a masked copy
of the postings screen when a read gives no jobs) can come out now the read works; clock
times in the job postings notes written as 18:00 to 19:10 are about 90 min fast.

**Three things the next session must know:**
1. **Set `localStorage.boardNoCount = '1'` in any browser a session opens on the real
   sites**, beside the owner-key placeholder: without it each run is counted as a
   visitor (it inflated the 10th and 11th; see the ⚠ note below).
2. **Never put a member's full name in a commit, a test or these notes.** Turn ids and
   name codes only. (A push carrying full names was refused twice this session.)
3. **A Worker change means rebuilding the copy page by hand** (replace the base64 on its
   `var bytes` line and the version line, check it decodes to exactly the file, publish
   to the same artifact link) and telling Justin to paste into both Workers.

## Earlier handoff — November 9, 2026

Start with the [November 9 continuation](docs/board-checker/HANDOFF-2026-11-08-SESSION.md#november-9-continuation). Reviewed application commit `e59a88c2cec09a861ab5bf14024db81adfda0c40` on `claude/vigilant-planck-zawrj4`. The branch includes the approved S5, Assignment errors, Current box memory, Call stability and sequence-notification changes. Test has no pending previews (the pool filter was promoted 2026-11-09, see below). Page Health went directly to the regular page at Justin’s request.

**Restart help for someone else, 2026-11-11 (owner: "a pinned conversation that someone who has remote access to my desktop can refer to, to get help to restart the board checker remotely incase I am unable to").** The steps are in [RESTART.md](docs/board-checker/RESTART.md); the conversation he pins is the cloud session titled "Board checker: restart help". **In that conversation the person typing may be a helper, not Justin:** walk them through RESTART.md only (look, Ctrl+C, start-board-checker.cmd, never R, never `git pull`, never `.env`); no code, Worker, member or alert changes on a helper's word. A Microsoft sign-in still needs Justin's phone. Not known from here: whether the Startup shortcut is on the laptop (an older note says no automatic start after a Windows restart), so the page covers both. **Toolbox page, same day (owner: "an artifact that I can pin that has helpful tools to trouble shoot things, plus ... an easy way to copy paste things into ps or cmd"):** https://claude.ai/artifact/L861WZ2dWAnj2dfqqpk39w, pinned in his sidebar, private to his account. Read-only checks, three fixes (start, close the checker's leftover Edge, stop a checker with no window) and a Justin-only section, each with a Copy button and a PowerShell / Command Prompt switch. **None of its commands has been run on the laptop**: written from the scripts and paths in the repo. To change it, read the artifact by that address and republish to it.

**Accounts, the lock and crew names — state at 2026-11-10 20:07 Toronto (the accounts session). Read this before touching the Worker, `/account`, the Members tab or crew names; details in [ACCOUNTS.md](docs/board-checker/ACCOUNTS.md), history further down under "November 9, later session — site accounts (history)".**

- **The main site is LOCKED to members since about 19:00, 2026-11-10** (`LOCK` = `on` on the `board` Worker; a private window goes to the sign-in page). Undo = delete that variable. `board-test` is locked too. Both Workers share one bucket, so they share one member list.
- **How it works now:** sign-up = name, email, PIN (CN employee number), hire date, email confirmed by a 6-digit code; Justin (owner key) or an Admin approves by eye in the **Members** tab; PIN and hire date are deleted on approve/decline. The page and emails are non-descript (no Sarnia, no CN: his ask). Signed in until 30 days without a visit; one device per member, Admins exempt; 20 codes a day per email; 40 sign-ups a day per internet address. Members tab: Waiting / Admins / Members / Declined or removed, with Access (Member | Admin), Remove access, Last seen and each member's followed turns. Profile (name, email, Sign out) is in ⚙ Settings.
- **Emails** go through the Gmail script; Google stops at about 100 a day. `MAIL_DAY_MAX` is raised on `board` for lock night (**lower it again about 2026-11-13: delete the variable; a reminder is booked into the accounts session**). Past 60% of the day's allowance the "you're approved" notes stop and the rest is kept for codes. Page Health showed 118 devices on 2026-11-10, so email was the tight spot; if codes run out, deleting `LOCK` reopens the site until morning.
- **Worker:** Justin pastes it himself into both Workers from the copy page https://claude.ai/artifact/Ko95qHHnGfvW9r1m7suiNu (rebuilt by hand after each Worker change: `scratchpad/make-copy-page.py` then republish). Last Worker change: `5c0fde0` (pasted). Everything since is laptop/page only.
- **Alerts and accounts:** alerts still reach phones with no account (the laptop sends them; the lock only guards pages). A signed-in member's phone is matched to their account when they open the board (`/push/claim`; it copies the alerts back untouched). **Not built, due after a week's grace (about 2026-11-17, only on Justin's go-ahead; a reminder is booked):** the laptop skipping phones with no approved member and stopping alerts on Remove access. That changes how the checker sends alerts: agree it with the board/checker session. One notice went to all 33 phones with alerts at 18:30 on the 10th (`node scripts/announce.js`, `--dry` to count).
- **Crew names on the board (members only), built 2026-11-10 evening at Justin's word ("build the whole thing"):** shown to any signed-in approved member on a site whose Worker has `CREW_NAMES` = `on`. **On for `board-test` and, since the evening of 2026-11-10, for the main `board` too (Justin confirmed): every approved member now sees crew names.** Delete `CREW_NAMES` on a Worker to take them off that site. Names are "Last, F". Source: the pool and spareboard screens the checker already reads unmasked (who CATS shows on the turn), and the Call Board (who is working it). His rule: while a turn is out working, the person working it; back home, whose turn it is. `<< OPEN TURN >>` reads "open turn". The line-up adds the spare covering a job going spare or an open turn ("EN (SD06 Hamel, C goes spare) · EN03 Sywak, M": his wording, no "spare"/"likely"); a 501/502 turn is named per craft; the Garnet row shows both ("CO … · EN …"). **No names in alerts** (his rule at least until the alerts grace period ends). The crew names passcode must be saved on Page Health (it was, 2026-11-10); Page Health's "Crew names on the board" box says what is missing if they don't show.
- **Files this touched outside the accounts area, in small marked places** (board/checker session, please keep them): `lib/board/screens.js` (`boardPersonName`, `parseBoardCrew`), `lib/board/names.js` (`recordNames` keeps `crafts`; `recordBoardCrew`, `shortName`, `namesByTurn`; `byTurn` skips `@board|` keys), `lib/board/site.js` (writes `data/crew.json`, locked), `lib/board/r2.js` (`accounts/` in `KEEP_PREFIXES`: without it every publish deleted every account), `scripts/board-auto.js` (two lines: `learn()` and where names.json is saved), `scripts/announce.js` (new), and in `board.html`: `CREW` / `crewTag` / `crewBoth` / `crewIn` at `markTurn`, `lineupCrew(t, s)`, one `crewTag` in `poolBody` and the turn panels, `crewBoth` in the two Garnet rows, `loadCrew`, `renderMembers`, Profile and the sign-up banner in the `auth/me` handler, the 401 hop in `getJSON`.
- **Seen by Justin on the real test site:** names show; SA05 → Allen after the pool-screen source; 501/502 names; the covering spare's name. **Pushed but not yet confirmed by him:** open turn wording, the reworded spare line, the Garnet row's names (he pulled and restarted at `4024f2d`). Two of the three confirmed 2026-11-11 (the spare line, names on 501); the open turn wording is item 1 on the **Housekeeping list** in [TODO](docs/board-checker/TODO.md), to check with him later (his ask).
- **Still open:** (1) `isOwner()` trusts the `cf-access-authenticated-user-email` header and any `*.cloudflareaccess.com` token; harmless while `OWNER_EMAIL` is unset (it is unset on `board`), but fix `accessEmail()` or never set that variable with Access off. (2) Hash links (`#…`) are dropped on the way through sign-in. (3) An iPhone home-screen app is a separate "device" from Safari under the one-device rule. (4) RailroadTracker set aside by Justin; if it reads the site's files it stopped at the lock. (5) A removed member who kept the crew names passcode could open a saved copy of the file; changing `BOARD_NAMES_KEY` and the saved passcode ends that. (6) `OWNER_KEY` on `board` is a plain Variable, not a Secret; changing its value signs everyone out. (7) Followed name codes show only as a count on the Members tab.
- **Tests:** `test/board/accounts.test.js` (Worker, 13 tests) and `test/board/names.test.js`. Whole suite 370 of 371 on 2026-11-10 evening; the one failing, `Mac yard: a crew on rest at the call is skipped and keeps its place`, came in with `0c75432` (alerts work), not from the accounts session. **Fixed 2026-11-10 20:15 by the board/checker session (the test still used order − 2 h; it now uses the new rule): 371 of 371.**

**Yard job names: whose job it is — ON BOTH SITES since 2026-11-11 19:55 (owner: "Whether to
put yard job names on the main site yes"; the `PREVIEW` test is out of `yardOwners`; seen on the
main site with the real names file: 10 yard jobs with an "Assigned" line, and a yard job opened
in Turn History has its people in the heading. Page Health's row is still unseen: nobody
follows a yard job). First built for the test site, 2026-11-10 late
evening (owner: "do it ... The on-duty crews isnt necessarily the actual person who owns
that yard turn. those names will be a bit further in the option 6 screen").** Before this a
yard job never had a name anywhere (names came only from pool / spareboard screens and
trains on the Call Board).
- **Laptop:** `parseYardOwners` (lib/board/screens.js) reads each yard job's own people by
  craft from the crews in town at the end of option 6 (unmasked, in memory; a `TEMP` line
  is a fill-in and is left out; an open craft reads "open turn"). `recordYardCrew`
  (lib/board/names.js) keeps them in names.json as `@yard|<job>|<craft>`; `namesByTurn`
  puts them in the locked `data/crew.json` as `<job>-<craft>` (`YEBS30-S1`), 14 days like
  the rest. Two lines in scripts/board-auto.js (`opts.names.yard`, and where names.json is
  saved). **Needs the laptop to pull and restart**; names appear after the next check.
- **Page (public/board.html), behind `PREVIEW`** (`yardOwners`, `yardTag`): Current → Days
  off shows the name beside a yard job's row (job + craft); Current → Yard jobs adds an
  "Assigned: FO … · S1 …" line under the crew on duty; a yard job opened in Turn History
  has its people in the heading. Page Health's "On it now" (owner only, both sites) lists a
  followed yard job's people. To promote: drop the `PREVIEW` test in `yardOwners`.
- **Checked:** test added (names.test.js), suite 372 of 372. On the real test site with
  made-up yard names put into the page at phone width: Days off and Yard jobs show them,
  no page errors, no sideways scroll. **Not checked:** the real crews-in-town screen with
  names (the reader is built from the made-up layout in screens-extra.test.js: surname,
  initials, first name), the Turn History heading, Page Health's row. ❓ Ask him once the
  laptop has pulled: do the names read right, and should relief jobs (`REL#`) or trainees
  (TT) be shown differently.

- **Seen working on the real test site after his pull, 2026-11-10 22:50:** 84 yard entries
  (e.g. Days off: `YEBS30 S1 Mackenzie, A`; Yard jobs: "Assigned: FO … · S1 …"), no page
  errors. Empty trainee slots read "TT open turn" on most jobs, so an open TT / ET is now
  left out (needs another laptop pull; the old entries age out of names.json in 14 days).
  ❓ `Wallis, B` shows as FO on both YBHS31 and YPRS60: one person on two jobs, or two people?
- **Shared name codes split, 2026-11-11 00:45 (owner: "Person 1 keeps their code. Person 2
  replaces the last letter with number 1 ... Person 3 replaces the last letter with 2.
  Whenever anyone searchs the name code for anyone in person 1. Prompt the other name
  codes ... Make sure all the logs and turn history are tied to the correct code").
  Needs the laptop to pull and restart. Both sites (his direct ask, not a preview).**
  - **The groups** (`CODE_GROUPS`, the same list in lib/board/people.js and
    public/board.html): COBR + COBD (his own choice the evening before, kept), BRWA +
    BRW1 + BRW2, JAMC + JAM1, MADE + MAD1, MARI + MAR1, MARO + **MAR2** (his rule gives
    MAR1, which MARI's second already has; he confirmed MAR2 stays, 2026-11-11). Who is
    who was found on 2026-11-11 by turn: SB06 / SR11; SR08 / the FOs of YBHS31 and YPRS60;
    XSAS02's FO / YFLS01's FO; B111 / YMPS31's TT; SD02 / YPRS02's S1; B105 / YSBY02's YA.
    Each split-off person is found by a one-way hash (`OWN_CODES`), so no name is in the
    code: first three letters of the first name + surname where the surname is shared
    (his word for the first names), else the usual code + surname. The comment there has
    the command to add one; add the group to both `CODE_GROUPS` lists.
  - **A code can end in 1 to 9 now** (`isCode` in board.html, `kindOf` in
    board-analytics.js, BOARD_WEEKLY_CODES, scripts/alert-check.js, scripts/trainee.js).
    No Worker change: a followed person is `@` + a hash there.
  - **The prompt** (`codeGroupNote`): searching any code in a group, in the alert box
    under Find a turn and in Turn History's person panel, lists every code in the group
    with the turn its person is on now, the name where crew names are on, and in the
    alert box a "Track XXXX instead" button.
  - **History.** Checks saved before the split hold the shared hash for everyone. The
    site build re-ties them by turn (`People.retie` in lib/board/site.js, before the
    sightings, the reset tracker and "now"): rules = shared hash → turn → new hash. The
    laptop learns the turns itself (`learnSplit`, BoardChecker\code-splits.json: where
    each split-off code is on a turn of its own during its first 24 h), plus `SEED` (COBD:
    SA07 and SR11). New checks carry `peopleV: 2` and are never re-tied. Day files keep
    the rules' signature (`retie`): **every day is rebuilt once after the pull, and again
    whenever a turn is learned in that first day** (like a FORMAT bump, a slower publish).
  - **Limits, told to him:** before the restart the two could only be told apart by
    turn, so a person-1 spare who worked the other's yard job then is counted to the
    other; a split-off person's earlier turns (before the one they hold now) stay with
    person 1, except COBD's SA07; SR01 / SB03 on 24 to 25 Oct stay with COBR. **Phones
    following a shared code for person 2 or 3 must follow the new code**; nothing moved
    them (can't tell who a phone meant). Not announced to anyone.
  - **Checked:** suite 372 of 372 (tests for the codes, `retie`, `learnSplit`). On the
    real test site with this page: COBR, BRWA, MARI and MAR2 show the prompt in both
    places, JUOD shows none, no page errors, no sideways scroll. **Not checked:** the
    rebuild on the laptop (no real history here), BRW1 / BRW2 / the others appearing
    after the restart. Look at people.json after his pull: each new code on one turn,
    the shared ones no longer on two.
  - **Booked into this session: 2026-11-11 21:30 Toronto, review each group's turn history
    with Justin** (his ask: "After a day would you be able to review their turn history and
    manually correct things. We can walk thru it. Some of the people work steady yard jobs
    so it will be easy to separate"). Show him each code's turns with dates, he says which
    stretches move. Manual moves need rules by turn **with a date range** (`retie` is
    turn-only now): build that then, not before.
  - Also fixed, found on the way: the alert box's Save button threw and stayed greyed
    out when alerts could not be set up (`e.currentTarget` after a wait).
  - Looked alike but have different codes, nothing to do: B106 / SB03, B129 / B134, S101
    / YSTY01, S502-CO / YINS60's S1, XSAS03's FO / YEBS30's S1, SD10, XSAS05's FO. One
    code each on YFLS01 + YPRS30, YEBS03 + YFLS01, YBHS01 + YEBS03 (8 to 10 Nov) is not
    settled: no two names fit; trainees moving between jobs is the likely reading.
- **How many 18.6(b) submissions were sent: on Page Health, 2026-11-11 03:50 (owner: "Add
  tracking how many grievances being submitted"). WORKER CHANGE `bc9e72d`: not live until
  Justin pastes it into both Workers.** The Worker already kept each day's total
  (`stats/held186/<day>.json`, for the 30-a-day limit); it now also keeps `co` / `en` in
  it and `/health/held186` (owner only) returns `sent`: the last 30 days, today first
  (`held186Sent`). Page Health → Article 18.6(b) submissions shows Today / Last 7 days /
  Last 30 days and a folded table by day (`heldSent` in board.html); with the older
  Worker it says "needs the newest Worker". Counts only, never who. Not counted: a text
  file someone exports and sends themselves; a day before the paste has its total but no
  craft split. Owner page, so both sites. He was not asked where he wanted it: Page
  Health was my pick; say so if he wants it elsewhere (Analytics, members).
  - **Who submitted, and when, added 2026-11-11 04:40 (owner: "records who submitted the
    grievance and the time ... incase we have any issues"). WORKER CHANGE `d6687dc`, the
    version on the copy page now; paste that one (it includes `bc9e72d`).** Every try that
    reaches the limits or the email is kept (`held186Log`, R2 `stats/held186/log/<month>.json`,
    12 months, never served as a file): time, the signed-in member (account id, name,
    email, from `sessionOf`), the name typed on the form, craft, train out, the page's
    reference, and the result ("sent", or "not sent: why"). Never the claim's text, the
    PIN, the copy address or the internet address. `/health/held186` returns `log` (newest
    200 of the last three months); Page Health lists them under the counts (`heldLog`).
    The form's review box now tells the member a record is kept (`.gkept`): my addition,
    not asked for; say so. Records start at the paste: nothing before it can be recovered
    (only daily totals were kept). Tests: r2.test.js and accounts.test.js (a signed-in
    member's name is on the record; not signed in on a locked site it cannot be sent).
  - **The same paste fixes the visits table a day short late in the evening** (`lastDays`:
    counted by calendar day, used by `/stats/days` too): Housekeeping item 2, done once
    pasted. The r2 test no longer depends on the hour.
  - **Copy page rebuilt and republished at the same link** (now version `d6687dc`, 1857 lines; first `bc9e72d`,
    checked to decode to exactly the file; the previous page decoded to exactly `5c0fde0`,
    so this commit is the only Worker difference). There was no make-copy-page.py in this
    session: the page was rebuilt from the published one (replace the base64 on the
    `var bytes` line and the version line). The page is in this session's scratchpad only.
  - **Checked:** suite 372 of 372; on the real test site with this page, the box shows
    the "needs the newest Worker" line with today's Worker and the three totals + by-day
    table with made-up counts, no page errors. **Not checked:** the real counts (nothing
    readable until the paste).

- **Line-up, a job going spare: "goes" dropped, 2026-11-11 (owner quoted the line without
  it and said yes when asked): "EN (SD04 Name spare) · EN05 Name".** One word in
  `lineupCrew` (board.html); both sites; shows after the laptop's next pull and publish.
  The crew names note near the top of this file still quotes the older wording.

- **Extra yard jobs: the crafts option 5 leaves out are predicted — built 2026-11-11 14:55
  (owner: "I think I found a mistake in cats. The YFXS01 should have a fo and S1 going
  spare ... but it only has one job listed"; "see if it calls both a FO and S1 by 1400 if
  it does let's make a rule to correct that"). Needs the laptop to pull and restart.**
  - **What happened:** option 5 listed only `YFXS01 FO 11th 1530` from the 1212 check to
    1406 (16 checks, never the S1). At the 1414 check it was on the Call Board, moved to
    1600, with FO B130 · S1 B133; YEBS30's S1 went to B134. The fast board had been B134,
    B133, B130: three spares went, where the site expected two and had B130 down for
    YINS60 (it went to B115's spot instead).
  - **The rule** (lib/board/spares.js `isExtraYard`, `extraYardJobs`, inside
    `expectedJobs`): a yard job whose id has X as its third letter (`Y?X…`: YFXS01,
    YFXS03, YMXS01, YMXS02 in the 27 live days) with nobody under it in the crews in town
    is an extra job: his words, "Extra jobs don't have anyone on their turn they just get
    called spare". Its whole crew is expected to go spare (FO + S1; EN + FO + S1 on a YMX
    job). Any of those option 5 does not list at that time is added as a predicted job
    (`extra: true`), filled with the listed ones in time order, so Current's Jobs going
    spare ("+ N predicted", worded from `why`), the expected cover, the spareboards'
    "lined into" and the spares' alerts all count it. Nothing is added once the job is on
    the Call Board. Regular jobs are untouched.
  - **Checked:** test added (spares.test.js, today's case: four spares for four jobs),
    suite 373 of 373. Against the 27 live day files the rule fires on today's job only
    while it was open; the two other times part of an extra job's crew was missing from
    option 5 (YFXS03 25 Oct 0734, YMXS01 8 Nov 0620) the job was already called. **Not
    checked:** on the laptop with real screens (no raw history here).
  - **The alert** (owner: "what will the notifications say"): the spare lined up for the
    unlisted craft hears "B133 lined up: YFXS01 planned for 11th 1530, expected call 11th
    1330. Its S1 job isn't on CATS yet, but YFXS01 is an extra job and its whole crew
    comes off the spareboard: expect a call." (`lineup.extra` in alerts.js; the listed
    craft's alert is unchanged; the Notifications tab's reason quotes the same). Shown to
    him 2026-11-11; ask if he wants it reworded.
  - **X is the tell: confirmed by Justin 2026-11-11 ("Yes X is the tell for extra jobs").**
  - **Not settled, ask him:** (1) are YFX / YMX the only extra
    jobs; (2) YBHS61 and YEBS04 **answered 2026-11-11: "regular jobs just unfilled, going
    spare like a road turn that would go spare"**. The X rule leaves them alone, as it
    should. In the 27 live days they ran 7 times and option 5 listed one only once
    (YBHS61 24 Oct, FO only for 71 checks, and S1 B111 worked it, so the open S1 was not
    listed either); the other six runs were never on option 5 and their crews mostly
    were not matched to a turn, so how they are filled is not in the data. **Watched only, by his decision 2026-11-11
    ("keep the first, can check for when thats happening, and then check our predicitions
    against what actually happened and then decide if the rule would be a net positive";
    it was built as a live rule for an hour on his "Yes add that", then pulled back
    before any laptop pull).** `watchYardJobs` / `unfilledCrafts` (spares.js): a yard job
    the crews in town list with every craft an open turn (trainee slots aside), where
    option 5 lists one of FO / S1 and not the other. It is **not** in `expectedJobs`: no
    predicted row, no cover, no alert, nobody moved on the spareboard. Each check that
    it would fire, the snapshot carries `vacanciesWatch: [{ at, train, cc, why,
    wouldCall, call }]` (site.js; `wouldCall` = the spare it would have named).
    **To score it:** in the day files, each `vacanciesWatch` job against that job's later
    `yardJobs` entry (same job, on duty within 3 h): did a spare work that craft, and
    was it `wouldCall`; and whether the spares below were one place off without it. On
    the Housekeeping list (item 4): look when two or three have happened, then he
    decides. One case so far (YBHS61 24 Oct, before this was recorded); (3) the order between
    jobs at the same time: today B134 (first out) got YEBS30 S1, B133 YFXS01's S1, B130
    its FO; the site would have said B134 FO, B133 S1, B130 YEBS30 (same three spares,
    different jobs); (4) a YMX job's S1: YMXS02 8 Nov showed only EN EN09 · FO B113 on duty.

- **Both sites checked after his pull and the Worker paste, 2026-11-11 15:30 ("pulled and
  restarted, check the site").** Newest check 1524; all 12 tabs on `board` and
  `board-test` draw their own page, no page errors, no failed requests, no sideways
  scroll; Page Health says "All good".
  - **Worker `d6687dc` is pasted on both:** the 18.6(b) box shows the counts (0 today, 9
    in the last 7 and 30 days, 3 days with any) and "Who submitted: nothing recorded yet".
    So Housekeeping item 2 (visits a day short) is live: taken off the list.
  - **Split name codes are working and the history is re-tied:** COBD on SR11 (with SA07
    from October), BRW1 on YBHS31, JAM1 on YFLS01, MAD1 on YMPS31, MAR1 on YPRS02, MAR2 on
    YSBY02, each with that turn's earlier sightings moved over; the shared codes are down
    to one own turn each, **except BRWA, still on SR08 and YPRS60: BRW2 had no sightings.**
    The second person with that surname did not match "first three letters of the first
    name" (CATS must spell it another way than he gave). Fixed in `OWN_CODES`: anyone
    else with that surname under BRWA is BRW2 (keyed on code + surname). **Needs one more
    pull and restart**; YPRS60's history moves once BRW2 is seen there.
  - **Line-up reads "(SD01 … spare)"**, no "goes" (his change). The changes list still
    says "(goes spare)": that is the saved rule text, a different line, left alone.
  - **Yard job names (test site):** 23 empty trainee slots still showed "TT / ET open
    turn" from names saved before the fix; `namesByTurn` now leaves them out, so they
    go at the next publish after the pull instead of in 14 days.
  - Not looked at: the extra-job prediction (no extra job listed since the pull) and
    `vacanciesWatch` (none yet).

- **BRW2 works since the 1537 check, 2026-11-11 (after his second pull):** BRW2 is on
  YPRS60 with that job's history back to 26 Oct; BRW1 on YBHS31; BRWA on SR08 only "now".
  One leftover: BRWA still lists YPRS60 for 11 Nov 0052 to 1528, the checks saved by the
  first split code (marked `peopleV` 2, so not re-tied). `PEOPLE_V` is now 3, so those
  are told apart by turn too. Takes effect at the next pull and restart (every day file
  rebuilt once more); nothing else waits on it.

- **Job postings (jobs up for bid): BUILT 2026-11-11 16:20 from his three photos; ON BOTH
  SITES since 17:00 (owner: "that looks good ... push to the main site"; the notes below
  that say `PREVIEW` or "test site only" are how it was first built). The tab is hidden
  on a site until the laptop has published a read. NOT YET RUN AGAINST REAL CATS: needs the laptop to pull and restart,
  then read the first check's log line.** Owner: "i wanna add a check that just shows job
  postings that are up, incase guys want to post for something"; "basic info essentially
  the job thats up for bid and the close date, and then we can add options for
  notifications". Notes on the screen are in lib/board/screens.js above
  `parseCircularInquiry`.
  - **Route (his words):** conductors main menu 3 then 8, engineers 1 then 8. The screen is
    CIRCULAR INQUIRY- TRAIN/YARD (PSTS02T). His photos: DIST 45 / SUB-DIST SA prefilled;
    "*" typed in LOCAL/REG, PERM/TEMP, ASGN/POOL/SPARE and CHG CARD/746/OTHER; Enter. The
    SEARCH CLOSE DATES boxes are **not typed** (his word, later that day: "the date will
    auto generate when enter is hit if nothing is there"; the checker typed it for an hour
    of code that never ran). The list
    ends "END OF RECORDS FOR THIS CRITERIA"; PF8 scrolls.
  - **Laptop** (scripts/board-auto.js, in `runRoute` before the spareboards; about once an
    hour, `postingsReadAt`): `chooseFromMenus(page, 8, 3 | 1)`, `fillCircularInquiry`
    (finds the boxes by where they sit: rows of 2 / 2 / 4 text boxes; anything else is
    logged as "boxes by row …" and skipped), Enter, F8 to the end (12 pages at most). Read
    **unmasked in memory** (the masked copy would lose the descriptions; the screen has no
    names) and only the parsed lines are kept, in BoardChecker\postings.json: `{ at, co:
    { read, from, complete, list }, en: {…} }`, each job `{ number, description, ddsd,
    assignment, pool, turn, yard, cc, kind (A/U/X), change (1/2/3), closes (YYYY-MM-DD),
    term (P/T), cia }`. Nothing of it goes into the saved check or history. A craft that
    fails keeps its last list. Log line: "Job postings, conductors (3 → 8): N up for bid".
  - **Site:** `buildSite({ postings })` copies it to `data/postings.json`. Page
    (`jobPostings`, `POSTINGS`, **behind `PREVIEW`**): **its own tab, "Job postings"**
    (owner, 16:30: "can this information be put on a tab. the tab can be job postings";
    `modePost`, mode `postings`, `renderPostings`, `#postings`; first built as a box on
    Current, moved), conductors then engineers, by closing date, "closes today /
    tomorrow" in colour; turn, craft, CATS's description, permanent / temporary,
    assignment / pool turn / spareboard, circular number. **No crew names beside the
    turns** (told him names stay off this box). To promote: drop the `PREVIEW` tests in
    `jobPostings`, where postings.json is loaded and where `modePost` is un-hidden.
  - **Reference is called "Job Aids" on the test site** (owner, same message: "can we
    change reference to Job Aids, we can try these changes on the test site first"): the
    tab's label and the page's heading (`refState.title`, public/board-ref.js) when
    `PREVIEW`; the main site still says Reference. To promote: make it the only name.
  - **Promoted 17:00, both names and the tab:** `jobPostings` no longer tests `PREVIEW`;
    `loadPostings` (board.html) fetches `data/postings.json` for everyone at start and
    each time the tab is opened, and un-hides `modePost` only when the file is there, so
    nobody sees an empty tab if the CATS read fails. "Job Aids" is the tab's and the
    page's only name now (`#ref` unchanged). He approved from the picture, before any
    real read. Clicked through again: main site with a made-up postings file (13 tabs,
    the new one draws), main site as it is now (12 tabs, no Job postings tab, Job Aids),
    test site: each its own heading, no errors.
  - **Every tab clicked on both sites with the first (test-only) page, 16:40:** 13 on the test site (with
    Job Aids and Job postings), 12 on the main site, each showing its own heading and its
    own button lit, no errors, no sideways scroll.
  - **Checked:** parser test from his photo (screens-extra.test.js), suite 376 of 376; the
    box on the real test site with his photo's eight conductor postings fed in (phone
    width, no errors, no sideways scroll; not shown on the main site).
  - **Not checked / guesses to confirm on the first real run:** that the engineers' menu
    1 → 8 is the same screen and takes the same boxes (he sent the conductor one); that
    the box rows come out 2 / 2 / 4; that Enter and F8 behave as on the other screens;
    what the list shows when nothing is up; the meaning of the 1/2/3 and CIA columns (kept
    raw, CIA not shown). **If the log says "skipped job postings …", the message says
    which step.**
  - **FIRST REAL READ, 16:30 (laptop on `deae9cf`): both routes reached the screen and
    "END OF RECORDS", but 0 jobs for conductors and 0 for engineers, where his photo an
    hour earlier had eight conductor postings. So either the list really came back empty
    (the "*" boxes or the date not taking) or the lines do not fit `CIRCULAR_ROW`. Because
    the published file has both crafts (empty), the Job postings tab IS showing on both
    sites, saying "Nothing up for bid": wrong until fixed.** `2d24cd0`: when the first page
    gives no jobs the checker keeps `sample` in postings.json for that craft: the masked
    screen (`lines`, A / 9 only), the text boxes with where they sit and their masked
    values (`boxes`) and the row count. **Read at 17:05 (the laptop had pulled): the
    boxes fill correctly and the list comes back, eight conductor lines and two engineer
    lines (SDSD07 closing 26 Nov, SDSD11 29 Nov; the engineers' screen is "CIRCULAR
    INQUIRY- ENGINE", same layout). The cause: in the grid every text box is its own cell
    in square brackets, so each line began `[] 785410 …` and the reader wanted the number
    first. Fixed `e564cec` (`parseCircularInquiry` leaves box cells out; a test uses the
    laptop's own lines). Needs one more pull and restart. Then check postings.json has
    8 + 2, and take the `sample` code out of board-auto.js.**
  - **Alerts, his answers 2026-11-11 16:35 (nothing built):** (1) "When a new one goes
    up, and can we do something that the person can select to have an addition reminder X
    hours before the posting closes each job at the time of the first notification": an
    alert for a new posting, and from that alert the member can choose an extra reminder
    X hours before that job closes, job by job. (2) who hears about which postings: "We
    will go thru this, its more complicated for conductors but we will make rules": wait
    for his rules. Notes for the design: the Worker keeps a phone's follows as turn-like
    ids (`TURN` regex: 2 to 6 letters / digits), so a topic such as `BIDCO` / `BIDEN`
    needs no Worker change, but per-job reminders and any filter beyond craft are new
    settings: either kept on the phone and sent as their own follows, or a Worker paste.
    **Who may post for what, his rules 2026-11-11 16:50 (word for word in parts; the
    alert goes only to people who could bid the job):** first know whether the person is a
    conductor or an engineer; "If their spot is unknown, for the purposes of these
    notifications only, use their last known craft". **Engineers** "can post for road or
    yard turns, regardless of where they are currently". **Conductors:** on the
    spareboard → road or yard; in the yard → "can only goto other yard tvs", an FO only
    to FO postings, an S1 (switchman) to either FO or S1; on the road → "can only post to
    road tvs": "Anyone on the road can post for 502/501 tv, any A or B pool TVs. Chain
    gang cannot post to another chain gang tv". Asked him, not answered yet: do permanent
    postings (P) follow the same rules as TVs; may a spareboard conductor take both FO and
    S1 yard postings; what a conductor with no known position gets; and that the person is known from the
    name code a phone follows. **Answered 17:00: "A conductor in the A or B pool, or on
    501/502 can also post to chain gang".** **Permanent postings, 17:05: "we will need to
    review but for now any perms show to in their specific craft and location. Engineer,
    Conductor Yard and Conductor Road"**: a permanent posting goes by three groups only
    (engineers; yard conductors for a yard job; road conductors for a road job), without
    the finer TV rules (FO / S1, chain gang). To be reviewed with him later. Read as: a
    spareboard conductor gets both yard and road perms (not confirmed).
    **His answers 17:15:** a spareboard conductor gets both yard and road, permanent and
    TV, FO and S1 ("yes"); a conductor whose spot is unknown: "use their last known
    position"; who is who: "name code, but how would the account way work" (explained to
    him; name code is the plan). **The rules are code now: lib/board/postings.js
    (`standing`, `mayPost`, `postingText`) with test/board/postings.test.js; nothing calls
    it yet.** Also at his word: the "Read from CATS …" line is off the tab.
    **ALERTS BUILT 2026-11-11 18:00, THE ACCOUNT WAY (owner, mid-build: "build the account
    way, that sounds amazing"; closing time: "the time is always 1200"). WORKER CHANGE
    `08e6109`: needs a paste into both Workers (copy page republished, 1918 lines) AND a
    laptop pull and restart. Controls were on the test site only at first; ON BOTH SITES
    since 19:10 (below). Nothing has been confirmed on a real phone yet.**
    - **Worker** (cloudflare/board-worker.js; the accounts session's file): `POST
      /auth/profile` (a signed-in approved member, or the owner's own session) saves
      `code` (name code) and `postings: { on, remind: { <circular>: hours 1 to 168 } }` on
      the account (the owner's in `accounts/owner.json`); `/auth/me` returns them;
      `accounts/postings.json` lists the account ids that have a code and want something,
      for the checker. `subscribe`: a device that follows nothing is kept when it sends
      `device: true` and is signed in (it takes its account's alerts); the owner's device
      is stamped account `owner` only then. Tests in accounts.test.js.
    - **Laptop:** `listPostingAccounts` (lib/board/r2.js) reads that list and each
      account file (approved ones only; keeps id, code, choices, nothing else).
      `Postings.accountEvents` (lib/board/postings.js): the person's standing from
      `rememberPeople` (last own turn and craft per code hash, kept 120 days in
      BoardChecker\posting-alerts.json with what each account was told); a new posting
      once if they `mayPost`; an account on for the first time (or switched back on) is
      not sent what is already up; a reminder once, the chosen hours before 1200 Toronto
      on the closing date (`closeAt`), with or without the new-posting alerts on. Sent in
      `sendTurnAlerts` after the turn alerts, to every device whose `account` matches
      (title "Job posting", link `./#postings=<number>`), logged as turn `JOBS`, kinds
      `posting` / `postingRemind`. An event no device took is tried again next check.
      Tests in postings.test.js.
    - **Page** (Job postings tab, `postingAlertsBox`, `renderPostings`, `POST_ME`): name
      code + Save; "Alert me when a job I can post for goes up" (asks to allow
      notifications on this device, `Alerts.device`, flag `alertDevice`); "Remind me"
      per job (none / 2 / 6 / 12 / 24 / 48 h); `#postings=<number>` opens the tab on that
      job. The owner's device signs itself in with its key first (`auth/owner`). The tab
      also says "closes … 1200" and drops a posting after 1200 on its day.
    - **Checked:** suite 382 of 382. In a browser on the test site with the account
      calls answered locally (nothing written to the real site): the box draws, a code
      saves, the link opens on the job; switching on in a headless browser fails at the
      push registration and the page says so and leaves everything off. Main site: no
      alerts box, no reminder pickers. **Not checked: a real phone end to end** (allow,
      switch on, a new posting arriving, a reminder).
    - **Cancelled postings (owner, 18:20, pasting two lines of the list: "the C means
      cancelled and are no longer able to post for"):** a C in the list's last column
      (`cia`). `Postings.cancelled`; such a posting is never offered or reminded; an
      account that was sent it, or had a reminder on it, gets one "was cancelled" alert
      (kind `postingCancelled`). On the tab it is struck through under the open ones,
      marked cancelled, not counted, no reminder choice. Laptop and page only: no Worker
      change. Suite 383 of 383.
    - **The name code lives in ⚙ Settings → Profile once saved (owner, 18:40: "once they
      put their name code in here, can you move that to the settings where they can
      update it, but its not on that page anymore"):** the Job postings tab's Alerts box
      asks for the code only while the account has none; after Save it is gone from
      that page and shown in Settings (`#profcode`, `paintProfileCode`; test site only,
      like the rest), where it can be changed or cleared. Tried in a browser with the
      account calls answered locally: saved on the tab → gone from the tab → in
      Settings → changed there; hidden on the main site.
    - **The explanation is under a round "i" beside the tick box (owner, 18:55: "can you
      add this info in like a compacted i with the circle they can click"):**
      `details.infotip` in `postingAlertsBox`; closed until tapped. What stops alerts on a
      device (iPhone not on the Home Screen, a browser that can't, alerts not set up on
      the site) stays in view as a line of its own.
    - **ON BOTH SITES since 19:10 (owner: "everything else looks good, push to the main
      page").** The `PREVIEW` tests are gone from `postingAlertsBox`, `remindPick`,
      `renderPostings` and `paintProfileCode`; `loadPostMe` runs for everyone at start.
      The Worker with `/auth/profile` answers on both `board` and `board-test` (checked
      19:05), so no paste is waiting. Still test-site only: yard job names, and the older
      previews. Clicked through with this page: 13 tabs on each site open their own page,
      no errors, the alerts box and reminder choices show on the main site, a cancelled
      posting is struck through and not counted.
    - **The Track box has the option too (owner, quoting the box for 👤 JUOD: "I dont see
      anything that lets you track notifications here"; earlier: "I want the option for
      job posting notifications to be off by default for those tracking name codes"):**
      for a name code, a last line "a job they can post for goes up (job postings)",
      unticked unless the account already has it on (`#dlgpost` in `openTrack`). OK saves
      it to the account (`postProfile`), with this code as the account's name code when
      it has none; an account with a different code keeps its own and the line says so.
      It is the same switch as the Job postings tab's, not a second setting. Checked in
      a browser with the push step stood in for: sends `{ code, postings: { on: true } }`.
    - **New postings shown on the page itself: ON BOTH SITES since 19:20 (owner: "you can
      push those notifications to the main page"; the `PREVIEW` tests are out of
      `paintNewPostings` and `markPostingsSeen`). First built for the test site (owner,
      18:50: asked how the alerts work without notifications; "Yes. Build it for the test
      site"):** for people who never allow phone notifications. Kept on the device
      (`postingsSeen` in localStorage: the circular numbers this device has shown).
      `paintNewPostings` / `markPostingsSeen` / `POST_NEW` in board.html, behind
      `PREVIEW`: the tab reads "Job postings · N", a line above Current says "N new job
      postings since you last looked" with a button that opens the tab, and each new row
      has a "new" chip until the tab is left. A device's first visit starts with
      everything as seen; a cancelled posting never counts. **Every open posting counts,
      both crafts:** the who-may-post rules run on the laptop, not on the page (told
      him; narrowing it is a possible second step). Per device, not per account: a
      posting seen on the phone is still "new" on the tablet. Checked in a browser with
      a made-up list: first visit nothing, a new one → count, line and chip, gone after
      the tab is opened; nothing of it on the main site. Suite 384 of 384.
    - **Not built:** setting a member's code from the Members tab; showing on the tab
      what the site thinks you are (engineer / yard FO / chain gang …); the Members tab
      listing who has these alerts on. **To promote:** drop the `PREVIEW` tests in
      `postingAlertsBox`, `remindPick` and `renderPostings`.
    Buttons on the alert itself work on Android, not on an iPhone: the reliable way is
    that tapping the alert opens the Job postings tab on that job with a "Remind me"
    choice there.
  - The laptop was on `1402ef9` at 16:00 (`fc88224` and this not pulled yet).

- **Live check, 2026-11-11 17:41 Toronto: the laptop is on `749a14e` and the main site is
  serving that page** (Job Aids, the Job postings tab with the Alerts box, the round "i",
  the Track box option, the name code in Settings, cancelled postings struck through).
  The 17:38 read has 8 conductor postings (SR11 and SR03 cancelled) and 2 engineer ones.
  The Worker with `/auth/profile` answers on both sites. Nothing waits on a pull or a
  paste. **Clock times in the job postings notes below written as 18:00 to 19:10 are
  about an hour and a half fast: that work was done between 16:20 and 17:35.** Still not
  confirmed: an alert arriving on a real phone; the `sample` code in board-auto.js (kept
  when a read gives no jobs) can come out now that the read works.

- **Agreements tab, a simpler document picker: ON BOTH SITES since 2026-11-11 18:20 (owner:
  "push it to the main page"; `renderAsk` passes `simple: true`). First built for the test
  site, 18:10 (owner: "Would there be a better way to lay this page out with the
  agreements selected. Could have it auto select a few of the more commonly used ones,
  then you can add in more if needed. And also have a conductor/engineer button").**
  public/board-ask.js (`COMMON`, `SHORT`, `setCraft`, `paintChips`, `setSimple`; styles
  `.askpicker …` in board.html); `renderAsk` passes `{ simple: PREVIEW }`.
  - Under the question box: "I am a" Conductor / Engineer (remembered on the phone,
    `askCraft`), "Searching" as chips, and a folded "Add more documents". A craft picks
    its everyday four: conductors → 4.16, its addenda, the conductors' crew calling
    procedures, duty and rest rules; engineers → 1.1, the mileage guidelines, the
    engineers' crew calling manual, duty and rest rules. **Which documents count as
    "commonly used" was my pick, not his: ask.** Until a craft is picked, both sets (7).
    Everything else (CROR, GOI, dangerous goods, discipline grid, the engineers'
    operating manual, CROA awards, the two Western agreements) is one tap under Add
    more. The tick-box list below stays the record of what is searched ("All
    documents, as a list"); the chips only show and change it. The CROA date boxes
    move up beside the chips. Was: all 13 ticked.
  - His question the same hour, answered, nothing changed: does one agreement use fewer
    tokens. Hardly: the search always sends a fixed number of passages (`TOP_K` 9, deeper
    24), whatever is ticked; narrowing mostly saves the second, dearer pass a member's
    question takes when the first finds nothing (the owner's always go deep).
  - **Checked** in a browser on the test site (no question was sent): the craft buttons,
    adding CROA and removing the addenda by chip, the Western agreements blocked while
    4.16 is picked, the craft kept over a reload; the main site keeps the old page (the
    picker hidden, all 13 ticked). Suite 383 of 383. To promote: pass `simple: true`.

- **Two "possible problems" flags on 11 Nov traced to one cause, nothing changed, waiting on
  Justin's rule (he pasted them at 18:15: "A42431 11 … went to A (SA07) but the sequence
  says B", "E27861 11 … went to B (SB02) but the sequence says SR").** The road day of the
  11th ran M30241 09 → A, **RM39491 10 (a rescue) → Chain Gang (SR08 + SD04)**, Z14891 10
  → A, A42431 11 → A, M38261 11 → B, E27861 11 → B. That is three A and two B, in order,
  if the rescue is not counted. The site counted the rescue as the second A train (it
  predicted SA08 for it and flagged "went to SR … sequence says A" that morning), so
  every later train sat one slot late: A42431 looked like the first B and E27861 like a
  Chain Gang train. The line-up flipped E27861 between SB02 and the Chain Gang all day
  for the same reason. The rule in force (his, 2026-11-07, `rescueSpare` in engine.js): a
  rescue takes the normal sequence unless option 5 lists both crafts spare with no turn.
  In the saved days 13 Sarnia rescues were called: 9 went to the Chain Gang, 2 to B, 1 to
  A, 1 unclear (two entries for one train), so "a rescue goes to the Chain Gang and uses
  no A or B slot" fits most but not all. **Answered 2026-11-11 18:25: "the rule is right, I think
  the crew office ordered the train incorrectly but I will keep track".** So the sequence
  is NOT changed: a rescue still takes the normal A/B sequence unless option 5 lists both
  crafts spare with no turn, and today's flags were the site correctly pointing at a
  train ordered to the wrong pool (and the knock-on of that). He is keeping his own
  tally; do not reopen the rule unless he does.
  **But the count changed, 18:35 (owner: "if that happens and an A or b turn gets skipped
  it sitll has to go out"):** a train really called to another pool than the sequence gave
  it no longer uses the slot it skipped (engine.js, in the slot loop: `went` = the pool
  of a train on the Call Board or remembered from it; the count goes by that, the
  `expected` and the flag stay). So after a mis-ordered train the next one takes the
  skipped A or B turn, as CATS did on the 11th, and only the wrong train is flagged, not
  the two after it. An ordered train's crew code still counts by the sequence (his
  correction of 11-07). Test added (engine.test.js, the 11th's six trains); suite 384 of
  384. Needs the laptop to pull and restart. Not replayed on the saved days (the engine
  needs the raw checks, which are only on the laptop).

- **⚠ A session's test browser is counted as a visitor: set `boardNoCount` first.** Found
  2026-11-11 19:10 when Justin asked how Page Health showed "opened 218 times on 81
  phones" with about 30 members approved (33 approved, 30 seen that day, the lock on).
  The page counts itself (`stats/hit`) once per visit and once a day per browser, and a
  browser a session launches against the real sites is a fresh one every time, so each
  run added an "open" and a "phone": this session opened roughly 45 to 50 that day, and
  the 148 on the 10th has the other sessions' in it too. Those days' figures cannot be
  corrected from here. **From now on every script that loads the real sites must run
  `localStorage.setItem('boardNoCount', '1')` in its init script** (the page's own "Don't
  count this phone" flag), beside the owner-key placeholder. The real figure for a day is
  nearer the members "Last seen" on the Members tab.

**Board/checker session — state at 2026-11-10 20:15 Toronto. Read this before touching
`public/board.html`, the alerts or `lib/board/patterns.js`; each item has its own dated
note further down (search for the words in bold).**

- **Test counts in this session's notes are wrong, and one real failure hid behind them.**
  This session's container had no `node_modules`, so 60 tests in files that need a package
  (`dotenv` and others) never ran, and every note from it says "N of M, the same 12
  failing". Those 12 were the container, not the code. With `npm ci` the suite is **371 of
  371**. One test did break with the Garnet/Toronto call change (`0c75432`), in a file
  that could not load here; the accounts session found it, fixed in `test/board/site.test.js`.
  **A cloud session must run `npm ci` before trusting `npm test`.**
- **A session can read both real sites again: Justin saved the owner key for
  `board.sarniaboard.workers.dev` and `board-test.sarniaboard.workers.dev` on his Default
  cloud environment, 2026-11-10 20:20 ("lets give you the owners key so you can do updates,
  lets do it for both the test site and the main").** The session's proxy adds it as
  `x-owner-key` to every request to those two hosts; no session ever sees the value, and
  it is not in any variable or file. So: plain `curl https://board…/data/…` works through
  the lock, and so does a browser launched through `HTTPS_PROXY`. For the page's own owner
  features (owner tabs, `PREVIEW` on the test site) put any placeholder in
  `localStorage.boardOwnerKey`; the proxy overwrites the header. **Read only: open tabs and
  fetch files; never press Save, approve a member or send anything from a session.** Every
  session in that environment has this access, the accounts session included.
- **First real check with it, 2026-11-10 20:25, all 12 tabs on both sites, each showing its
  own page, no page errors, no failed requests, no sideways scroll.** That confirms the
  four owner tabs (Page Health, Search Review, Notifications, Members) after the tab fix.
  Main site: no preview features, Analytics has the new layout and seven pages, the pool
  buttons pair up, Page Health's follower tables have names (30 of 33 rows filled). Test
  site: the TEST SITE badge, 8 likely-call lines and 6 habit chips on Current, no
  spareboard predictions, Analytics has the eighth page (Likely-call test), Turn History
  in the new layout.
- **Live on the main site since 2026-11-10:** the Analytics new layout (everything that was
  in the Test tab, with the simpler Assignment errors); the Test tab is gone from both
  sites; Garnet and Toronto alerts use a call of 2 h before on duty (order − 2 h 15 for a
  train); a stand-in on a 501/502 job is forgotten when the trip is over (the SA07 alert);
  names on Page Health's follower tables; the pool buttons with each craft's two
  spareboards on one row.
- **"How to get alerts on this phone" under Find a turn, 2026-11-10 21:10 (owner: "add
  instructions beside find a turn to explain how to enable notifications ... and how to add
  the page as an icon on your homescreen").** A folded `details.turnhelp` in the rail of
  `public/board.html`, both sites: iPhone first (Safari → Share → Add to Home Screen, open
  from the icon; an iPhone only alerts from there), Android (Chrome ⋮ → Add to Home
  screen), then the four steps of the Track box, and one line for alerts that don't
  arrive. The rail's `ol` rule strips numbers, hence the longer selector. Checked on the
  real site's data in two styles on a phone and on a computer; he has not seen it yet.
  **Name codes are explained there too since 21:20 (owner: "you can add instructions for
  the name code now since the site isnt public anymore"):** how the code is made (first
  two letters of each name), that it follows the person across turns, which button to
  pick, and that it works in Turn History and Analytics. The name-code search was kept
  unadvertised while the page was open to anyone; with the lock on that no longer applies.
  A typed code is still never kept in the address bar or the recent-lookups list.
- **Rule from Justin, 2026-11-10: previews go to the test site only (behind `PREVIEW`),
  never a tab on the main site.** Small things he asks for directly, and owner-only pages,
  have gone to both sites, said plainly each time.
- **On the test site only, not promoted (he has not asked):** the likely-call window and
  habit chip on Current; the new Turn History layout; My week's "Sleep this week" box; the
  Snapshots and 18.6(b) row layouts; the newer-version bar; the compact header; Analytics
  → Likely-call test. Spareboard predictions are built but **switched off**
  (`SPARE_PREDICT = false`), on his word.
- **The two-week likely-call test: 2026-11-11 to 2026-11-24** (`TEST_FROM`, `TEST_DAYS`
  in lib/board/patterns.js; `score` in data/patterns.json). Decide on promoting the train
  window when it ends, not before. He said: "If its more beneficial than the time it shows
  over 2 weeks maybe we can push it [to] the main site."
- **Booked check-ins into this session:** the S5 swap watch (next: L50231 11, lined up for
  S502; four nights more to reach five clean) and 2026-11-25 09:00 Toronto to read the
  likely-call test (switched off 13 Nov; replaced by 24 Nov 08:00, see the top of this file). Both can read the live files now (the saved owner key, above).
- **After any change to `setMode` or the tab bar: click every tab and read the page's
  heading.** Removing the Test tab broke every tab but Analytics on the live site for
  about half an hour because the check read the address, not the page.
- **Waiting on Justin:** whether rescue trains out of Toronto
  should also use order − 2 h 15 (left at order − 2 h on one example); what Page Health's
  "GitHub" row says on the Windows laptop; whether a renumbered train (DH27331 → X27331)
  counts as one job; whether crews that turn straight back at Toronto count from arrival;
  CATS option 29 at his next call (S5 watch).
- **Not started, offered only:** `isOwner()` / `accessEmail()` in the Worker; deleting the
  older Analytics layout's code (still there with `ANA2` off); the dead
  `renderOrderSummary('test')` path; a spareboard model that counts yard shifts ahead.
- **Dated:** delete the suspended Render service 2026-11-23; Pushover trial ends about
  2026-12-04.

**Page styles, phone tab bar and pool buttons — one session, 2026-11-10 → 11 (owner,
from his phone). All approved by him and on `claude/vigilant-planck-zawrj4`; laptop
pull/restart/publish pending. This replaces that session's 18 separate notes.** Only
`public/board.html` changed (plus this file). 299 of 311 tests pass, the same 12 failing
as the branch without these changes.

*1. Page styles: 65 choices in ⚙ Settings → Page style* (was 4). Opt-in per phone
(localStorage `boardTheme`); nobody's page changes until they pick one.
- **Settings list:** six folded groups (`details.stygrp`) with a count each: Everyday 4,
  CATS 2, Railway 5, Old screens 15, Games 19, Films and shows 20. Everyday starts open;
  the group holding the style in use opens itself. The Settings box scrolls inside the
  screen.
- **Hand-written styles (22), each its own block near the end of the style sheet:**
  light, dark, retro, tablet, iphone (+ iphonelight), board (Departure Board), matrix,
  fallout, starwars, mario, pokemon, zelda, minecraft, naruto, gameboy, simpsons, win95,
  teletext, tron, pacman, startrek.
  - **Retro and Retro Tablet were redone from his own pictures** (four CATS screenshots,
    three GLINK photos) and he said "I like them both". Retro: the colours were already
    exact (#f1f1f1, #000000, #000080, #800000, #ffff00); what changed is one thin weight,
    capitals with wide spacing, no frames, views as maroon words with the open one on a
    yellow bar. Retro Tablet: colours read from photos, so near not exact (data #d9ecfa,
    choices #18c1ff, labels #2b8fff); title and section titles in pale bars, table
    headings as sky-blue bars, table rows sky blue with only the turn pale. In both,
    sentences meant to be read (reasons, notes, agreement answers) keep small letters.
  - **iPhone** goes light or dark with the phone; **iPhone Light** is the same style held
    light (`boardTheme = iphonelight` → `data-theme="iphone"` + `data-shade="light"`).
- **Kit styles (43), `data-theme` starting `k-`:** each is only a block of colour tokens,
  three typefaces and a few `--k-…` variables (frame, heading bar, tabs, the picked thing,
  day bars, glow); the rules under `:root[data-theme^="k-"]` (the "Kit styles" block) draw
  them. `k-px-…` ones also get the small sizes the pixel font needs. Some have a few rules
  of their own (Subway's route lines, Tetris's block tabs, Donkey Kong's girders, Classic
  Mac's striped title bars, RoboCop's corner brackets, Top Gun's stripe, Apple II's
  cursor, Cyberpunk's cut-corner tabs, Stranger Things' outlined title).
  - **To add one:** a variable block there and a button in the right group of the Settings
    list (bump the group's count). Nothing in the script: the name check is
    `k-[a-z0-9-]+` and the browser-bar colour comes from `--k-meta`.
  - ⚠ A gradient for a heading bar goes in `--k-head-img`, not `--k-head-bg` (the shared
    rule sets `background-image` after `background`, which wipes it).
- **Rules he has been told and accepted:** every themed style copies a look only (colours,
  shapes, lettering): no characters, logos, sprites or art. Late / spare / ordered keep a
  distinct colour in every style, even "one-colour" ones (Game Boy, Classic Mac, Nokia).
- **Fonts:** Press Start 2P (pixel) was added to the Google Fonts link for the game
  styles; a phone only downloads it when one of those styles is on. Several styles name
  typefaces a phone may not have (Courier New, Brush Script, Benguiat, Tahoma, Chicago)
  and fall back to a plainer one.
- ⚠ **When adding or changing a style, check on a phone-width screen** that Current and
  Turn History still share the first tab row: they are `calc(50% - 3px)` wide, so a tab
  gap over 6px breaks it (it did, three times).
- **Not done:** the Worker's sign-in page and grievance.html only know light / dark, so
  with any other style picked they show light.

*2. Tab bar on a phone.* The one swipe row promoted on the morning of the 10th cut a tab
in half at the screen edge ("fix the tabs at the top so they don't run off the screen").
The tabs now wrap into full rows, Current and Turn History share the first row, and the
bar uses the 48px the top bar keeps for the gear (`body.nav-one-row .modes`; the class
kept its name, the scroll-into-view line is gone). **This supersedes "one swipeable row"
in the notes below.**

*3. Pools at Sarnia.* On a phone the filter buttons sit two to a row in his order: A pool,
S1 / B pool, S3 / Chain Gang, Drags / 501/502, Garnet / Conductor fast, slow / Engineer
fast, slow / All (`POOL_SPOTS`, `poolSpot`, `--o` on each button; a pool not named comes
last). **The last three rows are from 2026-11-10 evening (owner, a phone screenshot: "put
conductor fast and slow in the same row. Do the same with engineers"):** Garnet moved up
beside 501/502 so each craft's two spareboards pair up, and a hidden gap (`.poolgap`, spot
9) keeps them paired on a saved day with no Garnet board. Both sites; checked in two
styles on a phone and on a computer, from saved copies of the data. **Changed again
minutes later (his screenshot with no Garnet button, 501/502 alone on its row: "move 502
down beside all"):** the order is now A, S1 / B, S3 / Chain Gang, Drags / Conductor fast,
slow / Engineer fast, slow / 501/502, then Garnet when its board is there, then All. With
no Garnet board 501/502 and All share the bottom row; with one, 501/502 and Garnet pair
and All follows on its own. The boards under them open in that
same order, whatever order they were switched on in, and a computer uses the same order
(in its single line of buttons).

*How it was checked, and what was not.* Every style was loaded at phone width on the
sample data (three pools, names masked): no script errors, no sideways scroll on Current /
Turn History / Order summary / Analytics, and the top of Current plus the line-up looked
at in a screenshot. **Not checked:** the other tabs (Article 18.6(b), Agreements,
Reference, Snapshots, Page Health, Test) in any of the new styles, a computer-width
screen, live data, a real phone.

*Open with Justin (ask, do not build):*
- ❓ The pixel digits (0, 6, 8 look alike) in the big times of Super Mario, Pokémon, Zelda,
  Minecraft, Game Boy, Pac-Man, Commodore 64, Nokia Phone, Tetris, Donkey Kong, Space
  Invaders and Apple II. Offered: keep the pixel letters for headings, normal numbers for
  times.
- ❓ Game Boy's low contrast in daylight; Cyberpunk's bright yellow page at night; the
  strength of Fallout's scan lines and Star Wars' stars on a real screen.
- ❓ Retro Tablet's line-up rows are pale, its table rows sky blue: a photo of option 41
  in GLINK would settle the line-up.
- More style ideas he has not picked (listed for him in chat): split-flap board,
  timetable, signal lights, hi-vis, more games and films, sports teams, seasonal. Build
  only what he names.

*Working notes for the next session.* This session's branch was `ccr-2f227f1e-8taof0`; it
is level with `claude/vigilant-planck-zawrj4`, where everything was pushed as
fast-forwards (the other session kept pushing there too: fetch and merge before each
push). He likes a phone-sized screenshot of each change. For a change to how an existing
page looks for everyone he asked to see a sample before the push; new opt-in styles went
straight out.

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
engine (known-crew shortcut, S5 audit).The line-up's reason wording does not tell the
version (the same sentence is in the current engine): use Page Health's "Running code"
row from now on. Call stability had both S501 crafts' call for the 10th and no false
"taken off". Next: L50231 11, lined up for S502. Results:

| L502 | Crew that went | Line-up at the call | Laptop code | Result |
|---|---|---|---|---|
| 05 | S502 | S501 at 0046 | before 8th fixes | swap |
| 08 | S501 | S502 at 0259 | before 8th fixes | swap |
| 09 | S502 | S501 at 0058 | not known | swap |
| 10 | S501 | S501 at every check to 0039; Call Board 0049 | not known | clean (1) |
| 11 | S502 (EN09 on the engineer's job) | S502 at every check to 0039, **S501 at 0047**, Call Board 0052 | after the 8th fixes (restarted 10th evening) | **swap, on the new code** |

**The watch lapsed and then failed its own test, 2026-11-11:** the session that booked the morning check is gone (its reminder is disabled, "session gone"), so nobody read the 11th until the evening handoff. Read then from the day file: the same one-check flip to the other crew on the first check after the 0045 call, on code that has the 8th's engine fixes. By the plan above that means **fix the engine** (the known-crew shortcut / S5 audit), not keep counting clean nights. Not started; nobody is booked to check L50231 12.

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
Later the same day, Justin: "a DH should go to the slow board always" (already so) and "if
they were on rest that's why they didn't get it, they need to be available". B111's rest
ended 0600, an hour before the 0700 call, so the open point is **available by when**. The
site's rule (rested by the call) was replayed over all 25 live day files: only two road
spare jobs had the first spare still on rest while the job was ordered but rested by the
call. M39491 29: B104, rest until 0600, ordered seen 0517, call 0615 → **got it**.
DHT040B 31: B111, rest until 0600, ordered seen from 0154, call 0700 → **passed**. "Free
when first seen ordered" as a general rule did worse than today's (18 vs 23 of 29 right),
so it was **not built**. Asked Justin for the cut-off; do not change `spareFills` on rest
until he gives one. **2026-11-10, later (this session):** Justin again: "I think
B111 was on rest when the call was made so it should have gone to the next person". The
saved checks don't show that: B111 reads "rest until 31st 0600" up to 0521 and
"available" from 0559; the line-up still had DHT040B at 0643 and the Call Board had it
(B133 working SR08) at 0652, so the call was made between 0643 and 0652 (deadheads reach
the Call Board a median 127 min before on duty; this one 128). B111 was off rest about 45
min before the call. Told him so. **Closed by Justin, 2026-11-10: "Leave it as a one
off".** `spareFills` keeps "rested by the call"; don't reopen it or ask for a cut-off again.

**Page Health → Who gets alerts tidied, 2026-11-10 (same session; Justin: "can we clean up
this. Maybe show who's following what turn on the members page"):** in `public/board.html`
(renderHealth) the two run-on lists are now a Turns table (turn, phones) and a People table
(name code, on turn now, phones), A–Z; people with no name code yet are one counted line.
"Last checked" / "Report received" lines dropped (the summary line has the time). Checked
in a phone-sized browser on sample data. Laptop pull/restart/publish pending; no Worker
change. **Built 2026-11-10 by the accounts session at Justin's word ("do 1, and push it"):** follows on the Members tab; the two "Phones are anonymous" lines reworded. What was asked first: A subscription
(`subs/`) carries no account, so the Worker's `subscribe()` would have to stamp the
signed-in account on it and `/health/accounts` return each member's follows: a change in
the accounts session's files, a paste into both Workers, only for phones that save their
alerts again while signed in, and it ends "phones are anonymous" (wording on Page Health
and Notifications).

**Call timeline, new layout — in Test, awaiting Justin's phone review (2026-11-10):** he
sent three screenshots: a call before the eight-hour window (EN09 YMXS02, 48 min notice)
drew as a tick beside a red bar that didn't reach it, and the six facts wrapped badly.
`renderCallTimelineV2` (public/board-analytics.js; styles `.ct2*` in board.html): red
from the actual call to the planned call whatever the window (dashed green box = a window
the call came before), headline = notice given (first lined → call) when under 8 h, times
under their points plus a fixed-row table, key lists only what is drawn; the three
fold-outs kept. Test tab (`testTimelines`) shows real calls in five groups, four each.
The regular page still uses `renderCallTimeline`: swap its three callers (sleepTable,
callReviewRecord, work-call-timeline) only when he approves. Open with him: headline as
notice vs "how early"; notice counted from first lined (not from ordered). Checked here
on the 27 live days in a browser at phone width; laptop pull/restart needed to see it.

**S501 trip missing from a person / S501-CO search, fixed 2026-11-10 (owner, from the
train):** L50231 08 and L50131 08 (S501, engineer covered by SA07 = RYPA) showed on
RYPA's search but not on JUOD's. The turn's trip was saved `workedBy: SA07` and every
work list drops `workedBy` trips; S501 is two turns with one number. Now, on a shared
turn with one craft covered, `facts` (public/board-turns.js) leaves `workedBy` empty and
saves `coveredCraft` + `coveredBy` ("(EN worked by SA07)"); `worked()` and
`personHistory()` in board.html leave the trip out only for that craft (S501-EN, or a
person whose own stretch is that craft). Both crafts covered = `workedBy` as before.
Replayed on the live 7th–9th: S501-CO gets both 08 trips, S502-EN both 09 trips. Turn
history is rebuilt from the day files each publish: no FORMAT bump, no Worker change.
Laptop pull/restart pending. Two call-timeline decisions parked on the new
"Housekeeping list" in TODO.

**Call stability: new timeline is now the regular page (2026-11-10, owner: "Switch to the
new call stability layout").** `renderCallTimelineV2` replaces `renderCallTimeline` in the
three places that draw a call (callReviewRecord, the Turn History call history, the Test
preview). The old function stays in board-analytics.js only because its tests still use it.
Suite 276 of 290 (same 14 failing). Live after the laptop pull and the next publish.

**Page Health new top promoted, 2026-11-10 (owner: "Test page looks good. Push"):** the
verdict line and the code version in words are on the regular Page Health (`renderHealth`
calls `healthRows(h, now, true)`, `healthVerdict(rows)` above the table). Test is back to
"No items awaiting review." Laptop pull/restart pending; ❓ the "GitHub" row on Windows.
The note below is how it was built.

**Page Health: new top — in Test, awaiting Justin's phone review (2026-11-10, he said yes
to items 1–3 of a review):** (1) a verdict line, "All good" or "N things need you" listing
the red rows (`healthVerdict`); (2) the code version in words: "Running code" (date, commit
title, hash), "Restart needed" when the folder was pulled but the checker still runs older
code, "GitHub" = how many updates are waiting (`codeRows`; laptop: `runningCode`,
`refreshCodeBehind` in scripts/board-auto.js, a background `git fetch` at most every 30
min, `GIT_TERMINAL_PROMPT=0`; health report field `code`); (3) followed people's name
codes kept over a restart (`Health.followedCodes`, BoardChecker\subscriber-codes.json, on
the laptop and in its private backup only). The rows now come from `healthRows(h, now,
next)`; the regular Page Health calls it with next = false and looks the same. To promote:
call it with true in `renderHealth` and put `healthVerdict(rows)` above the table. Test's
call-timeline preview is gone (promoted). Checked here in a browser with made-up reports
(old laptop code, all good, four things wrong); the git fetch has only run on Linux here,
❓ confirm the "GitHub" row on the Windows laptop. Suite 278 of 292, the same 14 failing.
Other Page Health ideas offered, not built: follower table, failed alerts by who, a
warning row for OWNER_EMAIL with Access off, reorder. Real names for followers: built 2026-11-10 evening from the crew-names file (note near the
top); the three answers it waited on are no longer needed.

**Turn History, 2026-11-10 (owner, two screenshots):** (1) every 501/502 trip on his own
search read "Timeline unavailable": call records are kept per craft (`S501-CO`) and the
trip row says plain `S501`, so `matchingCallRecords` (board.html) matched nothing. It now
takes the person's craft (personHistory puts `craft` on each trip) or, for a plain S501
turn search, either craft that worked it; the opened train uses the same function. L501
trips say "Not scored: L501 home has no expected call" (by design, see the Call
stability note). Checked against the live records: L50231 04, 08 and 10 match S501-CO.
(2) The long list under an opened train is folded into "What the board showed before
this call (N)" (`callHistory`, `.boardnotes`). Laptop pull/restart pending.

**L501 home now has Call stability, 2026-11-10 (owner: "fix why 501 doesn't have the call
stability graph"):** `sleepCheck` (lib/board/insights.js) reads `garnetLineup` (saved since
4th Nov). Whoever went out on an L502 (`state.s5Home`: the regular crew by craft, a
fill-in, an MU crew's spares) is expected on the same day's L501 at order − 15 min
(`GARNET_PREP`: on duty at Garnet was 15 min before the order on every L501, 4th–9th)
− 2 h. That wait is its own: it replaces whatever Sarnia's line-up still projects for the
turn, a gap in the Garnet reads is not "taken off", and an L501 on duty with no Garnet
wait is left unscored. Replayed on the live days: all 12 crew trips on L50131 04–09
scored (04, 05, 09 on time; 06 4 h 20 m late, 07 2 h late, 08 1 h 15 m late). ❓ The
Current page's Garnet "call" is order − 2 h (15 min later than this): ask before touching.
The fold-out he asked for again was already pushed (board notes); it shows once the laptop
publishes. Rebuilt from the day files: no FORMAT bump, no Worker change.

**Call stability: a "Why" under the graph, 2026-11-10 (owner: "add reasoning ... do not
change the graph ... ie job showing spare before call time or someone coming off the
spareboard in front of you unexpectedly. Or a train or extra job showing up"):** shown for
a call over an hour early or late, or with under 8 h notice. The tracker says why at the
check each change happened (`whyFor` in `sleepCheck`, lib/board/insights.js), from that
check and the one before (`state.sleepWhy`: seats by train and craft / spare-list job, first
seen, which lists were read): the train or job is new on its list; who had the seat before
and where they are now (skipped reason, another train, called, pool status); who has the
seat they left and whether that turn was on any list before; a straight trade; the train's
own time moved. Saved as `firstWhy`, `firstTrain`, `calledWhy` on the record and `why` on
each timeline change. The page only words them (`callReasons`, `renderCallReasons`,
`.ct2-why`; first lining, a fold of the middle, the last four). Nothing is guessed: a
change with no reason is listed bare. Replayed on the live days: 459 of 612 calls get a
Why, 429 with a reason on every line. On the regular page (he asked for it directly), not
Test. Rebuilt from the day files: no FORMAT bump, no Worker change. ❓ Ask him how the
wording reads on real calls; long back-and-forth runs between pool turns are noisy.

**Toronto (Mac yard) trains had no Call stability, fixed 2026-11-10 (owner screenshot,
SD03: "Timeline unavailable" on every train from Toronto):** `sleepCheck` took `t.crew ||
t.pred` and read `.co` / `.en`; Toronto's line-up rows carry `crew` as words ("S105 +
SA03", engineer first) with the pair in `pred`, so no Toronto train was ever tracked. Now
the object form, else `pred`, else the words. Their planned call is order − 15 min − 2 h
for a train and order − 2 h for a deadhead (on duty at Toronto was 15 min before the order
on 279 of 280 trains, at the order on 46 of 49 deadheads), so it lines up with on duty − 2
h. Replayed on the live days: 399 new call records and 79 "removed"; 155 of the 215
same-train calls land within 30 min of the plan. ❓ The Current page's Toronto "call" is
order − 2 h (owner's settled rule), 15 min later than the real call: ask before touching
(same question as Garnet). Rebuilt from the day files: no FORMAT bump, no Worker change.

**Toronto notice starts at off duty, 2026-11-10 (owner: "the time the train shows in the
line up isn't necessarily how much notice the crew has. The first lined should start when
the crew goes off duty at the bunkhouse"):** in `sleepCheck`, a crew still on its way to
Toronto (line-up row with `crewExpected` and no `crewPos`) is on no wait yet; once in the
bunkhouse the wait's `firstSeen` is the later of their off duty (`s.bunkhouse[].offDuty`)
and the train first showing, marked `firstFrom: 'offDuty'`. The graph and table then say
"Off duty" / "Off duty at Toronto" where they said "First lined". Replayed on the live
days: all 349 Toronto calls start at off duty, on average 7 h 27 m later than before. Side
effects, both checked: 25 calls with no bunkhouse stay (turned straight back, e.g.
RQ13931 07) have no record now; 45 more "removed" records, Sarnia waits whose job a spare
worked that used to be carried into the Toronto prediction (e.g. SD03 DHT039C 09, EN02
went). Not done: a spare working a pool turn to Toronto gets no record for the train home
(the line-up lists the turn, the Call Board the spare). Suite 282 of 296, same 14 failing.

**A spare on a pool turn to Toronto now gets the graph for the train home, 2026-11-10
(owner: "is there a fix for this"):** `sleepCheck` keeps who is working a turn in its
holder's place from the Call Board's backfill (`state.sleepRiding`: turn → spare, ended
when the turn is seen on duty on another train with no fill-in, or after 2 days). A Toronto
line-up row for that turn opens the wait under the spare, with the turn's bunkhouse off
duty. Replayed on the live days: 59 calls gained for spares and 59 false "removed" records
gone for holders who were never there; 5 calls and 6 "removed" went the other way (a ride
remembered a little too long). Suite 283 of 297, same 14 failing.

**Current, new layout promoted, 2026-11-10 (owner: "Push this to the main current tab and
clear out the test tab"):** `sectionsGrid` uses `lineup2`, `toronto2`, `garnet2`,
`changes2` and the "Jobs going spare" heading when `mode === 'current'`; `show` uses
`strip2`. **Snapshots still draw the older layout** (same data, older functions): ask
whether to switch them too. The Toronto / Garnet call on Current is now on duty − 2 h (15
min earlier for a train): this replaces the settled "Mac yard call = order − 2 h" on that
page, approved by the push. On a phone the tab bar is one swipeable row on every tab
(`body.nav-one-row`, the open tab scrolled into view). Test is back to "No items awaiting
review." Checked in a browser on live data: Current draws 17 rows with no page errors, a
row opens, Snapshots and Analytics still draw. Laptop pull/restart pending. The note below
is how it was built.

**Current, new layout — in Test, awaiting Justin's phone review (2026-11-10; he said "do
all but don't change the main current tab ... put it in the test tab"):** the real Current
is untouched. Test → `testCurrent` (board.html) draws the newest check with `strip2`
(counts on one line), `lineup2` (one two-line row per train, `cur2Row`; tap = the same
Why), `toronto2` (same rows; position, off duty, on-the-way estimate and the skipped list
folded under Details; "How crews are picked" folded), `garnet2` + `garnetCrew` (the
501/502 turn shown away on its own board, and who is filling in, when the Garnet board
wasn't read), `changes2` and empty boxes as one grey line (`.cur2-quiet`), headings without
the CATS option numbers, and on a phone the tab bar in one swipeable row while Test is open
(`body.nav-one-row`). Toronto and Garnet calls in the preview are on duty − 2 h (`awayCall`:
order − 15 min − 2 h for a train, order − 2 h for a deadhead), 15 min earlier than Current's
order − 2 h: ❓ his settled rule, confirm before promoting. The other boxes are the real
ones; folding uses the same per-phone memory Current already has. Measured on the live
09:42 check at phone width: page 7,989 → 5,597 px, line-up 1,400 → 644 px, Toronto about
2,000 → 866 px. To promote: swap `lineup`, `toronto`, `garnet`, `changes`, `strip` in
`SECTIONS` / `show` for the `…2` versions and decide on the tab bar. Suite 283 of 297.

**Order summary new layout promoted, 2026-11-10 (owner: "My bad. Push the updates"):**
`renderOrderSummary` always ends in `orderSummary2(view, preview, all, days, labels,
target)`; the six-column table is gone. A shared link or a search still opens its train
(`preview.open` → the row opened, its group opened, scrolled to; the remembered From /
Status are not applied then, so it can't be filtered away); Share is in each train's
detail. Test is back to "No items awaiting review." Checked in a browser on live data: 20
trains in four groups, page a screen wide, `#train=Q13931-10` opens that train, no page
errors. **Worker:** nothing in this session touched `cloudflare/board-worker.js`; the live
`board` Worker serves the "one device per account" wording (commit 361e039 or later).
❓ Not verifiable from here: whether it has ee8a13a (Admins not held to one device, 8 min
later) and what `board-test` runs (this session can't reach that address). The note below
is how it was built.

**Order summary, 2026-11-10 (owner asked for a review, then "do the fix and build the
suggestions and put it in the test tab"):**
- **Fixed on the regular tab:** an opened train's detail was broken apart. `story()`
  returns a table row and was put inside a cell, so the browser threw "All recorded
  changes" and Share above the column headings. `storyBody(r)` is now the inside and
  `story` wraps it; the detail also stays a screen wide while the table scrolls sideways.
- **New layout in Test, awaiting his phone review** (`orderSummary2`, reached through
  `renderOrderSummary('test')`; regular tab otherwise unchanged): no table; each train two
  lines (`cur2Row`): plan → order → on duty and the result against the first plan; short
  status chips (`OS2_SHORT`; the careful wording he approved on the 8th stays in the
  detail and the footnote); the day in four groups that stay folded as left
  (`orderSummary2Open:*`; completed and dropped start folded); sort by time or biggest
  change; filters on one row, remembered per phone (`orderSummary2`); search that hides
  rows as you type; and each crew's Call stability graph inside the train's detail.
  Checked in a browser on the live 10th at phone width: 21 trains, no sideways scroll, no
  page errors, search and sort work. Not built: nothing from the old count tiles (removed
  at his ask 3rd Nov). To promote: call `orderSummary2` for `orders` too (it reads
  `testPreview` state and `mode !== 'test'` checks: pass the target through).

**The test site, 2026-11-10 (owner: "go, owner key only, keep the test tab for now ...
make changes to the test site only and I'll push it when you're ready"):** `board-test`
and `board` serve one bucket, so the page tells them apart itself: `PREVIEW_HOST`
(`location.hostname` starts with `board-test.`) and the owner key verified (`healthData &&
OwnerKey.has()`, set in the health handler) make `PREVIEW` true and redraw. Everywhere else
it is false. With it on (board.html):
- **Analytics** tab = the new layout (`setMode` turns `ANA2` on with `ana2.mode =
  'analytics'`; the Test tab still shows the same preview at the normal address).
- **Snapshots** = Current's short rows (`sectionsGrid` / `strip2` / `wireCurrentBoxes`).
- **Article 18.6(b)** = rows, no sideways table (`ana2Stack(view, { all: true })`).
- **"A newer version of the site is ready" bar** (`checkSiteVersion`: a HEAD of the page
  every 5 min and on coming back into view; a changed ETag shows Reload).
- **Header**: a TEST SITE chip, smaller title, no subtitle, tighter sign-up banner.
- **A search's figures** (`anaFacts2`) cut at his screenshot: no usual / earliest–latest on
  duty, no crew predicted right, no times it went spare / out of sequence.
Simulated here (the switch forced on, live data, phone width): each of the above shows; at
the normal address none do; no page errors either way. **Not checked: the real
`board-test`** (this session cannot reach it). He needs the owner key saved on that
address once (`#ownerkey=…`), and ❓ whether the Worker answers a HEAD for the page with an
ETag (if not, the bar never shows). Turn History was left as it is (its table fits a
phone). To promote any of it: replace its `PREVIEW` test with `true`. Suite 288 of 300.

**Analytics preview in Test, fourth round, 2026-11-10 (owner: "Tidy the other tiles too").
Test only.** Under a turn, person or train search the four tile grids are grouped lines
(`anaFacts2`, `.tl2`): Work (or The train), On duty and Toronto, Plan against what
happened, Between trains; label left, value right, the same figures, shorter labels, the
explanations in one note underneath. `analyticsView` picks it when `ANA2`. Checked on live
data for SD11, 148 and a name code at phone width in the iPhone style: no errors; the
regular tab still has its tiles.

**Analytics preview in Test, third round, 2026-11-10 (owner screenshot of a turn search,
SD11: "clean up the call stability area and make it more mobile friendly. Put the changes
in the test tab"). Test only.** Under a turn or person search the Call stability box is
rebuilt (`ana2SearchCalls`): one summary card for that turn (the same card as the Sarnia /
Mac yard ones), a line for waits removed and calls with a job pulled, then the calls as
short rows (`ana2CallList` / `ana2CallRows`: call time, train, planned → called, how far
off in colour; tap = the graph and Why, drawn when opened; 20 at a time). The eight-hour
baseline panel, "Changes during the original plan", the tiles and the old table fold into
"More numbers and how they are worked out". The Call stability page's "Latest calls" uses
the same rows. Checked on live data for SD11 at phone width: no errors, regular tab
unchanged. Not touched: the turn's other tiles above the box (trains worked, time on duty
…), which is what looks ragged in his screenshot in the iPhone style: ask.

**Analytics preview in Test, second round, 2026-11-10 (owner: "do all the changes in the
test tab ... separate the trains ordered out of sarnia and ... mac yard ... simplify it and
add a visual explanation ... Dont push anything thats currently in the test tab to the main
page"). Still Test only; nothing promoted.**
- **Call stability** (`ana2CallPage`): first a "Sarnia and Mac yard, apart" box, one card
  each (`ana2OriginStats`, `ana2OriginCard`): % called within 30 min of the first plan, a
  five-band bar (over 1 h early … over 1 h late), under-8-h-notice share, typical early
  call; Garnet and yard jobs counted on their own in one line. On the live 90 days:
  Sarnia 19% within 30 min of 481 calls (31% over 1 h early, 35% over 1 h late, 16% under
  8 h notice); Mac yard 54% of 435 (17% / 19%, 4%). One measure throughout, the graph's:
  actual call against the first planned call (the older eight-hour-baseline figures are
  under "More numbers"). Then "How to read the call graph": the six parts and four made-up
  calls drawn by the real code (`ana2Examples`, `renderCallTimelineV2(z, { bare: true })`),
  open until he folds it (`analytics2How`). Then the filters, "Calls by how far off the
  plan", By turn, Latest calls; the baseline groups, "Changes during the original plan"
  and the tiles fold into "More numbers".
- **My week** (`anaMyWeek2`): opens on this week; every trip's hours from the reset
  tracker's off-duty times (501/502 and yard jobs included; ~ = an estimate); two-line
  trips with the call result from Call stability and its graph and Why inside; the reset
  due on top; shortest time off between trips; one line per rest or hold; the person's
  record from `personHistory` (trains worked while filling in; a 501/502 craft someone
  else covered left out). Checked with JUOD + SR03 followed: JUOD this week 3 trips, 24 h
  20 m on duty, reset needed by 15th 0449.
Checked in a browser on live data at phone width: no page errors; the regular My week and
Call stability are unchanged. Suite 286 of 298, the same 12 failing. The note below is the
first round.

**Analytics, new layout — in Test, awaiting Justin's phone review (2026-11-10; a review of
the tab, then "do all the changes in the test tab"):** the regular Analytics tab runs the
same code with `ANA2` off. Test → `renderTest` sets `ANA2 = true` and calls
`renderAnalytics`; `setMode` turns it off again; `ana2Pass(view)` then reworks the drawn
page (board.html):
1. Call stability: "Latest calls" 20 at a time (`ANA2_PAGE`, "Show 20 more"), each call's
   graph drawn only when opened (`details.ana2-lazy`, `ANA2_CALLS`).
2. No sideways scrolling: every table becomes stacked rows on a phone (`ana2Stack`, each
   cell labelled from its column heading; summary lists show 10 rows then "Show 20 more").
   **Turns side by side is left a table on purpose** (reading across the turns is its point).
3. The explanations fold under "About these numbers".
4. Overview: each card carries its page's number; no card for Overview itself (`anaHome`).
5. Call stability filters: Called at (Sarnia / Toronto / Garnet / yard), Pool, Craft (`ana2`).
6. Assignment errors: opens on "Still observed", else "Pool sequence needs review"; the
   dropdown styled; the odd tile fills its row.
7. Controls on one row, section tabs one swipe row, dates and page remembered per phone
   (`analytics2`).
8. The two Overview tests that had failed for days were written for the dashboard the guide
   replaced: rewritten (test/board/overview.test.js). Suite 285 of 297, 12 failing.
Measured at phone width on live data, regular → preview: Call stability 27,251 → 8,175 px,
Assignment errors 12,008 → 2,226, Stale trains 6,841 → 3,988, Trains 4,398 → 4,900 (taller:
stacked rows, but nothing off the side). Call stability headline by origin: everywhere 43%
within 30 min, Toronto 53%, Sarnia 28%. **Also fixed on the regular tab:** the "Latest
calls" table still drew the old call graph (missed when the new one was promoted).
To promote: drop the `ANA2` switch (make its branches the only path) and call `ana2Pass`
from `drawAnalytics` always.

**Call stability: the same yard job again within 3 days, fixed 2026-11-10 (owner: "do the
fix and push it"):** `sleepCheck` kept its "already called" note as turn + train for 3
days; a yard job's id has no day in it, so a spare lined up for the same job again was
ignored. `doneKey` now adds the on-duty day for an id with no day (road trains as before);
the notes are pruned after 4 days. Replayed on the live days: 11 calls recovered, 5 false
"removed" records became the calls they were, B116's 9th Nov YPRS30 wait is recorded
(removed 0947 when B108 got it). Suite 286 of 298, the same 12 failing.

**Call graph: pulled jobs, moved order times, who replaced a turn — on every graph,
2026-11-10 (owner: "anything that is dropped without being called it need to be noticable
... the graph should keep going. Only do this if its in the 8 hour window"; "anytime the
order time changes ... that needs to be noted"; for a removed turn "who else is shown on
the job and why"):** not a Test preview: the tracker and `renderCallTimelineV2` changed,
so it shows wherever a call graph does.
- Tracker (`sleepCheck`): a change carries `dropped` (+ `droppedFrom`) when the turn's
  train or job is off its list, nobody is on it and it isn't on the Call Board, within 8 h
  of its call (`jobGone`, `inWindow`); with nothing replacing it, an entry of its own
  (`only`). A mark only stands if that train was never seen again by the time the wait
  ends (`settle`, `state.sleepPresent`): a train off the line-up for a check and back, or
  one that reached the Call Board a check later, is not "pulled". `orderFrom` when an
  ordered time moves. A removed wait carries `replacedBy`, `replacedWhy`, `ownStatus`
  (their own board's status then) or `jobDropped`.
- Graph: a red ✕ in a ring on the line where the job was pulled, an amber ◆ where an
  ordered time changed, each with a banner line under the headline, a key entry and a row
  in the table; a removed graph says "Now on M38261 07: SD13 (moved from RQ13931 07).
  SD01 then showed: ** goes spare". A job off the spare list reads "Job closed without a
  call" (the vacancy closing). The Why box says the same.
Replayed on the live days: 83 of 1,049 calls had a job pulled, 79 an ordered time that
moved; of 264 removed waits 187 name who took the job and 19 are the job itself going.
Suite 288 of 300, the same 12 failing. Rebuilt from the day files: no FORMAT bump, no
Worker change. ❓ His check on real calls: a renumbered train (DH27331 09 → X27331 09) reads
as pulled then lined up for the new number.

**Page Health → Who gets alerts: names beside the turns and name codes, 2026-11-10 evening (owner,
pasting the two tables: "put their names beside the turn. So the name code put their name,
and just the turns put whos currently on that turn").** This answers the "real names for
followers" question left open on 11-10. `renderHealth` in board.html, both sites (Page
Health is owner-key only; it was not put behind `PREVIEW`). Nothing new is published and
no name goes into the health report: the names come from the locked `data/crew.json`
(turn → "Last, F", the accounts session's crew-names file), opened in the browser.
- Turns table gains "On it now": the name the boards show on that turn; a plain 501/502
  turn shows both ("CO … · EN …"); "open turn" as read; "no name read" when there is none.
- People table gains "Name": the name on that person's turn when it fits the code (first
  initial + first two letters of the surname; only the initial is in the file). When the
  turn shows someone else, the one name on the boards that fits; otherwise "more than one
  fits" or "not on the names list", never a guess.
- Where the site's crew names are off (`CREW_NAMES`), Page Health opens its own copy with
  the passcode the owner key already reads for 18.6(b) (`loadHealthCrew`, `healthCrew`),
  so names in this table do not switch names on across the page. No passcode saved → the
  tables show as before with one line saying why.
Checked here with a made-up names file and report in three states (site names off, on, no
passcode): right names, no page errors. **Confirmed by Justin on the real page after his
pull, 2026-11-10 evening: "names are showing".** (That also shows the Page Health tab draws after
the tab fix; Search Review, Notifications and Members are still unconfirmed.) Suite 299 of
311.
**The main site is locked since the evening of 11-10 (page and data answer 401 without an
account).** For an hour that evening a session could not load it; the saved owner key
(top of this file) ended that the same night, for both sites.

**SA07 was sent S501's L501 alert: a stand-in remembered two days too long, fixed
2026-11-10 (owner's lock-screen picture: "SA07 time change: L50131 10 ordered for 10th
2200, expected call 10th 2000 (was 10th 2130, call 10th 1930)"; "figure out the
problem").** Traced on the saved checks: on the 8th SA07's holder worked S501's engineer
job (L50231 08 out, L50131 08 home; backfill last seen 9th 0610). Today S501's own crew
is at Garnet (L50231 10, no backfill) and SA07 sits 3rd out in the A pool at home, lined
up for Z14891 10. The fill-in memory (`fill-ins.json`, key `S501-EN → SA07`) had no way to
end but the 48 h limit: `updateFillIns` ends a trip when the job's turn is on a home board
(the key `S501-EN` never is) or the stand-in is back on a spareboard (SA07 is a pool turn).
So `turnStates` still gave the Garnet crew's L501 to SA07 too, and because that line-up is
set first, **it also hid SA07's real train (Z148) from SA07's phones.** Fix
(lib/board/fillins.js, scripts/board-auto.js): a stand-in on a shared turn (S5xx, MUxx)
now ends when that craft's row is home on the 501/502 board (`sharedHome`), when the L501
it came home on has left the Call Board, or when the job is on the Call Board on another
train with nobody standing in. Test added (alerts.test.js). **Needs the laptop to pull and
restart**; the stale entry then clears on the first check. Not seen on the laptop itself:
`fill-ins.json` is not readable from here, so the cause is from the saved checks and the
code, not from the file.
**The Garnet and Toronto call in alerts: 2 h before on duty, since 2026-11-10 (owner:
"yes move it to 2 hours 15, check toronto too").** The alert above said call 2000 for an
order of 2200 ("order − 2 h", his rule of 11-04 for Garnet and 10-29 for Toronto). Checked
on every saved day, order time against the Call Board's on duty: Garnet L501 6 of 6 on
duty 15 min before the order; Toronto trains 178 of 179 (the one at its order was a rescue
train, RM30241 01); Toronto deadheads at their order 24 of 27. So: `GARNET_CALL_MIN` is
135; `torontoCallTime(order, cfg, deadhead)` is order − prep (15 train, 0 deadhead) − 2 h,
the same sum as a Sarnia call. It feeds the alerts (lined up, time change, the reminder
before the call), "rested by its call" for an ordered Toronto train (`torontoCrews`,
`torontoSouth`), Garnet's "late" flag, and the `call` saved in each snapshot. A rescue
train out of Toronto keeps order − 2 h. Current already showed these times (`awayCall`),
so **the question "does Current's Toronto/Garnet call change stand" is answered: yes.**
Six tests that pinned the old rule were rewritten to the new one. Suite 299 of 311.

**Tabs broken for about half an hour by the commit below, fixed, 2026-11-10 (owner: "the
tabs are all messed up ... the links are wrong they lead to the wrong page").** Taking out
`if (mode === 'test') renderTest();` in `setMode` removed the head of the `else if` chain
that draws each tab, and the chain attached itself to the line above (`if (!ANA2) …`). So
only Analytics drew; every other tab left the last page on screen. It reached the live
site because the laptop had pulled. Fix: the chain starts again with `if (mode ===
'members')`. **Why the check missed it:** the simulation after the change clicked the
other tabs but only read the layout class and the address, not what was on the page.
**From now on, after any change to `setMode` or the tab bar, click every tab and read the
page's heading** (scratch script `tabs1.js` did this: all eight public tabs on both sites,
crossing Analytics three times, each showing its own page, no errors). The four owner
tabs (Page Health, Search Review, Notifications, Members) sit in the same chain but
cannot be opened here without the owner key: not checked on a real phone.

**Analytics new layout promoted, Test tab removed, 2026-11-10 (owner, from the Test tab on
the main site: "i like the assigment errors tab ... push the test tab on the main site to
the main site. then get rid of the test tab on the main site and the test site, all the
tested stuff will just goto the test site from now on, so we dont have any overlap with
the test tab and accidently overwrite something").**
- **Working rule from here on: previews go to the test site only
  (https://board-test.sarniaboard.workers.dev, behind `PREVIEW`). There is no Test tab.**
  Don't build a preview into a tab on the main site again.
- **Promoted to the main site:** everything the Test tab showed, i.e. the whole Analytics
  new layout that ran under `ANA2`: explanations folded under "About these numbers",
  stacked rows in place of sideways tables, Overview cards with numbers, Call stability by
  where the call was (cards, filters, short call rows, the yard / Sarnia / Mac yard split
  under a search), the new My week, and the simpler Assignment errors (`anaAssignments2`).
  `setMode` now sets `ANA2 = mode === 'analytics'` on both sites; the banner is gone. The
  older layout's code is still there with `ANA2` off (back out = that one line); it can be
  deleted once he has lived with this a while.
- **His first ask ("push [Assignment errors] to the board test site") needed nothing:**
  both sites run the same files from the same bucket, so the test site already had it.
- **Test tab removed from both sites:** the button, `renderTest`, its health-refresh
  redraw. An old `#test` link lands on Analytics. (`renderOrderSummary('test')` and
  `testPreview` are dead code left in place.)
- **The likely-call test moved** to Analytics → "Likely-call test", a page that exists on
  the test site only (`ANA_SECS` gets it when `PREVIEW` turns on; `likelyTest`). Same
  content; its table is kept out of `ana2Stack`.
- **Still test-site only (not promoted, he has not asked):** the likely-call window and
  habit chip on Current, My week's "Sleep this week" box, Snapshots rows, 18.6(b) rows,
  the newer-version bar, the compact header, the Turn History layout below, spareboard
  predictions (off).
- Simulated here on live data, both sites, every Analytics page plus a turn search: no
  page errors, no sideways scroll; the main site shows no Likely-call test page and no
  Test tab. Suite 292 of 304, the same 12 failing.

**Turn History, improved on the test site, 2026-11-10 (owner: "come up with improvments to
the turn history tab and push those to the test site").** Preview only, every change
behind `PREVIEW` in board.html; the regular site draws Turn History as before (checked
here on SR03, B122, S501-CO and a name code). Why it was the way it was: the page grew a
section at a time (when it goes 10-24, work history 10-25, call stability per trip 11-07,
the "what the board showed" fold 11-10), each added under the last, so where the turn
stands now ended up below the whole work history and every trip was a four-line table
cell. What changed:
1. **Now comes first**, under the turn's name (`turnPanel`, `.tn2-now`), then when it goes.
2. **Work history as short rows** (`workHistory` → `.work2`, the same table restyled so
   `wireWork` and the call graph are untouched): train, how the call went as a pill (red
   early, amber late, green as first expected), who it worked with; under it call · on
   duty · off. The newest 6 show (`WORK2_SHOW`), "Show all N trips" for the rest.
3. **The calls added up** in one line over the list (`[data-work-sum]`, filled by the
   `work-call-results` handler): e.g. SR03 "16 trips. Of 16 calls that can be compared: 2
   when first expected, 5 early, 9 late; when it moved, typically by 45 m".
4. **The board's notes fold away** ("Board notes: every change the checks saw"); on a
   person search "Turns seen on (N)" folds too.
5. **Looked up lately**: the last six turns looked up, one tap each (`boardTurnsRecent` on
   the phone; turns only, a name code is never kept, same rule as `boardTurn`).
At phone width on live data, test site vs regular: SR03 1,788 px vs 3,236; a name code
1,811 vs 3,022; no sideways scroll, no page errors. Opening a trip still draws its call
graph. Suite 292 of 304 (no automated test covers this layout).

**Where everything on the test site stands, 2026-11-10 (owner: "update the handoff file
once this is done").** Nothing below is on the main site; promote only on his say-so.
- Snapshots rows, 18.6(b) rows, the newer-version bar, the compact header, My week's sleep
  box. (The Analytics new layout itself was promoted later the same day; note above.)
- Current: train habit chip and the likely-call window on planned Sarnia trains (**on a
  two-week test, 2026-11-11 to 11-24, read under Analytics → Likely-call test; check-in booked 11-25**).
- Spareboards: predictions built but **switched off** (`SPARE_PREDICT = false`).
- Turn History: the layout above.
- Analytics → Likely-call test (the Test tab is gone from both sites; see the note above).
Laptop: he pulls and restarts after each push; `data/patterns.json` (board, drift,
predict, score, spare, lead) is written on every publish.

**Likely-call window on a two-week test, 2026-11-10 (owner: "track it for 2 weeks. Use
the data its collecting and test to see how accurate the predictions are. If its more
beneficial than the time it shows over 2 weeks maybe we can push it [to] the main site, in
the test tab on the test site, clear it out and add a way to track it").** **The test runs
2026-11-11 to 2026-11-24 (`TEST_FROM`, `TEST_DAYS` in lib/board/patterns.js); decide on
promoting the train window to the main site when it ends, not before.**
- `Patterns.score(trains)` → `score` in data/patterns.json, rebuilt from the saved days on
  every publish (no state to lose). Every planned Sarnia run (no deadheads) is scored once
  at each distance it was seen planned (`runFigures`: the middle of its hourly looks there),
  against a window built only from runs already on duty before the first of those looks
  (its own symbol with 6 runs or more, else all trains; fewer than 6 → not scored, the
  page showed no window). `test` = runs on duty in the test dates, `before` = the same
  replay over the days saved before it, `runs` = the test's trains with each check.
- Three yardsticks against the shown call: `held` (real call inside the window; `width`
  its typical size); `likely.within60` vs `shown.within60` (the window's "most often"
  time vs the call the line-up showed, with `closer` / `further` counts past a 10 min tie);
  `earlyCovered` of `early` (calls over 30 min before the shown call that the window's
  early edge allowed for). The shown call is the order − 2 h 15, the real call on duty −
  2 h, so the shown call's miss is `miss + 15` (first cut forgot the 15; fixed before push).
- The Test tab on the test site now shows this (`likelyTest` in board.html, drawn by
  `renderTest` when `PREVIEW`): day N of 14, three tiles, a one-line reading, a table by
  distance, each train so far (opens to its checks: shown call, window, held / called
  earlier / called later), the "before the test" replay, and how it is scored. The
  Analytics preview that was in Test is gone there (Analytics on the test site is already
  that layout). **On the main site the Test tab is unchanged.**
- The replay over the 26 saved days (207 trains, 896 checks): the window held 78% (a
  typical 4.3 h wide); the "most often" time within an hour 54% vs the shown call 49%
  (374 checks closer, 233 further); 126 of 154 early calls covered. By distance the single
  time helps most 6–16 h out (55% vs 48%, 51% vs 43%) and not at all under 3 h (66% vs 66%).
  So the case for promoting rests on the window and the early calls, not on a better
  single time. This is lower than the 81% in the note below because that one tested each
  run against all the others, later ones included.
- Simulated here on live data (today: "Starts Nov 11" + the replay; with the start moved
  back a week to see it filled: 68 trains, no page errors, no sideways scroll). Suite 292
  of 304, the same 12 failing. A check-in is scheduled for 2026-11-25 to read the result.

**Spareboard predictions switched off, 2026-11-10 (owner: "take the working predictions
off the spareboard for now").** `SPARE_PREDICT = false` in board.html: neither the "likely
call … · held X of N" line (`spareCall`) nor the older "typically works in …" line
(`boardOdds`) shows on a spareboard, on the test site or anywhere. The code and the figures
in data/patterns.json (`board`, `spare`) are kept; set it to `true` to bring both back. The
likely-call window on the line-up's trains is untouched. He gave no reason; don't turn it
back on unless he asks.

**Assignment errors, simpler on the test site, 2026-11-10 (owner: "clean up the assignment
errors tab in the test site, make it simpler to read. push the changes to the test
site").** Preview only: `anaAssignments2` in board.html, used when `ANA2` is on; the
regular tab still draws `anaAssignments` (checked here: unchanged). Why it was the way it
was: the 2026-11-07 merge of Out of sequence + CATS errors reused the three old pages
inside every opened train, so each train repeated the page's explanation and a row of
tiles, and the 2026-11-08 audit wording ("Final pool sequence correct", "Outcome unknown")
went on screen as written. The audit's rules are kept (`reviewedPoolOutcome`,
`assignmentStatus` decide every outcome; nothing is deduplicated; grouping is still train
+ observation month); only the reading changed:
- One short row a train: symbol, on duty, which checks flagged it, an outcome chip each.
- Five plain outcomes in place of eight (`AE2`): Showing now (Still observed), Needs a
  look (Observed at departure, Pool sequence needs review), Can't tell (Outcome unknown,
  Final crew unverified), Stopped showing (Cleared), Fine in the end (Final pool sequence
  correct). Filter chips with counts replace the dropdown and the five tiles; it opens on
  Showing now, else Needs a look, else All (`ana2.ae`).
- Opened: one card a finding (Wrong pool / CATS listed the wrong turn / Spare job missing
  from CATS), a few labelled lines and one sentence for how it ended. Snapshot times and
  turns are still tappable.
- The explanation is given once, under "About these numbers".
On live data at phone width, last 90 days: 142 trains; 14 need a look, 31 can't tell, 66
stopped showing, 73 fine in the end; the page opens 1,720 px tall (was 2,158) and an opened
train is about a screen (was several). No page errors in dark or light. Suite 291 of 303.
Not changed: TODO 21's open audit points (month-boundary identity; "cleared" is not proof).

**Likely-call window for spares, test site, 2026-11-10 (owner: "can you do the same for
the spareboard. Push changes to the test site").** `Patterns.collect` now also keeps one
look an hour for each spare over both of its boards (`state.spares`: craft, turn, the
better of its two places among the available turns, and the job the site showed beside it
with its call); a resting spare counts when a job shows beside it. `spareCalls` matches
each look to the next time that turn was on duty within 3 days (call = on duty − 2 h) and
writes `spare` into data/patterns.json, one figure a wait, 6 waits or more, same stat shape
as `predict`: `job` = real call less the call shown, keyed `Conductor|yard|3-6` (craft,
yard job or train, how far ahead the shown call was) plus `yard|3-6` without the craft as
the fallback; `wait` = minutes from the look to the call for an available spare with
nothing showing, keyed `Conductor|4th–5th`, with `in8` (share called within 8 h). On the
test site each spare row gets a line under the turn, "likely call 10th 2130 – 11th 0505 ·
held 27 of 56", that opens to the full sentence (`spareCall`, `sparePlace` in board.html;
it replaces the "typically works in" line, which stays as the fallback when the file has
no `spare`). What the 26 live days say, and why the window differs from the trains': a
yard job showing is steady (0–3 h ahead: 90 of 100 inside a window 1.3 h wide); a train
showing is not (the spare got that train only 43% of the time; the near-certain window is
20–60 h wide, the middle half 2–8 h, and from 10 h or more out the call usually comes
earlier, on another job); nothing showing runs from a typical 7.7 h (1st out, 54% within
8 h) to 34.5 h (9th or more, 2%). So the page shows the near-certain window (5th–95th)
only while what is left of it after now is 6 h or less, and otherwise the middle-half
window, and "held X of N" says which: about 87% for the first, about half for the second.
Green = an hour wide or less and held 8 in 10. The same turn shows the same window on the
fast and the slow board. Simulated here on live data, no page errors; not seen on the real
board-test until the laptop pulls and publishes. Suite 291 of 303 (the same 12 failing).
Not tried: a model that counts the yard shifts ahead of a spare instead of hours.

**Likely-call window built on the test site, 2026-11-10 (owner: "Build it on the test
site").** `Patterns.predict(trains)` (lib/board/patterns.js) goes into data/patterns.json
as `predict: { trains: { M396: { '6-10': { n, mid, lo, hi, likelyLo, likelyHi, held,
likelyHeld } } }, all: {…} }`: per train (letters + number) and per distance of the shown
time (`awayOf`: past, 0-3, 3-6, 6-10, 10-16, 16-24, 24+ h), the gap between the shown time
while still planned and the real on-duty time, one figure a run, 6 runs or more. The wide
window is the 5th–95th of those; `held` is how many runs fell inside when each was checked
against the others (81% over all trains and distances on the live days; the middle-half
window 54%). On the test site each planned Sarnia row shows "likely call 11th 0450–0915 ·
held 19 of 24" (`likelyCall` in board.html; green when the window is an hour or less;
"(all trains)" when the train has too few runs of its own), with the full sentence on
opening the row. Ordered trains and deadheads show nothing. Call = shown order + gap − 2 h.
Simulated here on live data: no page errors. Suite 290 of 302. The note below is the
backtest that came first.

**Call-time prediction, backtested, not built (2026-11-10; owner: "are you able to make a
prediction on when trains will be called based on historical data ... on the current tab
... with an indication of accuracy").** Method tried: at any look, the shown on-duty time
plus what that train (letters + number), at that distance and status, did from there on
its other runs; each run tested against the rest (4,976 hourly looks, 218 Sarnia trains).
A single predicted time barely beats the shown one (within 1 h: 36 → 41% at 16–24 h, 39 →
42% at 10–16 h, 45 → 51% at 6–10 h, 46 → 63% in the last 3 h). A window is the useful
form: half of calls landed in a window about 2.8 h wide at 16–24 h, 2.2 h at 10–16 h, 1.4 h
at 6–10 h; the "8 in 10" window (6.0 / 4.5 / 3.2 h wide) held 69–75% of the time, a little
under its name with only 17–25 runs a train. Trains differ a lot at 10–16 h out: A424 8 in
10 between 30 min early and on time; Z148 1.7–5.5 h later; M396 0.7 h early to 4.3 h later;
E278 1.6–12.8 h later. Once ordered the shown time is right (93% within an hour). Offered:
a "likely" window per train on the test site that scores itself as trains go.

**Patterns on the test site, and two tracker fixes, 2026-11-10 (owner: "Push this to the
test site"; then, from board-test on his phone: separate yard / Sarnia / Mac yard under a
search, and "502 got messed up ... the train goes every day it doesn't get removed").**
The test site works on the real board-test address (his screenshot).
- **`lib/board/patterns.js` → `data/patterns.json`** (site.js builds it every publish from
  all the day files; unused at the normal address): `board` (an available spare's place on
  a spareboard → time until on duty), `drift` (a Sarnia train number against its first
  plan), `lead` (how wrong the shown time is by how far out). test/board/patterns.test.js.
- **Test site only** (`PATTERNS`, loaded when `PREVIEW` turns on): Current's spareboards
  say under each available turn "typically works in 5 h · 78% within 8 h" (`boardOdds`);
  line-up rows carry a habit chip ("usually +2.8 h", "holds its plan") and, opened, "How
  this train has gone" with the trust-by-lead note (`trainHabit`, `planTrust`); My week has
  "Sleep this week" (lost to early calls, waiting on late ones, calls 0000–0459, night
  calls in a row, under 8 h notice, shortest time off before a call, on-duty range).
  Not built: the spare-job alert (alerts are sent by the laptop, so it can't be test-only).
- **Under a turn or person search** the Call stability box has a card each for trains
  ordered out of Sarnia, out of Mac yard, yard jobs and Garnet (`ana2SearchCalls`,
  `ana2.originOf`).
- **Tracker fixes (every tab, after the next publish):** (1) a turn the line-up shows going
  spare for a train is no longer lined up for it, so a day off is not a "removed from the
  line-up"; (2) on 501/502, a train that goes with the other crew's number or a make-up
  crew drops the wait silently: the line-up had the wrong crew, nobody was removed;
  (3) a person search takes only their craft's records on 501/502 (each trip showed twice).
  Replayed on the live days: removed waits 264 → 220; S501-CO has no removals left
  (S502-CO keeps two, both a spare covering the conductor). About 22 calls no longer have a
  record: turns marked going spare that went anyway.
Simulated here with the patterns file and the fixed records: no page errors. Suite 290 of
302, the same 12 failing.

**Data study, 2026-11-10 (owner: "look up different things that would be useful to track
especially ... sleep ... the spareboard. Examine all the data ... find patterns or ways to
predict line ups"). Nothing built; 26 live days (16 Oct – 10 Nov), about 1,060 calls.**
Findings he was given (worked out in a scratch session from the day files, trains.json,
resets.json and a replay of `sleepCheck`):
- Sarnia plans drift late: on duty against the first plan, median +1.0 h; 57% more than
  30 min later, 18% earlier. By train number (n ≥ 19): x278 +6.3 h (95% later), x396 +2.8 h,
  x148 +1.8 h, x382 +1.3 h, x394 +0.9 h, x302 +0.3 h, x424 on time (84% within 30 min), x502
  about 1 h 15 m EARLIER every time (planned 0400, on duty 0245). Toronto: median 0.
  Adding a train's usual drift to its plan helps only a little (within 1 h: 41% → 47%).
- The time shown, by how far out: 16–24 h before on duty it is 2 h+ off 40% of the time;
  6–8 h, 17%; 3–4 h, 11%; 2–3 h, 9%. ORD is first seen a median 2.3 h before on duty and
  then holds (93% within 30 min): it is the call, not a warning.
- Crew prediction 8 h out is right 34% (conductor and engineer alike); at the last check
  82% / 80%. The spare expected to fill a job was the one 57% of 54.
- Spareboard, first available turn: conductor fast board on duty in a median 5.0 h (78%
  within 8 h); 2nd 8.0 h; 3rd 10.5 h; 4–5th 14.7 h; 6–8th 21.5 h (8% within 8 h). Engineer
  boards are far slower: 1st 8.3 h, 2nd 19.6 h (14% within 8 h), 3rd 32 h.
- Spare jobs show a median 11.8 h (yard) / 7.1 h (road) before they start; a quarter under
  4 h, 3–4% under 2 h. Yard starts going spare most: 1600, 0800, 2359, 1500/1445.
- Notice: pool from Sarnia median 20.4 h (9% under 8 h); from Toronto 10.1 h; spare on a
  road job 9.1 h (35% under 8 h); spare on a yard job 5.7 h (62% under 8 h, 24% under 2 h).
- 36% of Sarnia pool calls land 0000–0459. 23% of calls come within 10 h of going off
  duty, about 40% within 12 h.
Ideas offered, awaiting his pick: odds of working by board position; a train's usual
drift beside its time; a confidence note by how far out; weekly sleep figures (lost to
early calls, waiting on late ones, night calls, shortest time off, short notice).
Weekday patterns are too thin to trust yet (3–4 of each weekday).

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

**November 9, later session — site accounts (history).** Justin wants the site visible only to approved people. Cloudflare Access was tried on a new test Worker `board-test` (https://board-test.sarniaboard.workers.dev, same code and bucket as `board`) and dropped (free plan stops at 50 people). Built instead: accounts inside the Worker — read [ACCOUNTS.md](docs/board-checker/ACCOUNTS.md). Sign-up = name, email, PIN (CN employee number), hire date, email confirmed by a code; the page and emails must stay non-descript (no Sarnia, no CN: Justin's ask); Justin approves each by eye on `/account` (owner key); locked by the `LOCK=on` variable. State when this session ended:

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

**S5 correction, 2026-11-07 (supersedes earlier daily-anchor fix) — ITSELF SUPERSEDED 2026-11-13 by the
owner's one-day-each rule (section 5; top of this file):** the first
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

- **501/502: L502 goes to S501 and S502 one day each** (owner, 2026-11-13: "Whatever turn worked 502 this
  morning can not work it next. The rotation goes s501, then s502, then s501"; "They rotate every day. If
  he's on rest and his job goes out he waits till the next time his turn goes out in two days"; "It's a very
  simple rule that keeps getting messed up"). A day whose L502 went all MU is still that crew's day. A crew
  member who can't go (rest, hold, PL, away) is spare for his own craft only and waits for his turn's next
  day. **Option 29's position, rest and MU never decide whose day it is.** Supersedes the 2026-11-07 "first
  regular turn on option 29 is next" and the 2026-10-25 "first crew up on 29" readings (engine.js s5TurnOn).
- **501/502, his answers the same morning:** a cancelled L502 still uses up its day ("it goes by the day, if
  they cancel it the crew that is supposed to work gets paid to stay at home"). The crew coming home on L501 is
  lined up for the next L502, and **neither craft is shown spare until it ties up in Sarnia**; then its booked
  rest decides ("make sure not to show it spare untill the crew ties up and then you can see if they booked
  rest past it"). At Garnet or on L501: "known once off duty", each craft on its own row.

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
  Mac yard call = order − 2 h; Sarnia = order − 15 min prep − 2 h. (2026-11-10:
  Current and Call stability show the Toronto and Garnet call as on duty − 2 h,
  order − 15 min − 2 h for a train; the engine's crew pick still uses order − 2 h.)
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
