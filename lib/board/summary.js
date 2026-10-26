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

// SD turns are engineer turns (owner, option 27). If the screen lists other
// crafts on them too, keep the engineer row; one row per turn.
function engineersOnly(rows) {
  const eng = rows.filter((t) => /^(EN|LE)$/.test(t.craft));
  const list = eng.length ? eng : rows;
  return [...new Map(list.map((t) => [t.turn, t])).values()];
}

// Labels board-auto.js gives the screens added 2026-10-24.
const SPAREBOARDS = { 'co-fast': 'coFast', 'co-slow': 'coSlow', 'en-fast': 'enFast', 'en-slow': 'enSlow' };
// "<board>-view": the same board read again with VIEW TIME = the check less
// 10 min (owner, 2026-10-26), to see who left it since.
const EXTRA = [...Object.keys(SPAREBOARDS), ...Object.keys(SPAREBOARDS).map((l) => `${l}-view`), 'terminal', 's5', 'garnet'];

function loadSummary(summary, { now: nowOverride } = {}) {
  const pages = (summary.screens || []).map((s) => {
    const rows = parseGrid(s.screenGrid || []);
    const text = gridText(rows);
    // The two Mac yard screens (owner, 2026-10-17) look like 23 and 41, so
    // board-auto.js labels them; a line-up for station 41975 is Mac's too.
    // The screens added 2026-10-24 come labelled too (spareboards, the
    // vacancy list, 501/502, Garnet) and are kept apart from Sarnia's pools.
    const where = s.label === 'bunkhouse' ? 'bunkhouse'
      : s.label === 'mac' || (S.isLineup(text) && /\[41975\]/.test(text)) ? 'mac'
        : s.label && EXTRA.includes(s.label) ? s.label : 'sarnia';
    return { rows, text, where };
  });
  const sarnia = pages.filter((p) => p.where === 'sarnia');

  // The Call Board header is the only clock on these screens.
  let now = nowOverride ?? null;
  const boardPages = pages.filter((p) => S.isCallBoard(p.text));
  for (const p of boardPages) now = nowOverride ?? S.callBoardTime(p.rows) ?? now;
  // No readable clock on screen: use when the probe ran, in railway (Toronto) time.
  if (now == null && summary.probedAt) now = torontoLocal(new Date(summary.probedAt));
  if (now == null) throw new Error('No Call Board page with a date/time header; pass --now YYYY-MM-DDTHH:MM.');

  // Pages can be revisited; the same train on two pages is the same train.
  const trains = new Map();
  const yard = new Map();
  for (const p of boardPages) {
    const page = S.parseCallBoardPage(p.rows, now);
    for (const t of page.trains) trains.set(`${t.symbol}/${t.originDay}/${t.onDuty}`, t);
    // Yard jobs (owner, 2026-10-24), read when the Call Board was paged past the trains.
    for (const j of page.yard) yard.set(`${j.job}/${j.onDuty}`, j);
  }

  // Later screens win: the last time a turn was seen is the freshest.
  const pools = new Map();
  const unreadPools = [];
  for (const p of sarnia.filter((x) => S.isPoolPosition(x.text))) {
    let turns;
    try {
      turns = S.parseChainGang(p.rows, now).turns;
    } catch (err) {
      // An extra pool screen (19/21/27) laid out differently shouldn't sink
      // the check; screen 23 not reading is caught below (seen.chainGang).
      unreadPools.push(err.message);
      continue;
    }
    for (const t of turns) pools.set(`${t.craft}/${t.turn}`, t);
  }
  const all = [...pools.values()];
  const gangTurns = all.filter((t) => t.pool === 'SR');

  const lineup = new Map();
  for (const p of sarnia.filter((x) => S.isLineup(x.text))) {
    for (const t of S.parseLineup(p.rows, now)) lineup.set(`${t.symbol}/${t.originDay}`, t);
  }

  // Mac yard (owner, 2026-10-17): 41 for station 41975 westbound, the trains
  // home; option 28, the crews in the bunkhouse, an EN + CO pair per POS in
  // the order they come home. B1 rows (brakeman) are left out; the screen's
  // POOL box is the terminal pool and is ignored.
  const macLineup = new Map();
  for (const p of pages.filter((x) => x.where === 'mac' && S.isLineup(x.text))) {
    for (const t of S.parseLineup(p.rows, now)) macLineup.set(`${t.symbol}/${t.originDay}`, t);
  }
  const bunk = new Map();
  let bunkRead = false;
  for (const p of pages.filter((x) => x.where === 'bunkhouse')) {
    let turns;
    // MU (make-up) crews take trains home too (owner, 2026-10-26): any turn.
    try { turns = S.parseChainGang(p.rows, now, { anyTurn: true }).turns; } catch { continue; }
    bunkRead = true;
    for (const t of turns) {
      if (!/^(EN|LE|CO)$/.test(t.craft)) continue;
      const c = bunk.get(t.pos) || { pos: t.pos, en: null, co: null, restUntil: null };
      if (/^(EN|LE)$/.test(t.craft)) c.en = t.turn;
      else if (t.craft === 'CO') c.co = t.turn;
      if (t.restUntil != null) c.restUntil = Math.max(c.restUntil ?? t.restUntil, t.restUntil);
      bunk.set(t.pos, c);
    }
  }

  // Spareboards: one list per board, in board order (later pages win).
  const spareboards = {};
  for (const [label, key] of Object.entries(SPAREBOARDS)) {
    const got = new Map();
    let read = false;
    for (const p of pages.filter((x) => x.where === label && S.isSpareboard(x.text))) {
      try { for (const t of S.parseSpareboard(p.rows, now).turns) got.set(t.turn, t); read = true; } catch { /* not this page */ }
    }
    spareboards[key] = read ? [...got.values()].sort((a, b) => a.pos - b.pos) : null;
  }
  // Left the board in the last 10 min (option A): on the view-time read, not
  // on the board as it opened. Never predicted for a job (spareboards above
  // stays the board as it opened).
  const leftBoard = {};
  for (const [label, key] of Object.entries(SPAREBOARDS)) {
    if (!spareboards[key]) continue;
    const got = new Map();
    for (const p of pages.filter((x) => x.where === `${label}-view` && S.isSpareboard(x.text))) {
      try { for (const t of S.parseSpareboard(p.rows, now).turns) got.set(t.turn, t); } catch { /* not this page */ }
    }
    const here = new Set(spareboards[key].map((t) => t.turn));
    const gone = [...got.values()].filter((t) => !here.has(t.turn)).sort((a, b) => a.pos - b.pos);
    if (got.size) leftBoard[key] = gone;
  }
  // The jobs going spare (5, vacancies only).
  const vacancies = new Map();
  let terminalRead = false;
  for (const p of pages.filter((x) => x.where === 'terminal' && S.isTerminalLineup(x.text))) {
    terminalRead = true;
    for (const j of S.parseTerminalLineup(p.rows, now)) vacancies.set(`${j.train}/${j.cc}/${j.turn}`, j);
  }
  // 501/502 (29) and Garnet (31): pool screens, any turn id.
  const otherPool = (label) => {
    const got = new Map();
    let read = false;
    for (const p of pages.filter((x) => x.where === label && S.isPoolPosition(x.text))) {
      try { for (const t of S.parseChainGang(p.rows, now, { anyTurn: true }).turns) got.set(`${t.craft}/${t.turn}`, t); read = true; } catch { /* no rows */ }
    }
    return read ? [...got.values()] : null;
  };
  const s5 = otherPool('s5');
  const garnet = otherPool('garnet');

  return {
    now,
    callBoard: [...trains.values()],
    // Their crews: the Call Board shows names, not turns; board-auto.js
    // matched them to turns (summary.yardCrew, no names).
    yardJobs: [...yard.values()].sort((a, b) => (a.onDuty ?? 0) - (b.onDuty ?? 0)).map((j) => ({
      ...j, crew: j.crew.length ? j.crew : (summary.yardCrew || []).filter((c) => c.job === j.job).map((c) => ({ craft: c.craft, turn: c.turn })) })),
    spareboards,
    leftBoard,
    vacancies: [...vacancies.values()].sort((a, b) => a.pos - b.pos),
    s5: s5 || [],
    garnet: garnet || [],
    chainGangHome: gangTurns.filter((t) => t.terminal === 0),
    chainGangAway: gangTurns.filter((t) => t.terminal !== 0),
    aHome: all.filter((t) => t.pool === 'SA' && t.terminal === 0),
    bHome: all.filter((t) => t.pool === 'SB' && t.terminal === 0),
    sdHome: engineersOnly(all.filter((t) => t.pool === 'SD' && t.terminal === 0)),
    s1Home: engineersOnly(all.filter((t) => t.pool === 'S1' && t.terminal === 0)),
    s3Home: engineersOnly(all.filter((t) => t.pool === 'S3' && t.terminal === 0)),
    lineup: [...lineup.values()],
    macLineup: [...macLineup.values()].sort((a, b) => a.order - b.order),
    bunkhouse: [...bunk.values()].sort((a, b) => a.pos - b.pos),
    seen: { callBoardPages: boardPages.length, chainGang: gangTurns.length > 0, aPool: all.some((t) => t.pool === 'SA'), bPool: all.some((t) => t.pool === 'SB'), lineup: lineup.size > 0, macLineup: macLineup.size > 0, bunkhouse: bunkRead, sdPool: all.some((t) => t.pool === 'SD'), s1Pool: all.some((t) => t.pool === 'S1'), s3Pool: all.some((t) => t.pool === 'S3'),
      yardJobs: yard.size > 0, coFast: !!spareboards.coFast, coSlow: !!spareboards.coSlow, enFast: !!spareboards.enFast, enSlow: !!spareboards.enSlow,
      terminal: terminalRead, s5Pool: !!s5, garnet: !!garnet },
  };
}

module.exports = { loadSummary };
