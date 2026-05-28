# Phase 3 bootstrap

All Parts 1–3 live in **this repository**. The older [counting-calories](https://gitea.kood.tech/aleksirosendahl/counting-calories) repo is unchanged and not required for review.

## Provider split

| Concern | Provider | Code |
|---------|----------|------|
| Meal plans, insights, recipe RAG, nutrition tools | OpenAI | `apps/api` (existing) |
| Wingman chat + tool loop | Anthropic (Claude) | `apps/api/src/assistant` |
| Meal photo → food items | Gemini vision | `apps/api/src/meal-photos` |
| Calorie numbers | Database / nutrition APIs | Never raw LLM output |

## What exists today

- **Prisma:** `AssistantThread`, `AssistantMessage` (migration `20260528210000_assistant_bootstrap`)
- **API:** `GET /api/assistant/bootstrap` — public readiness report
- **API:** Thread CRUD (JWT); `POST .../messages` persists user text when `ASSISTANT_ENABLED=true`; wingman reply still **503**
- **AI:** `LlmClient` + `AnthropicClientService` stub in `apps/api/src/ai/llm/`
- **Design:** [ARCHITECTURE.md](./ARCHITECTURE.md), [API_SKETCH.md](./API_SKETCH.md), [ROADMAP.md](./ROADMAP.md), [STACK.md](./STACK.md)

## Check readiness

```bash
pnpm phase3:bootstrap
cd apps/api && pnpm exec prisma migrate deploy
curl -s http://localhost:3000/api/assistant/bootstrap | jq
```

## Implementation checklist

| Item | Location | Status |
|------|----------|--------|
| Parts 1–2 OpenAI features | `apps/api`, `apps/web` | Done |
| Design docs | `docs/` | Done |
| Assistant DB + bootstrap API | `apps/api/src/assistant` | Stub |
| Tool wrappers (`get_trend`, etc.) | `apps/api/src/assistant` | Todo |
| Anthropic chat + tool loop | `apps/api/src/ai/llm`, `assistant` | Todo |
| Thread summaries, `ui_blocks` | `assistant` + `apps/web` | Todo |
| Chat UI panel | `apps/web` | Todo |
| Gemini meal photo pipeline | `apps/api`, Nutrition tab | Done |

## Environment

```env
ASSISTANT_ENABLED=false
ASSISTANT_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
```

See root `.env.example`.
