# Board checker → RailroadTracker (shift tracker) — Plan

Status: **Phase 2 alerts built (2026-10-17), not switched on**. Owner chose: show
"when I go"; alert when lined up in Sarnia, when ordered, and when on-duty moves ≥ 30 min · Owner: odeajust (Justin)
Repos: this one (`240ca`, branch `claude/vigilant-planck-zawrj4`) and
`odeajust-glitch/RailroadTracker` (Android: Kotlin, Compose, Room).
Read [HANDOFF.md](../../HANDOFF.md) first.

## Goal

What each laptop check finds should show up in the phone app on its own, without
anyone re-typing it: when the owner goes, the Chain Gang board, the line-up, and what
changed. Later, the app should be able to **start a shift pre-filled** from it.

## What already exists (built 2026-10-15, never switched on)

```
 laptop                         Render (240ca server)               phone (RailroadTracker)
 board-auto.js ── POST ───────▶ /api/board          ◀── GET ────── AutoCheckWorker (every 15 min)
 every 5 min    Bearer BOARD_KEY  keeps newest check    Bearer key   Board tab + "When you go changed"
                                  ($ANALYTICS_DIR/board-latest.json)   notification
```

- **240ca:** `lib/board/relay.js` + `server.js` routes; `scripts/board-auto.js` pushes
  when `.env` has `BOARD_RELAY_URL` + `BOARD_KEY`. Payload:
  `{checkedAt, me[], report, changes[], myAnswerChanged}`. All plain text lines.
- **RailroadTracker branch `board-relay`** (not merged, not installed): `ui/board/`
  (BoardScreen, AutoCheck, AutoCheckWorker), address + key in `BoardReaderSettings`
  (encrypted, excluded from backup), `POST_NOTIFICATIONS`, WorkManager 2.9.1. No Room
  schema change. Tested on the emulator only.
- **Owner's decisions (2026-10-15), still in force unless they change them:**
  1. Auto checks stay **separate from the evidence log**: own Board tab, never written to
     `lineup_snapshots`. The Lineup tab keeps only checks he read himself (for the
     Transport Canada complaint: DRPR 6.6 / 7.2).
  2. Delivery is by a **relay on Render**.

## Blockers found 2026-10-17

1. **The relay is not on `main`.** Render deploys `main` (probably; confirm in its
   dashboard). `main` is 93 commits / ~6,800 lines behind this branch: the whole board
   checker. Merging is safe in principle (routes 404 without `BOARD_KEY`; the
   checker's scripts only run on the laptop), but **`express.static('public')` would also
   publish `board.html` + `board-sample.json` on the agreement-search site**. Either
   accept that (the Netlify site is public anyway), or exclude the board files from the
   static route as part of the merge.
2. Nothing on the phone yet: `board-relay` must be installed **with the backup procedure**
   (RailroadTracker handoff §6). Debug build only, `adb install -r`; never
   `connectedAndroidTest`.

## Phases

### Phase 1: switch on what's built (no new features)
1. 240ca: open a PR `claude/vigilant-planck-zawrj4` → `main`. Decide on the
   static-files point above. Merge it, then set `BOARD_KEY` (long random) on Render.
2. Laptop `BoardChecker\.env`: `BOARD_RELAY_URL=https://<app>.onrender.com` and the same
   `BOARD_KEY`. Check the console says "Sent to your phone."
3. Smoke test from anywhere: `curl -H "Authorization: Bearer $KEY" https://<app>/api/board/latest`.
4. Phone: back up, install `board-relay`, Board tab → Set up → address + key, allow
   notifications. Re-count shifts / watches / checks after install.
5. Merge `board-relay` into RailroadTracker `main` once he's happy with it.

**Done when:** a check on the laptop shows on the phone's Board tab within 15 min, and a
changed "when you go" raises one notification.

### Phase 2: structured data, not just text
Today the phone gets sentences. Anything smarter (countdowns, pre-filled shifts) needs
fields. Add an optional `mine` object to the payload, built from `result.me` in
`board-auto.js`. Old app builds ignore it.

```json
"mine": {
  "turn": "SR03",
  "state": "assigned | waiting | comingHome | notFound",
  "train": "M30241 17", "deadhead": false, "status": "PLN | ORD",
  "callAt": "2026-10-17T13:30:00-04:00", "onDutyAt": "2026-10-17T15:30:00-04:00",
  "ahead": ["SR07", "SR01"], "myRestUntil": null, "lineupEnd": "…"
}
```

- 240ca: extend `validateCheck` (types, length caps) and add tests. Keep `me[]` text as is.
- App: parse `mine` in `AutoCheck.kt`; Board tab shows a big "Called ~13:30 · on duty 15:30
  · M30241 (planned)" card with a countdown to the call.
- Smarter alerts: notify on `status` PLN→ORD for his train, and on his train or on-duty
  time changing by more than N minutes. That's quieter than today's "any text change"
  rule, which also fires when only the line-up's end time moves.

### Phase 3: into the shift tracker itself
- **"Start shift from board"** button on the Board tab (and on the ORD notification):
  opens the existing `StartShiftDialog` pre-filled with `assignmentId` = train symbol and
  `onDutyTime` = projected on-duty. **He confirms; nothing is saved automatically.**
  The shift is his own record, as now; the board only fills the form.
- Optional: stamp the shift's notes "pre-filled from auto board check <time>", for
  honesty, the way the evidence log stamps corrections.
- **Rest planning:** when he's `waiting`, show the earliest possible call (the first
  turn-ahead scenario in `describeMe`) so he can plan sleep against DRPR 7.2 (5 h in 24,
  12 h in 48).

### Phase 4 (only if he wants it): history on the phone
The relay keeps only the newest check, on purpose. If he wants "how did my projection
move today", either keep the last ~50 checks in the relay or have the app store each
check it fetches in a **new** table (not `lineup_snapshots`). Room schema bump + migration
test. The website's Find-a-turn already covers this on the laptop's data.

## Questions for the owner (before Phase 2)

1. **What info do you want in the app?** "When I go" only, or the board / line-up /
   changes too? (The Board tab already shows the full text report.)
2. **What should the app do with it?** Show it / notify you / pre-fill a shift / feed
   the rotation forecast?
3. **Merging into `main` on Render:** OK to deploy the board checker code with the
   agreement-search app? Should `board.html` be hidden there?
4. **Still keep auto checks out of the evidence log?** (Recommended: yes. A record
   made by software reading CATS is weaker evidence than one he read himself.)
5. Which notifications: ordered / time moved by N min / any change?

## Risks and notes
- **Evidence honesty:** never write auto checks into `lineup_snapshots`; label every
  auto-derived value on screen as coming from the laptop's check.
- **Staleness:** if the laptop stops (CATS signs out, laptop sleeps), the phone must
  show the check's age plainly ("checked 47 min ago") and warn past ~30 min.
- **Key handling:** `BOARD_KEY` lives only in Render env, `BoardChecker\.env`, and the
  app's encrypted settings. Never in git.
- **Polling floor:** Android lets WorkManager run every 15 min at best. True instant alerts
  would need FCM push, which means a Firebase project. Not worth it unless 15 min proves
  too slow.
- **One session at a time** may change the board checker; app changes go on a
  RailroadTracker branch, with the backup procedure before any install.
