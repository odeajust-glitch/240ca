// One-off / re-runnable script to download CROA arbitration award PDFs
// and keep only the ones within a recent date window (based on the
// award's actual "Heard in ..., <date>" text, not the case number).
//
// Usage: node scripts/fetch-croa.js [yearsBack]
// Downloads land in data/croa/, and a manifest is written to
// data/croa_manifest.json for server.js to index.

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const LINKS_FILE = path.join(__dirname, '..', 'croa_all_links.txt');
const CROA_DIR = path.join(__dirname, '..', 'data', 'croa');
const MANIFEST_PATH = path.join(__dirname, '..', 'data', 'croa_manifest.json');
const MIN_CANDIDATE_NUM = 4650; // safety margin below the known ~5yr boundary

const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function parseHearingDate(text) {
  const m = text.match(
    /heard[^.]{0,80}?,\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})/i
  );
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  return new Date(year, month, day);
}

function caseLabelFromFilename(filename) {
  const m = filename.match(/^(CR|BA)([0-9]{4}[A-Za-z0-9\-]*)\.pdf$/i);
  if (!m) return filename.replace(/\.pdf$/i, '');
  return `${m[1].toUpperCase()} ${m[2]}`;
}

async function downloadFile(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function main() {
  const yearsBack = parseFloat(process.argv[2]) || 5;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - yearsBack);

  const links = fs.readFileSync(LINKS_FILE, 'utf-8').split('\n').map((l) => l.trim()).filter(Boolean);

  const candidates = links.filter((url) => {
    const m = url.match(/\/(?:CR|BA)([0-9]{4})/i);
    if (!m) return false;
    return parseInt(m[1], 10) >= MIN_CANDIDATE_NUM;
  });

  console.log(`Cutoff date: ${cutoff.toDateString()}`);
  console.log(`Candidate files to check: ${candidates.length}`);

  fs.mkdirSync(CROA_DIR, { recursive: true });

  const manifest = [];
  let checked = 0;
  let kept = 0;
  let failed = 0;

  for (const url of candidates) {
    checked++;
    const filename = decodeURIComponent(url.split('/').pop());
    const localPath = path.join(CROA_DIR, filename);

    try {
      let buf;
      if (fs.existsSync(localPath)) {
        buf = fs.readFileSync(localPath);
      } else {
        buf = await downloadFile(url);
        if (!buf) {
          failed++;
          continue;
        }
      }

      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      const date = parseHearingDate(result.text.slice(0, 1000));

      if (!date || date < cutoff) {
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath); // don't keep out-of-window files on disk
        continue;
      }

      if (!fs.existsSync(localPath)) fs.writeFileSync(localPath, buf);

      manifest.push({
        file: filename,
        caseLabel: caseLabelFromFilename(filename),
        date: date.toISOString().slice(0, 10),
      });
      kept++;
    } catch (err) {
      failed++;
      console.error(`Error on ${filename}: ${err.message}`);
    }

    if (checked % 50 === 0) {
      console.log(`...${checked}/${candidates.length} checked, ${kept} kept, ${failed} failed`);
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Done. Checked ${checked}, kept ${kept}, failed ${failed}.`);
  console.log(`Manifest written to ${MANIFEST_PATH}`);
}

main();
