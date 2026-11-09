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
      .map(e => {
        const event = { turn: e.turn, kind: e.kind, text: e.text, alternate: !!e.alsoLineup,
          provisional: ambiguous && e.kind !== 'onDuty' };
        const lineup = states[e.turn]?.lineup;
        if (!seen.lineup || e.kind === 'onDuty' || lineup?.status !== 'ORD') return event;
        const ordered = result.predictions.find(p => p.pool === 'A' && !p.known && p.onDutyAt == null &&
          p.status === 'ORD' && p.order === lineup.order && p.symbol + ' ' + p.originDay === lineup.train &&
          (p.turn === e.turn || p.engineer === e.turn));
        if (!ordered) return event;
        const ahead = result.predictions.filter(p => ['A', 'B', 'SR'].includes(p.pool) && p.status === 'PLN' &&
          !p.known && p.onDutyAt == null && p.order < ordered.order).sort((a, b) => a.order - b.order)[0];
        if (ahead) {
          const clock = minutes => localIso(minutes).slice(11);
          event.suggested = lineup.train + ' is ordered for ' + clock(ordered.order) + '. ' + ahead.symbol + ' ' +
            ahead.originDay + ' is still planned ahead of you for ' + clock(ahead.order) + ' and has not been ordered. ' +
            e.turn + ' is the predicted ' + (ordered.turn === e.turn ? 'conductor' : 'engineer') + ' turn.' +
            (lineup.spare ? ' Spare coverage is expected.' : '') + ' Expected call ' + clock(lineup.call) + '.';
        }
        return event;
      });
    rows.push({ time, events, held: batch.held.filter(t => turns.has(t)) });
  }
  return { rows, check };
}
module.exports = { notificationReview };
