// Sends one question + the collective agreement to ONE provider and returns
// the answer, token usage, cost and time. The page calls this once per card
// in parallel (kimi, haiku, sonnet, opus) so each gets its own time budget.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Same instructions for every model so the comparison is fair.
const SYSTEM_PROMPT = `You are a reference assistant for union representatives and members.
You answer questions using ONLY the collective agreement text provided below.

Rules:
- Base every statement on the agreement text. Do not use outside knowledge of labour law or other agreements.
- Cite the specific article, paragraph, addendum or letter for every point (e.g. "Article 11.3", "Addendum 42").
- Where an article has exceptions, qualifications or is modified by an addendum or letter, say so.
- Quote short key phrases from the agreement where the exact wording matters.
- If the agreement does not address the question, or the answer is unclear, say that plainly. Never guess.
- Keep the answer practical: what the member is entitled to, and what to check or claim.`;

// USD per 1M tokens. Check the providers' pricing pages if these change.
// cacheWrite for Claude is the 1-hour cache (2x input), so questions asked a
// few minutes apart still read the agreement from the cache.
// Haiku 5.5 charges a higher rate when the prompt is over 100k tokens (the
// whole agreement is about 200k), so it has a "long" price too.
const CLAUDE_PRICES = {
  "claude-opus-5-5": { input: 4.0, cached: 0.2, cacheWrite: 8.0, output: 20.0 },
  "claude-sonnet-5-5": { input: 2.0, cached: 0.2, cacheWrite: 4.0, output: 10.0 },
  "claude-haiku-5-5": {
    input: 0.1, cached: 0.01, cacheWrite: 0.2, output: 0.5,
    long: { over: 100000, input: 0.5, cached: 0.05, cacheWrite: 1.0, output: 2.5 },
  },
};
const claude = (id, label, envVar, fallback) => {
  const model = Netlify.env.get(envVar) || fallback;
  return { label, model, keyVar: "ANTHROPIC_API_KEY", kind: "claude", price: CLAUDE_PRICES[model] || CLAUDE_PRICES[fallback] };
};
const getProviders = () => ({
  kimi: {
    label: "Kimi (Moonshot)",
    model: Netlify.env.get("KIMI_MODEL") || "kimi-k2.6",
    keyVar: "MOONSHOT_API_KEY",
    kind: "kimi",
    price: { input: 0.95, cached: 0.16, cacheWrite: 0.95, output: 4.0 },
  },
  haiku: claude("haiku", "Claude Haiku", "CLAUDE_HAIKU_MODEL", "claude-haiku-5-5"),
  sonnet: claude("sonnet", "Claude Sonnet", "CLAUDE_SONNET_MODEL", "claude-sonnet-5-5"),
  opus: claude("opus", "Claude Opus", "CLAUDE_OPUS_MODEL", "claude-opus-5-5"),
  openai: {
    label: "GPT (OpenAI)",
    model: Netlify.env.get("OPENAI_MODEL") || "gpt-6.1-sol",
    keyVar: "OPENAI_API_KEY",
    kind: "openai",
    price: { input: 2.0, cached: 0.1, cacheWrite: 2.0, output: 10.0 },
  },
});

// Room for the model's thinking plus the answer.
const MAX_OUTPUT_TOKENS = 8000;
// Same thinking effort for every Claude model so the test is fair; "medium"
// keeps Opus inside Netlify's 60-second limit with the whole agreement.
const CLAUDE_EFFORT = "medium";
const TIMEOUT_MS = 55000;

