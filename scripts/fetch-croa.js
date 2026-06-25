// One-off / re-runnable script to download CROA arbitration award PDFs
// and keep only the ones within a recent date window (based on the
// award's actual "Heard in ..., <date>" text, not the case number).
//
// Usage: node scripts/fetch-croa.js [yearsBack] [minCandidateNum]
// Downloads land in data/croa/, and a manifest is written to
// data/croa_manifest.json for server.js to index. minCandidateNum is a
// lower bound on case number to even bother checking (found by sampling
// a few award PDFs' real "Heard in ..., <date>" text for the target
// years-back window) — pick it a bit below the true boundary as a
// safety margin, since case numbers aren't perfectly chronological.

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const LINKS_FILE = path.join(__dirname, '..', 'croa_all_links.txt');
const CROA_DIR = path.join(__dirname, '..', 'data', 'croa');
const MANIFEST_PATH = path.join(__dirname, '..', 'data', 'croa_manifest.json');
const MIN_CANDIDATE_NUM = parseInt(process.argv[3], 10) || 4650;

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

const MONTH_NAMES = 'January|February|March|April|May|June|July|August|September|October|November|December';

function parseHearingDate(text) {
  // Two date formats appear across the archive's history:
  //   "Month Day[st/nd/rd/th], Year"  e.g. "July 5th, 1965"
  //   "Day Month Year"                e.g. "Tuesday 12 November 1991" (no comma)
  const monthDayYear = text.match(
    new RegExp(`heard[^.]{0,80}?,\\s*(${MONTH_NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})`, 'i')
  );
  if (monthDayYear) {
    const month = MONTHS[monthDayYear[1].toLowerCase()];
    const day = parseInt(monthDayYear[2], 10);
    const year = parseInt(monthDayYear[3], 10);
    return new Date(year, month, day);
  }

  const dayMonthYear = text.match(
    new RegExp(`heard[^.]{0,80}?\\s(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAMES})\\s+(\\d{4})`, 'i')
  );
  if (dayMonthYear) {
    const day = parseInt(dayMonthYear[1], 10);
    const month = MONTHS[dayMonthYear[2].toLowerCase()];
    const year = parseInt(dayMonthYear[3], 10);
    return new Date(year, month, day);
  }

  return null;
}

function caseLabelFromFilename(filename) {
  const m = filename.match(/^(CR|BA)([0-9]{4}[A-Za-z0-9\-]*)\.pdf$/i);
  if (!m) return filename.replace(/\.pdf$/i, '');
  return `${m[1].toUpperCase()} ${m[2]}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MIN_VALID_SIZE = 1024; // real award PDFs are always at least a few KB —
// anything smaller is a truncated/empty response from a throttled server,
// not a genuinely tiny PDF. Treat it as a failure worth retrying rather
// than silently trying to parse it (which can succeed with empty text and
// get miscounted as "no date found" instead of a real failure).

async function downloadFile(url, attempts = 4) {
  let lastReason = 'unknown';
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastReason = `HTTP ${res.status}`;
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length >= MIN_VALID_SIZE) return buf;
        lastReason = `suspiciously small response (${buf.length} bytes)`;
      }
    } catch (err) {
      lastReason = err.message;
    }
    if (i < attempts - 1) await sleep(800 * (i + 1)); // backoff: 800ms, 1600ms, 2400ms
  }
  throw new Error(`download failed after ${attempts} attempts: ${lastReason}`);
}

async function main() {
  const yearsBack = parseFloat(process.argv[2]) || 5;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - yearsBack);

  const links = fs.readFileSync(LINKS_FILE, 'utf-8').split('\n').map((l) => l.trim()).filter(Boolean);

  const candidates = links.filter((url) => {
    // BA-prefixed files are French-language translations of the same
    // cases (e.g. BA3249.pdf duplicates CR3249.pdf in French) — skip
    // them, we only want the English originals.
    const m = url.match(/\/CR([0-9]{4})/i);
    if (!m) return false;
    return parseInt(m[1], 10) >= MIN_CANDIDATE_NUM;
  });

  console.log(`Cutoff date: ${cutoff.toDateString()}`);
  console.log(`Candidate files to check: ${candidates.length}`);

  fs.mkdirSync(CROA_DIR, { recursive: true });

  // Merge into the existing manifest rather than rebuilding from scratch,
  // so an early abort (e.g. due to throttling) can't lose entries for
  // cached files that this run never got back around to revisiting.
  const manifestMap = new Map();
  if (fs.existsSync(MANIFEST_PATH)) {
    const existing = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    for (const entry of existing) manifestMap.set(entry.file, entry);
  }

  let checked = 0;
  let kept = 0;
  let failed = 0;
  let noDate = 0;
  let consecutiveFailures = 0;
  const CONSECUTIVE_FAILURE_LIMIT = 15;
  let abortedEarly = false;

  for (const url of candidates) {
    checked++;
    const filename = decodeURIComponent(url.split('/').pop());
    const localPath = path.join(CROA_DIR, filename);

    try {
      let buf;
      if (fs.existsSync(localPath) && fs.statSync(localPath).size >= MIN_VALID_SIZE) {
        buf = fs.readFileSync(localPath);
      } else {
        buf = await downloadFile(url); // throws after retries exhausted
      }

      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      const date = parseHearingDate(result.text.slice(0, 1000));

      if (!date || date < cutoff) {
        if (!date) noDate++;
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath); // don't keep out-of-window files on disk
        manifestMap.delete(filename);
        consecutiveFailures = 0; // a successful parse, even with no date, proves the server is responding
        continue;
      }

      if (!fs.existsSync(localPath)) fs.writeFileSync(localPath, buf);

      manifestMap.set(filename, {
        file: filename,
        caseLabel: caseLabelFromFilename(filename),
        date: date.toISOString().slice(0, 10),
      });
      kept++;
      consecutiveFailures = 0;
    } catch (err) {
      failed++;
      consecutiveFailures++;
      console.error(`Error on ${filename}: ${err.message}`);
      if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
        console.error(
          `\nAborting: ${consecutiveFailures} consecutive failures — croa.com is likely throttling/blocking us again. ` +
          `Stopping early rather than burning through the rest of the list. Re-run later once the site is reachable again; ` +
          `already-downloaded files are cached, so it'll resume from here.`
        );
        abortedEarly = true;
        break;
      }
    }

    // small delay between requests so we don't hammer croa.com's server
    await sleep(120);

    if (checked % 50 === 0) {
      console.log(`...${checked}/${candidates.length} checked, ${kept} kept, ${noDate} no-date, ${failed} failed`);
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify([...manifestMap.values()], null, 2)); // incremental save
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify([...manifestMap.values()], null, 2));
  console.log(`${abortedEarly ? 'Aborted early' : 'Done'}. Checked ${checked}/${candidates.length}, kept ${kept}, no-date ${noDate}, failed ${failed}.`);
  console.log(`Manifest now has ${manifestMap.size} total entries, written to ${MANIFEST_PATH}`);
}

main();
