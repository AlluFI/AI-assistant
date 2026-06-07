# Part 3 — Implementation status vs requirements

**Audit date:** 2026-05-28 (meal plan date validity, Today macros, token-aware wingman context, History UI)  
**Criteria:** [PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md](./PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md)  
**Detailed compliance (local, gitignored):** `COMPLIANCE_REPORT.md` in this folder — same format as Part 2.  
**Offline check:** `pnpm wingman:eval` → **18/18** routing heuristics pass (does not replace live LLM demo).

Legend: ✅ Implemented · 🟡 Partial / needs live verification · ⬜ Not started

---

## Summary

| Category | Status |
|----------|--------|
| Mandatory — conversation layer | ✅ |
| Mandatory — data access (≥4 tools, real APIs) | ✅ (11 LLM tools + confirmed writes) |
| Mandatory — system prompt & safety | ✅ |
| Mandatory — documentation | ✅ |
| Extra — Docker one-command | ✅ |
| Extra — NL charts in chat | ✅ |
| Extra — thread summarization (long threads) | ✅ (LLM + rule fallback from 8+ msgs) |
| Bonus — streaming | ✅ |
| Bonus — meal photo vision (Gemini) | ✅ |
| Bonus — eval harness | ✅ |
| Bonus — cross-session memory | ✅ |
| Open | Estonian / Finnish UI |

---

## Functional requirements

### Conversational experience

| Requirement | Status | Evidence |
|---------------|--------|----------|
| Follow-up questions | ✅ | Token-trimmed history + thread summary in prompt; manual demo |
| Context from earlier in thread | ✅ | `AssistantMessage` persistence; `GET .../threads/:id` |
| Digestible formatting | ✅ | System prompt: bullets, bold metrics, modes |

### Integration — health profile

| Requirement | Status | Evidence |
|---------------|--------|----------|
| BMI, weight, wellness, activity | ✅ | `get_health_metrics` → profile + analytics |
| Goals and preferences | ✅ | `get_progress_summary`, profile snapshot in prompt |
| Progress / activity history | ✅ | `get_progress_summary`, `get_chart_data` |
| Sleep / hydration / mood habits | ✅ | `get_daily_check_in`; Overview `PUT /daily-check-in` |
| Personalized insights (multi-data) | 🟡 | LLM synthesis over tools; verify in demo |

### Integration — nutrition

| Requirement | Status | Evidence |
|---------------|--------|----------|
| Meal plans | ✅ | `get_meal_plan` |
| Recipes + steps | ✅ | `get_recipe`, `search_recipes` |
| Intake vs targets | ✅ | `get_nutrition_summary` (+ photo intake in analytics) |
| Dietary restrictions | 🟡 | Profile in prompt; verify wording in demo |

### Data visualization

| Requirement | Status | Evidence |
|---------------|--------|----------|
| Describe trends | ✅ | `get_chart_data` + NL in reply |
| Insights vs targets / history | ✅ | Tool JSON + coaching |
| Charts in UI | ✅ | `ui_blocks` + `WingmanChart.tsx` |

### Six conversation types + few-shots

| Type | Status | Few-shots |
|------|--------|-----------|
| Health metrics | ✅ | `docs/PROMPT_EXAMPLES.md` §1 |
| Progress | ✅ | §2 |
| Meal plan | ✅ | §3 |
| Recipe | ✅ | §4 |
| Nutritional analysis | ✅ | §5 |
| General wellness | ✅ | §6 + safety |

### Multi-turn & response requirements

| Requirement | Status | Evidence |
|---------------|--------|----------|
| Follow-ups / reference resolution | 🟡 | Prompt + history; verify pronouns in demo |
| Personalization (name, goals) | ✅ | Display name + tools + `AssistantUserMemory` |
| Scannable structure | ✅ | System prompt formatting rules |
| Medical boundaries | ✅ | Prompt + `MEDICAL_URGENT` rule + few-shot |
| PII boundaries | ✅ | Prompt + keyword refusal for email/DOB/password |
| Out-of-scope redirect | ✅ | System prompt § Out of scope |

