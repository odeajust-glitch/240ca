require('dotenv').config();
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const { loadOrBuildChunks } = require('./lib/corpus');
const { SearchIndex } = require('./lib/search');
const { streamKimi, FAST_MODEL, SLOW_MODEL, NOT_FOUND_PATTERN } = require('./lib/kimi');
const { SOURCES, SOURCE_NAMES, ALL_SOURCE_IDS, DEFAULT_SOURCE_IDS, findConflict } = require('./lib/sources');
const { rateLimit } = require('./lib/rate-limit');
const { Analytics } = require('./lib/analytics');

const PORT = process.env.PORT || 5174;
const MAX_QUESTION_LENGTH = 500;

// The deep pass widens retrieval, not just the model: when the fast pass
// says "could not find", the usual culprit is the right passage missing
// from the top results — a smarter model can't answer from excerpts that
// don't contain the answer. 24 chunks ≈ 7k tokens, well within the slow
// model's context.
const TOP_K = 9;
const TOP_K_DEEP = 24;

const app = express();
// Render terminates TLS at its proxy; without this, req.ip is the proxy's
// address for everyone and the rate limit would be shared globally.
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cost protection for the paid Kimi calls behind /api/ask.
const askLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many questions in a short time — please wait a few minutes and try again.',
});

let searchIndex = null;
const analytics = new Analytics();

app.get('/api/sources', (req, res) => {
  res.json({
    sources: SOURCES.map(({ id, name, crafts, manualOnly, conflictsWith }) => ({
      id, name, crafts, manualOnly: !!manualOnly, conflictsWith: conflictsWith || [],
    })),
  });
});

// Serve the source PDFs so citations can deep-link to a page
// (/docs/conductors.pdf#page=47). Whitelisted from SOURCES rather than
// exposing data/ wholesale — the chunk cache and CROA corpus stay private.
const DOC_FILES = Object.fromEntries(
  SOURCES.filter((s) => s.filePath && s.filePath.toLowerCase().endsWith('.pdf'))
    .map((s) => [s.id, s.filePath])
);

app.get('/docs/:file', (req, res) => {
  const id = req.params.file.replace(/\.pdf$/i, '');
  const filePath = DOC_FILES[id];
  if (!filePath) return res.status(404).json({ error: 'Unknown document.' });
  res.sendFile(filePath);
});

// PDF.js library for the in-app viewer (viewer.html) — Android Chrome
// hands PDFs to an external viewer that drops the #page= fragment, so
// those users get a viewer we control instead.
app.use('/pdfjs', express.static(path.join(__dirname, 'node_modules', 'pdfjs-dist', 'build')));

