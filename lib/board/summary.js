// Pulls the three screens out of a board-probe summary.json (screens[] in the
// order the owner visited them) and hands them to the engine.
const { parseGrid, gridText } = require('./grid');
const S = require('./screens');
const { at } = require('./time');

function torontoLocal(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  return at(+p.year, +p.month, +p.day, +p.hour, +p.minute);
}

function loadSummary(summary, { now: nowOverride } = {}) {
  const pages = (summary.screens || []).map((s) => {
    const rows = parseGrid(s.screenGrid || []);
    return { rows, text: gridText(rows) };
  });

  // The Call Board header is the only clock on these screens.
  let now = nowOverride ?? null;
  const boardPages = pages.filter((p) => S.isCallBoard(p.text));
  for (const p of boardPages) now = nowOverride ?? S.callBoardTime(p.rows) ?? now;
  // No readable clock on screen: use when the probe ran, in railway (Toronto) time.
  if (now == null && summary.probedAt) now = torontoLocal(new Date(summary.probedAt));
  if (now == null) throw new Error('No Call Board page with a date/time header; pass --now YYYY-MM-DDTHH:MM.');

  // Pages can be revisited; the same train on two pages is the same train.
  const trains = new Map();
  for (const p of boardPages) {
    for (const t of S.parseCallBoardPage(p.rows).trains) trains.set(`${t.symbol}/${t.originDay}/${t.onDuty}`, t);
  }

  const gang = new Map();
  for (const p of pages.filter((x) => S.isChainGang(x.text))) {
    for (const t of S.parseChainGang(p.rows, now).turns) gang.set(`${t.craft}/${t.turn}`, t);
  }
  const gangTurns = [...gang.values()];

  const lineup = new Map();
  for (const p of pages.filter((x) => S.isLineup(x.text))) {
    for (const t of S.parseLineup(p.rows, now)) lineup.set(`${t.symbol}/${t.originDay}`, t);
  }

  return {
    now,
    callBoard: [...trains.values()],
    chainGangHome: gangTurns.filter((t) => t.terminal === 0),
    chainGangAway: gangTurns.filter((t) => t.terminal !== 0),
    lineup: [...lineup.values()],
    seen: { callBoardPages: boardPages.length, chainGang: gangTurns.length > 0, lineup: lineup.size > 0 },
  };
}

module.exports = { loadSummary };
