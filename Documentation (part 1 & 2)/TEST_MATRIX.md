# Endpoint Test Matrix

Quick manual verification matrix for review. Routes are under **`/api`**. Authenticated calls: **`Authorization: Bearer <access_token>`** unless noted.

**Companion:** `REVIEW_CHECKLIST.md` (criterion-by-criterion), `REQUIREMENTS_AUDIT.local.md` (gap analysis, gitignored).

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

Requires `GOOGLE_*` / `GITHUB_*` in env (see `.env.example`).

---

## 3) Profile (UI: Profile tab)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/profile` | Full health profile |
| `PATCH` | `/api/profile` | Requires `data_collection` consent |
| `GET` | `/api/profile/privacy` | Sharing preferences |
| `PATCH` | `/api/profile/privacy` | |
| `GET` | `/api/profile/consents` | |
| `POST` | `/api/profile/consents` | Grant/revoke (e.g. `data_collection`) |

---

## 4) Metrics — weight / wellness snapshots (UI: Weight & activity tab + Overview)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/profile/metrics?days=90` | History; optional `limit` |
| `POST` | `/api/profile/metrics` | Body: `weightKg`, optional `recordedAt`, `weeklyActivityDays`, … |
| `PATCH` | `/api/profile/metrics/:id` | Edit entry; **cannot** edit `profile_baseline` |
| `DELETE` | `/api/profile/metrics/:id` | Remove entry; **cannot** delete baseline |

**Duplicate guard:** two `POST` with the same `recordedAt` → **400** (“already exists for this timestamp”).

---

## 5) Activities — session logs (UI: Weight & activity tab)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/profile/activities/catalog` | 20+ activity types (auth required) |
| `GET` | `/api/profile/activities?days=90` | List logs in range |
| `POST` | `/api/profile/activities` | Body: `activityType`, `durationMinutes`, `activityAt` |
| `PATCH` | `/api/profile/activities/:id` | Edit type, duration, date |
| `DELETE` | `/api/profile/activities/:id` | Remove log |

Activity logs feed `GET /api/analytics/series/activity` (active days per week). Export includes activities (`GET /api/profile/export`).

**Note:** Multiple activity logs on the same day/minute are allowed; duplicate **metric** timestamps are not.

---

## 6) Weight & activity tab — UI smoke test (no extra API)

1. Sign in (demo: `demo@numbers.local` / `DemoPassword123!` after `pnpm demo:seed`).
2. Open dashboard → **Weight & activity** tab.
3. Log weight with optional date → appears in history table.
4. Log activity (type + duration + date) → appears under Activities filter.
5. Change range (30 / 90 / 180 / 365 days) → table refreshes.
6. Edit: select row → form prefills → save issues `PATCH`; delete issues `DELETE`.
7. Switch to **Overview** → progress chart and activity series update after reload.

---

## 7) Analytics (UI: Overview / Progress)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/analytics/summary` | BMI, wellness score, components (incl. optional `checkIn` when 7-day habits exist), goals |
| `GET` | `/api/analytics/series/weight?days=90` | Weight time series (`days` 7–365) |
| `GET` | `/api/analytics/series/wellness?days=90` | Wellness (+ BMI in payload) |
| `GET` | `/api/analytics/series/activity?days=90` | Active days per week (metrics + activity logs) |
| `GET` | `/api/analytics/summaries/progress` | Weekly/monthly computed deltas |

UI: combined progress chart toggles weight / wellness / BMI / activity; range selector drives `days` query param.

---

## 8) Daily wellness (UI: Overview — Today)

**Companion:** [docs/DAILY_WELLNESS.md](../../docs/DAILY_WELLNESS.md)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/today` | Calories left, **macros today** (protein/carbs/fats), next meal (plan covering today), reminders, adherence, streaks |
| `PUT` | `/api/daily-check-in` | Sleep, water (glasses), mood (1–5), optional `steps` |
| `GET` | `/api/daily-check-in?date=YYYY-MM-DD` | Read check-in |
| `POST` | `/api/daily-check-in/wearable-demo` | Demo steps + sleep import |
| `POST` | `/api/food-log/quick` | Recipe or ingredient → `MealIntakeLog` |
| `GET` | `/api/food-log/recent?limit=8` | Recent intake logs |

**UI smoke:** Overview → **Today** card → **Quick food log** → **Daily check-in** (optional steps) → optional wearable demo → switch to **Weight & activity** when reminders show.

---

## 9) AI insights (UI: Overview)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/insights?limit=10` | Cached recommendations |
| `POST` | `/api/insights/generate` | Regenerate (uses profile + recent metrics/activities) |

---

## 10) Privacy, export, deletion (UI: Privacy / Account)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/profile/export` | JSON export (profile, metrics, activities, consents, …) |
| `GET` | `/api/profile/export/events` | Audit-style export events |
| `GET` | `/api/profile/deletion-request` | Status |
| `POST` | `/api/profile/deletion-request` | Schedule deletion |
| `POST` | `/api/profile/deletion-request/cancel` | Cancel pending |
| `POST` | `/api/profile/deletion-request/purge-due` | Ops: body `{ "secret": "<PURGE_ADMIN_SECRET>" }` (JWT required; not automated) |
| `GET` | `/api/admin/status` | `{ showAdminTab, isModerator, isPurgeAdmin }` for signed-in user |
| `GET` | `/api/admin/deletion-queue` | Pending deletions (purge admin email only) |
| `POST` | `/api/admin/purge-due` | Purge accounts past retention (purge admin email only) |

**UI smoke (Admin):** Sign in as email in `RECIPE_MODERATOR_EMAILS` and/or `PURGE_ADMIN_EMAILS` → **Admin** tab visible → moderation queue and/or deletion cards (mobile) + purge button. See [docs/ADMIN.md](../../docs/ADMIN.md).

---

## 11) Health check

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/health` | Used by `pnpm verify` e2e |

---

## Automated verify

```bash
pnpm verify   # api build + lint + e2e + web build
pnpm compose:up --build   # full stack for manual matrix above
```

OpenAPI: `http://localhost:3000/docs`
