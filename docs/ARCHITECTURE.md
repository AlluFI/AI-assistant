# Architecture — AI Wingman

## High-level flow

```mermaid
sequenceDiagram
  participant User
  participant Web as Web UI
  participant API as Assistant API
  participant Router as Intent + policy
  participant Tools as Tool executor
  participant DB as Postgres
  participant LLM as LLM provider
  participant RAG as Recipe / user RAG

  User->>Web: message + threadId
  Web->>API: POST /assistant/threads/:id/messages
  API->>Router: classify intent (rules / small model)
  API->>DB: load thread, summary, profile snapshot
  API->>Tools: optional parallel tool calls
  Tools->>DB: analytics, meal plan, logs
  Tools->>RAG: search recipes / history (v2)
  Tools-->>API: structured facts + chart series
  API->>LLM: system + summary + tools results + last N turns
  LLM-->>API: reply + optional tool_calls loop
  API->>DB: persist messages + tool traces
  API-->>Web: message + ui_blocks (charts, CTAs)
```

## Layers (not three separate LLMs)

| Layer | Responsibility | Technology |
|-------|----------------|------------|
| **Facts** | Calories, deficits, trends, plan state | Existing Nest services + SQL |
| **Retrieval** | Recipes, (later) past insights / meals | Embeddings + filters (existing RAG) |
| **Reasoning** | Coaching tone, synthesis, follow-ups | One primary chat model |
| **Orchestration** | Tool loop, policy, memory | Assistant module in API |
| **Presentation** | Chat UI, embedded charts | React; chart specs from API |

### Optional “analyst”

Use **code + SQL** first. Add a **cheap classifier** (rules or mini model) only for intent: `progress_question` | `nutrition_coach` | `wellness_coach` | `action` | `off_topic`.

## Memory model

| Type | Storage | Used for |
|------|---------|----------|
| Working | Last 10 messages in prompt | Exact follow-ups |
| Thread summary | `AssistantThread.summary` (LLM or rule, 12+ messages) | Long conversations |
| Authoritative facts | Profile snapshot injected each turn | Goals, restrictions, targets |
| Cross-session | `AssistantUserMemory` (narrative + facts JSON) | Preferences across threads — see [LONG_TERM_MEMORY.md](./LONG_TERM_MEMORY.md) |

**Rule:** Summaries and memory are narrative only; metrics must be re-fetched via tools each turn if needed.

## Tool catalog (shipped)

| Tool | Source | Example question |
|------|--------|------------------|
| `get_health_metrics` | profile + analytics | “What’s my BMI?” |
| `get_progress_summary` | analytics | “How close to my goal?” |
| `get_meal_plan` | meal-plans | “What’s for dinner today?” |
| `get_recipe` | recipes | “How do I prepare tonight’s meal?” |
| `get_nutrition_summary` | nutrition-analytics | “Calories today vs target?” |
| `search_recipes` | recipes + RAG | “High protein lunch ideas” |
| `get_chart_data` | analytics | “Show my weight trend” → `ui_blocks` chart |
| `update_nutrition_targets` | nutrition | Set calorie/macro targets (AI, formula, or manual) |

**Daily wellness (Overview):** `GET /today`, habits check-in, quick food log — see [DAILY_WELLNESS.md](./DAILY_WELLNESS.md).

**Meal photos (bonus):** Gemini vision → `MealPhotoScan` → user confirm → `MealIntakeLog` → analytics ([MEAL_PHOTOS.md](./MEAL_PHOTOS.md)).

Actions that **mutate** data (regenerate plan, log meal) require **explicit user confirmation** in UI, not silent tool execution.

## Response shape

```typescript
type AssistantMessage = {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  uiBlocks?: Array<
    | { type: 'chart'; chart: 'calorie_trend' | 'macro_pie' | 'deficit_line'; params: Record<string, unknown> }
    | { type: 'cta'; label: string; action: 'open_nutrition' | 'open_insights' | 'confirm_regenerate_plan' }
  >
  toolTraces?: Array<{ name: string; args: unknown; resultSummary: string }>
}
```

## Deployment shape (this repo)

**Chosen:** assistant as a Nest module in the existing API (`apps/api/src/assistant/*`) plus a chat panel in `apps/web`. One clone for reviewers, shared auth and Prisma.

See [INTEGRATION.md](./INTEGRATION.md) and [REVIEWER_SETUP.md](./REVIEWER_SETUP.md).

## Safety

- No medical diagnosis; wellness disclaimers.
- Rate limit per user + per thread.
- Log prompts/responses without raw PII (user id only).
- Fallback when LLM down: template answers from last cached analytics.
