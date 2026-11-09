// Read-only replay. Caller feeds every saved check (including unchanged checks)
// before snapshot compression. No subscriber, sender, or persisted alert state.
const { turnStates, turnEvents } = require('./alerts');
const { localIso } = require('./time');

function notificationReview() {
  let told = null;
  const rows = [];
  let previousCoverage = new Map();
  const turns = new Set(['SA04', 'S106', 'SB05', 'S305']);
  function check(input, result) {
    const { now, seen } = input;
    const time = localIso(now).slice(11);
    if (time > '09:05') return;
    const states = turnStates(result, input.callBoard, {
      chainGang: input.chainGangHome, sd: input.sdHome, a: input.aHome, b: input.bHome,
      s1: input.s1Home, s3: input.s3Home, s5: input.s5, vacancies: seen.terminal ? input.vacancies : null,
      spareboards: input.spareboards, yardJobs: input.yardJobs, backfill: input.backfill,
      lineup: seen.lineup ? input.lineup : null, skipRescueRouting: true, reviewCoverage: true
    });
    const previous = told;
    const batch = turnEvents(previous, states, { now, lineupRead: seen.lineup });
    told = batch.told;
    if (time < '07:45') return;
    const ambiguous = seen.lineup && result.predictions.some(p => p.symbol === 'Z14891' && p.originDay === '06' && p.status === 'PLN' && p.onDutyAt == null) &&
      result.predictions.some(p => p.symbol === 'A42431' && p.originDay === '07' && p.status === 'ORD' && !p.known && p.onDutyAt == null);
    const coverStates = Object.entries(states).filter(([, state]) => state.lineup?.poolJob && !state.onDuty);
    const covering = new Set(coverStates.map(([turn]) => turn));
    const events = batch.events.filter(e => (turns.has(e.turn) || covering.has(e.turn)) && ['ordered','lineup','onDuty'].includes(e.kind) && /\b(?:A42431|Z14891)\b/.test(e.text))
      .map(e => {
        const event = { turn: e.turn, kind: e.kind, text: e.text, alternate: !!e.alsoLineup,
          provisional: ambiguous && e.kind !== 'onDuty' };
        const lineup = states[e.turn]?.lineup;
        if (!seen.lineup || !lineup || e.kind === 'onDuty') return event;
        const clock = minutes => localIso(minutes).slice(11);
        if (lineup.status === 'PLN' && e.kind === 'lineup') {
          const planned = result.predictions.find(p => p.pool === 'B' && !p.known && p.onDutyAt == null &&
            p.status === 'PLN' && p.symbol + ' ' + p.originDay === lineup.train && p.order === lineup.order &&
            (p.turn === e.turn || p.engineer === e.turn));
          const priorTrain = previous?.[e.turn]?.train;
          const other = planned && result.predictions.find(p => p.pool === 'A' && p.status === 'ORD' &&
            p.onDutyAt == null && p.order > planned.order && p.symbol + ' ' + p.originDay === priorTrain);
          if (other) {
            event.suggested = priorTrain + ' was ordered for ' + clock(other.order) + ', changing the predicted sequence. ' +
              e.turn + ' is now lined up for ' + lineup.train + ', still planned for ' + clock(planned.order) +
              '. If ' + lineup.train + ' is ordered for a time before ' + clock(other.order) +
              ', your train assignment may change' +
              (e.turn === planned.engineer ? '.' : ' again.' + (lineup.spare ? ' Your turn goes spare.' : '') +
                ' Expected call ' + clock(lineup.call) + '.');
          }
          return event;
        }
        if (lineup.status !== 'ORD') return event;
        const ordered = result.predictions.find(p => p.pool === 'A' && !p.known && p.onDutyAt == null &&
          p.status === 'ORD' && p.order === lineup.order && p.symbol + ' ' + p.originDay === lineup.train &&
          (p.turn === e.turn || p.engineer === e.turn));
        if (!ordered) return event;
        const ahead = result.predictions.filter(p => ['A', 'B', 'SR'].includes(p.pool) && p.status === 'PLN' &&
          !p.known && p.onDutyAt == null && p.order < ordered.order).sort((a, b) => a.order - b.order)[0];
        if (ahead) {
          event.suggested = lineup.train + ' is ordered for ' + clock(ordered.order) + '. ' + ahead.symbol + ' ' +
            ahead.originDay + ' is still planned ahead of you for ' + clock(ahead.order) + ' and has not been ordered. ' +
            e.turn + ' is the predicted ' + (ordered.turn === e.turn ? 'conductor' : 'engineer') + ' turn.' +
            (lineup.spare ? ' Spare coverage is expected.' : '') + ' Expected call ' + clock(lineup.call) + '.';
        }
        return event;
      });
    const nextCoverage = new Map();
    for (const [spare, state] of coverStates) {
      const job = state.lineup.poolJob;
      const pool = states[job.turn]?.lineup;
      if (!pool || !pool.spare || pool.order !== state.lineup.order ||
          (pool.train !== state.lineup.train && pool.train.split(' ')[0] !== state.lineup.train)) continue;
      const poolMessage = events.find(e => e.turn === job.turn && e.suggested);
      const key = [pool.train, job.turn, job.craft, pool.status, pool.call].join('|');
      if (!poolMessage) {
        if (previousCoverage.get(spare) === key) nextCoverage.set(spare, key);
        continue;
      }
      nextCoverage.set(spare, key);
      if (previousCoverage.get(spare) === key) continue;
      const suggested = spare + ', you are expected to cover ' + job.turn + '’s ' + job.craft + ' job. ' +
        poolMessage.suggested.replace(' Your turn goes spare.', '').replace(' Spare coverage is expected.', '');
      const ownMessages = events.filter(e => e.turn === spare && ['lineup','ordered'].includes(e.kind));
      if (ownMessages.length) {
        for (const e of ownMessages) e.suggested = suggested;
      } else {
        events.push({ turn: spare, kind: 'coverage', text: 'Proposed coverage update for ' + spare, suggested });
      }
    }
    if (seen.lineup) previousCoverage = nextCoverage;
    rows.push({ time, events, held: batch.held.filter(t => turns.has(t)) });
  }
  return { rows, check };
}
module.exports = { notificationReview };
