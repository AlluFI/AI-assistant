# Phase 3 bootstrap

All Parts 1–3 live in **this repository**. The older [counting-calories](https://gitea.kood.tech/aleksirosendahl/counting-calories) repo is unchanged and not required for review.

## Provider split

| Concern | Provider | Code |
|---------|----------|------|
| Meal plans, insights, recipe RAG, nutrition tools | OpenAI | `apps/api` (existing) |
| Wingman chat + tool loop | Anthropic (Claude) or OpenAI fallback | `AnthropicWingmanService` / `OpenAiWingmanService` via `WingmanLlmFacade` |
| Meal photo → food items | Gemini vision | `apps/api/src/meal-photos` |
| Calorie numbers | Database / nutrition APIs | Never raw LLM output |

## What exists today

- **Prisma:** `AssistantThread`, `AssistantMessage`, `AssistantUserMemory`, `MealPhotoScan`, `MealIntakeLog`
- **API:** Full assistant routes (threads, messages, stream, nudges, confirm actions, memory)
- **API:** Meal photo analyze + confirm (`POST /api/meal-photos/*`)
- **Web:** `WingmanChat` FAB + chart `ui_blocks`; `MealPhotoLog` on Nutrition tab
- **Eval:** `pnpm wingman:eval` (14/14 offline routing checks)
- **Design:** [ARCHITECTURE.md](./ARCHITECTURE.md), [API_SKETCH.md](./API_SKETCH.md), [ROADMAP.md](./ROADMAP.md), [STACK.md](./STACK.md)

## Check readiness

```bash
pnpm compose:up --build
docker compose exec api sh -lc "cd /repo/apps/api && pnpm nutrition:seed && pnpm demo:seed"
pnpm phase3:bootstrap   # optional script
curl -s http://localhost:3000/api/assistant/bootstrap | jq
pnpm wingman:eval
```

## Implementation checklist

| Item | Location | Status |
|------|----------|--------|
| Parts 1–2 OpenAI features | `apps/api`, `apps/web` | Done |
| Design docs | `docs/` | Done |
| Assistant DB + bootstrap API | `apps/api/src/assistant` | Done |
| Tool wrappers (health, nutrition, charts) | `apps/api/src/assistant` | Done |
| Anthropic/OpenAI chat + tool loop | `WingmanLlmFacade`, `assistant-wingman.service` | Done |
| Thread summaries, `ui_blocks`, streaming | `assistant` + `apps/web/src/wingman` | Done |
| Chat UI panel | `apps/web/src/wingman/WingmanChat.tsx` | Done |
| Cross-session memory | `UserMemoryService`, `AssistantUserMemory` | Done |
| Gemini meal photo pipeline | `apps/api/src/meal-photos`, Nutrition tab | Done |

See [ROADMAP.md](./ROADMAP.md) and `Documentation (part 3)/IMPLEMENTATION_STATUS.md` for the full audit.

## Environment

```env
ASSISTANT_ENABLED=true
ASSISTANT_LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
ASSISTANT_STREAMING=true
ASSISTANT_SUMMARY_MODE=llm
ASSISTANT_MEMORY_ENABLED=true
GEMINI_API_KEY=              # optional — meal photos
OPENAI_API_KEY=              # Parts 1–2 + optional wingman fallback
```

See root `.env.example`.
