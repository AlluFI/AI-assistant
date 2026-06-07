# Part 3 review demo checklist

Short live-demo script for reviewers. Pair with [TEST_MATRIX_PART3.md](./TEST_MATRIX_PART3.md) and [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

## Before demo (5 min)

1. `pnpm compose:up --build` (or local dev + migrate)
2. Seed: `docker compose exec api sh -lc "cd /repo/apps/api && pnpm nutrition:seed && pnpm demo:seed"`
3. Set keys in **repo root** `.env` (Compose reads this file):
   - `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY` + `ASSISTANT_LLM_PROVIDER=openai`)
   - Optional: `GEMINI_API_KEY` for meal photos
4. Rebuild/restart API after env changes: `docker compose up -d --build api`
5. Open http://localhost:8080 and http://localhost:3000/docs → tags **assistant**, **meal-photos**
6. Optional offline: `pnpm wingman:eval` (18/18 routing checks)

## Demo script (~20 min)

| # | Show | Talk track |
|---|------|------------|
| 1 | Full app tabs (Overview, Nutrition, Weight & activity) | Parts 1–2 foundation in same repo |
| 1b | Overview → Daily check-in (optional steps) | Steps on Today; **Check-in (7d)** on wellness gauge when habits logged |
| 2 | Wingman FAB + nudges | Reminders + chat entry point; **History** for past threads; new users see setup wizard (`docs/WINGMAN_ONBOARDING.md`) |
| 3 | `What's my current BMI?` | `get_health_metrics` — real profile data |
| 4 | `What's on my meal plan today?` | `get_meal_plan` — matches Nutrition tab |
| 5 | `Show my weight trend for the last month` | Chart `ui_block` (line) from `get_chart_data` |
| 6 | Follow-up: `Can you tell me more about that?` | Token-trimmed thread history + summary |
| 7 | `record 1 hour tennis for today` → Confirm | Writes require explicit approval |
| 8 | Weight & activity tab — activity appeared | Data layer = real profile API |
| 9 | Chest pain prompt | Medical boundary (urgent care, no diagnosis) |
| 10 | `What is my email?` | PII boundary |
| 11 | Memory panel (optional) | Cross-session facts (not thread History) — `docs/LONG_TERM_MEMORY.md` |
| 12 | Nutrition → **Log meal from photo** (if Gemini key) | Vision → DB macros → confirm intake |
| 13 | `GET /assistant/bootstrap` (optional) | Provider + assistant DB readiness JSON |
| 14 | `docs/PROMPT_ENGINEERING.md` + IMPLEMENTATION_STATUS | Prompt, tools, honest gaps |

## Questions reviewers may ask

- Why Anthropic for wingman and OpenAI for meal plans?
- How do you prevent hallucinated calories? (tools + meal-photo DB path)
- Where is the system prompt? (`apps/api/src/assistant/prompts/system-prompt.ts`)
- How is conversation history stored? (Prisma threads + token budget + optional LLM summary from 8+ messages)
- What happens when the LLM API is down? (disabled message / provider unset)

Prepare answers from `docs/ARCHITECTURE.md`, `docs/WINGMAN_ONBOARDING.md`, `docs/DAILY_WELLNESS.md`, `docs/STACK.md`, and `Documentation (part 1 & 2)/SECURITY_AND_AI_DECISIONS.md`.
