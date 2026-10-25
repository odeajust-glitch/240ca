// Parsers for the three CATS screens the board check reads (layouts in
// docs/board-checker/SCREENS.md). Each takes rows from parseGrid and keeps
// only crafts, turn ids, train symbols and times. Names are never copied out.
const { at, hhmm, nearestDay } = require('./time');
const { personCode } = require('./people');

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

// Yard job crews (owner, 2026-10-24): any turn id, e.g. YPRS02 or B138.
const ANY_TURN = /^[A-Z][A-Z0-9]{1,5}$/;
const hasDigit = (t) => /\d/.test(t);
// The Call Board ends its jobs with the crews in town (owner, 2026-10-24:
// "CREWS IN TOWN POOL: S1/SA C+C RESTED/STATUS"); paging stops there.
// The line reads "CREWS IN TOWN" on its own (owner's screenshot); TOWN
// comes through masked.
const CREWS_IN_TOWN = /^CREWS\s+IN\s+(TOWN|AAAA)$/;

// Returns the trains on one page, the yard jobs (owner, 2026-10-24: they
// come after the trains), whether the yard jobs have started, and whether
// the crews-in-town list (the end) has. now: the page's clock, for a yard
// job time with no date.
function parseCallBoardPage(rows, now = null) {
  const trains = [];
  const yard = [];
  let reachedYard = false;
  let crewsInTown = false;
  let current = null;
  let job = null;
  for (const r of rows) {
    if (CREWS_IN_TOWN.test(r.text)) { crewsInTown = true; break; }
    if (/ON\s+DUTY\s+AT:/.test(r.text)) {
      const m = TRAIN_LINE.exec(r.text);
      if (!m) {
        reachedYard = true;
        current = null;
        job = yardJob(r, now);
        if (job) yard.push(job);
        continue;
      }
      job = null;
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
    if (!r.cells.length) continue;
    const first = r.cells[0];
    const last = r.cells[r.cells.length - 1];
    if (job && CRAFT.test(first.text) && first.left < 130 && ANY_TURN.test(last.text) && hasDigit(last.text)) {
      job.crew.push({ craft: first.text, turn: last.text });
      continue;
    }
    if (!current) continue;
    if (CRAFT.test(first.text) && first.left < 130 && TURN_ID.test(last.text)) {
      current.crew.push({ craft: first.text, turn: last.text });
    }
  }
  return { trains, yard, reachedYard, crewsInTown };
}

// A yard job's line: job id first (e.g. YPRS02), "ON DUTY AT: SARNIA",
// and its on-duty date and time (YY/MM/DD HHMM), or just a time.
function yardJob(r, now) {
  const id = r.cells[0] && r.cells[0].text;
  // Checks saved before 2026-10-24 have the job id masked (AAAA99): skip.
  if (!id || !ANY_TURN.test(id) || !hasDigit(id) || /^A+9+$/.test(id)) return null;
  const station = (/ON\s+DUTY\s+AT:\s+([A-Z]+)/.exec(r.text) || [])[1] || '';
  let onDuty = null;
  const d = /(\d{2})\/(\d{2})\/(\d{2})\s+(\d{4})/.exec(r.text);
  if (d) {
    const t = hhmm(d[4]);
    onDuty = at(2000 + +d[1], +d[2], +d[3], t.hour, t.minute);
  } else if (now != null) {
    const t = r.cells.slice(1).find((c) => /^\d{4}$/.test(c.text));
    if (t) { const x = hhmm(t.text); onDuty = nearestDay(now, new Date(now * 60000).getUTCDate(), x.hour, x.minute); }
  }
  return { job: id, station, onDuty, crew: [] };
}

// Names off an unmasked Call Board page, for the grievance letters only
// (lib/board/names.js keeps them out of everything that's saved). A crew line
// is craft | SURNAME + marks (*, +) | optional (NET) | initials | FIRST NAME |
// turn (owner's screenshot, 2026-10-14). → [{ symbol, originDay, station,
// crew: [{ craft, turn, name: "Mike de Man" }] }]
const PARTICLES = new Set(['de', 'del', 'della', 'der', 'den', 'van', 'von', 'da', 'di', 'du', 'la', 'le']);
function properCase(word) {
  return word.toLowerCase().replace(/(^|['\-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}
function personName(cells) {
  const parts = cells.map((c) => c.text.replace(/\([^)]*\)\S*/g, '').replace(/[*+]/g, '').trim()).filter(Boolean);
  if (!parts.length) return null;
  const surname = parts[0].split(/\s+/).map((w, i, all) => (i < all.length - 1 && PARTICLES.has(w.toLowerCase()) ? w.toLowerCase() : properCase(w))).join(' ');
  const first = parts.length > 1 ? properCase(parts[parts.length - 1].split(/\s+/)[0]) : '';
  return first ? `${first} ${surname}` : surname;
}
function parseCallBoardNames(rows) {
  const trains = [];
  let current = null;
  for (const r of rows) {
    if (/ON\s+DUTY\s+AT:/.test(r.text)) {
      const m = TRAIN_LINE.exec(r.text);
      current = m ? { symbol: m[1], originDay: m[2], station: m[3], crew: [] } : null;
      if (current) trains.push(current);
      continue;
    }
    if (!current || r.cells.length < 3) continue;
    const first = r.cells[0];
    const last = r.cells[r.cells.length - 1];
    if (!CRAFT.test(first.text) || first.left >= 130 || !TURN_ID.test(last.text)) continue;
    const name = personName(r.cells.slice(1, -1));
    if (name) current.crew.push({ craft: first.text, turn: last.text, name });
  }
  return trains;
}

// --- Chain Gang position (Train Service 23, POOL SR, TERM n, CC CO) --------

// Pool position screens: 19 (A), 21 (B), 23 (Chain Gang). All share the
// POOL/TERM/CC prompt and the CC TURN T POS … REST heading.
function isPoolPosition(text) {
  return /POOL:/.test(text) && /TERM:/.test(text) && /\bCC\b/.test(text) && /\bPOS\b/.test(text);
}
const isChainGang = isPoolPosition;

// Column positions come from the heading row (CC TURN T POS … ST RN … SC REST),
// so status and rest cells are found by where they sit, not by guessing.
// opts.anyTurn: turns other than Sxnn too (501/502 has MU01, owner 2026-10-24).
function parseChainGang(rows, now, opts = {}) {
  const turnRe = opts.anyTurn ? /^[A-Z][A-Z0-9]\d{2}$/ : /^S[A-Z0-9]\d{2}$/;
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
    if (c.length < 4 || !turnRe.test(c[1].text) || !/^\d$/.test(c[2].text) || !/^\d{3}$/.test(c[3].text)) continue;
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
    // POS 999 + a train symbol = called and out working on that train. B0
    // alone (owner): working another job, so the turn goes spare if called.
    const workingOn = c.find((x) => x.left > header.sc && /^[A-Z]{1,3}\d{3,5}[A-Z]?$/.test(x.text));
    turns.push({
      pool: c[1].text.slice(0, 2), // SA, SB, SR, SD, S1, S3
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

// --- Who's on a yard job (owner, 2026-10-24) ------------------------------
// A yard job's crew lines on the Call Board have no turn, only names (owner's
// screenshot: "FO DESCHENES+ M MATTHEW"). board-auto.js reads the yard jobs
// and the boards unmasked, matches people by surname + first initial, and
// keeps only job + craft + turn. These helpers work on that unmasked grid,
// in memory; nothing here is saved.

// "JACOBSEN+(N/NT)N NEIL" → { surname: JACOBSEN, initial: N, first: NEIL }.
// The initials are the first one- or two-letter word after the surname;
// the first name (CATS cuts it short, e.g. JEREM) follows them.
function nameParts(cells) {
  const words = cells.map((c) => c.text).join(' ').replace(/\([^)]*\)/g, ' ').replace(/[*+]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const i = words.findIndex((w, k) => k > 0 && /^[A-Z]{1,2}$/.test(w));
  if (i < 1) return null;
  return { surname: words.slice(0, i).join(' '), initial: words[i][0], first: words[i + 1] && /^[A-Z'-]{2,}$/.test(words[i + 1]) ? words[i + 1] : '' };
}
// "JACOBSEN/N", for matching people across screens.
function nameKey(cells) {
  const p = nameParts(cells);
  return p ? `${p.surname}/${p.initial}` : null;
}
// The hidden search code (lib/board/people.js): JUOD.
function codeOf(cells) {
  const p = nameParts(cells);
  return p ? personCode(p.surname, p.first) : null;
}

// The yard jobs' crews off an unmasked Call Board page: [{ job, craft, key }].
function parseYardCrewNames(rows) {
  const out = [];
  let job = null;
  for (const r of rows) {
    if (CREWS_IN_TOWN.test(r.text)) break;
    if (/ON\s+DUTY\s+AT:/.test(r.text)) {
      const id = r.cells[0] && r.cells[0].text;
      job = !TRAIN_LINE.test(r.text) && id && ANY_TURN.test(id) && hasDigit(id) ? id : null;
      continue;
    }
    if (!job || r.cells.length < 3 || !/^[A-Z][A-Z0-9]$/.test(r.cells[0].text)) continue;
    const key = nameKey(r.cells.slice(1));
    if (key) out.push({ job, craft: r.cells[0].text, key, code: codeOf(r.cells.slice(1)) });
  }
  return out;
}

// Train crews off an unmasked Call Board page, with the job's turn as CATS
// shows it (a spare person filling in for someone absent shows under that
// job's turn, owner 2026-10-24): [{ train, craft, job, key }].
function parseTrainCrewNames(rows) {
  const out = [];
  let train = null;
  for (const r of rows) {
    if (CREWS_IN_TOWN.test(r.text)) break;
    if (/ON\s+DUTY\s+AT:/.test(r.text)) {
      const m = TRAIN_LINE.exec(r.text);
      train = m ? `${m[1]} ${m[2]}` : null;
      continue;
    }
    if (!train || r.cells.length < 3) continue;
    const first = r.cells[0];
    const last = r.cells[r.cells.length - 1];
    if (!CRAFT.test(first.text) || first.left >= 130 || !TURN_ID.test(last.text)) continue;
    const key = nameKey(r.cells.slice(1, -1));
    if (key) out.push({ train, craft: first.text, job: last.text, key, code: codeOf(r.cells.slice(1, -1)) });
  }
  return out;
}

// People and their turns off an unmasked board: a spareboard (name …
// TURN POS) or a pool screen (CC TURN T POS NAME…): [{ key, turn }].
function parseBoardNames(rows) {
  const out = [];
  for (const r of rows) {
    const c = r.cells;
    if (c.length >= 6 && /^(EN|CO|LE|B1)$/.test(c[0].text) && /^[A-Z][A-Z0-9]\d{2}$/.test(c[1].text) && /^\d$/.test(c[2].text) && /^\d{3}$/.test(c[3].text)) {
      const key = nameKey(c.slice(4, 7));
      // Their own turn only at home (T 0) and not working (999, or a train
      // in INFO): away or working may be a spare covering a trip (owner).
      const working = c[3].text === '999' || c.slice(5).some((x) => /^[A-Z]{1,3}\d{4,5}$/.test(x.text));
      // TV beside the name (owner, 2026-10-25): the turn is going spare and
      // the person is on another turn (e.g. JUOD on S501 with TV, really on SR03).
      const tv = c.slice(5).some((x) => x.text === 'TV');
      if (key) out.push({ key, turn: c[1].text, code: codeOf(c.slice(4, 7)), own: c[2].text === '0' && !working && !tv, from: 'pool' });
      continue;
    }
    const ti = c.findIndex((x, k) => k > 0 && /^[A-Z][A-Z0-9]{1,3}\d{2,3}$/.test(x.text) && c[k + 1] && /^\d{3}$/.test(c[k + 1].text));
    if (ti > 0) {
      // A Sarnia spareboard: their own turn (owner).
      const key = nameKey(c.slice(0, ti));
      if (key) out.push({ key, turn: c[ti].text, code: codeOf(c.slice(0, ti)), own: true, from: 'spare' });
    }
  }
  return out;
}

// --- Spareboards (owner, 2026-10-24): conductor fast 13 / slow 9 (from
// Train Service), engineer fast 19 / slow 17 (from menu 1). "SPAREBOARD
// INQUIRY"; one row per person: name (never kept), TURN, POS, ST, RN, RETN,
// REST (time + day), MTPD, USHR, PD, STT, #S, #O. Columns are found by the
// heading row; masked headings (RETN…) by their order after RN.

function isSpareboard(text) {
  return /SPAREBOARD/.test(text) && /\bTURN\b/.test(text) && /\bPOS\b/.test(text);
}

const timeAndDayIn = (cells, now) => {
  const t = cells.find((x) => /^\d{4}$/.test(x.text));
  if (!t) return null;
  const d = cells.find((x) => /^\d{1,2}$/.test(x.text) && x.left > t.left);
  const { hour, minute } = hhmm(t.text);
  return nearestDay(now, d ? +d.text : new Date(now * 60000).getUTCDate(), hour, minute);
};

function parseSpareboard(rows, now) {
  let header = null;
  for (const r of rows) {
    const names = r.cells.map((c) => c.text);
    const ti = names.indexOf('TURN');
    if (ti >= 0 && names.includes('POS') && names.includes('REST')) {
      const at = (i) => (r.cells[i] ? r.cells[i].left : null);
      const ri = names.indexOf('REST');
      const rn = names.indexOf('RN');
      header = { turn: at(ti), pos: at(names.indexOf('POS')), st: at(names.indexOf('ST')), rn: at(rn), retn: rn >= 0 ? at(rn + 1) : null, rest: at(ri), after: at(ri + 1) };
      break;
    }
  }
  if (!header) throw new Error('Spareboard screen: column headings not found');
  const near = (x, target) => target != null && Math.abs(x.left - target) <= 14;
  const turns = [];
  for (const r of rows) {
    const ti = r.cells.findIndex((c) => near(c, header.turn) && /^[A-Z][A-Z0-9]{1,3}\d{2,3}$/.test(c.text));
    if (ti < 0 || !r.cells[ti + 1] || !/^\d{3}$/.test(r.cells[ti + 1].text)) continue;
    const c = r.cells.slice(ti + 2);
    const st = c.find((x) => near(x, header.st));
    const rn = c.find((x) => near(x, header.rn));
    const end = header.after ?? Infinity;
    turns.push({
      turn: r.cells[ti].text,
      pos: +r.cells[ti + 1].text,
      terminal: 0,
      working: false,
      workingOn: null,
      st: st ? st.text : null,
      rn: rn ? rn.text : null,
      statusUntil: header.retn != null ? timeAndDayIn(c.filter((x) => x.left >= header.retn - 6 && x.left < header.rest - 6), now) : null,
      restUntil: timeAndDayIn(c.filter((x) => x.left >= header.rest - 6 && x.left < end - 6), now),
    });
  }
  return { turns };
}

// --- Terminal line-up, vacancies only (Train Service 5, Enter; owner,
// 2026-10-24: the jobs going spare). POS, CALL (MM/DD), TIME, TZ, STATUS,
// TRAIN/DESC, ORGSTN, PL, CC, ST, RETN (MM/DD), DTTM, TURN, EMP (a name,
// never kept). TURN is pool + turn on the road (S1S103 → S103) and the job
// id on a yard job (YPRS02).

function isTerminalLineup(text) {
  return /TERMINAL\s+LINEUP/.test(text);
}

function parseTerminalLineup(rows, now) {
  let h = null;
  for (const r of rows) {
    const names = r.cells.map((c) => c.text);
    if (names[0] === 'POS' && names.includes('TURN') && names.includes('STATUS')) {
      const at = (i) => (i >= 0 && r.cells[i] ? r.cells[i].left : null);
      const pl = names.indexOf('PL');
      h = { pos: at(0), call: at(1), time: at(2), status: at(names.indexOf('STATUS')), train: at(names.indexOf('STATUS') + 1), pl: at(pl), cc: at(pl + 1), st: at(pl + 2), retn: at(pl + 3), dttm: at(pl + 4), turn: at(names.indexOf('TURN')), emp: at(names.indexOf('TURN') + 1) };
      break;
    }
  }
  if (!h) return [];
  const near = (x, target) => target != null && Math.abs(x.left - target) <= 14;
  const year = new Date(now * 60000).getUTCFullYear();
  const when = (md, t) => {
    const m = /^(\d{2})\/(\d{2})$/.exec(md || '');
    if (!m) return null;
    const x = hhmm(/^\d{4}$/.test(t || '') ? t : '0000');
    return [year - 1, year, year + 1].map((y) => at(y, +m[1], +m[2], x.hour, x.minute)).reduce((b, c) => (Math.abs(c - now) < Math.abs(b - now) ? c : b));
  };
  const jobs = [];
  for (const r of rows) {
    const c = r.cells;
    if (!c.length || !near(c[0], h.pos) || !/^\d{3}$/.test(c[0].text)) continue;
    const cell = (left) => c.find((x) => near(x, left));
    const txt = (left) => (cell(left) || {}).text || '';
    const pool = txt(h.pl);
    let turn = txt(h.turn);
    if (pool && turn.length === 6 && turn.startsWith(pool)) turn = turn.slice(2);
    const st = c.filter((x) => x.left >= h.st - 6 && x.left < (h.retn ?? h.turn) - 6).map((x) => x.text).join(' ');
    const train = txt(h.train);
    jobs.push({
      pos: +c[0].text,
      at: when(txt(h.call), txt(h.time)),
      status: /^ORD/.test(txt(h.status)) ? 'ORDERED' : 'PLANNED',
      train,
      yard: pool === 'YD' || /^Y[A-Z]/.test(train),
      pool,
      cc: txt(h.cc),
      st,
      returns: h.retn != null ? when(txt(h.retn), txt(h.dttm)) : null,
      turn,
    });
  }
  return jobs;
}

module.exports = {
  trainNoOf,
  parseCallBoardNames,
  isCallBoard, callBoardTime, parseCallBoardPage,
  isPoolPosition, isChainGang, parseChainGang,
  isLineup, parseLineup,
  isSpareboard, parseSpareboard,
  isTerminalLineup, parseTerminalLineup,
  nameKey, parseYardCrewNames, parseTrainCrewNames, parseBoardNames,
};
