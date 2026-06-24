const KIMI_API_URL = 'https://api.moonshot.ai/v1/chat/completions';
const KIMI_MODEL = process.env.KIMI_MODEL || 'moonshot-v1-8k';

const SOURCE_NAMES = {
  conductors: 'Conductors Agreement',
  conductors_addendum: 'Conductors Agreement Addenda',
  engineers: 'Engineers Agreement',
  rest_rules: 'Duty and Rest Period Rules (Transport Canada)',
  crew_calling: 'Crew Calling Manual (TCRC Sarnia)',
  mileage_guidelines: 'Engineer Mileage Committee Operating Guidelines',
};

function buildMessages({ question, contextChunks }) {
  const contextText = contextChunks
    .map(
      (c, i) =>
        `[${i + 1}] (${SOURCE_NAMES[c.source] || c.source}, page ${c.page})\n${c.text}`
    )
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

// Non-streaming, kept for any callers that just want the full string.
async function askKimi({ question, contextChunks }) {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error('KIMI_API_KEY is not set in .env');

  const res = await fetch(KIMI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: buildMessages({ question, contextChunks }),
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kimi API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '(no answer returned)';
}

// Streaming: calls onToken(text) for each delta as it arrives.
async function streamKimi({ question, contextChunks, onToken }) {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error('KIMI_API_KEY is not set in .env');

  const res = await fetch(KIMI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: buildMessages({ question, contextChunks }),
      temperature: 0.2,
      stream: true,
    }),
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

module.exports = { askKimi, streamKimi };
