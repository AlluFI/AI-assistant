# AI Assistant (Part 3) — Requirements & Testing Criteria

Reference document for reviewers and self-checks. Mirrors the structure of [Part 1 & 2 requirements](../Documentation%20(part%201%20&%202)/PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md).

**Related docs:** [TEST_MATRIX_PART3.md](./TEST_MATRIX_PART3.md) · [REQUIREMENTS_QUICKCHECK.md](./REQUIREMENTS_QUICKCHECK.md) · [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) · local `COMPLIANCE_REPORT.md` (gitignored; Part 2–style audit)

---

## The Situation 👀

Your wellness platform has evolved into a comprehensive health ecosystem, featuring health analytics and nutrition planning. Now it's time to make these valuable features more accessible through a **conversational AI assistant**.

In this project, you design and implement an AI assistant that helps users interact with the platform using natural language. The assistant enables users to access health metrics, nutrition information, and personalized wellness guidance through conversations that feel intuitive and helpful.

---

## Functional Requirements 📋

### Conversational experience

Users should be able to ask questions about their health data and receive clear, helpful responses that feel natural and personalized. The assistant should:

- Understand follow-up questions
- Remember context from earlier in the conversation
- Present information in an easily digestible format

### Integration with existing features

**Health profile**

- Access current health metrics (weight, BMI, wellness score)
- Retrieve health goals and preferences
- Summarize progress data and activity history
- Provide personalized health insights based on user data

**Nutrition management**

- Access current meal plans and nutritional intake
- Retrieve recipe information and preparation steps
- Provide nutritional analysis and recommendations
- Answer questions about dietary goals and restrictions

**Data visualization**

- Describe trends from health and nutrition charts
- Highlight key insights from user data
- Compare current metrics to targets and historical data

### Core conversation types (few-shot examples required)

Each type must have few-shot examples in prompts or documentation:

| Type | Example questions |
|------|-------------------|
| Health metrics | "What's my current BMI?", "How has my weight changed this month?" |
| Progress | "How close am I to my weight goal?", "Am I making progress with my fitness level?" |
| Meal plan | "What's on my meal plan today?", "What's for lunch tomorrow?" |
| Recipe information | "Tell me about my dinner recipe", "How do I prepare tonight's meal?" |
| Nutritional analysis | "How many calories have I consumed today?", "Am I meeting my protein target?" |
| General wellness | "How can I improve my sleep?", "What stretches help with lower back pain?" |

### Multi-turn conversation management

- Follow-ups: "Can you tell me more about that?", "Why is that important?"
- Context-aware responses (topics from previous messages)
- Reference resolution ("it", "that", etc.)

### Response requirements

**Personalization**

- User's name and preferences where appropriate
- Reference specific goals and metrics

**Structure and formatting**

- Clear, scannable formats (lists, sections, emphasis)
- Consistent patterns for similar queries
- Appropriate formatting for numbers and statistics

**Safety and boundaries**

- Clear AI limitations on medical advice
- Appropriate handling of sensitive health topics
- Guardrails for out-of-scope questions
- Suggest professional consultation for medical concerns

---

## Implementation architecture

Two-layer design:

### Conversation layer

| Component | Responsibility |
|-----------|----------------|
| Chat interface | Message history, floating panel / dedicated view |
| Input handling | Validation, length limits, empty input |
| Response rendering | Text, lists, CTAs, charts (`ui_blocks`) |
| Session state | Active thread, open/closed panel |
| History | Persist threads and messages |
| Context | Recent messages, summaries, profile snapshot |
| Generation | LLM + tool loop (or staged rule-based fallback) |

### Data access layer

| Component | Responsibility |
|-----------|----------------|
| Health data functions | Metrics, trends, goals, activity |
| Nutrition functions | Meal plans, recipes, intake, targets |
| Profile integration | Goals, restrictions, display name |
| Function calling | OpenAI/Anthropic tools → existing Nest services |
| Formatting | Structured JSON for model consumption |
| Errors | Unavailable / incomplete data → structured errors |
| Security | JWT user scope; no cross-user data |

### Example request flow

1. User: "What's my current BMI?" (conversation layer)
2. Message appended to history
3. Model decides tool: `get_health_metrics(metric_type: "bmi", time_period: "current")`
4. Data layer calls analytics/profile services → e.g. BMI 24.2
5. Model formats reply with classification
6. Response stored; topic "BMI" available for follow-ups
7. UI displays: "Your current BMI is 24.2, which falls in the normal range."