let agreementCache = null;
async function loadAgreement() {
  if (agreementCache) return agreementCache;
  const candidates = [
    path.join(process.cwd(), "agreement.txt"),
    path.resolve("agreement.txt"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "agreement.txt"),
  ];
  for (const p of candidates) {
    try {
      agreementCache = await readFile(p, "utf8");
      return agreementCache;
    } catch {}
  }
  return null;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function cost(price, { uncached = 0, cached = 0, cacheWrite = 0, output = 0 }) {
  if (price.long && uncached + cached + cacheWrite > price.long.over) price = price.long;
  return (
    (uncached * price.input +
      cached * price.cached +
      cacheWrite * price.cacheWrite +
      output * price.output) /
    1_000_000
  );
}

// ---- Provider calls ------------------------------------------------------

async function callOpenAICompatible(url, key, model, agreement, question, signal, extra = {}) {
  const res = await fetch(url, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      ...extra,
      messages: [
        // Agreement first and identical every time, so automatic prefix caching kicks in.
        { role: "system", content: `${SYSTEM_PROMPT}\n\n<agreement>\n${agreement}\n</agreement>` },
        { role: "user", content: question },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  const u = data.usage || {};
  const cached = u.prompt_tokens_details?.cached_tokens ?? u.cached_tokens ?? 0;
  return {
    answer: data.choices?.[0]?.message?.content ?? "(empty response)",
    usage: {
      uncached: Math.max(0, (u.prompt_tokens || 0) - cached),
      cached,
      cacheWrite: 0,
      output: u.completion_tokens || 0,
    },
  };
}

async function callClaude(key, model, agreement, question, signal) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        // Cache the agreement so repeat questions pay the cheap cache-hit rate.
        { type: "text", text: `<agreement>\n${agreement}\n</agreement>`, cache_control: { type: "ephemeral", ttl: "1h" } },
      ],
      output_config: { effort: CLAUDE_EFFORT },
      messages: [{ role: "user", content: question }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  if (data.stop_reason === "refusal") throw new Error("The model declined to answer this question.");
  const u = data.usage || {};
  return {
    answer: (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n") || "(empty response)",
    usage: {
      uncached: u.input_tokens || 0,
      cached: u.cache_read_input_tokens || 0,
      cacheWrite: u.cache_creation_input_tokens || 0,
      output: u.output_tokens || 0,
    },
  };
}

// ---- Handler -------------------------------------------------------------

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  // Simple password so strangers who find the URL can't spend your credit.
  const pw = Netlify.env.get("TEST_PASSWORD");
  if (pw && body.password !== pw) return json({ error: "Wrong password" }, 401);

  const p = getProviders()[body.provider];
  if (!p) return json({ error: "Unknown provider" }, 400);

  const question = (body.question || "").trim();
  if (!question) return json({ error: "No question" }, 400);

  const agreement = (body.agreement && body.agreement.trim()) || (await loadAgreement());
  if (!agreement) return json({ error: "No agreement text. Add agreement.txt to the project or upload one on the page." }, 400);

  const key = Netlify.env.get(p.keyVar);
  // No key yet for this provider: say so quietly instead of an error.
  if (!key) return json({ provider: body.provider, label: p.label, model: p.model, skipped: `No ${p.keyVar} set in Netlify yet.` });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    let result;
    if (p.kind === "kimi") {
      // kimi-k2.x thinks by default; the live agreement search turns that off
      // for its fast answers, and it keeps Kimi inside the 60-second limit.
      const extra = /^kimi-k/.test(p.model) ? { thinking: { type: "disabled" } } : {};
      result = await callOpenAICompatible("https://api.moonshot.ai/v1/chat/completions", key, p.model, agreement, question, controller.signal, extra);
    } else if (p.kind === "openai") {
      result = await callOpenAICompatible("https://api.openai.com/v1/chat/completions", key, p.model, agreement, question, controller.signal);
    } else {
      result = await callClaude(key, p.model, agreement, question, controller.signal);
    }
    return json({
      provider: body.provider,
      label: p.label,
      model: p.model,
      answer: result.answer,
      usage: result.usage,
      cost: cost(p.price, result.usage),
      ms: Date.now() - started,
    });
  } catch (err) {
    const msg = err.name === "AbortError" ? `Timed out after ${TIMEOUT_MS / 1000}s` : err.message;
    return json({ provider: body.provider, label: p.label, model: p.model, error: msg, ms: Date.now() - started }, 502);
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: "/api/ask", method: "POST" };
