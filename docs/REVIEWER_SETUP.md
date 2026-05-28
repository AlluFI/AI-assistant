# Reviewer setup — full app (Parts 1–3)

This repository contains **everything** needed to run and review the project. You do not need the older `counting-calories` repository.

## Quick start (Docker)

```bash
git clone <this-repo-url>
cd ai-assistant
cp .env.example apps/api/.env
# Edit apps/api/.env: JWT secrets (32+ chars), optional OPENAI_API_KEY / ANTHROPIC_API_KEY

pnpm install
pnpm compose:up --build
```

Then seed (inside the API container):

```bash
docker compose exec api sh -lc "cd /repo/apps/api && pnpm nutrition:seed && pnpm demo:seed"
```

| URL | Purpose |
|-----|---------|
| http://localhost:8080 | Web app (nginx) |
| http://localhost:3000/docs | Swagger (all API tags including **assistant**) |
| http://localhost:8025 | Mailpit (verification emails) |

**Demo login:** `demo@numbers.local` / `DemoPassword123!`

## Quick start (local dev)

```bash
pnpm install
cp .env.example apps/api/.env
cd apps/api && pnpm exec prisma migrate deploy && cd ../..
pnpm nutrition:seed
pnpm demo:seed
pnpm dev:api    # terminal 1 — http://localhost:3000
pnpm dev:web    # terminal 2 — http://localhost:5173
```

## What to review by part

| Part | Where to look |
|------|----------------|
| 1–2 | Overview, Profile, Insights, Nutrition tabs; `REVIEW_CHECKLIST.md`, `TEST_MATRIX.md` |
| 3 bootstrap | `GET /api/assistant/bootstrap`, Swagger **assistant** tag; `docs/ARCHITECTURE.md` |
| 3 wingman | Floating chat (💬), `apps/api/src/assistant/`, Swagger **assistant** tag |

```bash
pnpm phase3:bootstrap
curl -s http://localhost:3000/api/assistant/bootstrap | jq
```

## AI keys (optional but recommended)

| Key | Used for |
|-----|----------|
| `OPENAI_API_KEY` | Meal plans, insights, recipe AI (Parts 1–2) |
| `ANTHROPIC_API_KEY` | Wingman chat (Part 3; or `OPENAI_API_KEY` with `ASSISTANT_LLM_PROVIDER=openai`) |
| `GEMINI_API_KEY` | Meal photo vision on Nutrition tab (`docs/MEAL_PHOTOS.md`) |

Wingman options: `ASSISTANT_STREAMING=true`, `ASSISTANT_SUMMARY_MODE=llm`, `VITE_ASSISTANT_STREAMING=true` (web).

Offline routing check: `pnpm wingman:eval` (see `docs/WINGMAN_EVAL.md`).

Long-term memory: `GET/DELETE /api/assistant/memory`, wingman **Memory** panel — see `docs/LONG_TERM_MEMORY.md`.

Without keys, Parts 1–2 use deterministic fallbacks where documented in `SECURITY_AND_AI_DECISIONS.md`.

## Repo layout

```
apps/api/     NestJS + Prisma (all parts)
apps/web/     React client
docs/         Phase 3 design + bootstrap notes
docker/       Compose stack
```