---

## Architecture (two layers)

| Layer | Status | Location |
|-------|--------|----------|
| Chat UI, history, streaming | ✅ | `apps/web/src/wingman/` — History panel, New chat, thread switch |
| Input validation (empty, max 8k) | ✅ | `PostAssistantMessageDto` |
| Persist threads/messages | ✅ | Prisma `AssistantThread`, `AssistantMessage` |
| Context (summary, profile, memory) | ✅ | `assistant-wingman.service.ts`, `wingman-context.util.ts`, `UserMemoryService` |
| LLM + tool loop | ✅ | `WingmanLlmFacade`, `assistant-tools.service.ts` |
| JWT-scoped data access | ✅ | All tools use `userId` from JWT |
| Structured errors (missing data) | ✅ | Tools return errors; prompt forbids inventing numbers |

---

## GenAI techniques

### System prompt

| Must include | Status |
|--------------|--------|
| Purpose, tone, domain terms | ✅ |
| Ethical boundaries | ✅ |
| Formatting rules | ✅ |
| Personalization rules | ✅ |
| Examples per category | ✅ `few-shot-snippet.ts` + `docs/PROMPT_EXAMPLES.md` |
| Out-of-scope handling | ✅ |

### Function calling (minimum 4)

| Tool | Status | Backing |
|------|--------|---------|
| `get_health_metrics` | ✅ | Profile + analytics |
| `get_progress_summary` | ✅ | Analytics |
| `get_meal_plan` | ✅ | Meal plans |
| `get_recipe` | ✅ | Recipes |
| `get_nutrition_summary` | ✅ | Nutrition analytics |
| `get_chart_data` | ✅ | Analytics series |
| `search_recipes` | ✅ | Recipes + RAG |
| `get_daily_check_in` | ✅ | Daily wellness |
| `update_health_profile` | ✅ | Profile |
| `update_nutrition_targets` | ✅ | Nutrition targets |
| `update_nutrition_preferences` | ✅ | Nutrition profile prefs |

**Confirmed writes (UI only, not silent tools):** `confirm_log_activity`, `confirm_log_weight`, `confirm_regenerate_meal`, `confirm_generate_shopping_list`, `confirm_mark_meal_eaten`, `confirm_generate_meal_plan`, `confirm_onboarding_skip`, `confirm_onboarding_ai_targets`, `confirm_onboarding_formula_targets`, `confirm_onboarding_meal_defaults` — see `docs/WINGMAN_ONBOARDING.md`.

### Memory & context

| Requirement | Status | Evidence |
|---------------|--------|----------|
| ≥5 turns context | ✅ | Token budget (`ASSISTANT_CONTEXT_*`) + min 4 turns when possible |
| Key facts (goals, restrictions) | ✅ | `AssistantUserMemory` — `docs/LONG_TERM_MEMORY.md` |
| Thread summary when long | ✅ | `ThreadSummaryService` from **8+** messages (`ASSISTANT_SUMMARY_MODE=llm`) |
| Units kg, cm, kcal, g | ✅ | System prompt |
| Concise vs detailed | ✅ | `ASSISTANT_RESPONSE_MODE` |

### Model / token / errors

| Topic | Status | Doc |
|-------|--------|-----|
| Model choice rationale | ✅ | `docs/STACK.md`, `docs/PROMPT_ENGINEERING.md` |
| Temperature / top_p | ✅ | Documented (~0.4 / 0.95) |
| Token windowing | ✅ | `wingman-context.util.ts` — estimated token budget, not fixed turn count |
| LLM outage fallback | 🟡 | Rule-based paths when provider unset; limited template fallback |
| Boundaries messaging | ✅ | `GET /assistant/bootstrap` readiness + disabled message |

---

## Extra requirements

