const { SOURCE_NAMES } = require('./sources');

const KIMI_API_URL = 'https://api.moonshot.ai/v1/chat/completions';

const FAST_MODEL = process.env.KIMI_MODEL_FAST || 'moonshot-v1-8k';
const SLOW_MODEL = process.env.KIMI_MODEL_SLOW || 'kimi-k2.6';

// "Could not find it" is the exact phrase our system prompt instructs the
// model to use when the excerpts don't contain an answer — used to decide
// whether to automatically escalate to the slower, more capable model.
const NOT_FOUND_PATTERN = /could not find/i;

function temperatureFor(model) {
  // kimi-k2.* models only allow the default temperature (1) — omit the
  // param entirely for them rather than sending an unsupported value.
  return /^kimi-k2/.test(model) ? undefined : 0.2;
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
async function streamKimi({ question, contextChunks, onToken, model = FAST_MODEL, signal }) {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error('KIMI_API_KEY is not set in .env');

  const temperature = temperatureFor(model);

  const res = await fetch(KIMI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: buildMessages({ question, contextChunks }),
      ...(temperature !== undefined ? { temperature } : {}),
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kimi API error ${res.status}: ${body}`);
  }

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
}

module.exports = { streamKimi, FAST_MODEL, SLOW_MODEL, NOT_FOUND_PATTERN };
