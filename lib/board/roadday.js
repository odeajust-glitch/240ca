// Each road day's Sarnia trains, remembered across checks (CHECKUP #5,
// owner 2026-10-22). A train drops off the Call Board once it's gone, so a
// later check sees fewer A/B trains than really ran and hands the next train
// to A again (X27861 16 showed as A). Every Sarnia train seen on duty is kept
// here, and the engine counts the ones no longer shown as `departed`. Only
// what a check actually saw goes in (owner: only use what's in history\).
const fs = require('fs');
const path = require('path');
const defaults = require('./config');
const { loadSummary } = require('./summary');

// Long enough to cover the road day before a 0143 check, short enough that
// the file stays small.
const KEEP_MINUTES = 36 * 60;

// Checks further apart than this may have missed a train entirely, so the
// memory only vouches for what it saw since then.
const GAP_MINUTES = 6 * 60;

const keyOf = (t) => `${t.symbol}/${t.originDay}`;

// memory: { since, last, trains: { "symbol/originDay": train } }, trains as
// parsed from the Call Board (turns only; names are never on them). `since`
// is when unbroken checking began: a road day that started before it may be
// missing trains, so the engine keeps trusting CATS there.
function remember(memory, callBoard, now, cfg = defaults) {
  const unbroken = memory && memory.last != null && now - memory.last <= GAP_MINUTES && now >= memory.last;
  const since = unbroken ? memory.since : now;
  const trains = { ...((memory && memory.trains) || {}) };
  for (const t of callBoard) {
    if (t.station !== cfg.homeStation) continue;
    trains[keyOf(t)] = { symbol: t.symbol, trainNo: t.trainNo, originDay: t.originDay, station: t.station, onDuty: t.onDuty,
      crew: t.crew.map((c) => ({ craft: c.craft, turn: c.turn })) };
  }
  for (const [k, t] of Object.entries(trains)) if (t.onDuty < now - KEEP_MINUTES) delete trains[k];
  return { since, last: now, trains };
}

// Remembered trains the current Call Board no longer shows.
function departed(memory, callBoard) {
  const shown = new Set(callBoard.map(keyOf));
  return Object.values((memory && memory.trains) || {}).filter((t) => !shown.has(keyOf(t)));
}

// Saved checks (summary .json files, oldest first) → memory. Used to start
// the memory from history\ the first time, and by the website builder.
function rememberFiles(memory, files) {
  let m = memory;
  for (const f of files) {
    try {
      const input = loadSummary(JSON.parse(fs.readFileSync(f, 'utf8')));
      m = remember(m, input.callBoard, input.now);
    } catch { /* a check that can't be read adds nothing */ }
  }
  return m || { trains: {} };
}

// The last two day folders of history\ cover the 36 h kept.
function seedFromHistory(historyDir) {
  let days = [];
  try { days = fs.readdirSync(historyDir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-2); } catch { return { trains: {} }; }
  const files = days.flatMap((d) => fs.readdirSync(path.join(historyDir, d))
    .filter((f) => /^\d{4}(-\d+)?\.json$/.test(f)).sort().map((f) => path.join(historyDir, d, f)));
  return rememberFiles(null, files);
}

function loadMemory(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function saveMemory(file, memory) {
  fs.writeFileSync(file, JSON.stringify(memory, null, 2));
}

module.exports = { GAP_MINUTES, remember, departed, rememberFiles, seedFromHistory, loadMemory, saveMemory, KEEP_MINUTES };
