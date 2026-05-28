# Security and AI Decisions (Part 2: Nutrition + Meal Planning)

This document is a concise review companion for "student can explain" criteria in the meal-planning project phase.

## AI Data and Personalization

- **PII minimization impact:** AI meal planning and nutrition analysis avoid direct identifiers; personalization is driven by profile goals, activity, dietary preferences/restrictions, and nutrition history.
- **Reuse of prior profile data:** Part 1 profile attributes are reused and prefilled in nutrition flows so users do not repeatedly enter the same information.
- **Missing data impact:** when profile or nutrition inputs are incomplete, generation falls back to conservative defaults and clearly bounded plans.
- **Normalization impact:** nutrition calculations use standardized units (grams, milliliters, kcal, minutes) to keep scaling, comparisons, and charts consistent.

## Prompt Strategy and Output Quality

- **Sequential prompting rationale:** meal planning is decomposed into strategy -> structure -> recipe assignment to improve reliability versus one large prompt.
- **Few-shot usage:** meal strategy/structure prompts include few-shot examples to improve output shape consistency.
- **Parameter tuning:** lower temperature with controlled top-p is used where deterministic JSON and stable planning are preferred.
- **Structured output discipline:** prompts require JSON-only responses; invalid or missing AI output paths fall back to deterministic behavior.

## RAG Decisions

- **Why RAG:** retrieval grounds generation in known recipe data, reducing hallucination risk and improving practical recipe quality.
- **Pipeline:** recipe database -> embeddings -> relevance search -> augmented prompt -> grounded recipe selection.
- **Grounded selection guardrails:** generated recipe choices are constrained to retrieved candidates; fallback selects top retrieved match if AI fails.

## AI Recipe Confirmation (Post-Plan)

- **Draft vs stored:** meal-plan generation assigns slots and macros first; full recipes are AI-drafted and persisted only after the user clicks **Confirm recipes**.
- **Shopping list gate:** shopping lists require confirmed `recipeId` links and aggregate **recipe ingredients** only (no title guessing).
- **Custom AI recipes:** `confirm-recipes` generates complete recipe records (ingredients, preparation, nutrition) for unlinked meals and stores them in the database.

## Function Calling Decisions

- **Nutrition math via function-call path:** recipe scaling, meal assignment from stored recipes, and nutrition-tool endpoints route through `calculate_nutrition` / `scale_recipe` wrappers so calls are traceable.
- **Exception (fallback slots):** when no grounded recipe exists at assignment time, slot macros use a deterministic calorie-budget split until the user confirms AI-generated recipes (then function-calling paths apply to stored recipe data).
- **Traceability:** function-call metadata (tool name, args, execution timestamp) is returned in tool routes and used by service flows.
- **Validation + error safety:** tool arg parsing enforces required fields/types and returns clear 4xx errors for invalid parameters.

## AI Reliability and Error Handling

- **Timeout and retry policy:** OpenAI calls use request timeouts plus retry/backoff for transient failures (network, 429, 5xx).
- **Fallback strategy:** when AI key/provider is unavailable, deterministic fallback behavior still returns usable plans/insights/substitutions.
- **User-facing errors:** API failures return actionable messages; UI surfaces errors without full page reload.

## Model Selection Rationale

- **Capability priorities:** reliable structured JSON output, moderate latency, and predictable instruction following.
- **Split by task profile:** deterministic planning/selection uses stricter settings; user-facing recommendation text can use slightly more flexible generation.
- **Cost/latency tradeoff:** default model balances responsiveness for interactive dashboard/nutrition workflows.

## Recipe Search and Substitution (UI + API)

- **Catalog search UI:** Nutrition tab **Search recipes** modal calls `GET /api/recipes` with text (`q` → RAG similarity) and structured filters (cuisine, meal, ingredient, prep time, calories, restriction-based `allergies`).
- **Substitution scope:** `POST /api/recipes/:id/substitute-ingredient` returns ranked alternatives for one ingredient; it does **not** rewrite the stored recipe. UI surfaces this in the recipe detail modal with an explicit “suggestions only” note.
- **Substitution inputs:** recipe context, user restrictions/dislikes, optional reason (e.g. availability), and a database ingredient candidate pool; AI path may use function calling; missing AI falls back to deterministic picks from the pool.

## Nutrition Analytics and Visualization Decisions

- **Tracking dimensions:** calories + macros tracked daily/weekly with deficit/surplus calculations and trend lines.
- **Visualization choices:** progress bars for calorie target status, macro distribution charts, and trend lines for deficit/surplus evolution.
- **Interpretability:** color-coded status and compact summary blocks help users quickly identify over/under-target patterns.
- **AI analysis integration:** generated highlights, concerns, and suggestions are co-located with nutrition charts to support immediate action.

## Security and Abuse Prevention (Relevant to Part 2)

- **Access control:** nutrition, meal planning, recipes, and shopping list routes require authenticated access.
- **Rate limiting:** existing throttling strategy protects endpoints from rapid-fire abuse and provider overuse.
- **Token/session safety:** short-lived access tokens with refresh rotation reduce exposure windows for compromised credentials.

## Reviewer Notes (Quick Talking Points)

- Explain how sequential prompts improve plan quality and debuggability.
- Explain exactly where augmented prompt is built and where grounded selection is generated.
- Show a function-call-traced nutrition response and fallback behavior with missing AI key.
- Demonstrate **Search recipes** modal, substitution suggestions, manual meal addition, meal-level shopping list generation, and AI nutrition insights in the UI.
