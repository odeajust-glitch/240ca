// Pre-builds the chunk cache (data/chunks_cache.json) so the server
// boots in seconds instead of re-parsing ~2,000 PDFs. Render runs this
// as part of the build command; run it locally after changing any
// source document or the chunker.
const { loadOrBuildChunks, CACHE_PATH } = require('../lib/corpus');

async function main() {
  const started = Date.now();
  const { chunks, fromCache } = await loadOrBuildChunks();
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    fromCache
      ? `Cache already fresh (${chunks.length} chunks, checked in ${secs}s): ${CACHE_PATH}`
      : `Built ${chunks.length} chunks in ${secs}s, saved to ${CACHE_PATH}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
