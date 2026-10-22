# Board checker check-ups

## 2026-10-22: five-day check-up (owner asked for it, 2026-10-17)

From the 2026-10-17 review, items not handled that day. Go through each with
the owner; nothing here has been changed yet.

**First, from the real checks since the laptop was updated**
- [ ] **#1 Toronto screens on real CATS.** Did checks print "skipped
  Bunkhouse 28" or "skipped Mac yard line-up 41"? Was S1 typed in the right
  box on 41? Owner: use **only real board-checker captures** (the laptop's
  `BoardChecker\history`), not the screenshot-based copies, for the test
  fixtures; replace `macScreens()` in `test/board/site.test.js` with a real
  capture once there is one.
- [ ] Is the Toronto table / predicted crew right against what happened?
- [ ] Did the website update after Toronto-only changes (#4, done 10-17)?

**Accuracy**
- [x] **#5 Remember each road day's trains across checks** (built 2026-10-22, lib/board/roadday.js) (from history), so
  A/B counts don't go wrong once a road day's trains leave the Call Board
  (the cause behind X27861 16 showing A). Biggest accuracy fix left.
- [ ] **#6 Rest/hold "until 0000 = available at 0000"**: any case where a turn
  with rest ending exactly at the call was skipped in real life? (Shadow
  check #1, SR02 rest 0100 vs call ~0100, went the other way.)
- [ ] **#7 Toronto flags**: should "available" mean rested by the train's
  call time rather than rested at the moment it left the line-up?
- [ ] **#8 Toronto pairing**: when the next crew is still on rest at the
  train's call, does CATS skip them or does the train wait? Mark it?

**Website**
- [ ] **#10 Which day a train belongs to** in the Order summary: calendar day
  of on duty (now) or the 0500 road day the A/B count uses?
- [ ] **#11 Order table on a phone**: fewer columns, rest in the story?

**Running it**
- [ ] **#14 Site is public**: password (paid Netlify) or keep the link close?
- [ ] **#16 One chat at a time** changing the board checker / site.
- [ ] **#3** (one update covers everything): nothing to do; drop.

## 2026-10-24: Netlify usage (#13)
- [ ] Netlify → the team's **Usage** / billing page: how many deploys / credits
  the snapshot site used in its first week (about 16 uploads a day at most).
  If it's heading over the plan, raise `BOARD_SITE_EVERY` in
  `BoardChecker\.env`.
