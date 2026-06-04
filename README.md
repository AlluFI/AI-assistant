# Wellness App — AI Assistant (Parts 1–3)

**Reviewer submission repo:** full wellness platform (Parts 1–2) plus Part 3 AI wingman in one monorepo. Clone this repository only — no separate `counting-calories` checkout required.

| Part | Scope | Status in this repo |
|------|--------|---------------------|
| **1** | Auth, profile, analytics, insights, privacy | Implemented — `apps/api`, `apps/web` |
| **2** | Nutrition, meal plans, RAG recipes, shopping lists, enhanced analytics | Implemented |
| **3** | Conversational wingman (chat, tools, charts, memory, meal photos) | Implemented — `apps/api/src/assistant`, `apps/web/src/wingman` |

Wellness platform: accounts, health profiles, analytics, AI meal planning, recipes, shopping lists, React client, and the **Wingman** conversational assistant.

## Stack

- **API**: NestJS 11, Prisma 7, PostgreSQL, Redis (refresh sessions), Argon2, Nodemailer (Mailpit in Docker)
- **Web**: React 19, Vite 8, TypeScript
- **Monorepo**: pnpm workspaces (`apps/api`, `apps/web`)

## Prerequisites

- Node 20+
- pnpm 10+
- Docker Engine + Docker Compose (for the all-in-one stack)

## Environment

For **Docker Compose**, copy `.env.example` to the **repository root** `.env` (Compose forwards `ASSISTANT_*`, `ANTHROPIC_API_KEY`, `GEMINI_*`, and `OPENAI_API_KEY` into containers). For local API dev, you can also use `apps/api/.env`.

Required secrets:

- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` — each at least 32 characters
- `REDIS_URL` — e.g. `redis://127.0.0.1:6379`

Optional OAuth (Google / GitHub): set `OAUTH_CALLBACK_BASE` to the **browser-reachable** API auth prefix (e.g. `http://localhost:3000/api/auth`) plus provider client ID and secret.

Optional AI integration:

- **Parts 1–2:** `OPENAI_API_KEY` (and optionally `AI_MODEL`). If missing or the provider call fails, the app stores deterministic fallback insights.
- **Part 3 wingman:** `ANTHROPIC_API_KEY` (default provider) or `OPENAI_API_KEY` with `ASSISTANT_LLM_PROVIDER=openai`. Default model: `claude-sonnet-4-6` (`ASSISTANT_MODEL`).
- **Meal photos (bonus):** `GEMINI_API_KEY` on the Nutrition tab — see [docs/MEAL_PHOTOS.md](docs/MEAL_PHOTOS.md).

Optional web developer UI: set `VITE_DEV_TOOLS=true` when building or running the web app to show Quick actions, API health, manual reload buttons, and raw JSON panels (see `apps/web/.env.example`). Vite dev (`pnpm dev:web`) enables this via `apps/web/.env.development`. Docker Compose: set `VITE_DEV_TOOLS=true` in the repo root `.env` and rebuild the web image.

## Local development

1. Run Postgres, **Redis**, and Mailpit (or full Docker Compose).
2. Apply migrations: `cd apps/api && pnpm exec prisma migrate deploy`
3. API: `pnpm dev:api` — http://localhost:3000  
   - OpenAPI: http://localhost:3000/docs  
   - Health: http://localhost:3000/api/health
4. Web: `pnpm dev:web` — http://localhost:5173 (Vite proxies `/api` to the API)

