# Collective Agreement Search

Question-answering web app for TCRC Division 240 (CN Rail, Sarnia) conductors
and locomotive engineers. Members ask plain-English questions about their
collective agreements and work rules; the app retrieves the most relevant
passages with BM25 and has an LLM answer **only from those excerpts**, with
document + page citations on every claim. Not legal advice — the UI says so.

## How it works

1. **Corpus** — `data/` holds the source documents: the Conductors (4.16) and
   Engineers (1.1) agreements, Transport Canada rest rules, CROR, CN's GOI and
   dangerous-goods rules, crew-calling manuals, the discipline grid, and
   ~2,000 CROA arbitration awards (`data/croa/` + `croa_manifest.json`).
   The registry lives in [lib/sources.js](lib/sources.js).
2. **Indexing** — PDFs are parsed and chunked ([lib/indexer.js](lib/indexer.js)),
   cached in `data/chunks_cache.json` ([lib/corpus.js](lib/corpus.js)), and
   served from an in-memory BM25 inverted index ([lib/search.js](lib/search.js)).
   The cache is keyed on the inputs and rebuilds itself when a document changes.
3. **Answering** — `/api/ask` streams NDJSON: citations first, then answer
   tokens from Moonshot's Kimi API ([lib/kimi.js](lib/kimi.js)). A fast model
   answers first; if it can't find the answer, the app retries with a slower
   model over a wider retrieval (24 chunks instead of 9). Users can also
   trigger that manually ("Try a deeper search").

## Running locally

```
npm install
cp .env.example .env   # fill in KIMI_API_KEY
node scripts/build-cache.js   # optional: pre-parse PDFs (~80s); first boot does it otherwise
npm start              # http://localhost:5174
```

## Scripts

- `scripts/build-cache.js` — pre-builds the chunk cache. Render runs this at
  build time so deploys boot warm.
- `scripts/fetch-croa.js [yearsBack] [minCandidateNum]` — downloads CROA award
  PDFs into `data/croa/` and writes the manifest. **Requires
  `croa_all_links.txt`** (a list of PDF URLs scraped from croa.com's award
  archive), which is not checked in — regenerate it from the archive listing
  before running.
- `scripts/rebuild-croa-manifest.js` — rebuilds the manifest from PDFs already
  on disk.

## Deployment

Deployed to Render via [render.yaml](render.yaml) (all source PDFs are
committed, so the build step can parse them). `KIMI_API_KEY` is set in the
Render dashboard. `/api/ask` is rate-limited per IP (10 requests / 5 min) and
questions are capped at 500 characters.
