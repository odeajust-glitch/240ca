// Builds the full chunk corpus (static agreement PDFs + the CROA case
// batch) with a JSON cache, so restarts don't re-parse ~2,000 PDFs.
// The cache is keyed on a hash of the inputs; any changed source file,
// manifest edit, or chunker tuning produces a different key and forces
// a rebuild. Generate it ahead of time with scripts/build-cache.js
// (Render runs that at build time) — otherwise the first boot builds
// and saves it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildIndex, indexCaseBatch, CHUNK_SIZE, CHUNK_OVERLAP } = require('./indexer');
const { SOURCES } = require('./sources');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CROA_DIR = path.join(DATA_DIR, 'croa');
const CROA_MANIFEST_PATH = path.join(DATA_DIR, 'croa_manifest.json');
const CACHE_PATH = path.join(DATA_DIR, 'chunks_cache.json');

// Bump when a code change alters chunk output in a way the input hash
// can't see (e.g. new cleanup logic in the indexer).
const CACHE_VERSION = 1;

function readManifest() {
  if (!fs.existsSync(CROA_MANIFEST_PATH)) return null;
  return fs.readFileSync(CROA_MANIFEST_PATH, 'utf-8');
}

function computeCacheKey(manifestRaw) {
  const hash = crypto.createHash('sha256');
  hash.update(`v${CACHE_VERSION}|${CHUNK_SIZE}|${CHUNK_OVERLAP}`);
  // Static sources: identity is name + size. Sizes catch a swapped-in
  // revision of an agreement; mtimes are deliberately excluded because
  // a fresh git clone (every Render deploy) rewrites them all.
  for (const s of SOURCES.filter((s) => !s.dynamic)) {
    hash.update(`|${s.id}:${fs.statSync(s.filePath).size}`);
  }
  // The CROA corpus is fully described by its manifest: cases are only
  // added/removed via fetch-croa.js, which rewrites the manifest, and
  // the award PDFs themselves are immutable once published.
  hash.update(`|croa:${manifestRaw ? crypto.createHash('sha256').update(manifestRaw).digest('hex') : 'none'}`);
  return hash.digest('hex');
}

async function buildAllChunks(manifestRaw) {
  const staticSources = SOURCES.filter((s) => !s.dynamic);
  const chunks = await buildIndex(staticSources.map(({ filePath, id }) => ({ filePath, label: id })));

  let croaChunks = [];
  if (manifestRaw) {
    const manifest = JSON.parse(manifestRaw);
    const cases = manifest.map((entry) => ({
      filePath: path.join(CROA_DIR, entry.file),
      caseLabel: `${entry.caseLabel} (${entry.date})`,
      date: entry.date,
      url: `http://croa.com/PDFAWARDS/${entry.file}`,
    }));
    croaChunks = await indexCaseBatch(cases, 'croa');
  }

  return [...chunks, ...croaChunks];
}

// Returns { chunks, fromCache }.
async function loadOrBuildChunks() {
  const manifestRaw = readManifest();
  const key = computeCacheKey(manifestRaw);

  if (fs.existsSync(CACHE_PATH)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
      if (cached.key === key) return { chunks: cached.chunks, fromCache: true };
      console.log('Chunk cache is stale (inputs changed), rebuilding...');
    } catch (err) {
      console.warn(`Chunk cache unreadable (${err.message}), rebuilding...`);
    }
  }

  const chunks = await buildAllChunks(manifestRaw);
  fs.writeFileSync(CACHE_PATH, JSON.stringify({ key, chunks }));
  return { chunks, fromCache: false };
}

module.exports = { loadOrBuildChunks, CACHE_PATH };