---

## GenAI techniques

### System prompt design

Must include:

- Purpose and capabilities
- Personality and tone
- Domain terminology (health & nutrition)
- Ethical boundaries and limitations
- Response formatting rules
- Personalization and context rules
- Examples per query category
- Out-of-scope / sensitive request handling

### Feature access (function calling)

Minimum **4 functions** covering health metrics, nutrition, and platform features:

- Clear parameters and return types
- Validation before execution
- Permission checks (authenticated user only)
- Error handling when data missing

Example shape:

```json
{
  "name": "get_health_metrics",
  "description": "Retrieves user's current health metrics",
  "parameters": {
    "type": "object",
    "properties": {
      "metric_type": {
        "type": "string",
        "enum": ["bmi", "weight", "wellness_score", "all"]
      },
      "time_period": {
        "type": "string",
        "enum": ["current", "weekly", "monthly"]
      }
    },
    "required": ["metric_type"]
  }
}
```

**Target tools in this repo (implement in `apps/api/src/assistant/`):**

| Tool | Backing service |
|------|-----------------|
| `get_health_metrics` | Profile + analytics |
| `get_progress_summary` | Analytics summaries |
| `get_meal_plan` | Meal plans |
| `get_recipe` / `search_recipes` | Recipes + RAG |
| `get_nutrition_summary` | Nutrition analytics |
| `get_chart_data` | Analytics series (for NL → chart) |
| `log_activity` / `log_weight` | Profile (confirmed actions only) |

### Conversation memory and context

- Multi-turn: **≥ 5 turns** of usable context
- Track key user facts (goals, restrictions)
- Reference resolution across turns
- Optional: thread summaries when token budget is tight (extra)

### Response formatting

- Templates for ≥ 4 query categories
- Standardized units: **kg**, **cm**, **kcal**, **g** macros (consistent with Parts 1–2)
- Concise vs detailed modes (extra / configurable)
- Natural language descriptions of chart trends

### Important considerations

| Topic | Expectation |
|-------|-------------|
| Model selection | Justify model(s) and temperature / top-p per task type |
| Token management | Efficient prompts; history windowing / summarization |
| Error handling | Graceful fallbacks; clear user messaging |
| Boundaries | Communicate scope; redirect out-of-scope requests |
| Finetuning | **Not required** — focus on data access and follow-ups |

---

## Extra requirements 📚

### Docker

- Single command builds and runs full stack (Parts 1–3)
- Docker only — no manual dependency install for reviewers
- See root `docker-compose.yml`, `pnpm compose:up`

### Data visualization (chat)

Natural language → charts:

| Request example | Chart type |
|-----------------|------------|
| "Show my weight trend for the last month" | Time-series line |
| "Show how my protein intake compares to target" | Comparison bar |
| "Show macronutrient breakdown for today" | Pie / proportion |

Plus **proactive** chart suggestions in conversation context.

### Context summarization (extra)

- Compress older turns when approaching token limits
- Dynamic detail by current topic (nutrition vs exercise)

---

## Bonus functionality 🎁

Optional; must not break default behaviour. Use feature flags or separate builds if needed.

Examples: streaming tokens, meal-photo vision (Gemini), proactive weekly check-in, advanced eval harness, cross-session user memory.

**Implemented in this repo (2026-05-28):** see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for a full map of mandatory vs extra vs bonus criteria.

---

## Deliverables and review requirements 📁

- Complete source and configuration
- Documentation: overview, architecture, setup, usage, prompts, model choice, memory, function calling, errors, bonus
- Demo: full system, design choices, Parts 1–2 integration, challenges, model tradeoffs

---

## Testing

