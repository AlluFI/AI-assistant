# Roadmap — Phase 3

## Phase 0 — Sketch (this repo)

- [x] Architecture, stack, API sketch
- [x] Course requirements + testing criteria → `Documentation (part 3)/`
- [x] Module in monorepo (`apps/api/src/assistant`) — single `ai-assistant` submission repo

## Phase 1 — Read-only wingman (MVP)

- [x] Prisma: `AssistantThread`, `AssistantMessage`
- [x] `POST .../messages` with tools: health, progress, meal plan, recipe, nutrition, charts
- [x] Token-aware history in LLM context (`wingman-context.util.ts`); rolling thread summary from **8+** messages
- [x] Chat UI with text + charts + CTAs
- [x] Tool traces stored on messages

## Phase 2 — Charts & memory

- [x] `ui_blocks` chart rendering in web (line, bar, pie)
- [x] Rolling thread summaries (rule + LLM)
- [x] Suggested starter prompts
- [x] Link to Weight & activity / Nutrition / Insights via CTAs

## Phase 3 — Coaching & actions

- [x] Mode prompts: nutrition vs wellness vs balanced (per-thread `coachingMode`)
- [x] Recipe search tool from chat (`search_recipes`)
- [x] Confirmed actions: regenerate planned meal, create shopping list
- [x] Proactive nudge: weekly check-in when profile is stale

## Phase 4 — Polish

- [x] Streaming responses (SSE `POST .../messages/stream`)
- [x] LLM-based thread summarization (`ASSISTANT_SUMMARY_MODE=llm`, fallback rule)
- [x] Eval golden set + `pnpm wingman:eval` (see `docs/WINGMAN_EVAL.md`)
- [x] Provider abstraction (`WingmanLlmFacade`)

## Phase 5 — Bonus (shipped)

- [x] Cross-session memory (`AssistantUserMemory`, `docs/LONG_TERM_MEMORY.md`)
- [x] Gemini meal photos (`apps/api/src/meal-photos`, `docs/MEAL_PHOTOS.md`)
- [x] Requirements compliance doc (`Documentation (part 3)/IMPLEMENTATION_STATUS.md`)

## Phase 6 — Daily wellness (shipped)

- [x] `GET /api/today` — Today dashboard aggregate
- [x] Daily check-in (sleep, water, mood, optional manual steps) + demo wearable import
- [x] Check-in habits → wellness score **Check-in (7d)** component (~12.5% when 7-day data exists)
- [x] Quick food log (`POST /api/food-log/quick`)
- [x] Overview UI: Today (calories + **macros today** rings), Quick food log, Daily check-in, nutrition setup banner
- [x] Adherence % and protein/logging streaks
- [x] Docs: [DAILY_WELLNESS.md](./DAILY_WELLNESS.md), TEST_MATRIX updates

## Phase 7 — Wingman onboarding & polish (shipped)

- [x] In-chat setup wizard (`GET/POST /api/assistant/onboarding`) — [WINGMAN_ONBOARDING.md](./WINGMAN_ONBOARDING.md)
- [x] `update_health_profile` tool; onboarding confirm CTAs
- [x] `get_daily_check_in` tool; check-in nudges
- [x] Meal plan `snack_2` / `preferred_meal_times`; nutrition target rationale in UI
- [x] **Weight & activity** tab label (Record renamed)

## Phase 8 — Meal plan dates & wingman polish (shipped)

- [x] Meal plan date validity (`planCoversDate`, `endDate`, `coversToday`) — expired plans excluded from Today, Generate, wingman `get_meal_plan`
- [x] `GET /api/meal-plans/history`, `POST /api/meal-plans/:id/reapply`, recipe **replace** on slot
- [x] Wingman **History** panel (thread list, switch, New chat)
- [x] Token-aware context window (`ASSISTANT_CONTEXT_*`)

## Phase 9 — Catalog recipes & meal plan UX (shipped)

- [x] Wingman **`confirm_create_recipe`** — AI draft + persist to catalog when search is empty or user asks (`RecipesService.createFromWingmanRequest`)
- [x] Weekly meal plan detail opens on **today's day** tab (not always Day 1)
- [x] Today card: removed redundant **Nutrition** header button (main nav only)

## Open questions

1. ~~Separate deployable vs monorepo~~ → **monorepo** for review
2. ~~Is streaming required for review demo?~~ → implemented (can disable via env)
3. ~~Cross-session memory~~ → **global `AssistantUserMemory`**
4. ~~Meal photo vision~~ → **Gemini + confirmed DB nutrition**
5. Estonian / Finnish language support?

## Success metrics

- ≥95% tool calls return valid args on golden set — **18/18 offline** (`pnpm wingman:eval`)
- Zero hallucinated calorie numbers in eval (spot-check + meal-photo DB path)
- p95 response &lt; 8s without streaming (tools + one LLM round) — verify in demo environment
