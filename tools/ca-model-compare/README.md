# CA Model Compare

Ask one question about the collective agreement and get answers from Kimi and three Claude models (Haiku, Sonnet, Opus) side by side, with the cost and time for each. You can mark each answer as correct, partly right, wrong, or "admitted unsure", and the page keeps a running scorecard in your browser.

## 1. Get the API keys

| Provider | Where | Env variable |
|---|---|---|
| Kimi (Moonshot) | Your existing key from platform.moonshot.ai | `MOONSHOT_API_KEY` |
| Anthropic | platform.claude.com → API keys (add a few dollars of credit) | `ANTHROPIC_API_KEY` |
| OpenAI (optional, no card shown now) | platform.openai.com → API keys | `OPENAI_API_KEY` |

$10 per provider is far more than enough for testing. Set a low monthly spending limit on each account while you test.

## 2. Add the agreement

`agreement.txt` is already Agreement 4.16 plus the addendum book, made from `data/conductors.pdf` and `data/conductors_addendum.pdf` (about 880k characters, roughly 200k tokens). (You can also upload a .txt file on the page for one session.)

## 3. Deploy as a NEW Netlify site

Keep this separate from the live member site.

1. Drag this folder into Netlify (Add new site → Deploy manually), or push it to a Git repo and connect it.
2. In Site configuration → Environment variables, add:
   - `MOONSHOT_API_KEY`, `ANTHROPIC_API_KEY` (one Anthropic key serves all three Claude cards)
   - `TEST_PASSWORD`: any password; the page asks for it so strangers can't spend your credit
3. Redeploy so the variables take effect.

Make sure each variable's scope includes **Functions**.

## Optional: change the models

Defaults are `kimi-k2.6` (thinking off, as on the live search's fast answers), `claude-haiku-5-5`, `claude-sonnet-5-5` and `claude-opus-5-5` (all at the same "medium" thinking effort). To test others, add these variables and redeploy:

- `KIMI_MODEL` (e.g. `kimi-k3`)
- `CLAUDE_HAIKU_MODEL`, `CLAUDE_SONNET_MODEL`, `CLAUDE_OPUS_MODEL`

If you change models, update the prices in `netlify/functions/ask.mjs` so the cost column stays accurate.

## How the test is kept fair

- All four get the same instructions and the same full agreement text.
- The agreement is cached, so the second and later questions are much cheaper. Claude keeps it cached for an hour; the first question of each hour costs about US$2.80 across the four cards (mostly Opus and Sonnet), later ones a few cents each.
- Netlify stops a function after 60 seconds. If a model hasn't answered by then, its card shows a timeout.

## Suggested test

Write 10–15 questions you already know the answers to, including:
- a couple where an addendum or exception changes the answer,
- one the agreement doesn't cover (the right answer is "it doesn't say").

Run each one, score the answers, then use **Download results (CSV)** to keep a record.
