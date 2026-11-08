# Trip-data errors and fixes — 2026-11-08

Branch: `claude/vigilant-planck-zawrj4`.
Live evidence from Order summary: Updated November 8 11:13, check 11:10
(Toronto time). Implementation is tested locally; publication is not yet verified.

| Error caught | Evidence and why it was wrong | Fix |
| --- | --- | --- |
| An old crew's Toronto tie-up survived a corrected departure | X39491 06 first showed SD12/SR04 on duty November 7 2315 and tied up November 8 0149. The Call Board later corrected the same full dated ID to S107/SA05, on duty November 8 0445. The 0149 tie-up still belonged to the earlier evidence. | Any duty-time, crew or station change withdraws the attached tie-up and away-crew mapping. Keep the original events and add an explicit withdrawal event. Reattach only from fresh compatible bunkhouse evidence. |
| Crew-only corrections could be ignored | Code returned early whenever duty time was unchanged, without comparing the crew. A different crew at the same duty time could retain the old crew's off-duty match. This additional path was caught in source review and regression testing, not separately confirmed live. | Compare time, crew and station before skipping an unchanged row. Record crew-only corrections. |
| A negative duty interval appeared as a positive duration | X39491 06 displayed duty 8th 0445 to off 8th 0149, yet displayed 2h 56m. The stored duration was stale; the display duration formatter also uses absolute values. | Reject off-duty times at/before duty and evidence tied to another departure/crew. Invalid durations are unavailable rather than passed to duration formatting. Old published/archive rows are checked too. |
| Invalid tie-ups could feed held-away calculations | Held-away matching uses the Toronto tie-up as its start. Keeping a withdrawn tie-up could attribute a later home trip/held interval to the wrong outbound departure. This was a downstream risk found in code; no particular claim or alert is asserted wrong here. | Exclude invalid tie-ups from held-away matching and clear derived duration/held fields on invalid legacy rows. Show Needs review instead of a false off-duty value. |

## Information retained

- Matching uses the complete train symbol and origin day, pinned to the month:
  X39491 06 and X39491 07 remain separate records.
- Original observations and crew/time corrections remain in the event history.
- No replacement off-duty time is invented. Missing evidence stays unavailable.
- Normal valid trips, single-craft bunkhouse fallback rules, railway calculations,
  call rules and notifications are unchanged.
- Cache FORMAT 27 rebuilds retained site snapshots.

## Validation and remaining work

49 targeted trip-correction, Analytics, site-build and call-timeline tests pass.
Regression cases cover duty-time corrections, crew-only corrections, withdrawal
and valid replacement of tie-ups, invalid old/archive rows, normal durations and
different train dates.

Pull/restart/publication and a real-CATS check of X39491 06 remain open. Verify the
0149 tie-up is no longer attached to the 0445 departure, the false duration is gone,
and any replacement tie-up belongs to the corrected crew. No Worker deployment
was performed. Earlier held-away submissions, if any, were not inspected.
