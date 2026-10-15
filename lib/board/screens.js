// Parsers for the three CATS screens the board check reads (layouts in
// docs/board-checker/SCREENS.md). Each takes rows from parseGrid and keeps
// only crafts, turn ids, train symbols and times. Names are never copied out.
const { at, hhmm, nearestDay } = require('./time');

// --- Call Board (Train Service 3 → 6 → Enter): crews on duty ---------------

function isCallBoard(text) {
  return /CALL\s+BOARD/.test(text) && /ON\s+DUTY\s+AT:/.test(text);
}

// Page header "26/10/14-1553" is YY/MM/DD-HHMM: the moment of the snapshot.
function callBoardTime(rows) {
  for (const r of rows) {
    const m = /(\d{2})\/(\d{2})\/(\d{2})-\s*(\d{3,4})\b/.exec(r.text);
    // A masked header reads 99/99/99: not a date, so fall through.
    if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) {
      const t = m[4].padStart(4, '0');
      return at(2000 + +m[1], +m[2], +m[3], +t.slice(0, 2), +t.slice(2));
    }
  }
  return null;
}

const TRAIN_LINE = /^([A-Z]{1,3}\d{3,5}[A-Z]?)\s+(\d{2})\s+ON\s+DUTY\s+AT:\s+(\S+)\s+(\d{2})\/(\d{2})\/(\d{2})\s+(\d{4})$/;
const TURN_ID = /^[A-Z][A-Z0-9]\d{2}$/;

// A42431 → A424 (last two digits are routing). Deadheads keep their letter:
// DHT211B → DHT211B.
function trainNoOf(symbol) {
  return /^DH/.test(symbol) ? symbol : symbol.slice(0, -2);
}
const CRAFT = /^(EN|CO|ET|FO|S1|B1|BR|YF|TR)$/;

// Returns the trains on one page, and whether the yard jobs have started
// (trains always come first, so that's where paging stops).
function parseCallBoardPage(rows) {
  const trains = [];
  let reachedYard = false;
  let current = null;
  for (const r of rows) {
    if (/ON\s+DUTY\s+AT:/.test(r.text)) {
      const m = TRAIN_LINE.exec(r.text);
      if (!m) { reachedYard = true; current = null; continue; }
      const t = hhmm(m[7]);
      current = {
        symbol: m[1],
        trainNo: trainNoOf(m[1]),
        originDay: m[2],
        station: m[3],
        onDuty: at(2000 + +m[4], +m[5], +m[6], t.hour, t.minute),
        crew: [],
      };
      trains.push(current);
      continue;
    }
    if (!current || !r.cells.length) continue;
    const first = r.cells[0];
    const last = r.cells[r.cells.length - 1];
    if (CRAFT.test(first.text) && first.left < 130 && TURN_ID.test(last.text)) {
      current.crew.push({ craft: first.text, turn: last.text });
    }
  }
  return { trains, reachedYard };
}

// --- Chain Gang position (Train Service 23, POOL SR, TERM n, CC CO) --------

function isChainGang(text) {
  return /CHAIN GANG-\s*POS/.test(text) && /POOL:/.test(text);
}

// Column positions come from the heading row (CC TURN T POS … ST RN … SC REST),
// so status and rest cells are found by where they sit, not by guessing.
function parseChainGang(rows, now) {
  let terminal = null;
  let pool = null;
  let header = null;
  for (const r of rows) {
    const m = /POOL:\s*\(\s*(\w+)\s*\)\s*TERM:\s*\(\s*(\d)\s*\)/.exec(r.text);
    if (m) { pool = m[1]; terminal = +m[2]; }
    if (/\bCC\b/.test(r.text) && /\bPOS\b/.test(r.text) && /\bREST\b/.test(r.text)) {
      const col = (re) => {
        const c = r.cells.find((x) => re.test(x.text));
        return c ? c.left : null;
      };
      header = { st: col(/^ST$/), rn: col(/^RN$/), sc: col(/^SC$/), rest: col(/^REST$/) };
    }
  }
  if (!header) throw new Error('Chain Gang screen: column headings not found');

  const turns = [];
  for (const r of rows) {
    const c = r.cells;
    if (c.length < 4 || !/^SR\d{2}$/.test(c[1].text) || !/^\d$/.test(c[2].text) || !/^\d{3}$/.test(c[3].text)) continue;
    const near = (left, target) => target != null && Math.abs(left - target) <= 14;
    const st = c.find((x) => near(x.left, header.st));
    const rn = c.find((x) => near(x.left, header.rn));
    const statusCells = c.filter((x) => x.left > (header.rn ?? 0) + 14 && x.left < header.sc);
    const restCells = c.filter((x) => x.left >= header.sc);
    const timeAndDay = (cells) => {
      const t = cells.find((x) => /^\d{4}$/.test(x.text));
      if (!t) return null;
      const d = cells.find((x) => /^\d{1,2}$/.test(x.text) && x.left > t.left);
      const { hour, minute } = hhmm(t.text);
      // No day shown: assume the snapshot's own day.
      return d ? nearestDay(now, +d.text, hour, minute) : nearestDay(now, new Date(now * 60000).getUTCDate(), hour, minute);
    };
    // POS 999 + a train symbol (status B0) = called and out working.
    const workingOn = c.find((x) => x.left > header.sc && /^[A-Z]{1,3}\d{3,5}[A-Z]?$/.test(x.text));
    turns.push({
      craft: c[0].text,
      turn: c[1].text,
      terminal: +c[2].text,
      pos: +c[3].text,
      working: +c[3].text === 999 || !!workingOn,
      workingOn: workingOn ? workingOn.text : null,
      st: st ? st.text : null,
      rn: rn ? rn.text : null,
      statusUntil: timeAndDay(statusCells),
      restUntil: timeAndDay(restCells),
    });
  }
  return { pool, terminal, turns };
}

// --- Train Line-up (Train Service 41): ordered (ORD) and planned (PLN) -----

function isLineup(text) {
  return /TRAIN LINE UP/.test(text);
}

const LINEUP_ROW = /^(\d{2})(\d{2})-(\d{2})(\d{2})\s+([NSEW])\s+([A-Z]{3})\s+(\S+)\s+(\d{2})\s+(\d{5})\s+(.*?)\s+(\S+)\s+(\S+)$/;

function parseLineup(rows, now) {
  const trains = [];
  const year = new Date(now * 60000).getUTCFullYear();
  for (const r of rows) {
    const m = LINEUP_ROW.exec(r.text);
    if (!m) continue;
    // MMDD-HHMM; pick the year that puts it nearest the snapshot (New Year).
    const order = [year - 1, year, year + 1]
      .map((y) => at(y, +m[1], +m[2], +m[3], +m[4]))
      .reduce((best, c) => (Math.abs(c - now) < Math.abs(best - now) ? c : best));
    const info = m[10];
    trains.push({
      order,
      direction: m[5],
      status: m[6], // ORD = ordered, PLN = planned (estimate)
      symbol: m[7],
      trainNo: trainNoOf(m[7]),
      originDay: m[8],
      originStation: m[9],
      info,
      deadhead: /^DH/.test(m[7]) || /\bDT\b/.test(info),
      engCrew: m[11],
      trnCrew: m[12],
    });
  }
  return trains;
}

module.exports = {
  trainNoOf,
  isCallBoard, callBoardTime, parseCallBoardPage,
  isChainGang, parseChainGang,
  isLineup, parseLineup,
};
