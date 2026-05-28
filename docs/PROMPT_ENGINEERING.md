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

Tool traces are stored on assistant messages (`toolTraces` JSON).

## Confirmed actions (not silent tools)

Weight and activity **writes** use rule parsing + UI confirm (`confirm_log_activity`, `confirm_log_weight`), not automatic tool execution.

## Review demo prompts

See [Documentation (part 3)/TEST_MATRIX_PART3.md](../Documentation%20(part%203)/TEST_MATRIX_PART3.md).
