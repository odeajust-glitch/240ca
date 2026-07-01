require('dotenv').config();
const path = require('path');
const express = require('express');
const { loadOrBuildChunks } = require('./lib/corpus');
const { SearchIndex } = require('./lib/search');
const { streamKimi, FAST_MODEL, SLOW_MODEL, NOT_FOUND_PATTERN } = require('./lib/kimi');
const { SOURCES, ALL_SOURCE_IDS } = require('./lib/sources');

const PORT = process.env.PORT || 5174;
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let searchIndex = null;

app.get('/api/sources', (req, res) => {
  res.json({ sources: SOURCES.map(({ id, name, crafts }) => ({ id, name, crafts })) });
});

app.post('/api/ask', async (req, res) => {
  const { question, sources: requestedSources, dateFrom, dateTo, tier } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question is required.' });
  }
  if (!searchIndex) {
    return res.status(503).json({ error: 'Index still building, try again shortly.' });
  }

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
    let sources = null;
    if (Array.isArray(requestedSources) && requestedSources.length > 0) {
      const valid = requestedSources.filter((id) => ALL_SOURCE_IDS.includes(id));
      if (valid.length === 0) {
        send({ type: 'chunk', text: 'No documents are selected to search. Enable at least one source.' });
        send({ type: 'done', citations: [] });
        return res.end();
      }
      if (valid.length < ALL_SOURCE_IDS.length) sources = valid;
    }

    const chunks = searchIndex.search(question, {
      topK: 9,
      sources,
      dateFrom: typeof dateFrom === 'string' && dateFrom ? dateFrom : null,
      dateTo: typeof dateTo === 'string' && dateTo ? dateTo : null,
    });

    if (chunks.length === 0) {
      send({ type: 'chunk', text: 'No matching passages were found in the selected document(s) for this question.' });
      send({ type: 'done', citations: [] });
      return res.end();
    }

    send({
      type: 'citations',
      citations: chunks.map((c) => ({
        source: c.source,
        page: c.page,
        snippet: c.text.slice(0, 220),
        fullText: c.text,
        url: c.url || null,
      })),
    });

    const wantsSlow = tier === 'slow';
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
    // cost/latency on questions that already answer well.
    if (!wantsSlow && NOT_FOUND_PATTERN.test(firstAnswer)) {
      send({ type: 'escalating' });
      await streamKimi({
        question,
        contextChunks: chunks,
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

app.get('/api/status', (req, res) => {
  res.json({ ready: !!searchIndex, chunkCount: searchIndex ? searchIndex.chunks.length : 0 });
});

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
