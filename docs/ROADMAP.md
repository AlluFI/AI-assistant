# Roadmap — Phase 3

## Phase 0 — Sketch (this repo)

- [x] Architecture, stack, API sketch
- [x] Course requirements + testing criteria → `Documentation (part 3)/`
- [x] Module in monorepo (`apps/api/src/assistant`) — single `ai-assistant` submission repo

## Phase 1 — Read-only wingman (MVP)

- [x] Prisma: `AssistantThread`, `AssistantMessage`
- [x] `POST .../messages` with tools: health, progress, meal plan, recipe, nutrition, charts
- [x] Last 10 turns in LLM context; rolling thread summary (rule-based, 12+ messages)
- [x] Chat UI with text + charts + CTAs
- [x] Tool traces stored on messages

## Phase 2 — Charts & memory

- [x] `ui_blocks` chart rendering in web (line, bar, pie)
- [x] Rolling thread summaries (rule-based)
- [x] Suggested starter prompts
- [x] Link to Record / Nutrition / Insights via CTAs

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

## Open questions

1. ~~Separate deployable vs monorepo~~ → **monorepo** for review
2. ~~Is streaming required for review demo?~~ → implemented (can disable via env)
3. ~~Cross-session memory~~ → **global `AssistantUserMemory`** (see `docs/LONG_TERM_MEMORY.md`)
4. Estonian / Finnish language support?

## Success metrics

- ≥95% tool calls return valid args on golden set (offline routing heuristics)
- Zero hallucinated calorie numbers in eval (spot-check)
- p95 response &lt; 8s without streaming (tools + one LLM round)
