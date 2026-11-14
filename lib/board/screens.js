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
// A train's crew on the Call Board also lists a conductor trainee (owner,
// 2026-11-04: L50231 04 "TT DEMARS … S501" was missing from the line-up).
// Names (parseCallBoardNames) keep CRAFT: a trainee's name isn't the turn's.
const TRAIN_CRAFT = /^(EN|CO|ET|TT|FO|S1|B1|BR|YF|TR)$/;

// Yard job crews (owner, 2026-10-24): any turn id, e.g. YPRS02 or B138.
const ANY_TURN = /^[A-Z][A-Z0-9]{1,5}$/;
const hasDigit = (t) => /\d/.test(t);
// The Call Board ends its jobs with the crews in town (owner, 2026-10-24:
// "CREWS IN TOWN POOL: S1/SA C+C RESTED/STATUS"); paging stops there.
// The line reads "CREWS IN TOWN" on its own (owner's screenshot); TOWN
// comes through masked.
const CREWS_IN_TOWN = /^CREWS\s+IN\s+(TOWN|AAAA)$/;

// A train's or yard job's crew can run onto the next Call Board page (owner,
// 2026-11-13: "It also doesn't have me on the call board"; in the 05:41
// check L50131 12 had lost its CO S501 and M39671 11 its CO SA02, both back
// at 05:49: each train's last line was the top of the next page, before any
// heading, and was dropped). carry: an object the caller keeps from page to
// page; the train or job a page ends on carries on into the very next page
// (PAGE n + 1) only, never a page read out of turn.
function callBoardPageNo(rows) {
  for (const r of rows) {
    const m = /PAGE\s+(\d+)\s+OF\s+\d+/.exec(r.text);
    if (m) return +m[1];
  }
  return null;
}
function carriedOn(carry, rows) {
  const page = callBoardPageNo(rows);
  return { page, on: !!carry && page != null && carry.page != null && page === carry.page + 1 };
}

// Returns the trains on one page, the yard jobs (owner, 2026-10-24: they
// come after the trains), whether the yard jobs have started, and whether
// the crews-in-town list (the end) has. now: the page's clock, for a yard
// job time with no date. carry: see carriedOn (the train or job already
// returned with the page before gets the lines that run on).
function parseCallBoardPage(rows, now = null, carry = null) {
  const { page, on } = carriedOn(carry, rows);
  const trains = [];
  const yard = [];
  let current = on ? carry.train || null : null;
  let job = on ? carry.job || null : null;
  let reachedYard = !!job;
  let crewsInTown = false;
  for (const r of rows) {
    if (CREWS_IN_TOWN.test(r.text)) { crewsInTown = true; current = null; job = null; break; }
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
    if (TRAIN_CRAFT.test(first.text) && first.left < 130 && TURN_ID.test(last.text)) {
      current.crew.push({ craft: first.text, turn: last.text });
    }
  }
  if (carry) Object.assign(carry, { page, train: current, job });
  return { trains, yard, reachedYard, crewsInTown };
}

// Another terminal's Call Board (owner, 2026-11-14: the Toronto South Call
// Board, for our trains out of Mac yard; lib/board/toronto-south.js). The
// same screen as ours, read only for its trains: "<train> <day> ON DUTY AT:
// <where> YY/MM/DD HHMM" and the crew lines under it (craft … turn). Where can
// be more than one word (and comes through masked unless it's a known word),
// and their turns needn't look like ours, so this is looser than
// parseCallBoardPage. Stops at the first yard job or the crews in town.
// carry: as parseCallBoardPage's, for a crew that runs on to the next page.
const ANY_TRAIN_LINE = /^([A-Z]{1,3}\d{3,5}[A-Z]?)\s+(\d{2})\s+ON\s+DUTY\s+AT:\s+(.+?)\s+(\d{2})\/(\d{2})\/(\d{2})\s+(\d{4})$/;
function parseCallBoardTrains(rows, carry = null) {
  const { page, on } = carriedOn(carry, rows);
  const trains = [];
  let current = on ? carry.train || null : null;
  let reachedYard = false;
  let crewsInTown = false;
  for (const r of rows) {
    if (CREWS_IN_TOWN.test(r.text)) { crewsInTown = true; current = null; break; }
    if (/ON\s+DUTY\s+AT:/.test(r.text)) {
      const m = ANY_TRAIN_LINE.exec(r.text);
      if (!m) { reachedYard = true; current = null; break; }
      const t = hhmm(m[7]);
      current = { symbol: m[1], originDay: m[2], station: m[3].trim(), onDuty: at(2000 + +m[4], +m[5], +m[6], t.hour, t.minute), crew: [] };
      trains.push(current);
      continue;
    }
    if (!current || !r.cells.length) continue;
    const first = r.cells[0];
    const last = r.cells[r.cells.length - 1];
    if (TRAIN_CRAFT.test(first.text) && first.left < 130 && r.cells.length > 1 && ANY_TURN.test(last.text) && hasDigit(last.text)) {
      current.crew.push({ craft: first.text, turn: last.text });
    }
  }
  if (carry) Object.assign(carry, { page, train: current });
  return { trains, reachedYard, crewsInTown };
}

