# Prompt engineering — Part 3 wingman

## System prompt

Built at runtime in `apps/api/src/assistant/prompts/system-prompt.ts`:

- Role, capabilities, units (kg, cm, kcal, g)
- Tool-use rules (never invent metrics)
- Safety and PII boundaries
- Response mode: `ASSISTANT_RESPONSE_MODE=concise|detailed`
- Embedded few-shot snippet → full examples in [PROMPT_EXAMPLES.md](./PROMPT_EXAMPLES.md)

## Models

| Env | Purpose |
|-----|---------|
| `ASSISTANT_LLM_PROVIDER=anthropic` | Prefer Claude (`ANTHROPIC_API_KEY`) |
| `ASSISTANT_LLM_PROVIDER=openai` | Use OpenAI tool loop |
| (fallback) | If Anthropic unset, uses `OPENAI_API_KEY` |

| Parameter | Typical value | Rationale |
|-----------|---------------|-----------|
| temperature | 0.4 | Factual coaching; less creative drift |
| top_p | 0.95 | Slight diversity in phrasing |

## Tools (function calling)

Definitions: `apps/api/src/assistant/assistant-tool-definitions.ts`  
Execution: `apps/api/src/assistant/assistant-tools.service.ts`

| Tool | Use when |
|------|----------|
| `get_health_metrics` | BMI, weight, wellness, activity |
| `get_progress_summary` | Goals, weight trend, wellness components |
| `get_meal_plan` | Meals for a date |
| `get_recipe` | Ingredients + steps |
| `get_nutrition_summary` | Day/week intake vs targets |
| `get_chart_data` | Series for trends / macros |
| `search_recipes` | Catalog search + RAG |
| `get_daily_check_in` | Sleep, water, mood, steps (day or week) |
| `update_health_profile` | Profile fields during setup or chat |
| `update_nutrition_targets` | Calorie/macro targets (AI, formula, manual) |
| `update_nutrition_preferences` | Meals/snacks per day, `preferred_meal_times` (incl. `snack_2`) |

**Count:** 11 tools in `assistant-tool-definitions.ts`. User-facing logging for habits is `PUT /daily-check-in` on Overview (not a wingman tool).

## Token windowing

History sent to the LLM is trimmed by **estimated token budget** (not a fixed turn count):

| Env | Default | Purpose |
|-----|---------|---------|
| `ASSISTANT_CONTEXT_TOKEN_BUDGET` | 12000 | Budget for system prompt + history |
| `ASSISTANT_CONTEXT_REPLY_RESERVE` | 2500 | Reserved for assistant reply + tool rounds |
| `ASSISTANT_CHARS_PER_TOKEN` | 4 | Rough chars-per-token estimate |
| `ASSISTANT_CONTEXT_MIN_TURNS` | 4 | Minimum recent turns to keep when possible |
| `ASSISTANT_CONTEXT_MAX_MESSAGES` | 120 | Max DB messages considered before trimming |

Implementation: `apps/api/src/assistant/wingman-context.util.ts`. Thread summary (`ThreadSummaryService`) compresses older turns when a thread grows (from 8+ messages). Long-term memory: `docs/LONG_TERM_MEMORY.md`.


## Confirmed actions (not silent tools)

Writes use rule parsing and/or scripted CTAs + UI confirm before the database changes:

| Action | Purpose |
|--------|---------|
| `confirm_log_activity` | Activity session |
| `confirm_log_weight` | Weigh-in |
| `confirm_regenerate_meal` | Replace one planned meal |
| `confirm_generate_shopping_list` | Shopping list from plan |
| `confirm_mark_meal_eaten` | Mark plan slot eaten |
| `confirm_generate_meal_plan` | New meal plan |
| `confirm_onboarding_skip` | Dismiss setup wizard |
| `confirm_onboarding_ai_targets` | AI nutrition targets in onboarding |
| `confirm_onboarding_formula_targets` | Formula targets in onboarding |
| `confirm_onboarding_meal_defaults` | Meal/snack defaults in onboarding |

See [WINGMAN_ONBOARDING.md](./WINGMAN_ONBOARDING.md) for onboarding confirms.

## Review demo prompts

See [Documentation (part 3)/TEST_MATRIX_PART3.md](../Documentation%20(part%203)/TEST_MATRIX_PART3.md).
