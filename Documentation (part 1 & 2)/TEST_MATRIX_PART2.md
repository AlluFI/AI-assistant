# Endpoint Test Matrix (Part 1 + Part 2)

Quick manual verification matrix for review. Routes are under **`/api`**. Authenticated calls: **`Authorization: Bearer <access_token>`** unless noted.

**Companion:** `REVIEW_CHECKLIST.md` (criterion-by-criterion), `PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md` (canonical requirements), `SECURITY_AND_AI_DECISIONS.md` (AI/security talking points).

---

## 1) Auth and security (UI: login / account)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/auth/register` | Creates account + verification email |
| `POST` | `/api/auth/verify-email` | Marks email verified |
| `POST` | `/api/auth/login` | Access token (+ refresh token/cookie) |
| `POST` | `/api/auth/mfa/complete` | TOTP or backup code after `mfaRequired` |
| `POST` | `/api/auth/refresh` | Rotates refresh + new access token |
| `POST` | `/api/auth/logout` | Signs out one session |
| `POST` | `/api/auth/logout-all` | Signs out all sessions |
| `GET` | `/api/auth/csrf` | CSRF token for cookie refresh mode |
| `POST` | `/api/auth/forgot-password` | Throttled |
| `POST` | `/api/auth/reset-password` | Token from email |
| `GET` | `/api/auth/me` | Current user summary |
| `PATCH` | `/api/auth/account` | Display name, etc. |
| `GET` | `/api/auth/totp/setup` | 2FA enrollment |
| `POST` | `/api/auth/totp/confirm` | Enable 2FA |
| `POST` | `/api/auth/totp/disable` | Disable 2FA |
| `POST` | `/api/auth/totp/backup-codes/regenerate` | New backup codes |

---

## 2) OAuth (browser)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/auth/google` | Start Google sign-in |
| `GET` | `/api/auth/google/callback` | Sets refresh + CSRF cookies |
| `GET` | `/api/auth/github` | Start GitHub sign-in |
| `GET` | `/api/auth/github/callback` | Sets refresh + CSRF cookies |

---

## 3) Profile (UI: Profile tab)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/profile` | Full health profile |
| `PATCH` | `/api/profile` | Requires `data_collection` consent |
| `GET` | `/api/profile/privacy` | Sharing + automation prefs (`insightCadence`, reminders, `reminderChannel`) |
| `PATCH` | `/api/profile/privacy` | |
| `GET` | `/api/profile/consents` | |
| `POST` | `/api/profile/consents` | Grant/revoke (e.g. `data_collection`) |
| `PATCH` | `/api/nutrition/profile` | Timezone (also via nutrition profile) |

---

## 4) Metrics and activities (UI: Weight & activity tab)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/profile/metrics?days=90` | Weight / wellness history |
| `POST` | `/api/profile/metrics` | Log weigh-in |
| `PATCH` | `/api/profile/metrics/:id` | Edit entry |
| `DELETE` | `/api/profile/metrics/:id` | Remove entry |
| `GET` | `/api/profile/activities/catalog` | 20+ activity types |
| `GET` | `/api/profile/activities?days=90` | Activity logs |
| `POST` | `/api/profile/activities` | Log workout |

---

## 5) Analytics and insights (UI: Overview / Insights)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/analytics/summary` | BMI, wellness score, goals |
| `GET` | `/api/analytics/series/weight?days=90` | Weight series |
| `GET` | `/api/analytics/series/wellness?days=90` | Wellness series |
| `GET` | `/api/analytics/series/activity?days=90` | Active days per week |
| `GET` | `/api/insights?limit=10` | Cached wellness insights |
| `POST` | `/api/insights/generate` | Regenerate wellness insights |

---

## 6) Nutrition profile (UI: Nutrition tab)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/nutrition/profile` | Combined health + nutrition profile, suggested targets |
| `PATCH` | `/api/nutrition/profile` | Cuisines, dislikes, calorie target, meals/snacks per day, macros, meal times (`snack`, `snack_2`, …) |
| `POST` | `/api/nutrition/profile/apply-suggested-targets` | Mifflin–St Jeor formula targets |
| `POST` | `/api/nutrition/profile/apply-ai-targets` | AI targets from health profile (`OPENAI_API_KEY`) |

---

## 7) Recipes and RAG (API + Nutrition UI)

