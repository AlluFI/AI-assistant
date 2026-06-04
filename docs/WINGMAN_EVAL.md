# Wingman eval golden set

Offline routing checks (no LLM API calls) validate that common user phrases map to the expected tools or rule-based intents.

## Run

```bash
pnpm wingman:eval
```

Jest unit tests (subset):

```bash
cd apps/api && pnpm test -- wingman.eval.spec
```

## Golden cases

Defined in `apps/api/src/assistant/eval/wingman-golden-set.json` (18 cases covering health, nutrition, charts, recipe search, nutrition target updates, and confirm flows).

Heuristics live in `tool-routing.heuristic.ts` — they approximate routing for CI; live LLM tool choice may differ slightly.

## Live eval (manual)

With `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` and demo user seeded, verify in the Wingman UI:

1. Streaming tokens appear while the model responds
2. Thread summary updates after a long conversation (12+ messages)
3. Tool traces in Swagger `GET /assistant/threads/:id` show correct tool names
