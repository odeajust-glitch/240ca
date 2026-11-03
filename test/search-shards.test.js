// Owner, 2026-11-03: the agreement search moves from Render to the Worker.
// The Worker's search over the R2 files must give what SearchIndex gave.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { SearchIndex } = require('../lib/search');
const { buildShards } = require('../lib/search-shards');
const { SOURCES } = require('../lib/sources');

const words = ['company', 'employee', 'rest', 'hours', 'article', 'grievance', 'arbitrator', 'held', 'away', 'terminal', 'call', 'crew',
  'conductor', 'engineer', 'mileage', 'vacation', 'discipline', 'claims', 'duties', 'yard', 'spareboard', 'notice', 'book', 'off', 'sick'];
function corpus() {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const out = [];
  const ids = ['conductors', 'engineers', 'rest_rules', 'croa', 'agreement_4_3'];
  for (let i = 0; i < 230; i++) {
    const n = 20 + Math.floor(rnd() * 60);
    const text = Array.from({ length: n }, () => words[Math.floor(rnd() * words.length)]).join(' ') + (i % 7 === 0 ? ' Article 18.6(b) applies.' : '');
    const source = ids[i % ids.length];
    out.push({ id: `c${i}`, source, page: source === 'croa' ? `CR ${5000 + i} (2020-01-0${1 + (i % 9)})` : String(1 + i), text,
      ...(source === 'croa' ? { date: `2020-01-0${1 + (i % 9)}`, url: `http://croa.com/PDFAWARDS/CR${5000 + i}.pdf` } : {}) });
  }
  return out;
}

