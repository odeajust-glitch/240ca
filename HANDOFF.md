# HANDOFF — read this before doing anything

## Current handoff — November 9, 2026

Start with the [November 9 continuation](docs/board-checker/HANDOFF-2026-11-08-SESSION.md#november-9-continuation). Reviewed application commit `e59a88c2cec09a861ab5bf14024db81adfda0c40` on `claude/vigilant-planck-zawrj4`. The branch includes the approved S5, Assignment errors, Current box memory, Call stability and sequence-notification changes. Test has no pending previews (the pool filter was promoted 2026-11-09, see below). Page Health went directly to the regular page at Justin’s request.

**Game Boy, The Simpsons, Windows 95, Teletext and Tron page styles; Settings list
grouped, 2026-11-10 evening (owner picked them from a list of ideas):** five more choices
(`data-theme` `gameboy`, `simpsons`, `win95`, `teletext`, `tron` in `public/board.html`),
the look only. Game Boy: four greens, pixel headings. Simpsons: yellow top band, sky-blue
page, white round panels with black outlines, round letters (`ui-rounded` on an iPhone).
Windows 95: teal page, grey bevelled windows with navy title bars, buttons that sink when
picked. Teletext: black with the eight pure colours, blue bars with yellow headings. Tron:
near-black with glowing cyan outlines and a faint grid. That makes 20 styles, so the list
in ⚙ Settings is now in five groups (Everyday, CATS, Old screens, Games, Films and shows:
`.stygroup`) and the Settings box scrolls inside the screen. ⚠ When adding a style that
changes the gap between the tabs, check Current and Turn History still share the first
row (they are `calc(50% - 3px)` wide, so a gap over 6px breaks it). Checked at phone
width on sample data like the others. Laptop pull/restart/publish pending.

**Minecraft and Naruto page styles, 2026-11-10 evening (owner: "make a minecraft theme and
a Naruto theme"):** two more choices (`data-theme` `minecraft`, `naruto` in
`public/board.html`), the look only (no blocks, characters, symbols or logos).
Minecraft: dirt-brown page, light grey bevelled panels, grey stone buttons with white
shadowed pixel letters, grass green headings and picked thing. Naruto: orange top band,
white comic panels with a thick black outline and hard drop shadow, heavy slanted
capitals (Barlow Condensed), the open tab black with orange letters, black day bars.
Checked at phone width on sample data like the others. Laptop pull/restart/publish
pending.

**Zelda page style, 2026-11-10 evening (owner: "make a zelda theme"):** one more choice,
`data-theme="zelda"` in `public/board.html`, the look only (no characters, symbols or
logos): deep green page, parchment sheets with a gold edge, gold pixel headings (Press
Start 2P, as Mario and Pokémon), the picked thing gold with green letters, green day
bars. Checked at phone width on sample data like the three below; same ❓ about the pixel
digits. Laptop pull/restart/publish pending.

**Star Wars, Super Mario and Pokémon page styles, 2026-11-10 evening (owner: "make a star
wars theme", then "OG Super Mario Brothers and Pokemon"):** three more choices in ⚙
Settings (`data-theme` `starwars`, `mario`, `pokemon` in `public/board.html`), each the
look only: no logos, characters, sprites or lettering from the films or games.
Star Wars: black with faint stars (a repeating tile on `body`), crawl yellow data, pale
blue labels and links, sabre green / red for ordered / late. Super Mario: sky-blue page,
black panels, brick-orange headings and tabs with black edges, question-block yellow for
the picked thing, green day bars. Pokémon: cream page, white text boxes with a thick dark
double edge, red top band with a yellow title, yellow-and-blue for the picked thing.
Mario and Pokémon use the pixel font Press Start 2P for headings and times (added to the
Google Fonts link; a phone only downloads it when one of those styles is on). Checked at
phone width on sample data: Current drawn, the other main views opened with no sideways
scroll or script errors. ❓ The pixel digits (0, 6, 8) are harder to tell apart than the
normal ones: ask him how the times read on his phone. Laptop pull/restart/publish pending.

**Fallout page style, 2026-11-10 evening (owner: "make a fallout theme"):** a ninth choice,
`data-theme="fallout"` in `public/board.html`: the game's terminal look only (no art, no
logos). Green-black page, one mint green, tall narrow capitals (Barlow Condensed), faint
scan lines over the page (`body::after`, taps pass through), the picked thing a solid
green bar, 2px square frames, yellow and red unchanged. Opt-in per phone. Checked at
phone width on sample data, Current only. Laptop pull/restart/publish pending.

**Matrix page style, 2026-11-10 evening (owner: "make a matrix theme"):** an eighth choice,
`data-theme="matrix"` in `public/board.html`: black page, fixed-width green letters, a
glow on headings and big times, pale green for anything tapped, yellow and red unchanged,
"ordered" in bright pale green. Opt-in per phone. Checked at phone width on sample data,
Current only. Laptop pull/restart/publish pending.

**iPhone Light page style, 2026-11-10 evening (owner: "add an iphone theme that is light as
well"; his phone is set dark, so iPhone always drew dark for him):** a seventh choice,
saved as `boardTheme = iphonelight`. It is the iPhone style with `data-shade="light"` on
the page, which switches off that style's dark block (`:not([data-shade="light"])` in
`public/board.html`); "iPhone" still goes light or dark with the phone (its swatch is now
half and half). Checked on a dark and a light phone setting, and switching between
styles. Laptop pull/restart/publish pending.

**Pool buttons two to a row, 2026-11-10 evening (owner, after a sample: "looks good, push
it"):** on a phone the Pools at Sarnia filter buttons sit two to a row in his order: A
pool, S1 / B pool, S3 / Chain Gang, Drags / 501/502, All (`POOL_SPOTS`, `poolSpot` and the
`--o` order on each button in `public/board.html`; a pool not named comes after 501/502).
Then ("make the boards open in the same order as the buttons"): the boards under them
open in that order too, and the button order now holds on a computer as well (one order
everywhere; a computer keeps its single line of buttons). Laptop pull/restart/publish pending.

**Tab bar on a phone wraps again, 2026-11-10 evening (owner, screenshot from his phone:
"fix the tabs at the top so they don't run off the screen"):** the one swipe row promoted
that morning cut a tab in half at the edge ("Article 1…"). Now the tabs wrap into as many
rows as they need (three on his phone), each row filled edge to edge, and the bar uses the
48px the top bar keeps for the gear (`body.nav-one-row .modes` in `public/board.html`; the
class kept its name, the scroll-into-view line is gone). Then, from a second
screenshot: "Make current and turn history take up the first row": those two are half the
row each, the rest wrap under them. **This supersedes "one swipeable
row" in the notes below.** Measured in all six styles at phone width: no tab past the
edge, nothing to scroll. Laptop pull/restart/publish pending.

**Page styles pushed to the laptop's branch, 2026-11-10 (owner: "Push them all to the real
site"):** `ccr-2f227f1e-8taof0` (Retro second pass, Retro Tablet second pass, Departure
Board; iPhone was already here) was merged with `claude/vigilant-planck-zawrj4` and pushed
to it as a fast-forward. The "pushed to ccr-… only" caveats in the notes below no longer
hold. Checked after the merge: all four styles load and Current / Turn History / Order
summary / Analytics open at phone width with no script errors; 289 of 301 tests, the same
12 failing as the branch before the merge. **Laptop pull/restart/publish pending.**

**iPhone page style, 2026-11-10 (owner: "Add a iPhone theme to the board checker website"):**
a fifth choice in ⚙ Settings → Page style, `data-theme="iphone"` in `public/board.html`
(the block at the end of the style sheet): Apple's system font and colours, rounded cards
with no outline, the views as a segmented control, blue for anything tapped; light or dark
goes with the phone. Opt-in per phone (`boardTheme`), nobody's page changes until they
pick it. Checked here in a phone-sized and a desktop browser on sample data, light and
dark (Current only); not yet seen on a real iPhone. ⚠ Pushed to **`ccr-2f227f1e-8taof0`**
only (the branch this cloud session was given, fast-forwarded to
`claude/vigilant-planck-zawrj4` at 8123afc + this one commit): the laptop's branch does
not have it until it is merged there. Not done: the Worker's sign-in page and
grievance.html only know light/dark, so with iPhone picked they show light.

**Departure Board page style, 2026-11-10 (owner liked both retro passes, then: "make up
one more theme that would be popular"):** a sixth choice in ⚙ Settings,
`data-theme="board"` in `public/board.html` (block near the end of the style sheet): a
station departure board. True black, amber fixed-width letters (IBM Plex Mono, already
loaded), white headings and links, big times with a slight glow, green / red kept. Opt-in
per phone. Checked here at phone width, Current only. Same branch caveat as below.
❓ Waiting on him: does he like it.

**Retro Tablet page style, second pass, 2026-11-10 (owner, two photos of GLINK on the
company phone: main menu and Call Board):** in `public/board.html` ("Retro Tablet, second
pass" block near the end of the style sheet). Colours read from the photos (a camera, so
near, not exact): data pale blue-white #d9ecfa, menu choices / links sky blue #18c1ff
(was a greener #3fe0d8), labels blue #2b8fff, title a pale blue bar with blue letters,
views as pale blue rounded PF keys, the current one sky blue. One weight, capitals, no
cyan bars across the section headings, pool letters plain. Green / yellow / red left as
they were. A third photo (Pool Maintenance Inquiry) then added: each sheet's title in a pale bar,
column headings as sky-blue bars with blue letters, table rows sky blue with only the
turn pale. Checked here at phone width with the real Barlow Condensed font, Current only.
Same branch caveat as below. ❓ Waiting on him: do both match.

**Retro page style, second pass, 2026-11-10 (owner: "2 themes already on the site that
don't match how I want", then four screenshots of CATS in Chrome on his phone, "Here is
one"):** the colours were already right to the pixel (#f1f1f1, #000000, #000080, #800000,
#ffff00, white fields with black edges). Changed in `public/board.html` (the "Retro,
second pass" block near the end of the style sheet): one thin weight (no bold anywhere),
capitals with wide spacing, smaller headings, no frames round the sheets (a faint line
between rows kept), views as maroon menu words with the current one black on yellow,
pressable things as white boxes with black edges, pool letters as plain coloured letters.
Sentences meant to be read (reasons, notes, agreement answers) keep small letters.
Checked here at phone width on sample data, Current only; the sandbox has no Courier New,
so the real phone will draw thinner letters. Same branch caveat as the iPhone style
below. ❓ Waiting on him: does it match, and samples for the second one (Retro Tablet,
presumably).

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
warning row for OWNER_EMAIL with Access off, reorder. Real names for followers wait on
three answers (capture names for everyone each check; OWNER_EMAIL deleted on `board`;
layout).

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
  two-week test, 2026-11-11 to 11-24, read in the Test tab; check-in booked 11-25**).
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

**THE MAIN SITE IS LOCKED (members only) since about 19:00 Toronto, 2026-11-10:** Justin added `LOCK` = `on` on `board`; a private window goes to the sign-in page. Undo = delete that variable. The reminder notice went to all 33 phones with alerts at 18:30 (`node scripts/announce.js`). Crew names: he means to set `CREW_NAMES` = `on` on `board` once the test site's names look right (SA05 → Allen; 501/502 rows). `MAIL_DAY_MAX` is raised on `board` (lower it again about 2026-11-13). The paragraph below is the state a few hours earlier.

**Site accounts — state at 2026-11-10 16:30 Toronto, read this first.** Live on `board` (unlocked, sign-up banner showing via `SIGNUP_NOTICE=on`) and `board-test` (locked). **Justin plans to lock the main site at 19:00 today** by adding the variable `LOCK` = `on` on `board`; undo = delete it. Before that he must paste Worker `191dd06` or newer into both Workers (copy page below) and pull + restart the laptop. Rules in force: sign-in lasts until 30 days without a visit; one device per member, Admins exempt; 20 codes a day per email; 70 account emails a day (the tight spot on lock night: each sign-in on another device or browser costs one, each sign-up two); 40 sign-ups a day per internet address. Members tab shows Waiting / Admins / Members and each member's followed turns (phones stamped when they save alerts while signed in). **To do on or after 2026-11-13: have Justin delete the `MAIL_DAY_MAX` variable on `board` and `board-test`** (he raised the email limit for lock night and asked to be reminded to lower it in 3 days; a reminder is scheduled into the accounts session). **Alerts and the lock (Justin, 2026-11-10):** alerts still go to phones that never made an account (the laptop sends them, the lock only guards pages). Step 1, built: a signed-in member's phone is matched to their account when they open the board (`/push/claim`, `account` in the phone's `subs/` file; it copies the alerts back untouched). **Step 2, NOT built, due after a week's grace (about 2026-11-17, on Justin's say-so):** the laptop skips phones with no approved member's account and stops alerts on Remove access — a change to how the checker sends alerts, so agree it with the board/checker session; first check the Members tab's "phones get alerts without a known member" count has shrunk. **Note for the board/checker session, 2026-11-10 18:15:** `Mac yard: a crew on rest at the call is skipped and keeps its place` fails on this branch since `0c75432` (not from the accounts work; 370 others pass).

**Crew names on the board, built for the test site 2026-11-10 (accounts session, at Justin's word: "build the whole thing"):** read ACCOUNTS.md "Crew names on the board". Touches the board/checker session's files in small marked places: `lib/board/names.js` (`recordNames` keeps `crafts`; new `shortName`, `namesByTurn`), `lib/board/site.js` (writes `data/crew.json`), `board.html` (`CREW`, `crewTag`, `crewIn` at `markTurn`, one `crewTag` in `poolBody` and in the test-site turn panel, `loadCrew` by `showHealth`). No longer tied to `PREVIEW` (Justin, 18:15: "I want anyone with access to be able to see them" on the main site after the lock): any signed-in approved member sees them on a site whose Worker has `CREW_NAMES=on`; he plans to set that on `board` after 19:00. Names now come first from the pool and spareboard screens (`screens.js` `parseBoardCrew`, `names.js` `recordBoardCrew`, two lines in `board-auto.js` at `learn` and where names.json is saved; wrapped so a failure can't stop a check). Needs: Worker paste, `CREW_NAMES=on` on `board-test` only, the crew names passcode saved on Page Health, laptop pull + restart. Not on the main site; no names in alerts (his rule until the alerts grace period ends, about 2026-11-17). Still open: `OWNER_EMAIL` header issue below; hash links are dropped on the way through sign-in; an iPhone home-screen app is a separate "device" from Safari. The paragraphs below are the history.

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
