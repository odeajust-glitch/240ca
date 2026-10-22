// A second pair of eyes on each board check (owner, 2026-10-16): Claude reads
// the finished report, working included, and says whether anything looks
// off. It never changes the answer; the rules in engine.js decide when you go.
//
// Settings live in .env and are read again before every review, so the key or
// model can be changed while board-auto.js is running:
//   ANTHROPIC_API_KEY   your key (no key → no review)
//   BOARD_AI_MODEL      default claude-opus-5-5
//   BOARD_AI_REVIEW     set to off to stop reviewing
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const Anthropic = require('@anthropic-ai/sdk');

const { ENV_FILES } = require('./paths');

const DEFAULT_MODEL = 'claude-opus-5-5';

const SYSTEM = `You double-check a board report for a CN conductor in Sarnia (turn SR03 on the Chain Gang list unless the report says otherwise). Software read the CATS screens and applied these rules:
- A road day runs from 0500 to 0459. Its first 3 road trains go to the A pool (SA turns), the next 2 to the B pool (SB turns), the rest to the Chain Gang (SR conductors, SD engineers). Deadheads (DH) always go to the Chain Gang. L502/L501 trains are crewed by S5 and never count.
- Trains already on duty on the Call Board count toward their road day, using the pool of the crew CATS gave them. The Call Board only lists crews still on duty: trains that already left drop off it, so fewer A or B trains may show than were really used. The software also remembers trains earlier checks saw ("Counted from earlier checks"), and a B train going out means that road day's A trains are used up. The report's notes on what a road day has used are final: never recount a road day's A/B trains from the trains you can see.
- Toronto trains: the manifest number is the letters plus the first three digits of the symbol (M39491 → M394, A42431 → A424, M39931 → M399). If the third of those digits is odd (M399, A425) the train is ordered out of Toronto and never counts toward Sarnia's A/B trains; even (M394, A424) is a Sarnia train. The software has already applied this: a train shown with a pool is a Sarnia train.
- A and B turns go first in, first out; one that can't be called (rest, hold, ** or B0) still takes its train and goes spare to the spareboard.
- Chain Gang turns go in position order. A turn whose rest ends after the call time is skipped and keeps its place; rest or a hold turn (HT) ending exactly at the call time means available (owner's rule: rest or hold until 0000, called 0000 → takes the train). ** or B0 means the turn goes out with a spareboard employee.
- Times: the time at the start of each line-up row is the train's order time. On duty is 15 minutes before it (deadheads: on duty at the order time). The call is 2 hours before on duty. So a 2122 train is on duty 2107 and called about 1907; that is consistent, not an error. Planned (PLN) times are estimates.

Only judge the trains still to come on the line-up and the WHEN YOU GO answer. Trains already on duty or gone are history: the report's own warnings about them are already shown to the conductor, so don't repeat them.

Look for things that contradict these rules or the report itself: a pool used more times than allowed in a road day, a turn given two trains, a skipped turn that should have gone, the WHEN YOU GO line disagreeing with the line-up. Don't redo the whole allocation and don't speculate about things the report can't show.

Answer in plain text, no headings. If nothing looks wrong, answer exactly: Looks right.
Otherwise give at most 3 lines, each starting with "- ", naming the train or turn and what looks wrong, in under 25 words each.`;

function settings() {
  let file = {};
  for (const f of ENV_FILES) {
    try { file = dotenv.parse(fs.readFileSync(f)); break; } catch { /* not there */ }
  }
  const get = (name) => (file[name] ?? process.env[name] ?? '').trim();
  return {
    key: get('ANTHROPIC_API_KEY'),
    model: get('BOARD_AI_MODEL') || DEFAULT_MODEL,
    off: /^(off|no|false|0)$/i.test(get('BOARD_AI_REVIEW')),
  };
}

let client = null;
let clientKey = null;

// Server-side refusal fallback, on the models that take the "default" form.
const takesFallbacks = (model) => /^claude-(opus-5-5|opus-5|fable-5-1|sonnet-5-5)$/.test(model);

// Returns { note } (one short text), { skipped } when there's no key or the
// review is off, or { error } — never throws, so a review can't stop a check.
async function reviewCheck(detailedReport) {
  const s = settings();
  if (s.off) return { skipped: 'off' };
  if (!s.key) return { skipped: 'no key' };
  if (!client || clientKey !== s.key) {
    client = new Anthropic({ apiKey: s.key, timeout: 120_000 });
    clientKey = s.key;
  }
  const params = {
    model: s.model,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: 'user', content: detailedReport }],
  };
  try {
    const response = takesFallbacks(s.model)
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);
    if (response.stop_reason === 'refusal') return { error: 'the model declined to review this check' };
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return text ? { note: text, model: response.model } : { error: 'empty answer' };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { error: 'the API key in .env was refused' };
    if (err instanceof Anthropic.NotFoundError) return { error: `model "${s.model}" not found (BOARD_AI_MODEL)` };
    if (err instanceof Anthropic.RateLimitError) return { error: 'rate limited; will try on the next check' };
    if (err instanceof Anthropic.APIError) return { error: `API error ${err.status ?? ''}: ${err.message}`.trim() };
    return { error: err.message };
  }
}

module.exports = { reviewCheck, settings, SYSTEM };
