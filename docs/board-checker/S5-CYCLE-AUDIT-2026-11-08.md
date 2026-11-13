# 501/502 cycle audit — 2026-11-08

> **Superseded 2026-11-13.** This audit tested the "first regular turn on option 29" rule. The
> owner's rule is one day each ("The rotation goes s501, then s502, then s501"; HANDOFF section 5), and
> every L502 in the saved checks, 18 Oct–13 Nov, alternated by day: 21 of 21 right that way, against 8 of
> 17 for the site's board-position prediction at the last check before each went on duty.

Audited branch head: 664c40cabbffedfe2b72fa0d6326afcc5e3bae3b.
Scope: existing engine selection, Current snapshot ordering, Why renderer and
notification-state construction. No new railway rules, application changes,
deployments, restarts or notification sends in this audit.

## Evidence and limits

- Live browser: displayed **Updated Nov 8, 13:59**, current snapshot **13:57**.
  L50231 09 PLN 9th 0400 still showed S501 CO/EN. S501 was terminal 1 with
  rest until 8th 2030; S502 was available; both positions 001.
  This is old publication evidence, not confirmation of fix 664c40c.
- Live S501-CO Turn History contained these saved observations:
  - Nov 4 0051: outbound L50231 04, on duty Sarnia 0245.
  - Nov 4 1111: away terminal 1, Garnet rest until 1901.
  - Nov 4 1900: Garnet available.
  - Nov 4 1936: working L50131 04; on duty Garnet 2115.
  - Nov 5 0711: home rest until Nov 6 0640.
  - Nov 8 0259: working L50231; 0308 note linked L50231 08 to SA07 fill-in.
  - Nov 8 1341: terminal 1 / Garnet rest until 2030.
- These are saved interpreted notes, not raw option-29 inputs. Older predictions
  in notes may contain historical bugs; they are not expected-answer truth.
- The three repository CATS fixtures contain zero S5 rows. New phase scenarios
  are explicitly reconstructed inputs, not disguised real-data fixtures.
- Owner reports the preceding notification was correct. No owner-only delivery
  log or phone recipient confirmation was available in this browser.

## Automated cycle coverage

For each direction (S501 first and S502 first), check:
before departure; outbound L502; tied-001 Garnet rest; rested at Garnet;
working L501 home; home with engineer-only rest past call; home rested.
Engine prediction, S5 rendered board order and craft-specific notification state
agree in all 14 reconstructed stages. Existing tests also cover MU exclusion,
board-position reversal, calendar parity, per-craft PL/spare coverage and Garnet
L501 notification routing. Away selected crews intentionally receive no L502
lineup notification until back off duty in Sarnia.

The engine reason contains the selected turn. This does not mean the browser's
simplified Why displays that reason (see finding 3).

Command:
`node --test test/board/engine.test.js test/board/site.test.js test/board/alerts.test.js test/board/spares.test.js test/board/s5-rotation.test.js`

Result: **123 pass, 2 known TODO failures**, no unexpected failures.
TODO assertions execute and expose the defects; they are not counted as passes.

## Concrete remaining findings

1. **Dated identity bypass in known-crew shortcut.**
   In engine.js, calledS5 matches workingOn to symbol only; ORD bypasses the
   near-call restriction altogether. Reproduction: S501 working a previous L50231,
   S502 home pos 001; future L50231 09 is ORD -> chooses S501 as known.
   Expected: the earlier dated trip must not confirm the later dated train.
   Option 29's workingOn has no date; require matching dated Call Board/departure
   evidence or an explicitly bounded provisional inference. Test remains TODO.
2. **One craft becomes two confirmed crafts.**
   Same shortcut finds one working row and sets conductor and engineer to that
   turn, both non-spare. Reproduction: S501 CO working; S501 EN TV; ordered L502
   -> engineerSpare false. This bypasses per-craft availability and factual
   confirmation. Confirm/map each craft separately, including real fill-in evidence;
   do not infer an MU owner. Test remains TODO.
3. **Why lacks S5 selection explanation.**
   Live Why and public/board.html lineupWhy show calling sequence, spare coverage
   and CATS details, but omit the engine's S5 position/location reason. It cannot
   explain why S502 should precede S501 at the tied-001 transition. A concise S5
   explanation should be previewed in Test before promotion; retain decluttered style.
4. **Time wording discrepancy to verify separately.**
   Live L50231 09 Current says 0400; S501-CO When says on duty 0345 with call 0145.
   Likely lineup-order versus prep-adjusted duty semantics; not changed here.
   Do not assume this audit proves which label should change.

## Remaining verification

- Publish prior fix 664c40c via normal laptop workflow and verify a fresh timestamp,
  L50231 09 -> S502 and S5 board order. Do not treat this report as deployment.
- Obtain/replay masked raw option-29, Call Board, option-31, lineup and option-5
  checks spanning one complete cycle for both turns; include real spare/MU fills.
- Resolve findings 1 and 2 against those dated inputs, then remove TODO markers.
- Check missing/stale screens, split-craft transitions, duplicate symbols across
  dates/months, and multiple future L502 rows. No automatic parity fallback.
- Compare actual delivered notification evidence with snapshot timestamps once
  available; notification-state unit tests are not delivery tests.
