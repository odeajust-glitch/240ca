require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { buildIndex, indexCaseBatch } = require('./lib/indexer');
const { SearchIndex } = require('./lib/search');
const { streamKimi, FAST_MODEL, SLOW_MODEL, NOT_FOUND_PATTERN } = require('./lib/kimi');
const { SOURCES, ALL_SOURCE_IDS } = require('./lib/sources');

const CROA_DIR = path.join(__dirname, 'data', 'croa');
const CROA_MANIFEST_PATH = path.join(__dirname, 'data', 'croa_manifest.json');

async function indexCroa() {
  if (!fs.existsSync(CROA_MANIFEST_PATH)) return [];
  const manifest = JSON.parse(fs.readFileSync(CROA_MANIFEST_PATH, 'utf-8'));
  const cases = manifest.map((entry) => ({
    filePath: path.join(CROA_DIR, entry.file),
    caseLabel: `${entry.caseLabel} (${entry.date})`,
    date: entry.date,
  }));
  return indexCaseBatch(cases, 'croa');
}

const PORT = process.env.PORT || 5174;
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let searchIndex = null;

app.get('/api/sources', (req, res) => {
  res.json({ sources: SOURCES.map(({ id, name }) => ({ id, name })) });
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
      })),
    });

    const wantsSlow = tier === 'slow';
    const model = wantsSlow ? SLOW_MODEL : FAST_MODEL;

    const firstAnswer = await streamKimi({
      question,
      contextChunks: chunks,
      model,
      onToken: (text) => send({ type: 'chunk', text }),
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
      });
      send({ type: 'done', escalated: true });
    } else {
      send({ type: 'done', canEscalate: !wantsSlow });
    }
    res.end();
  } catch (err) {
    console.error(err);
    send({ type: 'error', error: err.message });
    res.end();
  }
});

app.get('/api/status', (req, res) => {
  res.json({ ready: !!searchIndex, chunkCount: searchIndex ? searchIndex.chunks.length : 0 });
});

async function start() {
  console.log('Indexing collective agreements...');
  const staticSources = SOURCES.filter((s) => !s.dynamic);
  const chunks = await buildIndex(staticSources.map(({ filePath, id }) => ({ filePath, label: id })));

  const croaChunks = await indexCroa();
  console.log(`Indexed ${croaChunks.length} CROA case chunks.`);

  searchIndex = new SearchIndex([...chunks, ...croaChunks]);
  console.log(`Indexed ${searchIndex.chunks.length} total chunks.`);

  app.listen(PORT, () => {
    console.log(`Collective Agreement Search running at http://localhost:${PORT}`);
  });
}

start();
