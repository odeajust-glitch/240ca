// Reads one CATS screen (the frame Jacada draws it in) into the masked
// summary shape: rows of positioned text with names and employee numbers
// masked. Shared by scripts/board-probe.js and scripts/board-auto.js, so both
// capture screens exactly the same way.
// Words that label a crew board. Any of these found on the page are listed
// in the summary; all other text is masked (letters -> A, digits -> 9) so
// the screen's layout comes through without anyone's name.
const BOARD_WORDS = new Set(('SPARE SPAREBOARD BOARD FAST SLOW POOL TURN TURNS POS POSITION NAME EMP EMPLOYEE ' +
  'NO NUM NUMBER STATUS REST CALL CALLED CALLING TIME DATE ON OFF DUTY BOOK BOOKED AVAIL AVAILABLE ' +
  'LIST TERMINAL SARNIA YARD ROAD TRAIN JOB ASSIGNMENT CREW CONDUCTOR ENGINEER LE CO RC YM ' +
  'UP DOWN OUT FIRST NEXT PREV PAGE ENTER PF1 PF2 PF3 PF4 PF5 PF6 PF7 PF8 PF9 PF10 PF11 PF12 ' +
  'MARKED MARK UNION VACATION VAC SICK LOA ETA HRS HOURS MILES MILEAGE SENIORITY ' +
  'TRAINS LINEUP LINE CHAIN GANG ORDER ORDERED ORDERS DEADHEAD DH CANCEL CANCELLED VACANT RESET ' +
  'SHORT WORK VIA MANIFEST SYMBOL TORONTO MAC MACMILLAN ARRIVED ARRIVAL ARR DEPART DEP DEPARTED ' +
  'CALLED TIE TIED HOME AWAY TERM PREP OD FROM TO DEST ORIGIN ENGR CONDR CREWED').split(' '));

// Masks one token unless it's safe to show: a board word, a short code
// (CO, LE), a small number (positions, times) or a train/turn symbol
// (SB01, L50221, Q14851). Names are letters only and employee numbers are
// long digit runs, so both get masked. Runs in Node and, via its source,
// inside the page.
function maskTokenWith(tok, words) {
  // Dates, times and codes aren't personal: 26/10/14, 0745-0800, 14OCT26,
  // 100MIL-style codes, 5-digit station/train numbers. Employee numbers are
  // 6+ digits and stay masked.
  if (/^\d{2}\/\d{2}\/\d{2}(-\d{0,4})?$/.test(tok)) return tok;
  if (/^\d{4}-\d{4}$/.test(tok)) return tok;
  if (/^\d{1,3}[A-Za-z]{2,4}\d{0,2}$/.test(tok)) return tok;
  if (/^\d{5}$/.test(tok)) return tok;
  const core = tok.replace(/[^A-Za-z0-9]/g, '');
  if (!core) return tok;
  if (words.has(core.toUpperCase())) return tok;
  if (/^[A-Za-z]{1,2}$/.test(core)) return tok;
  if (/^[0-9]{1,4}$/.test(core)) return tok;
  if (/^[A-Za-z]{1,3}[0-9][A-Za-z0-9]*$/.test(core) && core.length <= 10) return tok;
  return tok.replace(/[A-Za-z]/g, 'A').replace(/[0-9]/g, '9');
}

async function describeFrame(frame) {
  return frame.evaluate(([boardWords, maskSrc]) => {
    const words = new Set(boardWords);
    // eslint-disable-next-line no-eval
    const maskTokenWith = eval(`(${maskSrc})`);
    const text = document.body ? document.body.innerText : '';
    const lines = text.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    // The Train Line-up screen lists trains only, never people (owner
    // confirmed via screenshot 2026-10-14), so it's shown unmasked. Declared
    // before the return below, which calls mask() through screenGrid().
    const noNames = /TRAIN LINE UP/.test(text);
    const found = new Set();
    for (const w of text.toUpperCase().match(/[A-Z][A-Z0-9]*/g) || []) if (words.has(w)) found.add(w);
    return {
      title: document.title,
      framesInside: document.querySelectorAll('frame,iframe').length,
      tables: [...document.querySelectorAll('table')].slice(0, 20).map((t) => ({
        id: t.id || null,
        headers: [...t.querySelectorAll('th')].map((th) => th.textContent.trim()).slice(0, 30),
        rows: t.querySelectorAll('tr').length,
      })),
      inputs: [...document.querySelectorAll('input,select,textarea')].slice(0, 80)
        .map((el) => ({ tag: el.tagName.toLowerCase(), type: el.type || null, name: el.name || el.id || null })),
      preBlocks: document.querySelectorAll('pre').length,
      absPositioned: [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).position === 'absolute').length,
      textLines: lines.length,
      boardWordsFound: [...found].sort(),
      maskedLayout: lines.slice(0, 60).map((l) => l.replace(/[A-Za-z]/g, 'A').replace(/[0-9]/g, '9')),
      screenGrid: screenGrid(words),
    };

    // CATS draws each mainframe field as an absolutely-positioned element.
    // Grouping fields by their top offset rebuilds the screen's rows, and the
    // left offsets give the columns. Text is masked unless it's a board word,
    // a short code (CO, LE, SB01) or a small number (positions, times), so
    // names and employee numbers don't come through.
    function maskToken(tok) { return maskTokenWith(tok, words); }
    function mask(t) { if (noNames) return t; return maskAll(t); }
    function maskAll(t) { return t.split(/(\s+)/).map((x) => (/\s/.test(x) ? x : maskToken(x))).join(''); }
    function screenGrid() {
      // Every text node is placed by its own on-screen box, whatever element
      // wraps it. CATS nests its text, so walking positioned elements misses it.
      const cells = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const raw = node.textContent.replace(/\s+$/, '');
        if (!raw.trim() || node.parentElement.closest('script,style,noscript')) continue;
        range.selectNodeContents(node);
        const r = range.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        cells.push({ top: Math.round(r.top), left: Math.round(r.left), text: mask(raw.trim()) });
      }
      for (const el of document.querySelectorAll('input,select,textarea')) {
        if (/hidden|submit|button|image/.test(el.type)) continue;
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        // Never show what's in a password box, not even masked.
        const text = el.type === 'password' ? '[password]' : `[${mask(el.value.trim())}]`;
        cells.push({ top: Math.round(r.top), left: Math.round(r.left), text });
      }
      cells.sort((a, b) => a.top - b.top || a.left - b.left);
      const rows = [];
      for (const c of cells) {
        const row = rows.length && Math.abs(rows[rows.length - 1].top - c.top) <= 4 ? rows[rows.length - 1] : null;
        if (row) row.cells.push(`${c.left}:${c.text}`);
        else rows.push({ top: c.top, cells: [`${c.left}:${c.text}`] });
      }
      return rows.slice(0, 120).map((r) => `${r.top} | ${r.cells.join(' | ')}`);
    }
  }, [[...BOARD_WORDS], maskTokenWith.toString()]);
}

module.exports = { BOARD_WORDS, maskTokenWith, describeFrame };
