// Read-only replay. Caller feeds every saved check (including unchanged checks)
// before snapshot compression. No subscriber, sender, or persisted alert state.
const { turnStates, turnEvents } = require('./alerts');
const { localIso } = require('./time');

function notificationReview() {
  let told = null;
  const rows = [];
  const turns = new Set(['SA04', 'S106', 'SB05', 'S305']);
  function check(input, result) {
    const { now, seen } = input;
    const time = localIso(now).slice(11);
    if (time > '09:05') return;
    const states = turnStates(result, input.callBoard, {
      chainGang: input.chainGangHome, sd: input.sdHome, a: input.aHome, b: input.bHome,
      s1: input.s1Home, s3: input.s3Home, s5: input.s5, vacancies: seen.terminal ? input.vacancies : null,
      spareboards: input.spareboards, yardJobs: input.yardJobs, backfill: input.backfill,
      lineup: seen.lineup ? input.lineup : null, skipRescueRouting: true
    });
    const batch = turnEvents(told, states, { now, lineupRead: seen.lineup });
    told = batch.told;
    if (time < '07:45') return;
    const ambiguous = seen.lineup && result.predictions.some(p => p.symbol === 'Z14891' && p.originDay === '06' && p.status === 'PLN' && p.onDutyAt == null) &&
      result.predictions.some(p => p.symbol === 'A42431' && p.originDay === '07' && p.status === 'ORD' && !p.known && p.onDutyAt == null);
    const events = batch.events.filter(e => turns.has(e.turn) && ['ordered','lineup','onDuty'].includes(e.kind) && /A42431 07|Z14891 06/.test(e.text))
      .map(e => ({ turn: e.turn, kind: e.kind, text: e.text, alternate: !!e.alsoLineup,
        provisional: ambiguous && e.kind !== 'onDuty' }));
    rows.push({ time, events, held: batch.held.filter(t => turns.has(t)) });
  }
  return { rows, check };
}
module.exports = { notificationReview };
