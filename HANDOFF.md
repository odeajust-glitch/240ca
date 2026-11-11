# HANDOFF — read this before doing anything

## Current handoff — November 9, 2026

Start with the [November 9 continuation](docs/board-checker/HANDOFF-2026-11-08-SESSION.md#november-9-continuation). Reviewed application commit `e59a88c2cec09a861ab5bf14024db81adfda0c40` on `claude/vigilant-planck-zawrj4`. The branch includes the approved S5, Assignment errors, Current box memory, Call stability and sequence-notification changes. Test has no pending previews (the pool filter was promoted 2026-11-09, see below). Page Health went directly to the regular page at Justin’s request.

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

**Yard job names: whose job it is — on the test site only, awaiting Justin, 2026-11-10 late
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
    MAR1, which MARI's second already has: ❓ tell him, ask if he wants another). Who is
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

- **Job postings (jobs up for bid): BUILT 2026-11-11 16:20 from his three photos, on the
  test site only. NOT YET RUN AGAINST REAL CATS: needs the laptop to pull and restart,
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
  - **Every tab clicked on both sites with this page, 16:40:** 13 on the test site (with
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
  - **Next, on his word only:** alert options (a new posting; a posting closing soon;
    per craft). Not built.
  - The laptop was on `1402ef9` at 16:00 (`fc88224` and this not pulled yet).

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
  likely-call test. Both can read the live files now (the saved owner key, above).
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
