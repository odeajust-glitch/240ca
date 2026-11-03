// Puts the agreement search on Cloudflare (owner, 2026-11-03: moving off
// Render). Builds the passage index from data\ (the PDFs and CROA awards in
// this folder; the first run takes a couple of minutes), cuts it into small
// files (lib/search-shards.js) and uploads them with the PDFs to the R2
// bucket the board site uses (the R2_ settings in BoardChecker\.env).
// Only what changed goes up. Run again after adding or changing a document.
//
//   node scripts/search-upload.js
const fs = require('fs');
const { loadOrBuildChunks } = require('../lib/corpus');
const { buildShards } = require('../lib/search-shards');
const { SOURCES } = require('../lib/sources');
const { siteSettings } = require('../lib/board/site');
const { syncPrefixes } = require('../lib/board/r2');

async function main() {
  const settings = siteSettings();
  if (!settings.r2) {
    console.error(settings.r2Missing.length ? `Cloudflare settings incomplete in BoardChecker\\.env: ${settings.r2Missing.join(', ')}.` : 'Put R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in BoardChecker\\.env first.');
    process.exit(1);
  }
  console.log('Reading the documents (a couple of minutes the first time)...');
  const { chunks } = await loadOrBuildChunks();
  const files = buildShards(chunks, SOURCES);
  for (const s of SOURCES) if (s.filePath && /\.pdf$/i.test(s.filePath)) files.set(`docs/${s.id}.pdf`, fs.readFileSync(s.filePath));
  console.log(`${chunks.length} passages; ${files.size} files to check against Cloudflare.`);
  let last = 0;
  const sent = await syncPrefixes({ files, prefixes: ['search/', 'docs/'], r2: settings.r2,
    onProgress: (done, total) => { const pct = Math.floor((100 * done) / total); if (pct >= last + 10) { last = pct; console.log(`  ${pct}%`); } } });
  if (!sent.ok) { console.error(`Not uploaded: ${sent.message}`); process.exit(1); }
  console.log(`Done: ${sent.uploaded} uploaded, ${sent.removed} removed. The search is live on the board site (Agreements).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
