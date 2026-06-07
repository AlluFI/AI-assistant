# Review Walkthrough Checklist (Part 2: Nutrition + Meal Planning)

Use this in live project review or demo for Project Part 2.

**API basics:** routes are under **`/api`**. OpenAPI UI: **`http://localhost:3000/docs`**. Authenticated calls use **`Authorization: Bearer <access_token>`**.

**Companion docs:**

| Doc | Use it for |
|-----|------------|
| `PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md` | Canonical Part 2 requirements and testing criteria |
| `SECURITY_AND_AI_DECISIONS.md` | "Student can explain" AI/security/prompting decisions |
| `README.md` | Setup + feature overview + endpoint pointers |

---

## Mandatory testing criteria (Part 2 focus)

The list below follows the mandatory Part 2 review intent and maps each area to concrete checks in this repo.

| Criterion Cluster | How to verify (this repo) |
|--------|-------------------------------|
| README + docs completeness | Read `README.md` + `SECURITY_AND_AI_DECISIONS.md` for architecture, prompt strategy, model rationale, data model, and error handling decisions. |
| Dietary preferences + intolerances scale | `GET /api/nutrition/profile` and inspect catalog-backed behavior; check `apps/api/src/shared/dietary-catalog.ts` for broad supported values. |
| Reuse Project 1 user data + prefill | Open Nutrition tab; existing profile preferences/restrictions are shown and reused instead of re-collected from scratch. |
| ISO 8601 timestamps in planning | Verify generated `scheduledAt` values and DTO expectations in meal-plan API responses are ISO 8601. |
| Daily + weekly meal generation | `POST /api/meal-plans/generate` with `duration: daily` and `duration: weekly`; verify plans returned and persisted. |
| Meal structure customization | Set `mealsPerDay` + `snacksPerDay` in nutrition profile, regenerate, verify resulting slot structure updates. |
| Meal details include nutrition | `GET /api/meal-plans/:id` / version fetch includes meal title/type/time + macro nutrition per meal. |
| Alternatives + replacements | Use meal alternatives in UI or `POST /api/meal-plans/versions/:versionId/meals/:mealId/alternative`; **Replace recipe** panel or `POST .../meals/:mealId/replace-recipe`. |
| Swaps/reordering across schedule | Use swap flow + drag reorder in Nutrition UI or call `POST /api/meal-plans/versions/:versionId/swap` and `POST /api/meal-plans/versions/:versionId/reorder`. |
| Manual meal additions | Use UI "Add manual meal" or call `POST /api/meal-plans/versions/:versionId/meals`. |
| Regenerate meal / whole plan versions | Per-meal regenerate via `POST /api/meal-plans/versions/:versionId/meals/:mealId/regenerate`; whole plan via new generation + version history/restore. |
| Confirm AI recipes before shopping | `POST /api/meal-plans/versions/:versionId/confirm-recipes`; UI **Confirm recipes** stores drafts; shopping buttons stay disabled until all meals have `recipeId`. |
| Shopping list from plan | `POST /api/shopping-lists/from-version/:versionId` after confirm; verify categorized **ingredients** (not meal titles) and quantities. |
| Shopping list from single meal | `POST /api/shopping-lists/from-meal/:versionId/:mealId`; UI **Create list for meal**. |
| Shopping list categories and edits | Check category grouping and item update/remove (`PATCH /api/shopping-lists/:listId/items/:itemId`, `DELETE ...`); open existing lists via **View shopping lists**. |
| Sequential prompting (>=3 steps) | Inspect meal generation steps in stored `generationSteps` and code flow in `meal-plans.service.ts` (`runStep1`, `runStep2`, step3 recipe assignment). |
| RAG retrieval + augmentation + generation | Verify step3 logs include retrieved recipes, augmented prompt, and grounded AI selection before final assignment. |
| Recipe + ingredient dataset scale | Run/inspect `pnpm nutrition:seed`; verify 500+ ingredients and 500+ recipes are available. |
| Vector similarity retrieval | `GET /api/recipes?q=...` uses embedding relevance from RAG service (`rag.service.ts`). |
| Function calling for nutrition calculations | Check responses from nutrition tools endpoints include function-call metadata; recipe/meal nutrition paths route through function-call wrappers. |
| Function-calling error handling | Validate invalid args return meaningful 4xx errors in nutrition tools; review fallback behavior in AI caller and nutrition flows. |
| Recipe search and filtering breadth | Nutrition tab → **Search recipes** popup, or `GET /api/recipes` with `q`, ingredient, cuisine, meal, prep time, calories, `allergies`. |
| Recipe details + visualized nutrition | Click a search result or meal **View recipe**; `GET /api/recipes/:id` + scaled nutrition in modal. |
| Ingredient substitution via AI | In recipe detail modal → **Suggest substitutes** (`POST /api/recipes/:id/substitute-ingredient`); suggestions only, recipe not auto-modified. |
| Portion adjustment + nutrition recalculation | Servings control in recipe modal; `POST /api/recipes/scale` with function-calling nutrition. |
| Standardized units in data model | Confirm solids gram, liquids milliliter support, kcal/minute conventions in schema/services and API payloads. |
| Required Recipe schema fields | Verify returned recipe object includes all required fields (`id`, `title`, `cuisine`, `meal`, `servings`, `ingredients`, `summary`, `time`, `difficulty_level`, `dietary_tags`, `source`, `img`, `preparation`). |
| Required Ingredient schema fields | Verify ingredient docs/records include required nutrient payload structure (`label`, `unit`, `quantity`, `nutrition` with calories/carbs/protein/fats). |
| Daily/weekly macro and calorie tracking | `GET /api/nutrition-analytics/daily`, `weekly`, and trend endpoints; verify calories + macro percent-of-target. |
| Deficit/surplus and trend visualization | Nutrition UI: progress bar status colors + line trend where positive=deficit, negative=surplus. |
| AI nutrition summary + suggestions | `GET /api/nutrition-analytics/insights`; verify highlights, concerns, macro balance, and actionable suggestions. |
| Cross-feature integration (dashboard/progress) | Verify nutrition trend appears in Overview progress section and nutrition actions update dashboard analytics. |
| Today dashboard (calories left, next meal) | Overview → **Today** card (no duplicate Nutrition button — use top nav); `GET /api/today`; calories remaining and next planned meal after generating a plan. |
| Quick food log | Overview → **Quick food log**; `POST /api/food-log/quick`; daily intake updates in Today + nutrition analytics. |
| Daily habits + wearable demo | Overview → **Daily check-in**; `PUT /api/daily-check-in` (sleep, water, mood, optional steps); optional `POST /api/daily-check-in/wearable-demo`. |
| Adherence and streaks | After marking meals eaten, Today shows 7-day adherence % and protein/logging streaks. |
| AI / formula nutrition targets | Nutrition tab → **AI recommend targets** / **Use formula targets** (shows rationale); Wingman `update_nutrition_targets` tool. |
| Admin tab (moderation / purge) | Set `RECIPE_MODERATOR_EMAILS` and/or `PURGE_ADMIN_EMAILS` in `.env`; sign in → **Admin** tab; see [docs/ADMIN.md](../../docs/ADMIN.md). |
| Meal times / snacks on plans | `preferred_meal_times` incl. `snack_2`; Wingman `update_nutrition_preferences`; Overview setup banner if no calorie target. |
| Wingman meal actions | Static intents: mark meal eaten, generate meal plan, **create & save catalog recipe** (confirm CTAs); nudges for low protein streak & daily check-in. |
| Multi-snack meal times | Set `snacksPerDay` ≥ 2; save profile; verify `snack` + `snack_2` time fields in Nutrition preferences. |
| BMI/activity-driven personalization | Use "apply suggested targets" and profile activity changes; confirm nutrition targets and planning behavior adapt. |
| Prompt strategy + params | Review `SECURITY_AND_AI_DECISIONS.md` and code usage for few-shot, sequential prompts, temperature/top-p rationale. |
| API error UX + recovery | Trigger invalid payloads/timeouts/missing AI key; verify user-facing messages and fallback responses remain graceful. |
| Meal plan versioning + restore | Generate multiple plan versions, restore prior version (`POST /api/meal-plans/:planId/versions/:versionId/restore`). |
| Plan date validity + reapply | Expired plans (`isExpired` / past `endDate`) excluded from Today and default Generate; **Browse past plans** → `POST /api/meal-plans/:id/reapply` with new `startDate`. |