// Which terminal a Call Board page is for: the line under its header
// ("SARNIA" on ours, 2026-10-14 probe), '' when there's none.
function callBoardPlace(rows) {
  const r = (rows || []).slice(1, 4).find((x) => x.cells.length && !/\d/.test(x.text) && !/CALL\s+BOARD/.test(x.text));
  return r ? r.text.trim() : '';
}

// The crews in town (TODO #10; owner's screenshots, Call Board pages 5–10
// of 29, 2026-11-03). Every page of the list starts with the CREWS IN TOWN
// heading, then pools, each "POOL: <name>  RESTED/STATUS" and its crews:
//   01 CO SA02 <name>          ** RESTED **        rested
//   03 CO SB05 <name>          26/11/03-1815       rest until then
//   05 EN SD07 <name>          **HT 1104 0635      hold turn until 11/04 0635 (owner)
//      ET S102 <name>          << VACANCY >>       holder off the turn (booked off…; owner)
//      S1 <name>               <<TEMP VCNY>>       holder working another job for now (owner)
//      FO <name>               *** OFF ***         their day off
//      TT SB99 << OPEN TURN >>                     no one on the turn
//      << NO CREWS IN TOWN >>                      pool empty
// No position + TT / ET: a trainee (conductor / engineer) on that turn
// (owner). Yard jobs come as "YARD : XSAS01 REL#1 TH/FR OFF" with crew
// lines of craft + name only (no turn; "TEMP" in front = a temporary
// fill-in, owner). A pool carries on to the next page without its heading.
// Nearly everyone listed is on their own (home) turn (owner).
const TOWN_CRAFT = '(?:EN|CO|ET|TT|FO|S1|B1|BR|YF|YA|TR|LE|YM|RC)';
const TOWN_TURN_ROW = new RegExp(`^(?:(\\d{2})\\s+)?(TEMP\\s+)?(${TOWN_CRAFT})\\s+([A-Z][A-Z0-9]\\d{2})\\b`);
const TOWN_YARD_ROW = new RegExp(`^(TEMP\\s+)?(${TOWN_CRAFT})\\s+(.*)$`);
const TOWN_OPEN = /<<\s*OPEN\s+TURN\s*>>/;
function crewStatus(text, now) {
  if (/\*\*\s*RESTED\s*\*\*\s*$/.test(text)) return { status: 'rested', until: null };
  if (/<<\s*VACANCY\s*>>\s*$/.test(text)) return { status: 'vacancy', until: null };
  if (/<<\s*TEMP\s+VCNY\s*>>\s*$/.test(text)) return { status: 'tempVacancy', until: null };
  if (/\*\*\*\s*OFF\s*\*\*\*\s*$/.test(text)) return { status: 'off', until: null };
  let m = /(\d{2})\/(\d{2})\/(\d{2})-(\d{4})\s*$/.exec(text);
  if (m) { const t = hhmm(m[4]); return { status: 'rest', until: at(2000 + +m[1], +m[2], +m[3], t.hour, t.minute) }; }
  m = /\*\*\s*HT\s+(\d{2})(\d{2})\s+(\d{4})\s*$/.exec(text);
  if (m) {
    const t = hhmm(m[3]);
    let until = null;
    if (now != null) {
      const y = new Date(now * 60000).getUTCFullYear();
      // The year that puts it nearest the check (December → January).
      until = [y - 1, y, y + 1].map((yy) => at(yy, +m[1], +m[2], t.hour, t.minute)).sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0];
    }
    return { status: 'hold', until };
  }
  return { status: 'other', until: null };
}
// Walks the list: each pool / yard job (onPool) and each crew line
// (onCrew(pool, crew, nameCells)). nameCells: the cells between the
// turn (or craft) and the status column, i.e. the name; only the
// in-memory name read looks at them.
function walkCrewsInTown(pages, now, onPool, onCrew) {
  let seen = false;
  let pool = null;
  let statusLeft = null;
  for (const rows of pages) {
    let on = false;
    for (const r of rows) {
      const text = r.text.replace(/\s+/g, ' ').trim();
      if (CREWS_IN_TOWN.test(text)) { on = true; seen = true; continue; }
      if (!on || !text || /NO\s+CREWS\s+IN\s+(TOWN|AAAA)/.test(text)) continue;
      const head = /^POOL:\s*(.*?)\s*(?:\S+\/STATUS)?$/.exec(text);
      const yard = /^YARD\s*:\s*(\S+)\s*(.*?)\s*(?:\S+\/STATUS)?$/.exec(text);
      if (head || yard) {
        const h = r.cells.find((x) => /STATUS/.test(x.text));
        statusLeft = h ? h.left : null;
        pool = head ? { pool: head[1].replace(/"/g, ' ').replace(/\s+/g, ' ').trim(), crews: [] }
          : { pool: `YARD ${yard[1]}`, yard: yard[1], notes: yard[2], crews: [] };
        onPool(pool);
        continue;
      }
      if (!pool || /=/.test(text)) continue; // the F-key line
      const st = crewStatus(text, now);
      const nameOf = (after) => r.cells.filter((x) => x.left > after.left && (statusLeft == null || x.left < statusLeft - 18));
      if (TOWN_OPEN.test(text)) {
        const o = new RegExp(`^(${TOWN_CRAFT})\\s+(?:([A-Z][A-Z0-9]\\d{2})\\s+)?<<`).exec(text);
        onCrew(pool, { pos: null, craft: o ? o[1] : null, turn: (o && o[2]) || null, status: 'open', until: null, trainee: false, temp: false }, []);
        continue;
      }
      const c = pool.yard ? null : TOWN_TURN_ROW.exec(text);
      if (c) {
        const turnCell = r.cells.find((x) => x.text === c[4]);
        onCrew(pool, { pos: c[1] ? +c[1] : null, craft: c[3], turn: c[4], ...st, trainee: !c[1] && /^(TT|ET)$/.test(c[3]), temp: !!c[2] }, turnCell ? nameOf(turnCell) : []);
        continue;
      }
      const y = pool.yard ? TOWN_YARD_ROW.exec(text) : null;
      if (y) {
        const craftCell = r.cells.find((x) => x.text === y[2]);
        onCrew(pool, { pos: null, craft: y[2], turn: null, ...st, trainee: false, temp: !!y[1] }, craftCell ? nameOf(craftCell) : []);
      }
    }
  }
  return seen;
}
// → null (no list read) or [{ pool, yard?, notes?, crews: [{ pos, craft,
// turn, status rested/rest/hold/vacancy/tempVacancy/off/open/other, until,
// trainee, temp }] }]. Never a name.
function parseCrewsInTown(pages, now = null) {
  const pools = [];
  const seen = walkCrewsInTown(pages, now, (p) => pools.push(p), (p, crew) => p.crews.push(crew));
  return seen ? pools : null;
}
// The same list read unmasked, in memory only: who is on which turn (or
// yard job): [{ key, code, turn, job, craft, status, until, trainee, temp }].
// board-auto.js keeps only the name codes' hashes (people sightings).
function parseCrewsInTownNames(pages, now = null) {
  const out = [];
  walkCrewsInTown(pages, now, () => {}, (p, crew, nameCells) => {
    if (crew.status === 'open' || !nameCells.length) return;
    const key = nameKey(nameCells);
    // name: whole, as the crews in town show it (MATTHEW, not MATT): memory only (board-auto nameByHash).
    if (key) out.push({ key, code: codeOf(nameCells), name: townPersonName(nameCells), turn: crew.turn, job: p.yard || null, craft: crew.craft, status: crew.status, until: crew.until, trainee: crew.trainee, temp: crew.temp });
  });
  return out;
}

// Whose yard job it is, by name, for the crew names on the board (owner,
// 2026-11-11: "the on-duty crews isn't necessarily the actual person who owns
// that yard turn. Those names will be a bit further in the option 6 screen").
// The crews in town list each yard job's own people by craft; a TEMP line is
// a fill-in and is left out; an open craft reads "open turn". Unmasked, in
// memory, then names.json on the laptop only.
// -> [{ job, craft, name: "Jeremy Meadow" }]
function townPersonName(cells) {
  // "LAKE*+ (NET) C CLAYTON", "HILL*+ TR TREVOR", "FIELD*+(NET) PAUL": the
  // last word is the first name; the initials before it are dropped.
  const words = cells.map((c) => c.text).join(' ').replace(/\([^)]*\)/g, ' ').replace(/[*+<>#]/g, ' ').split(/\s+/).filter(Boolean);
  return nameOfWords(words);
}
// SURNAME (one word or more), INITIALS (one or two letters, one or more),
// FIRST NAME, and sometimes something more after it on the line (owner,
// 2026-11-14: "Chad, Tyson is his name (Last, First)": a word after TYSON on
// his row made the site show "Chad T Tyson, Q"). The first name is the word
// just after the initials, as nameParts reads it for the name code; with no
// initials (NITZ+ CHRISTOP), the last word. "Tyson Chad".
function nameOfWords(words) {
  if (!words.length) return null;
  if (words.length === 1) return properCase(words[0]);
  const isInitial = (w) => /^[A-Z]{1,2}$/i.test(w) && !PARTICLES.has(w.toLowerCase());
  let first = null;
  let sur = null;
  const i = words.findIndex((w, k) => k > 0 && isInitial(w));
  if (i > 0) {
    let j = i;
    while (j + 1 < words.length && isInitial(words[j + 1])) j++;
    if (j + 1 < words.length) { first = words[j + 1]; sur = words.slice(0, i); }
  }
  if (!first) {
    first = words[words.length - 1];
    sur = words.slice(0, -1);
    while (sur.length > 1 && isInitial(sur[sur.length - 1])) sur = sur.slice(0, -1);
  }
  const surname = sur.map((w, k, all) => (k < all.length - 1 && PARTICLES.has(w.toLowerCase()) ? w.toLowerCase() : properCase(w))).join(' ');
  return `${properCase(first)} ${surname}`;
}
function parseYardOwners(pages, now = null) {
  const out = [];
  walkCrewsInTown(pages, now, () => {}, (p, crew, nameCells) => {
    if (!p.yard || !crew.craft || crew.temp) return;
    // An empty trainee slot (TT / ET) is not a vacancy: say nothing (seen on the
    // live test site, 2026-11-10: "TT open turn" on most jobs).
    if (crew.status === 'open' && /^(TT|ET)$/.test(crew.craft)) return;
    const name = crew.status === 'open' ? OPEN_TURN : nameCells.length ? townPersonName(nameCells) : null;
    if (name) out.push({ job: p.yard, craft: crew.craft, name });
  });
  return out;
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
const OPEN_TURN = 'open turn';
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
// carry: as parseCallBoardPage's (a train's crew running onto the next page).
function parseCallBoardNames(rows, carry = null) {
  const { page, on } = carriedOn(carry, rows);
  const trains = [];
  let current = on ? carry.train || null : null;
  for (const r of rows) {
    if (CREWS_IN_TOWN.test(r.text)) { current = null; break; }
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
  if (carry) Object.assign(carry, { page, train: current });
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
  // No initials shown (owner's screenshot: "NITZ+  CHRISTOP"): surname, then
  // the first name; its first letter stands in for the initial.
  if (i < 1) return words.length >= 2 && /^[A-Z'-]{2,}$/.test(words[1]) ? { surname: words[0], initial: words[1][0], first: words[1] } : null;
  return { surname: words.slice(0, i).join(' '), initial: words[i][0], first: words[i + 1] && /^[A-Z'-]{2,}$/.test(words[i + 1]) ? words[i + 1] : '' };
}
// "JACOBSEN/N/NEI", for matching people across screens. The first name's
// first 3 letters too (owner, 2026-11-05: SD01's holder, D DONAL…, was put
// on YEBS04 because its S1 has the same surname and initial, D DYLAN).
// CATS cuts first names to 4–5 letters on the boards (KARA, DONAL) and shows
// them whole on the Call Board, so 3 letters match on every screen.
function nameKey(cells) {
  const p = nameParts(cells);
  if (!p) return null;
  const f = String(p.first || '').replace(/[^A-Z]/g, '');
  return f.length >= 3 ? `${p.surname}/${p.initial}/${f.slice(0, 3)}` : `${p.surname}/${p.initial}`;
}
// The hidden search code (lib/board/people.js): JUOD.
function codeOf(cells) {
  const p = nameParts(cells);
  return p ? personCode(p.surname, p.first) : null;
}

// The yard jobs' crews off an unmasked Call Board page: [{ job, craft, key }].
// Also who it is, readably, and the job's on-duty time (owner, 2026-11-11:
// "The call board has the right jobs but wrong people currently working it
// listed": the site showed a yard job's worker only when they matched a
// spareboard turn, so a regular or a relief crew on the job was missing and
// the "Assigned" line read as the crew). name / onDuty go only into the
// laptop's names.json and the locked crew names file.
// carry: { job, onDuty } kept between pages by the caller. A job's line can be
// the last thing on one page and its crew the first thing on the next (his
// photos: YINS30 at the foot of page 3, its three people at the top of page 4).
function parseYardCrewNames(rows, carry = null) {
  const out = [];
  let job = carry ? carry.job || null : null;
  let onDuty = carry ? carry.onDuty ?? null : null;
  for (const r of rows) {
    if (CREWS_IN_TOWN.test(r.text)) break;
    if (/ON\s+DUTY\s+AT:/.test(r.text)) {
      const id = r.cells[0] && r.cells[0].text;
      job = !TRAIN_LINE.test(r.text) && id && ANY_TURN.test(id) && hasDigit(id) ? id : null;
      const y = job ? yardJob(r, null) : null;
      onDuty = y ? y.onDuty : null;
      continue;
    }
    if (!job || r.cells.length < 3 || !/^[A-Z][A-Z0-9]$/.test(r.cells[0].text)) continue;
    const key = nameKey(r.cells.slice(1));
    if (key) out.push({ job, craft: r.cells[0].text, key, code: codeOf(r.cells.slice(1)), name: townPersonName(r.cells.slice(1)), onDuty });
  }
  if (carry) { carry.job = job; carry.onDuty = onDuty; }
  return out;
}

// Train crews off an unmasked Call Board page, with the job's turn as CATS
// shows it (a spare person filling in for someone absent shows under that
// job's turn, owner 2026-10-24): [{ train, craft, job, key }].
// carry: as parseCallBoardPage's (a train's crew running onto the next page).
function parseTrainCrewNames(rows, carry = null) {
  const { page, on } = carriedOn(carry, rows);
  const out = [];
  let train = on ? carry.train || null : null;
  for (const r of rows) {
    if (CREWS_IN_TOWN.test(r.text)) { train = null; break; }
    if (/ON\s+DUTY\s+AT:/.test(r.text)) {
      const m = TRAIN_LINE.exec(r.text);
      train = m ? `${m[1]} ${m[2]}` : null;
      continue;
    }
    if (!train || r.cells.length < 3) continue;
    const first = r.cells[0];
    const last = r.cells[r.cells.length - 1];
    // TT too (owner, 2026-11-04: WADE, a TT riding with S501, dropped off
    // when his crew left Sarnia): board-auto puts a trainee on S501-TT.
    if (!TRAIN_CRAFT.test(first.text) || first.left >= 130 || !TURN_ID.test(last.text)) continue;
    const key = nameKey(r.cells.slice(1, -1));
    // name: whole, as the Call Board shows it: memory only (board-auto nameByHash).
    if (key) out.push({ train, craft: first.text, job: last.text, key, code: codeOf(r.cells.slice(1, -1)), name: personName(r.cells.slice(1, -1)) });
  }
  if (carry) Object.assign(carry, { page, train });
  return out;
}

// People and their turns off an unmasked board: a spareboard (name …
// TURN POS) or a pool screen (CC TURN T POS NAME…): [{ key, turn }].
// Who CATS shows on each turn of a pool or spareboard screen, by name, for
// the crew names on the board (owner, 2026-11-10: his photo of the A pool,
// "CO SA05 0 001 ALLEN*+ (NET)B BEN", where the site had an older Call Board
// name). The same rows parseBoardNames reads; this keeps the readable name
// and nothing else. In memory, then names.json on the laptop only.
// -> [{ turn, craft, name: "Ben Allen", working, pos: "001" }] (pos on pool rows)
// A pool or spareboard row's name: "BORODY*+ R ROBER" is surname, middle
// initial, first name, and the initial can sit in the surname's cell (owner,
// 2026-11-10: the site showed "Borody R, R"). The last word is the first
// name; the one- or two-letter words just before it are initials (R, or DG as
// on his bunkhouse photo of 2026-11-13) and are dropped, as nameParts does.
function boardPersonName(cells) {
  // "<< OPEN TURN >>": nobody holds it (owner, 2026-11-10: the site showed
  // "<< Open Turn, >").
  if (/OPEN\s+TURN/i.test(cells.map((c) => c.text).join(' '))) return OPEN_TURN;
  const words = cells.map((c) => c.text.replace(/\([^)]*\)\S*/g, ' ').replace(/[*+<>]/g, ' ')).join(' ').split(/\s+/).filter(Boolean);
  return nameOfWords(words);
}
function parseBoardCrew(rows) {
  const out = [];
  for (const r of rows) {
    const c = r.cells;
    if (c.length >= 6 && /^(EN|CO|LE|B1)$/.test(c[0].text) && /^[A-Z][A-Z0-9]\d{2}$/.test(c[1].text) && /^\d$/.test(c[2].text) && /^\d{3}$/.test(c[3].text)) {
      const nameCells = [];
      // The name stops at the train a working row shows after it too (2026-11-13: 501/502's MU01 "out
      // working on L50231" read as "<surname> <initial> <first>, L"; nothing used that row's name before).
      for (const x of c.slice(4)) { if (/^(\*\*|HT|TV|B0|\d.*)$/.test(x.text) || /^[A-Z]{1,3}\d{3,5}[A-Z]?$/.test(x.text) || nameCells.length >= 5) break; nameCells.push(x); }
      const name = boardPersonName(nameCells);
      // Out on a trip (the same test parseBoardNames uses, or shown at an
      // away terminal): the person working it may be a spare, so the Call
      // Board's name is the one to show while it is out (owner, 2026-11-10).
      const working = c[2].text !== '0' || c[3].text === '999' || c.slice(5).some((x) => /^[A-Z]{1,3}\d{4,5}$/.test(x.text));
      // pos: the bunkhouse (28) names its crews by position (names.js recordBunkhouse).
      if (name) out.push({ turn: c[1].text, craft: c[0].text, name, working, pos: c[3].text });
      continue;
    }
    const ti = c.findIndex((x, k) => k > 0 && /^[A-Z][A-Z0-9]{1,3}\d{2,3}$/.test(x.text) && c[k + 1] && /^\d{3}$/.test(c[k + 1].text));
    if (ti > 0) {
      const name = boardPersonName(c.slice(0, ti));
      if (name) out.push({ turn: c[ti].text, craft: '', name });
    }
  }
  return out;
}
function parseBoardNames(rows) {
  const out = [];
  for (const r of rows) {
    const c = r.cells;
    if (c.length >= 6 && /^(EN|CO|LE|B1)$/.test(c[0].text) && /^[A-Z][A-Z0-9]\d{2}$/.test(c[1].text) && /^\d$/.test(c[2].text) && /^\d{3}$/.test(c[3].text)) {
      // The name: up to the status codes and times (owner's screenshot: a
      // "(NET)" box or a two-word surname pushes the first name along).
      const nameCells = [];
      for (const x of c.slice(4)) { if (/^(\*\*|HT|TV|B0|\d.*)$/.test(x.text) || nameCells.length >= 5) break; nameCells.push(x); }
      const key = nameKey(nameCells);
      // Their own turn only at home (T 0) and not working (999, or a train
      // in INFO): away or working may be a spare covering a trip (owner).
      const working = c[3].text === '999' || c.slice(5).some((x) => /^[A-Z]{1,3}\d{4,5}$/.test(x.text));
      // TV = temporary vacancy (owner, 2026-10-25): the person is on another
      // turn for now and this one goes spare (JUOD on S501 with TV, on SR03).
      const tv = c.slice(5).some((x) => x.text === 'TV');
      if (key) out.push({ key, turn: c[1].text, craft: c[0].text, code: codeOf(nameCells), own: c[2].text === '0' && !working && !tv, tv, from: 'pool' });
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

// --- Assignment history (3 → 7, PSTS17A; owner, 2026-11-04) -----------------
// Each train's on-duty time and hours on duty, so its exact off duty:
//   Q13931  03  261103  0230  TORONTO  17800  0910     (DUTY 0910 = 9 h 10 m)
//   M30131  04  261104  1015  TORONTO  18900  N/A      (still on duty)
// Location box S1 = Sarnia, S5 = 502/501; HOME/AWAY 1 = trips coming home.
function isAssignHistory(text) {
  return /ASSIGNMENT\s+HISTORY/.test(text) && /TRAIN\s+ID/.test(text);
}
const ASSIGN_ROW = /^([A-Z]{1,3}\d{3,5}[A-Z]?)\s+(\d{2})\s+(\d{2})(\d{2})(\d{2})\s+(\d{4})\s+([A-Z][A-Z .'-]*?)\s+(\d{3,6})\s+(\d{4}|N\/A)\s*$/;
function parseAssignHistory(rows) {
  const out = [];
  for (const r of rows) {
    // Each row starts with the X box, saved as "[]" (owner's laptop, 2026-11-04).
    const m = ASSIGN_ROW.exec(r.text.replace(/\s+/g, ' ').trim().replace(/^\[[^\]]*\]\s*/, ''));
    if (!m) continue;
    const t = hhmm(m[6]);
    const on = at(2000 + +m[3], +m[4], +m[5], t.hour, t.minute);
    const duty = m[9] === 'N/A' ? null : +m[9].slice(0, 2) * 60 + +m[9].slice(2);
    out.push({ train: `${m[1]} ${m[2]}`, symbol: m[1], originDay: m[2], on, terminal: m[7].trim(), duty, off: duty == null ? null : on + duty });
  }
  return out;
}

// --- Assignment history for the yard (3 → 7 with YD; owner, 2026-11-13) ----
// The same screen with YD in POOL OR YD/LO (owner's photos, 2026-11-12;
// docs/board-checker/SCREENS.md): each yard job's on duty and its O-T, the
// overtime on top of 8 hours CATS has once the crew closes the ticket (blank:
// none, or the ticket is not closed yet). Owner, 2026-11-13: "Do not use the
// call board to determine off duty since if they forget to tie up it will sit
// there. We have to manually close our ticket in the computer". As saved
// (masked: the description's words read AAAA, the job, date, times and O-T
// stay):
//   X ASSIGNMENT AAA-AAAA/AAAA AAAAAAAAAAA O-T
//   [] YSBY03 261111 0700 0700 AAA AAAAA 3 0400
//   [] YBHS01 261111 0800 0800 AAAAAA A9/A9
// → [{ job, on, ot }]: ot in minutes, null when blank.
// The train list has no O-T heading (TRAIN ID, ODT-DATE/TIME, INT-TERMINAL,
// MILES, DUTY, MISC), so O-T alone tells the two apart.
function isYardHistory(text) {
  return /ASSIGNMENT\s+HISTORY/.test(text) && /(^|\s)O-T(\s|$)/m.test(text);
}
const YARD_HISTORY_ROW = /^(Y[A-Z]{3}\d{2})\s+(\d{2})(\d{2})(\d{2})\s+(\d{4})(?:\s|$)/;
function parseYardHistory(rows) {
  // The O-T heading's place: a four-figure O-T sits under it, at the end of the row.
  const head = rows.find((r) => /(^|\s)O-T(\s|$)/.test(r.text) && /ASSIGNMENT/.test(r.text));
  const otAt = head ? ((head.cells || []).find((c) => c.text === 'O-T') || {}).left : null;
  const out = [];
  for (const r of rows) {
    const m = YARD_HISTORY_ROW.exec(r.text.replace(/\s+/g, ' ').trim().replace(/^\[[^\]]*\]\s*/, ''));
    if (!m) continue;
    const t = hhmm(m[5]);
    const cells = r.cells || [];
    const end = cells[cells.length - 1];
    // No heading found: four figures at the end, after a description of two
    // words or more (its own start time and its name: "0700 YDM BLOCK 3 0400").
    const rest = m.input.slice(m[0].length).trim().split(' ').filter(Boolean);
    const x = otAt != null ? (end && /^\d{4}$/.test(end.text) && end.left >= otAt - 40 ? end.text : null)
      : rest.length >= 3 && /^\d{4}$/.test(rest[rest.length - 1]) ? rest[rest.length - 1] : null;
    out.push({ job: m[1], on: at(2000 + +m[2], +m[3], +m[4], t.hour, t.minute), ot: x ? +x.slice(0, 2) * 60 + +x.slice(2) : null });
  }
  return out;
}

// --- Upcoming days off (Train Service 4; owner, 2026-11-05) ----------------
// Nothing to type; F8 pages down. One row per person: MO/DY-TIME (when the
// days off start), DDSD (45SA), LEAVE-TYPE (OFF), STAT (A / B / blank),
// NAME (never kept) and ASSIGNMENT: type (A/U/X), district, pool + turn,
// craft, e.g. U-45SAS1S102ET → S1 pool, turn S102, ET; A-45SAYSBY03YA →
// yard job YSBY03, YA.

function isDaysOff(text) {
  return /UPCOMING\s+DAYS\s+OFF/.test(text);
}

const DAYS_OFF_ROW = /^(\d{2})\/(\d{2})-(\d{4})\s+(\d{2}[A-Z]{2})\s+(\S+)\s+(?:([A-Z])\s+)?.*?\b([AUX])-(\d{2}[A-Z]{2})([A-Z0-9]{6})([A-Z0-9]{2})$/;

function parseDaysOff(rows, now) {
  const year = new Date(now * 60000).getUTCFullYear();
  const out = [];
  for (const r of rows) {
    // Fields CATS draws in two boxes (11/06 -0001, U- 45SA…) read as one.
    const m = DAYS_OFF_ROW.exec(r.text.replace(/\s*([/-])\s*/g, '$1').trim());
    if (!m) continue;
    const [, mo, dy, t, ddsd, leave, stat, type, , job, craft] = m;
    const x = hhmm(t);
    const from = [year - 1, year, year + 1].map((y) => at(y, +mo, +dy, x.hour, x.minute)).reduce((b, c) => (Math.abs(c - now) < Math.abs(b - now) ? c : b));
    // Road turns are pool + turn (S1S102 → S102); yard jobs keep their id.
    const pool = job.slice(0, 2);
    const road = !/^Y/.test(job) && TURN_ID.test(job.slice(2));
    out.push({ from, ddsd, leave, stat: stat || '', type, pool: road ? pool : '', turn: road ? job.slice(2) : job, yard: !road, craft });
  }
  return out;
}

// --- Job postings: Circular Inquiry (owner, 2026-11-11) ----------------------
// "i wanna add a check that just shows job postings that are up, incase guys
// want to post for something"; "basic info essentially the job thats up for
// bid and the close date". Conductors: main menu 3, then 8; engineers: 1,
// then 8. CIRCULAR INQUIRY- TRAIN/YARD (PSTS02T): DIST / SUB-DIST prefilled,
// then four boxes typed "*" (LOCAL/REG, PERM/TEMP, ASGN/POOL/SPARE, CHG
// CARD/746/OTHER), Enter. The SEARCH CLOSE DATES boxes are left alone: CATS
// puts today's date (YYMMDD) in the first when Enter is pressed (owner).
// One line per circular (his photo, 2026-11-11):
//   785410 | 1445 PLANK YDH W/T | 45SA | YPRS30 | S1 | A | 3 | 261112 | P
//   785549 | CDR CHAIN GANG     | 45SA | SRSR11 | CO | U | 3 | 261116 | T | C
// number, description, district, assignment (pool + turn for a road job, the
// job id for a yard job), craft, A/U/X (assignment / pool / spare), 1/2/3,
// closing date (YYMMDD), P/T (permanent / temporary), CIA (C = cancelled:
// "no longer able to post for", owner 2026-11-11). No names on it.
// "END OF RECORDS FOR THIS CRITERIA" ends the list; PF8 scrolls.
function isCircularInquiry(text) {
  return /CIRCULAR\s+INQUIRY/.test(text);
}
const CIRCULAR_ROW = /^(\d{5,7})\s+(.+?)\s+(\d{2}[A-Z]{2})\s+([A-Z0-9]{4,8})\s+([A-Z][A-Z0-9])\s+([AUX])\s+([123])\s+(\d{6})\s+([PT])(?:\s+(\S+))?$/;
function parseCircularInquiry(rows) {
  const out = [];
  for (const r of rows) {
    // A text box comes through as its own cell, "[what's in it]": each line
    // starts with its empty X box (first real read, 2026-11-11: "[] 785410 …",
    // so nothing matched). Boxes are left out.
    const text = (r.cells ? r.cells.filter((c) => !/^\[.*\]$/.test(c.text)).map((c) => c.text).join(' ') : r.text).replace(/\s+/g, ' ').trim();
    const m = CIRCULAR_ROW.exec(text);
    if (!m) continue;
    const [, number, description, ddsd, asg, cc, kind, change, closed, pt, cia] = m;
    const road = !/^Y/.test(asg) && asg.length === 6 && TURN_ID.test(asg.slice(2));
    out.push({ number, description, ddsd, assignment: asg, pool: road ? asg.slice(0, 2) : '', turn: road ? asg.slice(2) : asg, yard: !road, cc, kind, change,
      closes: `20${closed.slice(0, 2)}-${closed.slice(2, 4)}-${closed.slice(4, 6)}`, term: pt, cia: cia || '' });
  }
  return out;
}

// --- Yardmaster seniority list (owner, 2026-11-13) ---------------------------
// "lets figure out the YM seniority list first"; "the order is 3 then 1 ...
// then enter 3g YA 45 SA ... you have to record the names and their permanent
// job"; read "only 2 times a day, once the first check after 0000 and once the
// first check after 1200" (lib/board/seniority.js). SENIORITY LIST INQUIRY
// (PSTS02F): LIST CODE 3G + YA, DIST 45, SUB-DIST SA, Enter; the title then
// reads YARDMSTRS (LN,HA,SA,OAKVL). Seven people a page, two lines each (his
// photos, 2026-11-13; the names here are made up):
//    30  930421  SURNAME*+      TJ   FIRST       45  SA  2610251200   B   OFF
//                                                YSTY01YA  0630 TOWER S/S JT60
// rank (with gaps: the other terminals' places on the same list), date YYMMDD,
// the name with CATS's marks (*, +, (NET), (NODP)), district and sub,
// awarded YYMMDDHHMM, move type (B, F or blank), status (OFF, VACATION or
// blank); then the current assignment, job or pool + turn and craft in eight
// letters (YSTY01 YA, S1 S102 EN, EX YA01 YA = the yardmaster spare, XSAS01 FO =
// a relief job), and its description ("REL#1 TH/FR OFF": that OFF is the job's
// days off, not a status). Someone with no assignment has no second line.
// "PRESS PFKEY8 TO SCROLL" on each page, "END OF LIST" on the last.
// "Last, F" from a name as the list shows it ("ALDER*+ TJ TOMAS" -> "Alder, T"; made-up), as the board's
// crew names (owner, 2026-11-10: "last name, first initial"). '' when it can't be read.
function seniorityShort(name) {
  const np = nameParts([{ text: String(name || '') }]);
  if (!np) return '';
  const surname = np.surname.split(/\s+/).map((w, i, all) => (i < all.length - 1 && PARTICLES.has(w.toLowerCase()) ? w.toLowerCase() : properCase(w))).join(' ');
  return `${surname}, ${(np.first || np.initial || '').slice(0, 1)}`;
}
function isSeniorityList(text) {
  return /SENIORITY\s+LIST\s+INQUIRY/.test(text);
}
const SENIORITY_ROW = /^(\d{1,4})\s+(\d{6})\s+(.+?)\s+(\d{2})\s*([A-Z]{2})(?:\s+(\d{10}))?(?:\s+([A-Z]))?(?:\s+(\S.*?))?$/;
const SENIORITY_JOB = /^([A-Z0-9]{6})([A-Z][A-Z0-9])(?:\s+(.*))?$/;
function parseSeniorityList(rows) {
  const out = [];
  let last = null;
  for (const r of rows) {
    const text = (r.cells ? r.cells.filter((c) => !/^\[.*\]$/.test(c.text)).map((c) => c.text).join(' ') : r.text).replace(/\s+/g, ' ').trim();
    const m = SENIORITY_ROW.exec(text);
    if (m) {
      const [, rank, date, name, dist, sub, awarded, move, status] = m;
      last = { rank: +rank, date, name, short: seniorityShort(name), key: nameKey([{ text: name }]), marks: (name.match(/[*+]+/) || [''])[0], tags: [...name.matchAll(/\(([A-Z]+)\)/g)].map((x) => x[1]),
        dist, sub, awarded: awarded || '', move: move || '', status: status || '', assignment: '', pool: '', turn: '', craft: '', yard: false, description: '' };
      out.push(last);
      continue;
    }
    const j = last ? SENIORITY_JOB.exec(text) : null;
    if (j) {
      const [, asg, craft, description] = j;
      // A yard or relief job keeps its id (YSTY01, XSAS01); a road or spare
      // turn is pool + turn (S1 S102, SR SR10, EX EN08).
      const job = /^[YX]/.test(asg) || !TURN_ID.test(asg.slice(2));
      const a = { assignment: asg + craft, pool: job ? '' : asg.slice(0, 2), turn: job ? asg : asg.slice(2), craft, yard: job, description: (description || '').trim() };
      // A second assignment line (the list with TEMP ASGN Y might show one) is kept as `extra`.
      if (!last.assignment) Object.assign(last, a); else (last.extra = last.extra || []).push(a);
      continue;
    }
    if (text) last = null;
  }
  return out;
}

module.exports = {
  isSeniorityList, parseSeniorityList, seniorityShort,
  isCircularInquiry, parseCircularInquiry,
  isAssignHistory, parseAssignHistory, isYardHistory, parseYardHistory,
  trainNoOf,
  parseCallBoardNames,
  isCallBoard, callBoardTime, parseCallBoardPage, parseCrewsInTown, parseCrewsInTownNames, parseCallBoardTrains, callBoardPlace,
  isPoolPosition, isChainGang, parseChainGang,
  isLineup, parseLineup,
  isSpareboard, parseSpareboard,
  isTerminalLineup, parseTerminalLineup,
  isDaysOff, parseDaysOff,
  nameKey, parseYardCrewNames, parseTrainCrewNames, parseBoardNames, parseBoardCrew, parseYardOwners,
};
