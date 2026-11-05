# Alert review: alerts based on assumptions (2026-10-25 to 2026-11-05 14:34)

From the owner's Board_alerts export. Checked against the saved checks on
the site at the time of each alert. Turns only; no names.

## Reset heads-ups (`resetAhead`): 20 sent

| Who was told | About | Times sent | Right person? | Under the new rule |
|---|---|---|---|---|
| SR01 | SR04 (needs reset by 6th 0230, likely) | 6 (3rd 2355 to 4th 0614) | Yes: SR06 on hold past the call, SR01 off rest by then | 1 |
| EN03 | S306 (by 5th 1630, likely) on M38261 04 | 2 | Yes: S306's job goes spare; EN07 takes YMPS31 first, EN03 next | 1 |
| SR01 | SR06 (by 4th 1944, likely) | 2 | Yes: SR01 next available | 1 |
| EN03 | SD02 (by 6th 1944, heads-up) | 10 (4th 1735 to 2159) | **No**: should have been SD04 (SD11 on hold, SD01 **). Fixed 11-05 | 1, to SD04 |

Too many: the same heads-up was re-sent whenever the projected train or
its time moved. Fixed 11-05: once per reset (turn + deadline + who's next
+ likely/heads-up). 20 → 4.

## "CATS shows the wrong turn" (`catsWrong`): 8 sent

- B134, 2nd 1255: SA09's job listed, order has SR05. Once. (Owner's
  original example.)
- EN03, 4th 1650 to 2313: **7 times**, all about S108's engineer job on
  option 5, each matched to a different train (M39491, M39671, M30241,
  Z14891) and once SD01's job on DHT263B 05. Fixed 11-05: once per CATS
  listing (craft + whose job), not per train.
- ❓ For the owner: was S108's engineer job real (did EN03 or someone get
  called for it)? The train it's matched to kept changing, so the check
  may be matching option 5's job to the wrong train.

## Others: look right, not too many

- `mayCall` (Toronto South may get it): 3, once each (27th, 28th).
- `aheadRest` (someone ahead went on rest/hold, you move up): 11, one per
  turn change.
- `aheadBack`: 87 over 11 days, one per turn coming back; B126 gets the
  most (it follows a long board).
