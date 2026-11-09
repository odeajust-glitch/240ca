// Only the owner's Test comparison calls this module.
const { runBoardCheck } = require('./engine');
const { at, nearestDay, localIso } = require('./time');

function compareS5(input, backfill = []) {
  const regular = runBoardCheck(input).predictions;
  const proposed = runBoardCheck(input, { s5Review: true }).predictions;
  const assignments = (p) => ['CO', 'EN'].map(craft => {
    if (!p) return 'Unavailable';
    const co = craft === 'CO';
    const turn = co ? p.turn : p.engineer;
    if (!turn) return 'Unavailable';
    if (co ? p.spare : p.engineerSpare) return turn + ' → spare (' + ((co ? p.coWhy : p.enWhy) || 'coverage required') + ')';
    return turn + (p.known ? ' · marked known' : p.s5Pending ? ' · coverage pending' : ' · predicted');
  });
  return input.lineup.filter(t => /^L502/.test(t.symbol)).map(t => {
    const same = p => p.symbol === t.symbol && p.originDay === t.originDay && p.order === t.order;
    const origin = nearestDay(t.order, Number(t.originDay), 12, 0);
    const train = t.symbol + ' ' + t.originDay;
    const trip = input.callBoard.find(b => b.symbol === t.symbol && Number(b.originDay) === Number(t.originDay) &&
      nearestDay(b.onDuty, Number(b.originDay), 12, 0) === origin);
    const reviewed = assignments(proposed.find(same));
    if (trip) {
      for (const [index, craft] of ['CO', 'EN'].entries()) {
        const matches = c => craft === 'EN' ? /^(EN|LE)$/.test(c.craft) : c.craft === 'CO';
        const fills = backfill.filter(b => b.train === train && matches(b) && b.turn && b.job &&
          input.callBoard.filter(r => r.symbol === t.symbol && r.originDay === t.originDay).length === 1);
        const turns = [...new Set(trip.crew.filter(matches).map(c => c.turn).filter(Boolean))];
        reviewed[index] = fills.length === 1 ? fills[0].turn + ' covering ' + fills[0].job + ' · recorded fill-in'
          : turns.length === 1 ? turns[0] + ' · on Call Board' : 'No unambiguous craft record';
      }
    }
    return { train, origin: localIso(origin).slice(0, 10), order: localIso(t.order), current: assignments(regular.find(same)), proposed: reviewed };
  });
}

function auditCases() {
  const order = at(2026, 11, 9, 5);
  const row = (turn, craft, pos, extra = {}) => ({ turn, craft, pos, terminal: 0, ...extra });
  const working = { working: true, workingOn: 'L50231' };
  const base = { now: at(2026, 11, 8, 14), chainGangHome: [], callBoard: [],
    lineup: [{ symbol: 'L50231', trainNo: 'L502', originDay: '09', order, status: 'ORD' }] };
  const home = (pos) => ['CO', 'EN'].map(c => row('S502', c, pos));
  return [
    { name: 'Previous trip uses the same symbol', input: { ...base, s5: [row('S501','CO',999,working), row('S501','EN',999,working), ...home(1)] } },
    { name: 'Conductor working, engineer on TV', input: { ...base, now: order - 120,
      s5: [row('S501','CO',999,working), row('S501','EN',1,{ st: 'TV' }), ...home(2)] } }
  ];
}

module.exports = { compareS5, auditCases };
