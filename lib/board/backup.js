// Laptop backup to the R2 bucket (owner, 2026-11-02: if the board-checker
// laptop dies, its memory goes with it). Once a day, the first check after
// 03:00:
//   backups/state/YYYY-MM-DD.zip    the data folder's own files (alert
//                                   memory, fill-ins, sign-in times, road
//                                   days, analytics archive, push keys, logs);
//                                   the last KEEP_STATE_DAYS kept
//   backups/history/YYYY-MM-DD.zip  each finished history\ day, once; kept as
//                                   long as history\ is (BOARD_HISTORY_DAYS)
// Never in a backup: .env (passwords), names.json (crew names stay on the
// laptop), the browser profiles and the built site. The Worker never serves
// backups/ and the site upload never deletes it. Restore: download the zips
// from the Cloudflare dashboard and unzip them into BoardChecker
// (docs/board-checker/CLOUDFLARE.md). Never throws: a failed backup is
// tried again next check.
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { signRequest, listBucket, r2Conn } = require('./r2');

const KEEP_STATE_DAYS = 14;
const AFTER_HOUR = 3; // a quiet time; a laptop off then backs up at its next check
const HISTORY_PER_RUN = 10; // the first run catches up over a few days
const SKIP_FILES = /^(\.env.*|names\.json|heartbeat\.json)$/i;

// What's due now: { state: bool, history: [days] }. days: history\ folder
// names; have: keys already in backups/; today/hour: the laptop's clock.
function plan({ lastStateDay = null, days = [], have = new Set(), today, hour }) {
  const state = lastStateDay !== today && hour >= AFTER_HOUR;
  const history = days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < today && !have.has(`backups/history/${d}.zip`)).sort().slice(-HISTORY_PER_RUN);
  return { state, history };
}

// Old ones to delete: state zips past KEEP_STATE_DAYS, history zips older
// than historyDays (0 = keep all).
function expired(keys, today, historyDays) {
  const ago = (n) => new Date(Date.parse(`${today}T12:00:00Z`) - n * 864e5).toISOString().slice(0, 10);
  return [...keys].filter((k) => {
    const m = /^backups\/(state|history)\/(\d{4}-\d{2}-\d{2})\.zip$/.exec(k);
    if (!m) return false;
    if (m[1] === 'state') return m[2] < ago(KEEP_STATE_DAYS);
    return historyDays > 0 && m[2] < ago(historyDays);
  });
}

async function zipFolder(dir, { topOnly = false } = {}) {
  const zip = new JSZip();
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile() && !SKIP_FILES.test(e.name)) zip.file(e.name, fs.readFileSync(path.join(dir, e.name)));
    else if (e.isDirectory() && !topOnly) for (const f of fs.readdirSync(path.join(dir, e.name))) zip.file(`${e.name}/${f}`, fs.readFileSync(path.join(dir, e.name, f)));
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

async function put(conn, bucket, key, body, fetchImpl) {
  const req = signRequest({ ...conn, method: 'PUT', path: `/${bucket}/${key}`, body, headers: { 'content-type': 'application/zip' } });
  const res = await fetchImpl(req.url, { method: 'PUT', headers: req.headers, body, signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`R2 answered ${res.status} uploading ${key}`);
}

async function del(conn, bucket, key, fetchImpl) {
  const req = signRequest({ ...conn, method: 'DELETE', path: `/${bucket}/${key}` });
  await fetchImpl(req.url, { method: 'DELETE', headers: req.headers, signal: AbortSignal.timeout(60000) });
}

// One go: returns { ok, did: [..], message } and the new state to keep
// (BoardChecker\backup.json: { lastStateDay, lastAt }).
async function runBackup({ dataDir, historyDir, r2, state = {}, now = new Date(), historyDays = 90, fetchImpl = fetch }) {
  const today = now.toLocaleDateString('en-CA');
  const hour = now.getHours();
  const did = [];
  try {
    let days = [];
    try { days = fs.readdirSync(historyDir); } catch { /* no history yet */ }
    if (!(state.lastStateDay !== today && hour >= AFTER_HOUR)) return { ok: true, did, state };
    const conn = r2Conn(r2);
    const have = new Set((await listBucket(conn, fetchImpl, 'backups/')).keys());
    const p = plan({ lastStateDay: state.lastStateDay, days, have, today, hour });
    await put(conn, r2.bucket, `backups/state/${today}.zip`, await zipFolder(dataDir, { topOnly: true }), fetchImpl);
    did.push(`state ${today}`);
    for (const d of p.history) {
      await put(conn, r2.bucket, `backups/history/${d}.zip`, await zipFolder(path.join(historyDir, d)), fetchImpl);
      did.push(`history ${d}`);
    }
    for (const k of expired(have, today, historyDays)) await del(conn, r2.bucket, k, fetchImpl);
    return { ok: true, did, state: { ...state, lastStateDay: today, lastAt: now.getTime() } };
  } catch (err) {
    return { ok: false, did, message: err.message, state };
  }
}

module.exports = { plan, expired, zipFolder, runBackup, KEEP_STATE_DAYS, SKIP_FILES };
