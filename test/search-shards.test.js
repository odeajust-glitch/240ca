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
// Claude stand-in: Anthropic's streaming events, or an error status.
function fakeClaude({ text = 'Opus answer [1].', status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
    if (status !== 200) return new Response('{"error":{"message":"nope"}}', { status });
    const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
    return new Response(ev({ type: 'message_start', message: { usage: { input_tokens: 10000, output_tokens: 1 } } }) + ev({ type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '' } })
      + ev({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text } }) + ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1000 } }) + ev({ type: 'message_stop' }), { status: 200 });
  };
  return { calls, fetchImpl };
}
// Sends Claude's URL to one stand-in, everything else (Kimi) to the other.
const route = (claude, kimi) => async (url, opts) => (String(url).includes('anthropic') ? claude.fetchImpl : kimi.fetchImpl)(url, opts);
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
    assert.deepEqual(ev.map((e) => e.type).filter((t, i, a) => a.indexOf(t) === i), ['citations', 'model', 'chunk', 'escalating', 'done']);
    assert.deepEqual(ev.filter((e) => e.type === 'model').map((e) => e.label), ['Kimi K2.6', 'Kimi K2.6']); // no ANTHROPIC_API_KEY: Kimi K2.6 stands in
    assert.equal(ev.filter((e) => e.type === 'citations')[1].citations.length, 24);
    // Thinking stays on (its reasoning comes apart and isn't shown).
    assert.equal(kimi.calls[0].thinking, undefined);
    assert.equal(kimi.calls[1].model, 'kimi-k2.6');
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

