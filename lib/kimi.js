const { SOURCE_NAMES } = require('./sources');

const KIMI_API_URL = 'https://api.moonshot.ai/v1/chat/completions';

const FAST_MODEL = process.env.KIMI_MODEL_FAST || 'kimi-k2.6';
const SLOW_MODEL = process.env.KIMI_MODEL_SLOW || 'kimi-k3';

// "Could not find it" is the exact phrase our system prompt instructs the
// model to use when the excerpts don't contain an answer — used to decide
// whether to automatically escalate to the slower, more capable model.
const NOT_FOUND_PATTERN = /could not find/i;

function temperatureFor(model) {
  // kimi-k2/k3 models only allow the default temperature (1) — omit the
  // param entirely for them rather than sending an unsupported value.
  return /^kimi-k/.test(model) ? undefined : 0.2;
}

function buildMessages({ question, contextChunks }) {
  const contextText = contextChunks
    .map((c, i) => {
      const locator = /^\d+$/.test(String(c.page)) ? `page ${c.page}` : c.page;
      return `[${i + 1}] (${SOURCE_NAMES[c.source] || c.source}, ${locator})\n${c.text}`;
    })
    .join('\n\n');

  const systemPrompt =
    'You are a search assistant for TCRC Division 240 railroad workers. ' +
    'Answer the question using ONLY the excerpts provided below, which come from ' +
    'the official Conductors and Locomotive Engineers collective agreements, and the ' +
    'Transport Canada Duty and Rest Period Rules for Railway Operating Employees, the Conductors ' +
    'Agreement addenda, the TCRC Sarnia Crew Calling Manual, and the Engineer Mileage Committee ' +
    'Operating Guidelines. ' +
    'If an excerpt comes from Agreement 4.3, note that 4.3 governs the Prairie and Mountain Regions ' +
    '(Western Canada), not Division 240, which works under Agreement 4.16. ' +
    'Always cite the source document and page number for every claim, using the ' +
    'bracketed excerpt numbers (e.g. "[2]"). ' +
    'If the excerpts do not contain the answer, say plainly that you could not find ' +
    'it in the agreement excerpts provided — do not guess, and do not use outside knowledge. ' +
    'This is not legal advice; tell the user to confirm with their Local Chairperson for anything that affects a grievance.';

  const userPrompt = `Excerpts:\n\n${contextText}\n\nQuestion: ${question}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

// Streaming: calls onToken(text) for each delta as it arrives. Returns the
// full accumulated answer text. `model` lets callers pick a specific tier.
// `signal` (optional) aborts the upstream request — passed through so the
// caller can stop billing/streaming when the client disconnects.
// Hard cap on one Kimi call, connect through end of stream — without it,
// a hung upstream pins the user's request open forever.
const KIMI_TIMEOUT_MS = 120_000;

// The Moonshot org is rate limited to a handful of requests per minute, so
// two people asking at once is enough to get a 429. Retrying is only safe
// before the first token reaches the client — once we've streamed text, a
// retry would duplicate it — and every retry here happens while the
// response status is still all we've read.
const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 8_000;

function isRetryableStatus(status) {
  // 429 is the rate limit; 5xx are upstream hiccups that usually clear.
  return status === 429 || (status >= 500 && status < 600);
}

// Moonshot's 429 body says "try again after N seconds" and it may also send
// a Retry-After header. Prefer what the server tells us, fall back to
// exponential backoff, and jitter so concurrent callers don't resynchronize.
function backoffFor(attempt, res, body) {
  const header = Number(res.headers.get('retry-after'));
  const fromBody = /try again after (\d+) seconds?/i.exec(body || '');
  const advised = Number.isFinite(header) && header > 0
    ? header * 1000
    : fromBody ? Number(fromBody[1]) * 1000 : null;

  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  const wait = advised !== null ? Math.max(advised, BASE_BACKOFF_MS) : exponential;
  return Math.min(wait, MAX_BACKOFF_MS) * (0.5 + Math.random() / 2);
}

// Sleep that gives up early if the caller aborts (client disconnected),
// so a backoff wait never outlives the request it belongs to.
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

async function streamKimi({ question, contextChunks, onToken, model = FAST_MODEL, signal }) {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error('KIMI_API_KEY is not set in .env');

  const temperature = temperatureFor(model);

  // Each attempt gets its own timeout; the one that succeeds keeps covering
  // the stream it opened, so a slow reasoning model is never cut short by
  // time an earlier attempt spent waiting.
  let timeout;
  let res;

  for (let attempt = 0; ; attempt++) {
    timeout = AbortSignal.timeout(KIMI_TIMEOUT_MS);
    const attemptSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

    try {
      res = await fetch(KIMI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: buildMessages({ question, contextChunks }),
          ...(temperature !== undefined ? { temperature } : {}),
          stream: true,
        }),
        signal: attemptSignal,
      });
    } catch (err) {
      if (timeout.aborted && !signal?.aborted) {
        throw new Error(`The answer service did not respond within ${KIMI_TIMEOUT_MS / 1000} seconds. Please try again.`);
      }
      throw err;
    }

    if (res.ok) break;

    const body = await res.text();
    if (!isRetryableStatus(res.status) || attempt === MAX_ATTEMPTS - 1) {
      throw new Error(`Kimi API error ${res.status}: ${body}`);
    }
    await sleep(backoffFor(attempt, res, body), signal);
  }

  try {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line for next chunk

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onToken(delta);
          }
        } catch {
          // ignore malformed/partial SSE lines
        }
      }
    }

    return full;
  } catch (err) {
    // A timeout abort must surface as a real error the user sees; only a
    // caller abort (client disconnect) should stay an AbortError, which
    // the route handler deliberately swallows.
    if (timeout.aborted && !signal?.aborted) {
      throw new Error(`The answer service did not respond within ${KIMI_TIMEOUT_MS / 1000} seconds. Please try again.`);
    }
    throw err;
  }
}

module.exports = { streamKimi, FAST_MODEL, SLOW_MODEL, NOT_FOUND_PATTERN };