---

## Suggested live demo flow (Part 2)

### 1) Bring up stack

- `pnpm compose:up`
- Web: `http://localhost:8080`
- API docs: `http://localhost:3000/docs`

### 2) Prepare nutrition data

- `pnpm nutrition:seed` (or run inside Docker API container)
- Optional: `pnpm demo:seed` for ready profile/metrics
- Sign in as demo user from README

### 3) Nutrition profile + targets

- Open Nutrition tab, confirm reused preferences/restrictions from profile
- Save timezone, cuisines, dislikes, meal/snack counts
- Use "Apply suggested targets" to demonstrate BMI/activity integration

### 4) Meal planning operations

- Generate **daily** and **weekly** plans
- Open a **weekly** plan → day tabs default to **today's calendar day** (e.g. Day 5 on the 5th day of the plan), with date labels on tabs
- Swap meals (including across days), reorder meals, regenerate one meal, **replace recipe** on a slot
- Add a manual meal
- **Confirm recipes** (AI-generated drafts persisted)
- **Create shopping list** for the plan version (ingredients only after confirm)
- **View recipe** on a meal card; scale servings in the modal
- Restore an older version
- **Browse past plans** on Nutrition → reapply an expired plan with a new start date

### 5) Recipes + substitutions + scaling

- Nutrition tab → **Recipe catalog** → **Search recipes**
- Filter by text, cuisine, meal, ingredient, prep time, max calories; optional restriction filter
- Open a result → scale servings → **Suggest substitutes** for one ingredient (explain AI vs fallback, advisory-only)
- Optionally repeat via meal plan **View recipe** on a confirmed meal

### 6) Shopping list flows

- Confirm recipes first if buttons are disabled
- **Create shopping list** from whole version
- **Create list for meal** from one meal
- **View shopping lists** to open the modal; edit quantities and exclude/remove items; download PDF

### 7) Nutrition analytics + AI analysis

- Show daily/weekly/trend views
- Demonstrate deficit/surplus visualization
- Show AI nutrition analysis card (highlights/concerns/suggestions)

### 8) Overview — Today, quick log, habits

- Open **Overview** → **Today** (calories left, **Macros today** — protein/carbs/fats, next meal)
- **Quick food log** from a recipe; confirm intake on Today refreshes
- **Daily check-in** (sleep, water, mood, optional steps); wellness gauge **Check-in (7d)** when habits logged
- Optional **Import demo wearable data** (pre-fills steps/sleep)
- Mark meals eaten → adherence % and streaks update

### 9) Final quality checks

- Run `pnpm verify`
- Explain prompt sequence, RAG pipeline, and function-calling path