Use Mailpit (e.g. http://localhost:8025) for verification and password-reset links. Email links assume routes such as `/verify-email?token=…` and `/reset-password?token=…` on `WEB_APP_URL`. OAuth redirects to `{WEB_APP_URL}/oauth/callback#access_token=…`.

## Docker (full stack)

```bash
pnpm compose:up
```

- Web (nginx + SPA): http://localhost:8080  
- API: http://localhost:3000  
- Mailpit: http://localhost:8025  
- Mailpit SMTP (host port for manual testing): `localhost:10250` → container `1025` (the API still connects to `mailpit:1025` inside Compose)
- Postgres: `localhost:15432` (`postgres` / `postgres` / `numbers`) — host port **15432** maps to container 5432 so it does not clash with local Postgres on 5432  
- Redis: `localhost:6379`

Compose sets `OAUTH_CALLBACK_BASE` to `http://localhost:3000/api/auth` so Google/GitHub can redirect back to the API; add real `GOOGLE_*` / `GITHUB_*` credentials to enable OAuth.

## Implemented features

- **Sessions**: JWT access tokens plus **rotating refresh tokens** in Redis (reuse detection revokes the session family)
- **Session hardening**: refresh token cookie support (`httpOnly`, sameSite), CSRF token endpoint/check for cookie-based refresh, OAuth state challenge stored in Redis
- **Session hardening options**: `AUTH_REFRESH_COOKIE_ONLY=true` disables refresh token body usage and enforces cookie+CSRF refresh flow
- **Auth**: register, email verify, sign-in, sign-out (single refresh), sign-out-all, refresh; password forgot/reset (email + token)
- **OAuth**: Google and GitHub (optional via env); links `/api/auth/google` and `/api/auth/github` for sign-in
- **2FA (TOTP)**: optional setup (otpauth URI + secret), confirm, disable, backup codes + regenerate; sign-in prompts MFA then `POST /api/auth/mfa/complete`
- **Profile**: `GET/PATCH /api/profile` (validated health fields), `GET/POST/PATCH/DELETE /api/profile/metrics` for weigh-ins, `GET/POST/PATCH/DELETE /api/profile/activities` for workout logs (type, date, duration)
- **Analytics**: BMI + wellness score (weighted BMI / activity / goal progress / habits; optional **Check-in (7d)** component when daily habits exist), `GET /api/analytics/summary`, `GET /api/analytics/summaries/progress`, weight and wellness series
- **AI insights**: anonymized context payload from profile + analytics, `POST /api/insights/generate`, `GET /api/insights`; versioned persisted insights with cached fallback mode on AI outages and restriction-aware recommendation filtering
- **Dashboard UI**: trend charts for weight, wellness score, and BMI; **Weight & activity** tab to log weigh-ins and activities (20+ activity types, duration); quick stats + wellness goal progress bar; weight chart goal reference line; recommendation priority badges (high/medium/low) with expandable details
- **Privacy & export**: Privacy controls are surfaced under the **Profile** area in the web app; APIs remain `GET/PATCH /api/profile/privacy`, consent logging via `GET/POST /api/profile/consents`, and user JSON export via `GET /api/profile/export` with export event logging
- **Consent gating**: health profile and metric writes require explicit `data_collection` consent
- **Export audit**: `GET /api/profile/export/events` returns export history for user transparency
- **Deletion lifecycle**: `GET/POST /api/profile/deletion-request`, cancel via `POST /api/profile/deletion-request/cancel`; purge is **manual** (not cron) — `POST /api/profile/deletion-request/purge-due` with `PURGE_ADMIN_SECRET`, or **Admin** tab for emails in `PURGE_ADMIN_EMAILS` (`GET/POST /api/admin/*`)
- **Admin tab** (visible when `RECIPE_MODERATOR_EMAILS` and/or `PURGE_ADMIN_EMAILS` includes the signed-in user): recipe review queue, pending deletion list, purge-due action
- **Ops**: Swagger, throttling, global validation, Docker entrypoint migrations
- **Nutrition (Project 2)**: `GET/PATCH /api/nutrition/profile`, suggested calorie/macro targets from BMI + activity, 16 dietary preferences / 12 restrictions catalog
- **Recipes & RAG**: `GET /api/recipes` (search + vector similarity + allergy/calorie/macro filters), `GET /api/recipes/:id`, `POST /api/recipes/scale`, `POST /api/recipes/:id/substitute-ingredient`; seed ≥500 ingredients + ≥500 recipes via `pnpm nutrition:seed`
- **Nutrition tools**: `POST /api/nutrition-tools/calculate` and `scale-recipe` are explicit function-call execution paths (with trace metadata)
- **Meal plans**: `POST /api/meal-plans/generate` (3-step sequential prompting + RAG retrieval/augmentation/grounded selection), swap meals, drag-reorder (`POST .../reorder`), per-meal regenerate (`POST .../meals/:id/regenerate`), manual meal add (`POST .../versions/:versionId/meals`), `POST .../confirm-recipes` (AI drafts persisted to DB), version restore
- **Shopping lists**: after recipes are confirmed, generate from full version (`POST /api/shopping-lists/from-version/:versionId`) or single meal (`POST /api/shopping-lists/from-meal/:versionId/:mealId`) with 8 food categories; lists use real recipe ingredients only; adjust quantities / exclude items
- **Nutrition analytics**: `GET /api/nutrition-analytics/daily`, `trend`, `weekly`, and AI summaries/suggestions via `GET /api/nutrition-analytics/insights`; meal-photo intake included in daily totals
- **Enhanced nutrition**: micronutrient tracking panels, macro targets DTO, community recipe ratings (`recipe-feedback` module)
- **Automation**: scheduled insight generation and weight/activity reminders (email or in-app) driven by privacy settings; hourly cron in API
- **Daily wellness**: `GET /api/today` (calories left, protein ring, next meal, reminders, adherence, streaks); `PUT /api/daily-check-in` (sleep, water, mood, optional steps); `POST /api/daily-check-in/wearable-demo` (demo steps/sleep import); `POST /api/food-log/quick` (recipe or ingredient log → `MealIntakeLog`) — see [docs/DAILY_WELLNESS.md](docs/DAILY_WELLNESS.md)
- **Web**: **Overview → Today** dashboard with quick food log, daily check-in (optional steps on main form), and collapsible wearable demo import; **Nutrition setup banner** when no calorie target; **Nutrition** tab — charts, AI nutrition analysis card (target rationale), meal plan detail with per-meal macro pies, drag-to-reorder, manual meal add, **Confirm recipes**, **Create shopping list** / **Create list for meal**, **View recipe** modal with servings scale; **Search recipes** popup; **View shopping lists** with quantity editing and PDF download; **Log meal from photo** (Gemini); caloric trend on Overview → Progress
- **Web profile UX**: privacy controls, reminder channel/cadence, and timezone editing under the **Profile** section; Insights tab sets automated insight cadence; fixed top toast notifications for success/error feedback
- **Part 3 — Wingman**: floating chat (`WingmanChat`), thread history, SSE streaming, coaching modes (balanced / nutrition / wellness / onboarding), **11 tools** (read: health, progress, meal plan, recipe, nutrition summary, chart, daily check-in, recipe search; write: `update_health_profile`, `update_nutrition_targets`, `update_nutrition_preferences`) + **confirmed writes** (weight/activity, regenerate meal, shopping list, mark meal eaten, generate meal plan, onboarding targets) + **setup wizard** (`GET/POST /assistant/onboarding`) — see [docs/WINGMAN_ONBOARDING.md](docs/WINGMAN_ONBOARDING.md), in-chat charts (line/bar/pie), proactive nudges, cross-session memory panel; API under `/api/assistant/*` — see [Phase 3 (AI wingman)](#phase-3-ai-wingman)

## Scripts

| Command | Description |
|--------|-------------|
| `pnpm dev:api` | Nest watch mode |
| `pnpm dev:web` | Vite dev server |
| `pnpm build` | Build all workspace packages |
| `pnpm demo:seed` | Demo account + 90-day metrics — see [Demo data](#demo-data) |
| `pnpm nutrition:seed` | 500+ ingredients and recipes — see [Demo data](#demo-data) |
| `pnpm phase3:bootstrap` | Phase 3 env + optional live bootstrap endpoint |
| `pnpm wingman:eval` | Offline wingman routing checks (18/18 expected) |
| `pnpm verify` | API build/lint/e2e + web build |
| `pnpm compose:up` | `docker compose up --build` |
| `pnpm compose:down` | Tear down stack and remove volumes |

## Demo data

Two optional seeds give you a full review experience: a **demo user** (dashboards, charts, profile) and a **nutrition catalog** (recipes, meal plans, RAG). Run both after migrations; order does not matter.

| Seed | Script (repo root) | Source | Purpose |
|------|-------------------|--------|---------|
| **Nutrition** | `pnpm nutrition:seed` | `apps/api/prisma/seed-nutrition.ts` | ≥500 ingredients + ≥500 recipes with embeddings |
| **Demo user** | `pnpm demo:seed` | `apps/api/prisma/demo-seed.sql` + `seed-demo-extras.ts` | Verified account + health profile + ~90 days of metrics + demo intake/activity/community feedback |

**Sign-in (after demo seed):** `demo@numbers.local` / `DemoPassword123!` (email already verified)  
**App:** http://localhost:8080 (Docker) or http://localhost:5173 (local Vite dev)

### Docker Compose (recommended)

Run from the **repository root**. Migrations apply automatically when the `api` container starts (`prisma migrate deploy` in the image entrypoint).

1. Start the stack (first time or after schema/seed script changes):

```bash
pnpm compose:up --build
```

2. Seed **inside the `api` container** (uses the same `DATABASE_URL` as the running API — no host port confusion):

```bash
docker compose exec api sh -lc "cd /repo/apps/api && pnpm nutrition:seed"
docker compose exec api sh -lc "cd /repo/apps/api && pnpm demo:seed"
```

Or both in one exec:

```bash
docker compose exec api sh -lc "cd /repo/apps/api && pnpm nutrition:seed && pnpm demo:seed"
```

**Where:** commands run in container path `/repo/apps/api` (matches the API image layout). Root `pnpm nutrition:seed` / `pnpm demo:seed` are equivalent but require `DATABASE_URL` on your host (see below).

After seeding, open the web app → sign in as the demo user → **Overview** (90-day range) and **Nutrition** (meal plans, recipes).

### Local API + Postgres on the host

Run from the **repository root** after `cd apps/api && pnpm exec prisma migrate deploy` and with `DATABASE_URL` in `apps/api/.env` (or exported in the shell).

**Postgres via Docker only** (API on host, DB in Compose): use host port **15432**, not `5432` — macOS often has another Postgres on 5432.

```bash
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:15432/numbers?schema=public"
pnpm nutrition:seed
pnpm demo:seed
```

**Postgres and API both on host** (typical local dev):

```bash
# DATABASE_URL in apps/api/.env, e.g. postgresql://postgres:postgres@127.0.0.1:5432/numbers?schema=public
pnpm nutrition:seed
pnpm demo:seed
```

If nutrition seed fails with `P1010` / *User was denied access*, the shell is hitting the wrong Postgres — use `127.0.0.1:15432` for Compose, or run the Docker exec commands above.

### What each seed creates

**Nutrition (`nutrition:seed`)**

- ≥500 `Ingredient` rows and ≥500 `Recipe` rows (shared across all users)
- Safe to re-run: skips existing rows and resumes partial recipe seeding

**Demo user (`demo:seed`)**

- Verified user, privacy defaults, and analytics consents
- Full health profile (demographics, lifestyle, diet, fitness goals, fitness assessment)
- **~90 days** of **weekly** metric snapshots: weight, BMI, wellness score, and weekly activity days
- A `profile_baseline` snapshot so “starting weight” charts work without re-saving the profile

**Re-running demo seed:** safe; replaces only `seed` and `profile_baseline` snapshots for the demo user. Other accounts are untouched.

### Troubleshooting

**Nutrition seed failed partway (recipes):** re-run the same command (it resumes). To reset recipes only:

```bash
docker compose exec postgres psql -U postgres -d numbers -c 'DELETE FROM "RecipeIngredient"; DELETE FROM "Recipe";'
```

**Updated `seed-nutrition.ts`:** rebuild the API image before seeding in Docker: `pnpm compose:up --build`, then run `nutrition:seed` in the container again.

## Phase 3 (AI wingman)

Parts 1–2 use **OpenAI** (`OPENAI_API_KEY`). Part 3 wingman uses **Anthropic** by default (`ANTHROPIC_API_KEY`, model `claude-sonnet-4-6`); OpenAI is a fallback via `ASSISTANT_LLM_PROVIDER=openai`. Meal photos use **Gemini** vision on the Nutrition tab — see [docs/MEAL_PHOTOS.md](docs/MEAL_PHOTOS.md) and [docs/STACK.md](docs/STACK.md).

**Quick start (Docker):**

1. Copy `.env.example` → **repo root** `.env` — set `ANTHROPIC_API_KEY`, `ASSISTANT_*`, optional `GEMINI_API_KEY`.
2. `pnpm compose:up --build`
3. Seed: `docker compose exec api sh -lc "cd /repo/apps/api && pnpm nutrition:seed && pnpm demo:seed"`
4. Open http://localhost:8080 → sign in → **Wingman** FAB (bottom-right).
5. Readiness: `curl -s http://localhost:3000/api/assistant/bootstrap | jq` · offline checks: `pnpm wingman:eval`

**Design docs:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/PROMPT_ENGINEERING.md](docs/PROMPT_ENGINEERING.md), [docs/PROMPT_EXAMPLES.md](docs/PROMPT_EXAMPLES.md), [docs/WINGMAN_ONBOARDING.md](docs/WINGMAN_ONBOARDING.md), [docs/DAILY_WELLNESS.md](docs/DAILY_WELLNESS.md), [docs/ADMIN.md](docs/ADMIN.md), [docs/LONG_TERM_MEMORY.md](docs/LONG_TERM_MEMORY.md), [docs/WINGMAN_EVAL.md](docs/WINGMAN_EVAL.md)

**Reviewer quick start:** [docs/REVIEWER_SETUP.md](docs/REVIEWER_SETUP.md) · live demo script: [Documentation (part 3)/REVIEW_CHECKLIST_PART3.md](Documentation%20(part%203)/REVIEW_CHECKLIST_PART3.md)

## Review helper docs

### Part 3 — AI assistant (this project)

- [Documentation (part 3)/PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md](Documentation%20(part%203)/PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md) — full requirements + mandatory/extra tests
- [Documentation (part 3)/REQUIREMENTS_QUICKCHECK.md](Documentation%20(part%203)/REQUIREMENTS_QUICKCHECK.md) — pass/fail checklist for reviewers
- [Documentation (part 3)/IMPLEMENTATION_STATUS.md](Documentation%20(part%203)/IMPLEMENTATION_STATUS.md) — feature inventory vs requirements
- [Documentation (part 3)/TEST_MATRIX_PART3.md](Documentation%20(part%203)/TEST_MATRIX_PART3.md) — wingman API + UI test steps
- [Documentation (part 3)/REVIEW_CHECKLIST_PART3.md](Documentation%20(part%203)/REVIEW_CHECKLIST_PART3.md) — live demo script

### Parts 1–2 (in same repo)

- [Documentation (part 1 & 2)/REVIEW_CHECKLIST.md](Documentation%20(part%201%20&%202)/REVIEW_CHECKLIST.md) — wellness + nutrition demo
- [Documentation (part 1 & 2)/TEST_MATRIX.md](Documentation%20(part%201%20&%202)/TEST_MATRIX.md) — API matrix
- [Documentation (part 1 & 2)/PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md](Documentation%20(part%201%20&%202)/PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md) — Part 2 requirements

### Shared

- `docs/REVIEWER_SETUP.md` — clone, env, Docker, demo user
- `docs/PHASE3_BOOTSTRAP.md` — technical bootstrap notes
- `docs/ARCHITECTURE.md`, `docs/STACK.md`, `docs/ROADMAP.md` — design
- `SECURITY_AND_AI_DECISIONS.md` — AI/security talking points
- `Documentation (part 1 & 2)/OPERATIONS_SECURITY.md` — ops verification

## Part 3 compliance

Before review, walk through [Documentation (part 3)/REQUIREMENTS_QUICKCHECK.md](Documentation%20(part%203)/REQUIREMENTS_QUICKCHECK.md) and [Documentation (part 3)/IMPLEMENTATION_STATUS.md](Documentation%20(part%203)/IMPLEMENTATION_STATUS.md). For a Part 2–style mandatory criteria map, copy and maintain local `Documentation (part 3)/COMPLIANCE_REPORT.md` (gitignored). Offline: `pnpm wingman:eval` (18 routing checks).

## Next steps (roadmap)

See [docs/ROADMAP.md](docs/ROADMAP.md). Phase 3 core delivery is complete; remaining items are optional hardening and localization.

- Optional production hardening: enforce cookie-only refresh mode and stricter origin policy
- Add automated scheduled purge job (cron/worker) instead of manual purge endpoint
