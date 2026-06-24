require('dotenv').config();
const path = require('path');
const express = require('express');
const { buildIndex } = require('./lib/indexer');
const { SearchIndex } = require('./lib/search');
const { streamKimi } = require('./lib/kimi');

const PORT = process.env.PORT || 5174;
const ALWAYS_INCLUDED = ['rest_rules', 'crew_calling'];
const CRAFT_SOURCES = {
  conductors: ['conductors', 'conductors_addendum'],
  engineers: ['engineers'],
};
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let searchIndex = null;

app.post('/api/ask', async (req, res) => {
  const { question, scope } = req.body;
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
    const craft = scope === 'conductors' || scope === 'engineers' ? scope : null;
    const sources = craft ? [...CRAFT_SOURCES[craft], ...ALWAYS_INCLUDED] : null;
    const chunks = searchIndex.search(question, { topK: 9, sources });

    if (chunks.length === 0) {
      send({ type: 'chunk', text: 'No matching passages were found in the agreement(s) for this question.' });
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
  const chunks = await buildIndex([
    { filePath: path.join(__dirname, 'data', 'conductors.pdf'), label: 'conductors' },
    { filePath: path.join(__dirname, 'data', 'conductors_addendum.pdf'), label: 'conductors_addendum' },
    { filePath: path.join(__dirname, 'data', 'engineers.pdf'), label: 'engineers' },
    { filePath: path.join(__dirname, 'data', 'rest_rules.pdf'), label: 'rest_rules' },
    { filePath: path.join(__dirname, 'data', 'crew_calling_manual.pdf'), label: 'crew_calling' },
  ]);
  searchIndex = new SearchIndex(chunks);
  console.log(`Indexed ${chunks.length} chunks.`);

  app.listen(PORT, () => {
    console.log(`Collective Agreement Search running at http://localhost:${PORT}`);
  });
}

start();
