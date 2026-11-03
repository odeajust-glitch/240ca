// The agreement search on Cloudflare (owner, 2026-11-03: moving off Render).
// The Render server held the whole BM25 index in memory (lib/search.js); a
// Worker can't (128 MB, and it starts cold). So the index is built once on
// the laptop and cut into small files in R2, and the Worker reads only the
// few a question needs (cloudflare/board-worker.js, searchShards):
//
//   search/meta.json        { key, N, avgLength, buckets, perFile, docs: [[source, page, date, url, length]] }
//   search/sources.json     the source list (/api/sources) and the PDF ids
//   search/t/<b>.json       { term: [docId, tf, docId, tf, …] } for the terms hashing to bucket b
//   search/c/<k>.json       [text, …] for docIds k*perFile … (k+1)*perFile − 1
//
// Same tokenizer and BM25 as lib/search.js, so the results are the same
// (test/search-shards.test.js checks it against SearchIndex).
const crypto = require('crypto');
const { tokenize } = require('./search');

const BUCKETS = 512;
const PER_FILE = 200;

// FNV-1a, 32-bit: the Worker uses the same to find a term's bucket.
function bucketOf(term, buckets = BUCKETS) {
  let h = 0x811c9dc5;
  for (let i = 0; i < term.length; i++) {
    h ^= term.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % buckets;
}

// chunks: [{ source, page, text, date?, url? }]; sources: lib/sources.js
// SOURCES. → Map(path → JSON text).
function buildShards(chunks, sources, { buckets = BUCKETS, perFile = PER_FILE } = {}) {
  const files = new Map();
  const N = chunks.length;
  const docs = new Array(N);
  // No prototype: words like "constructor" are terms too.
  const terms = Array.from({ length: buckets }, () => Object.create(null));
  let total = 0;
  for (let i = 0; i < N; i++) {
    const c = chunks[i];
    const tokens = tokenize(c.text);
    total += tokens.length;
    docs[i] = [c.source, c.page, c.date || null, c.url || null, tokens.length];
    const counts = new Map();
    for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
    for (const [t, tf] of counts) {
      const b = terms[bucketOf(t, buckets)];
      (b[t] || (b[t] = [])).push(i, tf);
    }
  }
  for (let b = 0; b < buckets; b++) files.set(`search/t/${b}.json`, JSON.stringify(terms[b]));
  for (let k = 0; k * perFile < N; k++) files.set(`search/c/${k}.json`, JSON.stringify(chunks.slice(k * perFile, (k + 1) * perFile).map((c) => c.text)));
  const pdfs = sources.filter((s) => s.filePath && /\.pdf$/i.test(s.filePath)).map((s) => s.id);
  files.set('search/sources.json', JSON.stringify({
    sources: sources.map(({ id, name, crafts, manualOnly, conflictsWith }) => ({ id, name, crafts, manualOnly: !!manualOnly, conflictsWith: conflictsWith || [] })),
    defaults: sources.filter((s) => !s.manualOnly).map((s) => s.id),
    pdfs,
  }));
  // The key changes whenever anything above does, so the Worker drops what it cached.
  const key = crypto.createHash('sha256').update([...files.values()].join('\n')).digest('hex').slice(0, 16);
  files.set('search/meta.json', JSON.stringify({ key, N, avgLength: total / (N || 1), buckets, perFile, docs }));
  return files;
}

module.exports = { buildShards, bucketOf, BUCKETS, PER_FILE };
