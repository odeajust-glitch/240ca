// Rebuilds data/croa_manifest.json purely from PDFs already cached in
// data/croa/ — no network calls. Use this if the manifest gets out of
// sync with what's actually on disk (e.g. a stray process overwrote it).

const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const CROA_DIR = path.join(__dirname, '..', 'data', 'croa');
const MANIFEST_PATH = path.join(__dirname, '..', 'data', 'croa_manifest.json');

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

async function main() {
  const files = fs.readdirSync(CROA_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
  console.log(`Found ${files.length} cached PDFs.`);

  const manifest = [];
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    try {
      const buf = fs.readFileSync(path.join(CROA_DIR, filename));
      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      const date = parseHearingDate(result.text.slice(0, 1000));
      if (!date) {
        failed++;
        console.error(`No date found in ${filename}`);
        continue;
      }
      manifest.push({
        file: filename,
        caseLabel: caseLabelFromFilename(filename),
        date: date.toISOString().slice(0, 10),
      });
    } catch (err) {
      failed++;
      console.error(`Error on ${filename}: ${err.message}`);
    }
    if ((i + 1) % 200 === 0) console.log(`...${i + 1}/${files.length}`);
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`Done. ${manifest.length} entries written, ${failed} failed.`);
}

main();
