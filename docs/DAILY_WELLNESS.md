# Daily wellness — Today dashboard, habits, quick logging

High-impact daily-use features on the **Overview** tab. API routes are under `/api` (Swagger tag: **daily-wellness**).

## Overview UI

After sign-in, open **Overview**. At the top:

| Card | Purpose |
|------|---------|
| **Today** | Calories left, protein ring, next planned meal, activity this week, reminders, 7-day adherence, streaks |
| **Quick food log** | Log food outside the meal plan (recipe search or single ingredient) |
| **Daily check-in** | Sleep, water, mood; optional demo wearable import |

Data loads via `GET /api/today` together with existing overview charts (`loadTrends` in the web app).

## API endpoints

| Method | Path | Body / query | Notes |
|--------|------|--------------|--------|
| `GET` | `/today` | `?date=YYYY-MM-DD` (optional) | Aggregated today summary |
| `PUT` | `/daily-check-in` | `date`, `sleepHours`, `waterGlasses`, `mood` (1–5) | Upsert habits for a day |
| `GET` | `/daily-check-in` | `?date=` | Read check-in for a day |
| `POST` | `/daily-check-in/wearable-demo` | `date`, `steps`, `sleepHours` | Demo Apple Health / Google Fit import (`source: wearable_demo`) |
| `POST` | `/food-log/quick` | See below | Creates `MealIntakeLog` with `source: manual` |
| `GET` | `/food-log/recent` | `?limit=8` | Recent manual/photo logs |

### `GET /today` response (summary)

- `nutrition` — same shape as `nutrition-analytics/daily` plus `caloriesRemaining`
- `checkIn` — today's `DailyCheckIn` or `null`
- `nextMeal` — next uneaten slot from active meal plan (if any)
- `reminders` — `weightDue`, `activityDue` (7-day weight / cadence-based activity)
- `activityWeek` — active days this week vs `weeklyActivityDays` from health profile
- `adherence` — 7-day planned vs eaten meal counts and `adherencePercent`
- `streaks` — `proteinTargetDays`, `loggingDays` (consecutive days ending today)

### `POST /food-log/quick`

**From recipe:**

```json
{
  "title": "Greek salad",
  "mealType": "lunch",
  "recipeId": "<uuid>",
  "servings": 1
}
```

**From ingredients** (nutrition DB via `nutrition-tools`):

```json
{
  "title": "Banana snack",
  "mealType": "snack",
  "servings": 1,
  "ingredients": [{ "name": "banana", "quantity": 120, "unit": "gram" }]
}
```

Intake is included in `GET /api/nutrition-analytics/daily` together with planned meals marked eaten and photo-confirmed logs.

## Data model

`DailyCheckIn` (Prisma):

- `userId` + `date` (unique)
- `sleepHours`, `waterGlasses`, `mood`, `steps`
- `source` — `user` or `wearable_demo`

Migration: `20260603120000_daily_wellness`.

## Manual test flow

1. Sign in (`demo@numbers.local` after `pnpm demo:seed`).
2. **Overview** → confirm **Today** shows calories left and protein %.
3. **Quick food log** → search a recipe → **Log food** → Today calories update after refresh.
4. **Daily check-in** → save sleep/water/mood.
5. Expand **Import demo wearable data** → import steps/sleep → steps appear on check-in.
6. **Nutrition** → generate meal plan → return to Overview → **Next meal** populated.
7. Mark meals eaten on meal plan → adherence % and logging streak increase.

## Code layout

```
apps/api/src/daily-wellness/
  daily-wellness.controller.ts
  today.service.ts
  daily-check-in.service.ts
  food-log.service.ts
  adherence.util.ts

apps/web/src/dashboard/
  TodayDashboard.tsx
  QuickFoodLogPanel.tsx
  DailyCheckInPanel.tsx
  todayTypes.ts
```

## Related docs

- [TEST_MATRIX.md](../Documentation%20(part%201%20&%202)/TEST_MATRIX.md) — Part 1 overview endpoints
- [TEST_MATRIX_PART2.md](../Documentation%20(part%201%20&%202)/TEST_MATRIX_PART2.md) — nutrition + daily wellness
- [MEAL_PHOTOS.md](./MEAL_PHOTOS.md) — photo-based logging (also feeds daily intake)
