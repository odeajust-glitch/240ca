require('dotenv').config();
const path = require('path');
const express = require('express');
const { buildIndex } = require('./lib/indexer');
const { SearchIndex } = require('./lib/search');
const { streamKimi } = require('./lib/kimi');
const { SOURCES, ALL_SOURCE_IDS } = require('./lib/sources');

const PORT = process.env.PORT || 5174;
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let searchIndex = null;

app.get('/api/sources', (req, res) => {
  res.json({ sources: SOURCES.map(({ id, name }) => ({ id, name })) });
});

app.post('/api/ask', async (req, res) => {
  const { question, sources: requestedSources } = req.body;
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

    const chunks = searchIndex.search(question, { topK: 9, sources });

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

    await streamKimi({
      question,
      contextChunks: chunks,
      onToken: (text) => send({ type: 'chunk', text }),
    });

    send({ type: 'done' });
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
  const chunks = await buildIndex(SOURCES.map(({ filePath, id }) => ({ filePath, label: id })));
  searchIndex = new SearchIndex(chunks);
  console.log(`Indexed ${chunks.length} chunks.`);

  app.listen(PORT, () => {
    console.log(`Collective Agreement Search running at http://localhost:${PORT}`);
  });
}

start();
