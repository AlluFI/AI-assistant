# Repository layout — single submission monorepo

Reviewers clone **this repo only**. It contains Parts 1–2 (wellness + nutrition) and Part 3 (AI wingman) code and documentation.

## Layout

| Path | Purpose |
|------|---------|
| `apps/api/` | NestJS API — auth, profile, nutrition, meal plans, `assistant` module |
| `apps/web/` | React UI — dashboards, nutrition, (future) chat panel |
| `docs/ARCHITECTURE.md` | Wingman orchestration, memory, tools |
| `docs/API_SKETCH.md` | Assistant HTTP contract |
| `docs/STACK.md` | OpenAI / Anthropic / Gemini split |
| `docs/ROADMAP.md` | Phase 3 delivery phases |
| `docs/PHASE3_BOOTSTRAP.md` | Current bootstrap status |
| `docs/REVIEWER_SETUP.md` | Clone, Docker, demo user |

## Where to implement next

| Change | Where |
|--------|--------|
| Tool loop, Anthropic chat, Prisma assistant data | `apps/api/src/assistant/` |
| Chat UI, chart `ui_blocks` | `apps/web/` |
| Architecture / API contract updates | `docs/` first, then code |

## Relation to counting-calories

[counting-calories](https://gitea.kood.tech/aleksirosendahl/counting-calories) was the Part 1–2 development repo. Its contents were copied here; **new work happens only in this repository.**

**Sync (2026-05-30):** Parts 1–2 changes through `6290fe5` (enhanced nutrition, recipe community feedback, meal-plan refactor, auth UI module, tests) were merged into this repo while preserving Part 3 wingman, meal photos, and cross-session memory.
