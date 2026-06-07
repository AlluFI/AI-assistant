# Repository layout — single submission monorepo

Reviewers clone **this repo only**. It contains Parts 1–2 (wellness + nutrition) and Part 3 (AI wingman) code and documentation.

## Layout

| Path | Purpose |
|------|---------|
| `apps/api/` | NestJS API — auth, profile, nutrition, meal plans, `assistant`, `meal-photos` |
| `apps/web/` | React UI — dashboards, nutrition, wingman chat (`apps/web/src/wingman/`) |
| `docs/ARCHITECTURE.md` | Wingman orchestration, memory, tools |
| `docs/API_SKETCH.md` | Assistant HTTP contract |
| `docs/STACK.md` | OpenAI / Anthropic / Gemini split |
| `docs/ROADMAP.md` | Phase 3 delivery phases |
| `docs/REVIEWER_SETUP.md` | Clone, Docker, demo user |
| `docs/DAILY_WELLNESS.md` | Today dashboard, check-in, quick food log |
| `docs/WINGMAN_ONBOARDING.md` | Wingman in-chat setup wizard |
| `docs/ADMIN.md` | Admin tab (moderation, manual deletion purge) |

## Key modules

| Feature | API | Web |
|---------|-----|-----|
| Wingman chat + tools | `apps/api/src/assistant/` | `apps/web/src/wingman/` |
| Meal photo vision | `apps/api/src/meal-photos/` | `apps/web/src/nutrition/MealPhotoLog.tsx` |
| Nutrition + meal plans | `apps/api/src/meal-plans/`, `nutrition/` | `apps/web/src/nutrition/` |
| Daily wellness (Today) | `apps/api/src/daily-wellness/` | `apps/web/src/dashboard/TodayDashboard.tsx`, etc. |
| Meal plan dates / reapply | `apps/api/src/shared/meal-plan-date.util.ts`, `meal-plans/` | `PastMealPlansModal.tsx`, `NutritionPanel.tsx` |

## Historical note

[counting-calories](https://gitea.kood.tech/aleksirosendahl/counting-calories) was the original Part 1–2 repo. That codebase was merged into this monorepo; **review and ongoing development use this repository only** — the Part 2 repo is not maintained.