**UI:** Nutrition tab → **Recipe catalog** → **Search recipes** (modal: search/filter, open recipe, scale servings, suggest substitutes).

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/recipes?q=...` | Search + vector similarity + filters |
| `GET` | `/api/recipes/:id` | Full recipe (required schema fields) |
| `POST` | `/api/recipes/scale` | Scale servings; function-calling nutrition |
| `POST` | `/api/recipes/:id/substitute-ingredient` | Body: `{ ingredient, reason?, limit? }` — advisory suggestions only |

Seed data: `pnpm nutrition:seed` (≥500 ingredients + recipes).

---

## 8) Nutrition tools (function calling)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/nutrition-tools/calculate` | `calculate_nutrition` trace |
| `POST` | `/api/nutrition-tools/scale-recipe` | `scale_recipe` trace |

---

## 9) Meal plans (UI: Nutrition → Meal plan detail)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/meal-plans` | List plans; each item includes `startDate`, `endDate`, `coversToday`, `isExpired` |
| `GET` | `/api/meal-plans/history` | Expired plans only (`?q=` optional search) |
| `POST` | `/api/meal-plans/:planId/reapply` | Body `{ startDate }` — reactivate latest version from new start date |
| `POST` | `/api/meal-plans/generate` | Daily/weekly; 3-step generation + `generationSteps` |
| `GET` | `/api/meal-plans/:id` | Plan + versions + meals |
| `POST` | `/api/meal-plans/versions/:versionId/swap` | Swap slots (incl. cross-day) |
| `POST` | `/api/meal-plans/versions/:versionId/reorder` | Reorder within day |
| `POST` | `/api/meal-plans/versions/:versionId/meals/:mealId/regenerate` | Regenerate one meal |
| `POST` | `/api/meal-plans/versions/:versionId/meals/:mealId/replace-recipe` | Swap slot to another catalog recipe |
| `POST` | `/api/meal-plans/versions/:versionId/meals/:mealId/alternative` | Pick alternative |
| `POST` | `/api/meal-plans/versions/:versionId/meals` | Manual meal add |
| `POST` | `/api/meal-plans/versions/:versionId/confirm-recipes` | Persist AI recipe drafts |
| `POST` | `/api/meal-plans/:planId/versions/:versionId/restore` | Restore version |

**UI:** Weekly **Meal plan detail** opens on the day tab matching today (`mealPlanDate.util.ts`); day tabs show `Day N · MM-DD`.

---

## 10) Shopping lists (UI: View shopping lists / Create shopping list)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/shopping-lists` | List user lists |
| `POST` | `/api/shopping-lists/from-version/:versionId` | Requires all meals have `recipeId` |
| `POST` | `/api/shopping-lists/from-meal/:versionId/:mealId` | Single meal |
| `PATCH` | `/api/shopping-lists/:listId/items/:itemId` | Quantity edits |
| `DELETE` | `/api/shopping-lists/:listId/items/:itemId` | Remove / exclude item |

---

## 11) Nutrition analytics (UI: Nutrition tab + Overview Progress)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/nutrition-analytics/daily?date=YYYY-MM-DD` | Intake vs target, macro % |
| `GET` | `/api/nutrition-analytics/weekly` | Weekly rollup |
| `GET` | `/api/nutrition-analytics/trend?days=30` | Deficit/surplus trend |
| `GET` | `/api/nutrition-analytics/insights` | AI highlights, concerns, suggestions |

---

## 12) Daily wellness (UI: Overview — Today)

**Companion:** [docs/DAILY_WELLNESS.md](../../docs/DAILY_WELLNESS.md)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/today` | Today dashboard aggregate (macros, next meal from plan covering today) |
| `PUT` | `/api/daily-check-in` | Sleep, water, mood; optional `steps` |
| `POST` | `/api/daily-check-in/wearable-demo` | Demo wearable sync |
| `POST` | `/api/food-log/quick` | Quick log (recipe or ingredient) |
| `GET` | `/api/food-log/recent` | Recent logs |

Intake from quick log is included in `GET /api/nutrition-analytics/daily`.

---

## 13) Privacy, export, deletion

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/profile/export` | JSON export |
| `GET` | `/api/profile/export/events` | Export audit |
| `GET` | `/api/profile/deletion-request` | Status |
| `POST` | `/api/profile/deletion-request` | Schedule deletion |
| `POST` | `/api/profile/deletion-request/cancel` | Cancel pending |

---

## 14) Health check

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/health` | Used by `pnpm verify` e2e |

---

## Automated verify

```bash
pnpm verify
pnpm compose:up --build   # full stack for manual matrix above
```

OpenAPI: `http://localhost:3000/docs`

Demo sign-in (after `pnpm demo:seed`): `demo@numbers.local` / `DemoPassword123!`
