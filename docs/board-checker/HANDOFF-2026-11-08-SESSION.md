# Railway board session handoff — November 8, 2026

Read this first for the latest session state, then [root HANDOFF](../../HANDOFF.md)
for all settled rules and [TODO](TODO.md) for the authoritative backlog.
This supplements existing documentation; it does not replace historical evidence.

## Repository and working agreement

- Repository: odeajust-glitch/240ca.
- Branch: `claude/vigilant-planck-zawrj4`; do not merge main or create a PR.
- Source head inspected for this handoff: `2fcfac27e4d8ef3026c57ea27b2290dba12be7ed`.
- Owner: Justin O’Dea; usually on Android, Windows laptop runs checker.
- Preview layout changes in owner-only Test; promote only after owner approval.
- Inspect current branch/head and existing documentation before edits; avoid overwriting
  another session. No actual test notifications, filing submissions or deployments.
- Commit/push is not proof of laptop pull, restart, publication or real-CATS validation.

## Immediate next actions

1. Await Justin's review of Test → Analytics Overview and Test → Current / 501/502 Why.
   Both are committed previews, not approved for promotion.
2. Independently fix the two reproducible S5 known-crew shortcut defects below, preserving
   dated identity and separate craft evidence. Keep real-CATS verification open.
3. Verify a fresh published Current snapshot reflects S502 for the next L502 when
   S501 is in Garnet and both terminal-local positions are 001.
4. After previews are approved, promote only those approved changes.
5. Continue Analytics review: Assignment errors, Call stability, Stale trains,
   then consistent filters. This is a review queue, not authorization to change all pages.

## Latest owner request and preview

Latest request before handoff: build Analytics Overview preview.
Implemented in `2fcfac27e4d8ef3026c57ea27b2290dba12be7ed`:
- Test defaults to grouped guide for all seven active Analytics tabs:
  Overview, My week, Trains, Turns side by side, Call stability,
  Assignment errors, Stale trains.
- Descriptions explain what each page answers, with working Open buttons.
- Groups: Start here; Your work; Compare work; Calling and waiting; Check assignments.
- Notes explain dates, independent tracker coverage and unknown outcomes.
- Uses actual ANA_SECS destinations; no fabricated statistics or removed tabs restored.
- Buttons clear Analytics search before opening selected existing page.
- Test menu also keeps the pending Current / 501/502 Why preview available.
- Regular Analytics Overview remains unchanged. Syntax/catalog/navigation checks
  and 26 site/filing tests passed; owner-phone/live review pending.

## 501/502 changes and unresolved audit

Owner evidence: after S501 tied up in Garnet, S501 and S502 both displayed position
001; Current incorrectly assigned S501 to L50231 09. Owner says notification was correct.

`664c40cabbffedfe2b72fa0d6326afcc5e3bae3b`:
- Shared engine had broken equal positions alphabetically.
- At equal positions only, home precedes away; outbound L502 is last.
- Distinct board positions remain primary; PL/rest/hold and MU do not decide order.
- Site cache FORMAT 28 rebuilds saved snapshots.
- 105 engine/site/alerts/spares tests passed. Publication not confirmed.

Audit `7cd345f5a7f3ee0807cf04b07c387ac77a019ace`:
- [Full audit](S5-CYCLE-AUDIT-2026-11-08.md).
- 14 reconstructed stages across both directions agree on prediction, board order
  and notification state. Away crews intentionally receive no L502 lineup alert.
- Combined run: 123 passes, two known TODO assertion failures. Do not call all passing.
- **Open defect 1:** calledS5 shortcut in lib/board/engine.js matches workingOn symbol
  without date; a future ORD L50231 can inherit the previous trip's crew.
- **Open defect 2:** one working craft row sets both CO/EN confirmed and non-spare,
  bypassing the other craft's TV/rest and real fill-in evidence.
- Reproductions in test/board/s5-rotation.test.js; TODO flags remain until fixed.
- Real repository CATS fixtures have zero S5 rows. New phase scenarios are reconstructed,
  not raw CATS replays. Need masked full-cycle inputs and actual notification evidence.
- Current lineup 0400 versus When duty 0345 wording discrepancy is recorded for review;
  do not change timing rules by guessing.

Pending Why preview `f11e91ab1568d5887db894d9d1db550a8ade70ec`:
- Owner requested no list of other trains for S5.
- Test-only L502 Why shows selected CO/EN, other regular crew's recorded status
  (in Garnet, returning on L501, rest/PL details), available spare cover.
- Regular Current Why and other trains remain unchanged.
- Syntax and six sample rendering checks passed. Await owner review.
- These are UI changes, not fixes for the two known-crew shortcut defects.

## Other work completed this session

- Filing usability: `7eee8aeb3723f9f106b3ef88897fb679fd794f01`.
  Regular Article 18.6(b)/Turn History form stays below selected stay/card; clearer
  steps and disabled reasons; review and confirmation; edit invalidates approval.
  Client-generated reference in submitted/exported text, local receipt after service
  success. No inbox delivery tracking; no real submission sent. Thirty tests passed.
- Owner explicitly superseded engineer details/Copy-only restriction: engineers may
  use shared filing form. Do not reinstate the older restriction from historical notes.
- Current collapsible headers approved by owner after Test review and promoted:
  `c304dc6214ded33c66ace4bf4069ef6fb57e6748`.
  Native header tap/keyboard toggle; initially open; session state; separate Test state.
  Section shortcuts/notification links open collapsed target; Arrange/Snapshots unchanged.
  Owner verified Test; production version not independently confirmed after promotion.

## Deployment evidence — keep stages separate

| Stage | Evidence |
| --- | --- |
| GitHub | Changes above committed on requested branch; latest inspected head shown above. |
| Laptop pull | Owner said “I pulled it just waiting to update” after Why preview, before Overview build. Exact laptop SHA unknown. |
| Checker restart | Not independently confirmed for latest commits. |
| Phone refresh | Owner verified earlier accordion preview; latest two previews not yet approved. |
| Published website | Last browser inspection: Updated Nov 8 13:59; snapshot/check 13:57. Still old S501 for L50231 09. |
| Worker | No Worker edits/deployment for changes listed here; none required for these UI/engine changes. |
| Real CATS | Owner screenshots/history notes provide evidence; full-cycle raw replay and latest fix live confirmation remain open. |

Last live observation is historical evidence, not today's latest site state.
Normal rollout: pull this branch → restart checker → successful check/publication →
refresh phone. Verify displayed timestamps and behavior; do not claim this was performed.

## Rules and outstanding work that must survive

Read root HANDOFF section 5 and dated qualifications before changing behavior.
Preserve PL <=24h versus 24–36h, days-off 24h/ET-TT exclusions, normal Chain Gang/SD
versus reset what-if, reset formulas/alerts, spareboard call-order allocation,
ordered Sarnia calculated sequence, Toronto PLN/ORD selection, yard 8h/YSBY 12h,
S5 board order/location tie and craft-specific coverage, MU placeholder and Garnet
return/notification rules. Full dated train identity includes month context.

Do not close outstanding days-off, predicted spare-job notifications, reset checks,
subscriber retention/error reports, historical-data audit, Worker/email configuration,
owner decisions or deadlines merely because UI changes are committed.
See [TODO](TODO.md), [audit](S5-CYCLE-AUDIT-2026-11-08.md), and
[trip-data fixes](TRIP-DATA-FIXES-2026-11-08.md).
Original archive/snapshot are retained; this documentation task changes no application code.
