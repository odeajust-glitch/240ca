// Owner, 2026-11-13, with a photo of the site's Call Board box: "It also doesn't have me on the call
// board". In the 05:41 check L50131 12 showed "EN S501" without its CO S501, and M39671 11 lost its CO
// SA02; at 05:49 both were back. A train's last crew line was the top of the next Call Board page, before
// any heading, and the reader dropped it. Now the train a page ends on carries on into the next page
// (PAGE n + 1 only). Turn ids and train ids from his photo; made-up names only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGrid } = require('../../lib/board/grid');
const S = require('../../lib/board/screens');
const { loadSummary } = require('../../lib/board/summary');
const { at } = require('../../lib/board/time');
const { maskTokenWith, BOARD_WORDS } = require('../../lib/board/capture');

// Fixed-width screen text → the checker's grid lines (9 px a character), masked as saved or not.
const raw = (lines, mask = true) => lines.map((line, row) => [String(row * 18), ...[...line.matchAll(/\S+/g)].map((m) => `${m.index * 9}:${mask ? maskTokenWith(m[0], BOARD_WORDS) : m[0]}`)].join(' | '));
const now = at(2026, 11, 13, 5, 41);
const head = (n) => `26/11/13-   541          CALL  BOARD   CN  RAIL                     PAGE  00${n}  OF  003`;
// The 05:41 layout: each train's last line at the top of the next page.
const PAGES = [
  [head(1),
    'M39931 13  ON DUTY AT: TORONTO      26/11/12  2230',
    '           EN  HILL*+       D   DAVID      SD03',
    '           CO  LAKE*+       G   GRANT      SR03',
    'L50131 12  ON DUTY AT: GARNET       26/11/12  2145',
    '           EN  STONE*+      C   CARL       S501'],
  [head(2),
    '           CO  FIELD+       J   JAMES      S501',
    'M39671 11  ON DUTY AT: SARNIA       26/11/13  0730',
    '           EN  GROVE*+      R   RYAN       S102',
    '           ET  BROOK+       T   TOM        S102'],
  [head(3),
    '           CO  DALE*+       A   ADAM       SA02',
    'YSBY04    1900  YDM  BLOCK  4      ON  DUTY  AT:  SARNIA   26/11/12  1900',
    '           YA  WARD+        P   PAT        YSBY04'],
];

test('Call Board: a train\'s crew that runs onto the next page stays with the train', () => {
  const s = loadSummary({ probedAt: '2026-11-13T10:41:00Z', screens: PAGES.map((p) => ({ screenGrid: raw(p) })) }, { now });
  const crew = (sym) => s.callBoard.find((t) => t.symbol === sym).crew.map((c) => `${c.craft} ${c.turn}`).join(' · ');
  assert.equal(crew('L50131'), 'EN S501 · CO S501');
  assert.equal(crew('M39671'), 'EN S102 · ET S102 · CO SA02');
  assert.equal(crew('M39931'), 'EN SD03 · CO SR03');
  assert.equal(s.callBoard.length, 3);
});

test('Call Board: names and fill-ins carry on the same way; only into the very next page', () => {
  const pages = PAGES.map((p) => parseGrid(raw(p, false)));
  const carry = {};
  const trains = pages.flatMap((rows) => S.parseCallBoardNames(rows, carry));
  assert.deepEqual(trains.map((t) => `${t.symbol} ${t.crew.map((c) => `${c.craft} ${c.turn} ${c.name}`).join(', ')}`), [
    'M39931 EN SD03 David Hill, CO SR03 Grant Lake', 'L50131 EN S501 Carl Stone, CO S501 James Field', 'M39671 EN S102 Ryan Grove, ET S102 Tom Brook, CO SA02 Adam Dale']);
  const tc = {};
  const crews = pages.flatMap((rows) => S.parseTrainCrewNames(rows, tc));
  assert.deepEqual(crews.filter((c) => c.train === 'L50131 12').map((c) => `${c.craft} ${c.job}`), ['EN S501', 'CO S501']);
  assert.deepEqual(crews.filter((c) => c.train === 'M39671 11').map((c) => `${c.craft} ${c.job}`), ['EN S102', 'ET S102', 'CO SA02']);
  // Without a carry, or onto a page that isn't the next one (page 3 after page 1): as before, dropped.
  assert.deepEqual(pages.flatMap((rows) => S.parseCallBoardNames(rows)).find((t) => t.symbol === 'L50131').crew.map((c) => c.craft), ['EN']);
  const skip = {};
  const first = S.parseCallBoardPage(pages[0], now, skip);
  const third = S.parseCallBoardPage(pages[2], now, skip);
  assert.deepEqual([third.trains.length, third.yard.map((j) => j.job)], [0, ['YSBY04']]);
  assert.deepEqual(first.trains.find((t) => t.symbol === 'L50131').crew.map((c) => `${c.craft} ${c.turn}`), ['EN S501'], 'page 3\'s first line is not L50131\'s');
  assert.deepEqual(skip.train, null);
  // The crews in town end it: nothing carries past them.
  const town = {};
  S.parseCallBoardPage(pages[0], now, town);
  S.parseCallBoardPage(parseGrid(raw([head(2), 'CREWS IN TOWN', '           CO  FIELD+       J   JAMES      S501'])), now, town);
  assert.equal(town.train, null);
});