async function loadWorker() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'cloudflare', 'board-worker.js'), 'utf8');
  return (await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)).default;
}
function envWith(files) {
  const store = new Map(files);
  const obj = (k) => store.has(k) && { httpEtag: '"e"', writeHttpMetadata: () => {}, body: store.get(k), text: async () => store.get(k) };
  return { store, env: { KIMI_API_KEY: 'test-key', SITE: {
    get: async (k) => obj(k) || null, head: async (k) => obj(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
    list: async ({ prefix }) => ({ objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
  } } };
}
// Kimi stand-in: streams one answer (or "could not find" for the fast pass when asked).
function fakeKimi(answers) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push(JSON.parse(opts.body));
    const text = answers[Math.min(calls.length - 1, answers.length - 1)];
    const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
    return new Response(sse, { status: 200 });
  };
  return { calls, fetchImpl };
}
const readAll = async (res) => (await res.text()).trim().split('\n').map((l) => JSON.parse(l));

test('search: the Worker finds the same passages as SearchIndex', async () => {
  const chunks = corpus();
  const files = buildShards(chunks, SOURCES, { buckets: 16, perFile: 50 });
  const index = new SearchIndex(chunks);
  const worker = await loadWorker();
  const { env } = envWith(files);
  const real = globalThis.fetch;
  try {
    for (const [q, opts] of [['held away from the terminal', {}], ['grievance about article 18.6', {}], ['sick book off notice', { sources: ['conductors', 'croa'] }],
      ['arbitrator discipline', { sources: ['croa'], dateFrom: '2020-01-03', dateTo: '2020-01-06' }], ['claims duties', {}]]) {
      const kimi = fakeKimi(['Answer [1].']);
      globalThis.fetch = kimi.fetchImpl;
      const res = await worker.fetch(new Request('https://board.x.workers.dev/api/ask', { method: 'POST', body: JSON.stringify({ question: q, ...opts }), headers: { 'cf-connecting-ip': `1.2.3.${q.length}` } }), env, { waitUntil: () => {} });
      const events = await readAll(res);
      const cites = events.find((e) => e.type === 'citations').citations;
      const want = index.search(q, { topK: 9, sources: opts.sources || SOURCES.filter((s) => !s.manualOnly).map((s) => s.id), dateFrom: opts.dateFrom, dateTo: opts.dateTo });
      assert.deepEqual(cites.map((c) => [c.source, c.page, c.fullText]), want.map((c) => [c.source, c.page, c.text]), q);
      assert.ok(events.some((e) => e.type === 'chunk' && e.text === 'Answer [1].'));
      assert.deepEqual(events[events.length - 1], { type: 'done', canEscalate: true });
      // The question and the passages go to Kimi; the key in the header.
      assert.match(kimi.calls[0].messages[1].content, new RegExp(`Question: ${q}$`));
    }
  } finally { globalThis.fetch = real; }
});

test('ask: escalates when the fast answer could not find it; PDFs get page links; limits', async () => {
  const chunks = corpus();
  const worker = await loadWorker();
  const { env, store } = envWith(buildShards(chunks, SOURCES, { buckets: 16, perFile: 50 }));
  const real = globalThis.fetch;
  try {
    const kimi = fakeKimi(['I could not find it in the excerpts.', 'Deeper answer.']);
    globalThis.fetch = kimi.fetchImpl;
    const post = (body, ip = '9.9.9.9') => worker.fetch(new Request('https://board.x.workers.dev/api/ask', { method: 'POST', body: JSON.stringify(body), headers: { 'cf-connecting-ip': ip } }), env, { waitUntil: () => {} });
    const ev = await readAll(await post({ question: 'rest hours conductor' }));
    assert.deepEqual(ev.map((e) => e.type).filter((t, i, a) => a.indexOf(t) === i), ['citations', 'chunk', 'escalating', 'done']);
    assert.equal(ev.filter((e) => e.type === 'citations')[1].citations.length, 24);
    assert.equal(kimi.calls[0].thinking.type, 'disabled'); // fast tier
    assert.equal(kimi.calls[1].model, 'kimi-k3');
    const c = ev.find((e) => e.type === 'citations').citations;
    assert.ok(c.some((x) => x.source === 'conductors' && x.url === `/docs/conductors.pdf#page=${x.page}`));
    assert.ok(c.filter((x) => x.source === 'croa').every((x) => /^http:\/\/croa\.com\//.test(x.url)));
    // Bad input, conflicting sources.
    assert.equal((await post({ question: '' })).status, 400);
    assert.equal((await post({ question: 'x'.repeat(501) })).status, 400);
    const conflict = await readAll(await post({ question: 'rest', sources: ['agreement_4_3', 'conductors'] }));
    assert.match(conflict[0].text, /can't be searched together/);
    // 10 per 5 minutes per address (this one has asked 2).
    for (let i = 0; i < 8; i++) await post({ question: 'rest' });
    assert.equal((await post({ question: 'rest' })).status, 429);
    assert.equal((await post({ question: 'rest' }, '8.8.8.8')).status, 200);
    // Counted per day, no addresses kept; stats only with the key.
    const day = [...store.keys()].find((k) => k.startsWith('ask/stats/'));
    assert.ok(day && !/9\.9\.9\.9/.test(store.get(day)));
    env.STATS_KEY = 'statskey-123456';
    assert.equal((await worker.fetch(new Request('https://board.x.workers.dev/api/stats?key=wrong'), env)).status, 404);
    const st = await (await worker.fetch(new Request('https://board.x.workers.dev/api/stats?key=statskey-123456'), env)).json();
    assert.equal(st.today.visitors, 2);
    // The index files and counters are never served as files.
    for (const p of ['/search/meta.json', '/ask/stats/x.json']) assert.equal((await worker.fetch(new Request(`https://board.x.workers.dev${p}`), env)).status, 404);
    // Sources and status.
    assert.equal((await (await worker.fetch(new Request('https://board.x.workers.dev/api/sources'), env)).json()).sources.length, SOURCES.length);
    assert.deepEqual(await (await worker.fetch(new Request('https://board.x.workers.dev/api/status'), env)).json(), { ready: true, chunkCount: chunks.length });
  } finally { globalThis.fetch = real; }
});