test('ask: Claude Sonnet for members\' deeper answers, Opus for the owner; Kimi if Claude fails', async () => {
  const chunks = corpus();
  const worker = await loadWorker();
  const { env } = envWith(buildShards(chunks, SOURCES, { buckets: 16, perFile: 50 }));
  Object.assign(env, { ANTHROPIC_API_KEY: 'anthropic-test', OWNER_KEY: 'owner-key-0123456789' });
  const real = globalThis.fetch;
  const post = (body, headers = {}) => worker.fetch(new Request('https://board.x.workers.dev/api/ask', { method: 'POST', body: JSON.stringify(body), headers: { 'cf-connecting-ip': `7.7.7.${Math.random()}`, ...headers } }), env, { waitUntil: () => {} });
  const answer = (ev) => ev.filter((e) => e.type === 'chunk').map((e) => e.text).join('');
  try {
    // A member: Kimi first; "could not find" goes to Sonnet with more passages.
    let claude = fakeClaude();
    let kimi = fakeKimi(['I could not find it in the excerpts.']);
    globalThis.fetch = route(claude, kimi);
    let ev = await readAll(await post({ question: 'rest hours conductor' }));
    assert.equal(kimi.calls.length, 1);
    assert.equal(claude.calls.length, 1);
    assert.equal(claude.calls[0].body.model, 'claude-sonnet-5-5');
    assert.equal(claude.calls[0].headers['x-api-key'], 'anthropic-test');
    assert.match(claude.calls[0].body.system, /ONLY the excerpts/);
    assert.match(claude.calls[0].body.messages[0].content, /Question: rest hours conductor$/);
    assert.equal((claude.calls[0].body.messages[0].content.match(/^\[\d+\] \(/gm) || []).length, 24);
    assert.deepEqual(ev.filter((e) => e.type === 'model').map((e) => e.label), ['Kimi K2.6', 'Claude Sonnet']);
    assert.match(answer(ev), /Opus answer/);
    // A member's "Try a deeper search": Sonnet, no Kimi.
    claude = fakeClaude(); kimi = fakeKimi(['x']);
    globalThis.fetch = route(claude, kimi);
    ev = await readAll(await post({ question: 'rest hours conductor', tier: 'slow' }));
    assert.equal(kimi.calls.length, 0);
    assert.equal(claude.calls.length, 1);
    assert.equal(claude.calls[0].body.model, 'claude-sonnet-5-5');
    // The owner (right key): straight to Opus, nothing more to escalate.
    claude = fakeClaude(); kimi = fakeKimi(['x']);
    globalThis.fetch = route(claude, kimi);
    ev = await readAll(await post({ question: 'held away from the terminal' }, { 'x-owner-key': 'owner-key-0123456789' }));
    assert.equal(kimi.calls.length, 0);
    assert.equal(claude.calls.length, 1);
    assert.equal(claude.calls[0].body.model, 'claude-opus-5-5');
    assert.equal(ev.find((e) => e.type === 'model').label, 'Claude Opus');
    assert.ok(!ev.find((e) => e.type === 'done').canEscalate);
    // Page Health: the owner picks the models; members can't see or change them.
    const models = (method, body, key = 'owner-key-0123456789') => worker.fetch(new Request('https://board.x.workers.dev/health/models', { method, body: body && JSON.stringify(body), headers: { 'x-owner-key': key } }), env);
    assert.equal((await models('GET', null, 'nope')).status, 404);
    assert.equal((await models('POST', { owner: 'claude-haiku-5-5' }, 'nope')).status, 404);
    let m = await (await models('GET')).json();
    assert.deepEqual(m.current, { owner: 'claude-opus-5-5', first: 'kimi-k2.6', deep: 'claude-sonnet-5-5' });
    assert.equal((await models('POST', { deep: 'gpt-9' })).status, 400);
    m = await (await models('POST', { owner: 'claude-sonnet-5-5', first: 'claude-haiku-5-5', deep: 'kimi-k3' })).json();
    assert.deepEqual(m.current, { owner: 'claude-sonnet-5-5', first: 'claude-haiku-5-5', deep: 'kimi-k3' });
    // The owner's question now goes to Sonnet; a member's first answer to Haiku, deeper to Kimi K3.
    claude = fakeClaude(); kimi = fakeKimi(['I could not find it.']);
    globalThis.fetch = route(claude, kimi);
    await readAll(await post({ question: 'held away from the terminal' }, { 'x-owner-key': 'owner-key-0123456789' }));
    assert.equal(claude.calls[0].body.model, 'claude-sonnet-5-5');
    claude = fakeClaude({ text: 'I could not find it in the excerpts.' }); kimi = fakeKimi(['Kimi deep.']);
    globalThis.fetch = route(claude, kimi);
    ev = await readAll(await post({ question: 'held away from the terminal' }));
    assert.equal(claude.calls[0].body.model, 'claude-haiku-5-5');
    assert.equal(kimi.calls[0].model, 'kimi-k3');
    assert.deepEqual(ev.filter((e) => e.type === 'model').map((e) => e.label), ['Claude Haiku', 'Kimi K3']);
    // Kimi K3.1 Pro (owner, 2026-11-04) is a choice too.
    m = await (await models('POST', { deep: 'kimi-k3.1-pro' })).json();
    assert.equal(m.current.deep, 'kimi-k3.1-pro');
    // Back to the usual.
    m = await (await models('POST', { owner: 'default', first: 'default', deep: 'default' })).json();
    assert.deepEqual(m.current, { owner: 'claude-opus-5-5', first: 'kimi-k2.6', deep: 'claude-sonnet-5-5' });
    // A wrong key is a member: Kimi first.
    claude = fakeClaude(); kimi = fakeKimi(['Kimi answer [1].']);
    globalThis.fetch = route(claude, kimi);
    ev = await readAll(await post({ question: 'held away from the terminal' }, { 'x-owner-key': 'owner-key-0123456788' }));
    assert.equal(claude.calls.length, 0);
    assert.ok(ev.find((e) => e.type === 'done').canEscalate);
    // Claude refuses the request outright (bad key): Kimi K2.6 answers, and the page is told why.
    claude = fakeClaude({ status: 401 }); kimi = fakeKimi(['Kimi deep answer.']);
    globalThis.fetch = route(claude, kimi);
    ev = await readAll(await post({ question: 'held away from the terminal' }, { 'x-owner-key': 'owner-key-0123456789' }));
    assert.equal(claude.calls.length, 1); // a 401 isn't retried
    assert.equal(kimi.calls[0].model, 'kimi-k2.6');
    assert.deepEqual(ev.filter((e) => e.type === 'model').map((e) => e.label), ['Claude Opus', 'Kimi K2.6']);
    const fb = ev.find((e) => e.type === 'fallback');
    assert.equal(fb.from, 'Claude Opus');
    assert.match(fb.reason, /401/);
    assert.match(answer(ev), /Kimi deep answer/);
    assert.ok(!ev.some((e) => e.type === 'error'));
  } finally { globalThis.fetch = real; }
});

test('Page Health spending: Kimi balance, Claude cost, usage history', async () => {
  const chunks = corpus();
  const worker = await loadWorker();
  const { env } = envWith(buildShards(chunks, SOURCES, { buckets: 16, perFile: 50 }));
  Object.assign(env, { ANTHROPIC_API_KEY: 'anthropic-test', OWNER_KEY: 'owner-key-0123456789' });
  const real = globalThis.fetch;
  const owner = { 'x-owner-key': 'owner-key-0123456789' };
  const post = (body, headers = {}) => worker.fetch(new Request('https://board.x.workers.dev/api/ask', { method: 'POST', body: JSON.stringify(body), headers: { 'cf-connecting-ip': `8.8.8.${Math.random()}`, ...headers } }), env, { waitUntil: () => {} });
  try {
    const claude = fakeClaude();
    const kimi = fakeKimi(['I could not find it in the excerpts.']);
    const balance = { status: 0, data: { available_balance: 12.5, voucher_balance: 2.5, cash_balance: 10 } };
    globalThis.fetch = async (url, opts) => (String(url).includes('/users/me/balance') ? new Response(JSON.stringify(balance), { status: 200 })
      : String(url).includes('anthropic') ? claude.fetchImpl(url, opts) : kimi.fetchImpl(url, opts));
    await readAll(await post({ question: 'held away from the terminal' }, owner)); // Opus
    await readAll(await post({ question: 'rest hours conductor' })); // Kimi, then Sonnet
    const spend = (headers) => worker.fetch(new Request('https://board.x.workers.dev/health/spend', { headers }), env);
    assert.equal((await spend({})).status, 404);
    const d = await (await spend(owner)).json();
    assert.deepEqual(d.kimi, { available: 12.5, voucher: 2.5, cash: 10 });
    // 10,000 in + 1,000 out: Opus $0.04 + $0.02, Sonnet $0.02 + $0.01.
    assert.equal(d.claude.month.n, 2);
    assert.ok(Math.abs(d.claude.month.cost - 0.09) < 1e-9);
    assert.ok(Math.abs(d.claude.today.cost - 0.09) < 1e-9);
    assert.equal(d.all.month.n, 3); // + the Kimi answer (no token counts: counted, not priced)
    assert.equal(d.history.length, 1);
    assert.equal(d.history[0].questions, 2);
    assert.equal(d.history[0].people, 2);
    assert.deepEqual(d.history[0].models.map((m) => `${m.label} ${m.n}`).sort(), ['Claude Opus 1', 'Claude Sonnet 1', 'Kimi K2.6 1']);
    // Moonshot down: the rest still shows.
    globalThis.fetch = async () => new Response('nope', { status: 500 });
    const e = await (await spend(owner)).json();
    assert.match(e.kimi.error, /500/);
    assert.equal(e.claude.month.n, 2);
  } finally { globalThis.fetch = real; }
});

test('Search Review: questions and answers kept 60 days, owner only', async () => {
  const chunks = corpus();
  const worker = await loadWorker();
  const { env, store } = envWith(buildShards(chunks, SOURCES, { buckets: 16, perFile: 50 }));
  Object.assign(env, { ANTHROPIC_API_KEY: 'anthropic-test', OWNER_KEY: 'owner-key-0123456789' });
  const real = globalThis.fetch;
  const owner = { 'x-owner-key': 'owner-key-0123456789' };
  const post = (body, headers = {}) => worker.fetch(new Request('https://board.x.workers.dev/api/ask', { method: 'POST', body: JSON.stringify(body), headers: { 'cf-connecting-ip': '6.6.6.6', ...headers } }), env, { waitUntil: () => {} });
  const get = (q, headers = owner) => worker.fetch(new Request(`https://board.x.workers.dev/health/questions${q}`, { headers }), env);
  try {
    globalThis.fetch = route(fakeClaude({ text: 'Sonnet says [2].' }), fakeKimi(['I could not find it in the excerpts.']));
    await readAll(await post({ question: '  rest hours conductor ' }));
    globalThis.fetch = route(fakeClaude({ text: 'Opus says [1].' }), fakeKimi(['x']));
    await readAll(await post({ question: 'held away from the terminal' }, owner));
    assert.equal((await get('', {})).status, 404);
    const list = await (await get('')).json();
    assert.equal(list.keepDays, 60);
    assert.equal(list.days.length, 1);
    assert.equal(list.days[0].n, 2);
    const day = await (await get(`?day=${list.days[0].day}`)).json();
    const [m, o] = day.entries;
    assert.equal(m.question, 'rest hours conductor');
    assert.equal(m.owner, false);
    assert.equal(m.escalated, true);
    assert.deepEqual(m.answers.map((a) => [a.label, a.model, a.text]), [['Kimi K2.6', 'kimi-k2.6', 'I could not find it in the excerpts.'], ['Claude Sonnet', 'claude-sonnet-5-5', 'Sonnet says [2].']]);
    // The documents searched (the usual set here) and the ones the passages came from.
    assert.ok(m.searched.length > 0);
    assert.equal(m.picked, false);
    assert.ok(m.used.length > 0 && m.used.every((n) => m.searched.includes(n)));
    assert.equal(o.owner, true);
    // Picked one document: recorded as picked, and only that one searched.
    globalThis.fetch = route(fakeClaude(), fakeKimi(['x']));
    await readAll(await post({ question: 'held away from the terminal', sources: ['croa'] }, owner));
    const picked = (await (await get(`?day=${list.days[0].day}`)).json()).entries[2];
    assert.equal(picked.picked, true);
    assert.equal(picked.searched.length, 1);
    assert.deepEqual(picked.used, picked.searched);
    assert.deepEqual(o.answers.map((a) => a.label), ['Claude Opus']);
    // Nothing about who asked.
    assert.ok(!JSON.stringify(day).includes('6.6.6.6'));
    assert.equal((await get('?day=../x')).status, 400);
    // The timer deletes days past 60.
    const old = new Date(Date.now() - 62 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
    store.set(`ask/log/${old}.json`, '{"entries":[]}');
    let p; await worker.scheduled({}, env, { waitUntil: (x) => { p = x; } }); await p;
    assert.ok(!store.has(`ask/log/${old}.json`));
    assert.ok(store.has(`ask/log/${list.days[0].day}.json`));
    // Never served as a file.
    assert.equal((await worker.fetch(new Request(`https://board.x.workers.dev/ask/log/${list.days[0].day}.json`), env)).status, 404);
  } finally { globalThis.fetch = real; }
});

test('ask: a 400 from Claude is asked again without fallbacks; Kimi\'s reasoning is never shown', async () => {
  const chunks = corpus();
  const worker = await loadWorker();
  const { env, store } = envWith(buildShards(chunks, SOURCES, { buckets: 16, perFile: 50 }));
  Object.assign(env, { ANTHROPIC_API_KEY: 'anthropic-test', OWNER_KEY: 'owner-key-0123456789' });
  const real = globalThis.fetch;
  const post = (body, headers = {}) => worker.fetch(new Request('https://board.x.workers.dev/api/ask', { method: 'POST', body: JSON.stringify(body), headers: { 'cf-connecting-ip': `5.5.5.${Math.random()}`, ...headers } }), env, { waitUntil: () => {} });
  const answer = (ev) => ev.filter((e) => e.type === 'chunk').map((e) => e.text).join('');
  try {
    // First call 400 (the fallbacks option refused), the second plain one answers.
    const calls = [];
    const ok = fakeClaude({ text: 'Opus answer.' });
    globalThis.fetch = async (url, opts) => {
      calls.push({ body: JSON.parse(opts.body), headers: opts.headers });
      if (calls.length === 1) return new Response('{"error":{"message":"fallbacks: unknown"}}', { status: 400 });
      return ok.fetchImpl(url, opts);
    };
    let ev = await readAll(await post({ question: 'held away from the terminal' }, { 'x-owner-key': 'owner-key-0123456789' }));
    assert.equal(calls.length, 2);
    assert.equal(calls[0].body.fallbacks, 'default');
    assert.equal(calls[1].body.fallbacks, undefined);
    assert.equal(calls[1].headers['anthropic-beta'], undefined);
    assert.equal(answer(ev), 'Opus answer.');
    assert.ok(!ev.some((e) => e.type === 'fallback'));
    // Kimi (K3.1 Pro picked for the first answer) streams reasoning apart from the answer.
    await worker.fetch(new Request('https://board.x.workers.dev/health/models', { method: 'POST', body: JSON.stringify({ first: 'kimi-k3.1-pro' }), headers: { 'x-owner-key': 'owner-key-0123456789' } }), env);
    const kcalls = [];
    globalThis.fetch = async (url, opts) => {
      kcalls.push(JSON.parse(opts.body));
      const d = (o) => `data: ${JSON.stringify({ choices: [{ delta: o }] })}\n\n`;
      return new Response(d({ reasoning_content: 'I need craft response…' }) + d({ content: 'Clean answer [1].' }) + 'data: [DONE]\n\n', { status: 200 });
    };
    ev = await readAll(await post({ question: 'held away from the terminal' }));
    assert.equal(kcalls[0].model, 'kimi-k3.1-pro');
    assert.equal(kcalls[0].thinking, undefined);
    assert.equal(answer(ev), 'Clean answer [1].');
    assert.equal(ev.find((e) => e.type === 'model').label, 'Kimi K3.1 Pro');
    // The fallback reason is kept with the question.
    globalThis.fetch = route(fakeClaude({ status: 401 }), fakeKimi(['Kimi answer.']));
    await readAll(await post({ question: 'rest hours conductor' }, { 'x-owner-key': 'owner-key-0123456789' }));
    const day = [...store.keys()].find((k) => k.startsWith('ask/log/'));
    const last = JSON.parse(store.get(day)).entries.pop();
    assert.match(last.fallbacks[0], /^Claude Opus: Claude API error 401/);
  } finally { globalThis.fetch = real; }
});