app.post('/api/ask', askLimiter, async (req, res) => {
  const { question, sources: requestedSources, dateFrom, dateTo, tier } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question is required.' });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: `Question is too long (maximum ${MAX_QUESTION_LENGTH} characters).` });
  }
  if (!searchIndex) {
    return res.status(503).json({ error: 'Index still building, try again shortly.' });
  }

  // Counted here, after validation and readiness checks, so the numbers
  // reflect real answered questions rather than rejected or retried noise.
  analytics.recordQuestion(req.ip);

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');

  const send = (obj) => res.write(JSON.stringify(obj) + '\n');

  // If the client navigates away mid-answer, abort the upstream Kimi call
  // instead of streaming (and paying for) tokens into a dead socket. Listen on
  // the RESPONSE closing, not req's 'close' — the latter fires as soon as the
  // POST body is read (before any answer is sent), which would abort every
  // request immediately. writableEnded distinguishes a real early disconnect
  // (false) from our own normal res.end() (true).
  const abort = new AbortController();
  let clientGone = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientGone = true;
      abort.abort();
    }
  });

  try {
    // No selection means the defaults — manual-only sources (e.g. 4.3) are
    // only ever searched when explicitly requested.
    let sources = DEFAULT_SOURCE_IDS;
    if (Array.isArray(requestedSources) && requestedSources.length > 0) {
      const valid = requestedSources.filter((id) => ALL_SOURCE_IDS.includes(id));
      if (valid.length === 0) {
        send({ type: 'chunk', text: 'No documents are selected to search. Enable at least one source.' });
        send({ type: 'done', citations: [] });
        return res.end();
      }
      const conflict = findConflict(valid);
      if (conflict) {
        send({ type: 'chunk', text: `${SOURCE_NAMES[conflict[0]]} can't be searched together with ${SOURCE_NAMES[conflict[1]]}. Deselect one of them.` });
        send({ type: 'done', citations: [] });
        return res.end();
      }
      sources = valid;
    }
    if (sources.length === ALL_SOURCE_IDS.length) sources = null;

    const searchOpts = {
      sources,
      dateFrom: typeof dateFrom === 'string' && dateFrom ? dateFrom : null,
      dateTo: typeof dateTo === 'string' && dateTo ? dateTo : null,
    };

    const wantsSlow = tier === 'slow';
    const chunks = searchIndex.search(question, {
      topK: wantsSlow ? TOP_K_DEEP : TOP_K,
      ...searchOpts,
    });

    if (chunks.length === 0) {
      send({ type: 'chunk', text: 'No matching passages were found in the selected document(s) for this question.' });
      send({ type: 'done', citations: [] });
      return res.end();
    }

    const sendCitations = (list) => send({
      type: 'citations',
      citations: list.map((c) => ({
        source: c.source,
        page: c.page,
        snippet: c.text.slice(0, 220),
        fullText: c.text,
        // CROA chunks carry their own external URL; agreement chunks get a
        // page deep-link into the locally served PDF. Non-PDF sources (the
        // mileage guidelines .txt) get no link.
        url: c.url || (DOC_FILES[c.source] && /^\d+$/.test(String(c.page))
          ? `/docs/${c.source}.pdf#page=${c.page}`
          : null),
      })),
    });
    sendCitations(chunks);

    const model = wantsSlow ? SLOW_MODEL : FAST_MODEL;

    const firstAnswer = await streamKimi({
      question,
      contextChunks: chunks,
      model,
      onToken: (text) => send({ type: 'chunk', text }),
      signal: abort.signal,
    });

    // Auto-escalate to the slower, more capable model only when the fast
    // model explicitly said it couldn't find the answer — avoids doubling
    // cost/latency on questions that already answer well. The retry gets
    // wider retrieval, and the citations are re-sent to match what the
    // model now sees (the frontend re-renders the list on each event).
    if (!wantsSlow && NOT_FOUND_PATTERN.test(firstAnswer)) {
      send({ type: 'escalating' });
      const deepChunks = searchIndex.search(question, { topK: TOP_K_DEEP, ...searchOpts });
      sendCitations(deepChunks);
      await streamKimi({
        question,
        contextChunks: deepChunks,
        model: SLOW_MODEL,
        onToken: (text) => send({ type: 'chunk', text }),
        signal: abort.signal,
      });
      send({ type: 'done', escalated: true });
    } else {
      send({ type: 'done', canEscalate: !wantsSlow });
    }
    res.end();
  } catch (err) {
    // A client disconnect aborts the Kimi fetch on purpose — the socket is
    // already gone, so there's nothing to report and nothing to end.
    if (clientGone || err.name === 'AbortError') return;
    console.error(err);
    send({ type: 'error', error: err.message });
    res.end();
  }
});

// Usage numbers are for the operator only. Without STATS_KEY set the
// endpoint doesn't exist at all (404, not 401) so it isn't discoverable on
// the public URL. Comparison is constant-time to avoid leaking the key a
// character at a time.
app.get('/api/stats', (req, res) => {
  const expected = process.env.STATS_KEY;
  if (!expected) return res.status(404).json({ error: 'Not found.' });

  const provided = String(req.query.key || '');
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(404).json({ error: 'Not found.' });
  }

  res.json(analytics.summary());
});

app.get('/api/status', (req, res) => {
  res.json({ ready: !!searchIndex, chunkCount: searchIndex ? searchIndex.chunks.length : 0 });
});

// Render sends SIGTERM on every deploy and restart; without this the last
// few minutes of counts (still inside the save debounce) would be lost.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    analytics.flush();
    process.exit(0);
  });
}

async function start() {
  // Listen before indexing so /api/status can report progress and the
  // deploy's port check passes immediately; /api/ask returns 503 until
  // the index is ready.
  app.listen(PORT, () => {
    console.log(`Collective Agreement Search running at http://localhost:${PORT}`);
  });

  console.log('Loading corpus...');
  const { chunks, fromCache } = await loadOrBuildChunks();
  console.log(fromCache ? 'Loaded chunks from cache.' : 'Parsed source documents and saved chunk cache.');

  searchIndex = new SearchIndex(chunks);
  console.log(`Indexed ${searchIndex.chunks.length} total chunks.`);
}

start();
