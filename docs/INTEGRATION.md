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
| `docs/PHASE3_BOOTSTRAP.md` | Bootstrap checklist and readiness |
| `docs/REVIEWER_SETUP.md` | Clone, Docker, demo user |

## Key modules

| Feature | API | Web |
|---------|-----|-----|
| Wingman chat + tools | `apps/api/src/assistant/` | `apps/web/src/wingman/` |
| Meal photo vision | `apps/api/src/meal-photos/` | `apps/web/src/nutrition/MealPhotoLog.tsx` |
| Nutrition + meal plans | `apps/api/src/meal-plans/`, `nutrition/` | `apps/web/src/nutrition/` |

## Relation to counting-calories

[counting-calories](https://gitea.kood.tech/aleksirosendahl/counting-calories) was the Part 1–2 development repo. Its contents were copied here; **new work happens only in this repository.**

**Sync (2026-05-30):** Parts 1–2 changes through `6290fe5` (enhanced nutrition, recipe community feedback, meal-plan refactor, auth UI module, tests) were merged into this repo while preserving Part 3 wingman, meal photos, and cross-session memory.