| Requirement | Status | Evidence |
|---------------|--------|----------|
| Docker one command | ✅ | `pnpm compose:up` |
| NL → line / bar / pie charts | ✅ | `get_chart_data` enums + `chart-ui-blocks.util.ts` |
| Proactive chart offer | ✅ | System prompt: "Would you like to see a chart?" |
| History compression 10+ turns | ✅ | Token trim + summary from 8+ messages |
| Dynamic context by topic | 🟡 | Coaching modes + summary; not a separate router |

---

## Bonus functionality

| Feature | Status | Evidence |
|---------|--------|----------|
| Streaming (SSE) | ✅ | `POST .../messages/stream`, `VITE_ASSISTANT_STREAMING` |
| Meal photo vision | ✅ | `apps/api/src/meal-photos/`, `docs/MEAL_PHOTOS.md` |
| Weekly proactive nudge | ✅ | `GET /assistant/nudges` |
| Eval harness | ✅ | `pnpm wingman:eval`, `docs/WINGMAN_EVAL.md` |
| Cross-session memory | ✅ | `docs/LONG_TERM_MEMORY.md` |
| Wingman onboarding wizard | ✅ | `docs/WINGMAN_ONBOARDING.md`, `GET/POST /assistant/onboarding` |
| Daily check-in → wellness | ✅ | `check-in-wellness.util.ts`, Overview gauge **Check-in (7d)** |

---

## Mandatory testing criteria (quick map)

| Criterion area | Ready for review? | Notes |
|----------------|-------------------|-------|
| README + design docs | ✅ | `README.md`, `docs/*` |
| Health + nutrition via assistant | ✅ | Needs `ANTHROPIC_API_KEY` or OpenAI wingman provider |
| Six conversation types | 🟡 | Verify live with demo user |
| Multi-turn + PII + medical | ✅ | Rules + prompt; demo chest pain / email |
| History persist close/reopen | ✅ | Thread list + History panel; reload from `GET /assistant/threads` |
| Input validation | ✅ | `@MaxLength(8000)`, `@IsNotEmpty` |
| ≥4 tools, ≥5 turns | ✅ | 11 tools; token-aware context window |
| Jailbreak resistance | 🟡 | Prompt + auth scope; demo other-user prompts |
| Student explains model choices | ✅ | Documented; prepare verbal summary |

---

## Deliverables checklist

| Deliverable | Status |
|-------------|--------|
| Source + configuration | ✅ |
| Architecture, setup, usage | ✅ `docs/ARCHITECTURE.md`, `REVIEWER_SETUP.md` |
| Prompts + model choice | ✅ `PROMPT_ENGINEERING.md`, `PROMPT_EXAMPLES.md` |
| Function calling + memory + errors | ✅ This file + linked docs |
| Demo script | ✅ `REVIEW_CHECKLIST_PART3.md` |

---

## Env for reviewers

Root `.env` (Compose) or `apps/api/.env` (local dev) — see `.env.example`.

```env
ANTHROPIC_API_KEY=          # or OPENAI + ASSISTANT_LLM_PROVIDER=openai
ASSISTANT_MODEL=claude-sonnet-4-6
ASSISTANT_ENABLED=true
ASSISTANT_STREAMING=true
ASSISTANT_SUMMARY_MODE=llm
ASSISTANT_MEMORY_ENABLED=true
# Token-aware context (see docs/PROMPT_ENGINEERING.md)
ASSISTANT_CONTEXT_TOKEN_BUDGET=12000
ASSISTANT_CONTEXT_REPLY_RESERVE=2500
GEMINI_API_KEY=             # optional — meal photos on Nutrition tab
```

Compose forwards AI keys from the repo root `.env` (see `docker-compose.yml`).

---

## Gaps / honest notes

1. **Live LLM quality** — Offline eval covers routing only; reviewers should run the demo script with keys set.
2. **Docker without keys** — Wingman returns disabled/fallback messaging; Parts 1–2 still usable.
3. **Medical guardrails** — Keyword rules + prompt; not a separate moderation API.
4. **Localization** — English only (roadmap open item).

*Update this file when behaviour changes.*