Reviewers clone this repo, run Docker (or local dev), and verify mandatory criteria below. Use [REQUIREMENTS_QUICKCHECK.md](./REQUIREMENTS_QUICKCHECK.md) for pass/fail tracking and [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for what is already built.

### How to test

1. Clone repository; `pnpm compose:up` (or README local dev).
2. Seed: `pnpm nutrition:seed`, `pnpm demo:seed` (see [REVIEWER_SETUP.md](../docs/REVIEWER_SETUP.md)).
3. Sign in; open **wingman** chat bubble (bottom-right).
4. Work through mandatory sections in quickcheck; use TEST_MATRIX for API-level checks.
5. Log gaps; submitter fixes; re-test.

---

## Mandatory testing criteria

### Documentation & setup

- README contains clear overview, setup, and usage for the **full** app (Parts 1–3). Documentation includes: system prompt strategy, model rationale, conversation management, error handling, function-calling details.
- Assistant can access and summarize complete health profile data (BMI, weight, wellness score, activity, goals).
- Assistant **must not** expose sensitive PII beyond user's **name** (no email, DOB, credentials, other users).
- Multi-metric questions return unified narrative (e.g. weight + BMI together).
- Metrics include interpretation vs targets and trends (not raw dumps only).
- Goals/preferences retrieved accurately ("What are my fitness goals?").
- Personalized insights combine multiple data points ("What should I focus on to improve my wellness score?").
- Meal plan for timeframes ("What's my meal plan for today?").
- Recipe + preparation ("How do I prepare tonight's dinner?").
- Nutritional analysis vs targets ("Have I been getting enough protein this week?").
- Chart trends described in natural language with patterns and numbers.
- All **six** core conversation types work without retraining.
- Follow-up context ("Can you tell me more about that?").
- Entity reference ("Is that enough protein?" after breakfast).
- Scannable formatting for week meal plan, etc.
- Medical boundaries ("chest pains during exercise" → seek professional help).
- Conversation history persists across close/reopen (≥ 3-turn test).
- Input validation: empty, long, special chars, code — graceful errors.
- Data layer retrieves health + nutrition in same conversation.
- Missing data dates → structured error, not hallucination.
- Student can trace message → tools → response flow.
- Jailbreak resistance (other users' data, admin mode, etc.).
- System prompt: role, capabilities, boundaries, domain knowledge.
- Prompt includes format examples; responses match.
- Ethical/safety guidelines enforced in outputs.
- **≥ 4** distinct function calls with validation before execution.
- **≥ 5** turn context with follow-ups and references.
- Units: kg, cm, kcal, g — consistent with Parts 1–2.
- Concise vs detailed modes (if implemented) — demonstrable difference.
- Student explains model and temperature/top-p choices.

### Architecture checks

- Conversation layer tracks history without data loss.
- Data access layer uses real platform APIs (not invented numbers).
- Request flow matches documented pattern.

---

## Extra testing criteria

- Docker one-command run; no manual setup.
- NL chart requests: weight line, protein bar, macro pie.
- Proactive chart suggestions in context.
- History compression after 10+ turns.
- Dynamic context when topic shifts.
- Natural conversational quality beyond checkbox compliance.
- Efficient data fetching (no overfetch).
- Graceful fallbacks when AI/provider fails.
- Clear capability/limitation messaging.
- Bonus features documented and demonstrable.

---

## Suggested function catalog (implementation target)

Document actual names in `IMPLEMENTATION_STATUS.md` as you ship them.

```text
get_health_metrics(metric_type, time_period)
get_progress_summary(focus: weight | wellness | goals)
get_meal_plan(date | range)
get_recipe(meal_slot | recipe_id)
get_nutrition_summary(period: day | week)
get_chart_data(chart, days)
log_activity(activityType, durationMinutes, activityAt)  # confirm in UI
log_weight(weightKg, recordedAt)                           # confirm in UI
```

---

## Few-shot conversation examples (minimum set)

Store full examples in `docs/PROMPT_EXAMPLES.md` (to author) and reference from system prompt.

**Health metrics**

```text
User: What's my current BMI?
Assistant: Your current BMI is {value} kg/m² ({classification}). Based on your profile height of {h} cm and latest weight {w} kg.
```

**Progress**

```text
User: How close am I to my weight goal?
Assistant: Your target is {target} kg. Latest weight is {current} kg — about {delta} kg to go. Over the past month you've {trend summary}.
```

**Meal plan**

```text
User: What's on my meal plan today?
Assistant: [Day heading] • Breakfast: … • Lunch: … • Dinner: … (kcal/macros per meal)
```

**Recipe**

```text
User: How do I prepare tonight's dinner?
Assistant: Tonight's dinner is {title}. Ingredients: … Steps: 1. … 2. …
```

**Nutrition**

```text
User: How many calories have I consumed today?
Assistant: Today you've logged/planned {kcal} kcal of your {target} kcal target ({percent}%).
```

**Wellness (non-diagnostic)**

```text
User: How can I improve my sleep?
Assistant: General tips: … This isn't medical advice. For persistent sleep issues, speak with a healthcare provider.
```

---

*Course text adapted for this monorepo. Update [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) after each sprint.*
