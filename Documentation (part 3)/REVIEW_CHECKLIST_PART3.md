# Part 3 review demo checklist

Short live-demo script for reviewers. Pair with [TEST_MATRIX_PART3.md](./TEST_MATRIX_PART3.md).

## Before demo (5 min)

1. `pnpm compose:up --build` (or local dev + migrate)
2. Seed: nutrition + demo user
3. Optional: set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in `apps/api/.env`
4. Open http://localhost:8080 (or :5173) and http://localhost:3000/docs → tag **assistant**

## Demo script (~15 min)

| # | Show | Talk track |
|---|------|------------|
| 1 | Full app tabs (Overview, Nutrition, Record) | Parts 1–2 foundation in same repo |
| 2 | Wingman FAB + nudges | Reminders + chat entry point |
| 3 | `record 1 hour tennis for today` → Confirm | Actions require explicit approval |
| 4 | Record tab — activity appeared | Data layer = real `POST /profile/activities` |
| 5 | Ask BMI / meal plan *(when tools live)* | Function calling, no invented numbers |
| 6 | Follow-up + pronoun resolution *(when LLM live)* | Conversation memory |
| 7 | Chest pain prompt | Medical boundary |
| 8 | "What is my email?" | PII boundary |
| 9 | `GET /assistant/bootstrap` | Provider readiness |
| 10 | Architecture doc + IMPLEMENTATION_STATUS | Honest progress vs criteria |

## Questions reviewers may ask

- Why Anthropic for wingman and OpenAI for meal plans?
- How do you prevent hallucinated calories?
- Where is the system prompt?
- How is conversation history stored?
- What happens when the LLM API is down?

Prepare answers from `docs/ARCHITECTURE.md`, `docs/STACK.md`, and `SECURITY_AND_AI_DECISIONS.md`.
