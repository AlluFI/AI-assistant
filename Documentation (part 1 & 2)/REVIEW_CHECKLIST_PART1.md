# Review Walkthrough Checklist

Use this in live project review or demo.

**API basics:** routes are under **`/api`**. OpenAPI UI: **`http://localhost:3000/docs`**. Authenticated calls use **`Authorization: Bearer <access_token>`** (from `POST /api/auth/login`), except OAuth (browser redirects + cookies).

**Companion docs:**

| Doc | Use it for |
|-----|------------|
| `TEST_MATRIX.md` | Endpoint list by feature (incl. Weight & activity tab, activities, PATCH/DELETE) |
| `OPERATIONS_SECURITY.md` | Transit/at-rest, Compose runbook, duplicate metrics, throttling |
| `SECURITY_AND_AI_DECISIONS.md` | “Student can explain” prompts |
| `REQUIREMENTS_AUDIT.local.md` | Private gap analysis vs requirements (gitignored) |

---

## Mandatory testing criteria (same order as `PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md` → Testing → Mandatory)

The first column follows that checklist top to bottom. Wording is shortened when long; use the project requirements document as the canonical wording.

| Criterion | How to verify (this repo) |
|--------|-------------------------------|
| Explain how PII removal affects personalized AI recommendations | `SECURITY_AND_AI_DECISIONS.md` (heading “AI Data and Personalization”). |
| Explain strategy for detecting / handling AI hallucinations in health recommendations | `SECURITY_AND_AI_DECISIONS.md` (heading “AI Quality and Hallucination Handling”). |
| User receives email with verification link after registration | `POST /api/auth/register` → Mailpit `http://localhost:8025` → link to `WEB_APP_URL` with token → `POST /api/auth/verify-email` or web `#/verify-email?token=…`. |
| Auth: email-password and ≥ 2 OAuth providers | Password: register + `POST /api/auth/login`. OAuth: **`GET /api/auth/google`**, **`GET /api/auth/github`** (needs `GOOGLE_*` / `GITHUB_*` in env). |
| Password reset via email | `POST /api/auth/forgot-password` → Mailpit → `POST /api/auth/reset-password` with token. |
| Users can optionally enable 2FA | Logged in: `GET /api/auth/totp/setup` → `POST /api/auth/totp/confirm` with `{ "code": "…" }` (see `/docs`). Verify functionality of 2FA: Sign out; `POST /api/auth/login` → `mfaRequired` + `mfaToken`; complete `POST /api/auth/mfa/complete` with `totpCode` or `backupCode`. Optional: `POST /api/auth/totp/backup-codes/regenerate`. |
| Cannot access protected routes without verifying email | Register, skip Mailpit verify → `POST /api/auth/login` → **401** (“verify your email”). No JWT → no `GET /api/profile` etc. OAuth path: ask team how provider-trusted email is marked verified. |
| Explain security implications of JWT access-token duration |`SECURITY_AND_AI_DECISIONS.md` (heading “JWT access-token duration”). |
| Access token expires after [x] minutes (inactivity / TTL) | Check **`JWT_ACCESS_EXPIRES_SEC`** in `apps/api/.env` / `.env.example` (default **900**). Decode access JWT `exp` claim (e.g. jwt.io) after login. |
| New access token when valid refresh token provided | `POST /api/auth/refresh` with `{ "refreshToken": "<from login>" }` (or cookie flow per README) → new `accessToken` + rotated refresh. Verify with expired access + valid refresh `POST /api/auth/refresh` does **not** require a valid access token—only a valid refresh. Optionally expire access and confirm new access works on `GET /api/profile`. |
| Clear data-usage consent before collection | `GET/POST /api/profile/consents` — without **`data_collection`** consent, `PATCH /api/profile` / `POST /api/profile/metrics` should fail until granted. UI: Review Lab consents. Consent includes what is collected and how it is used. Read consent records / UI copy|
| Collects demographics, physical metrics, lifestyle, diet prefs/restrictions, wellness goals | `GET /api/profile` — confirm fields (age, gender, height/weight, occupation, activity, diet, goals, etc.). |
| Encrypted in transit and at rest | Evidence checklist: **`OPERATIONS_SECURITY.md`** sections 1–2. |
| Initial fitness assessment data | Same profile JSON: weekly activity, exercise types, session duration, fitness level, environment, time-of-day preference, endurance, pushups/squats, etc. |
| Explain how normalization affects visualization accuracy | `SECURITY_AND_AI_DECISIONS.md` (normalization bullet under “AI Data and Personalization”). |
| Health metrics in standard units before storage | `GET /api/profile`: **kg**, **cm**; metrics snapshots align. |
| User can change data sharing preferences | `GET/PATCH /api/profile/privacy` (`shareAnonymizedData`, `publicProfileVisible`, `allowAiProcessing`, `emailNotifications`, …). |
| Historical weight changes tracked with timestamps | `POST /api/profile/metrics` with `weightKg` + optional `recordedAt`; `GET /api/profile/metrics`. Multiple entries; each has distinct timestamp in history. Two `POST /api/profile/metrics` with **different** `recordedAt` → `GET /api/profile/metrics` ordered; UI chart shows points. |
| No duplicate activity/metric for same timestamp | Two `POST` with **same** `recordedAt` → second **400** (“already exists for this timestamp”). See **`OPERATIONS_SECURITY.md`** section 7 (duplicate metric timestamps). |
| Explain how BMI classifications affect wellness score | demo `GET /api/analytics/summary` when height/weight changes BMI band. |
| Wellness score changes when weekly activity frequency updates | `PATCH /api/profile` or metric with `weeklyActivityDays` → `GET /api/analytics/summary` `wellnessScore` changes. |
| Explain choice of AI model(s) (quality vs latency) | `SECURITY_AND_AI_DECISIONS.md` (“Model Selection Rationale”). |
| Explain which model capabilities mattered most | `SECURITY_AND_AI_DECISIONS.md` (“Model Selection Rationale”). |
| System recalculates wellness components when contributing metrics change | Edit profile fields / add metrics → `GET /api/analytics/summary` after each change. Verify updates for BMI range, activity, goal progress, habits: toggle weight/height, `weeklyActivityDays`, goal-related fields, habit-like fields; watch summary each time. |
| Different health insights when goals change | `PATCH /api/profile` (`fitnessGoal` / related) → `POST /api/insights/generate` → `GET /api/insights`, e.g. weight loss → muscle gain changes insights: Compare insight text before/after goal change |
| Explain caching vs regeneration for AI responses | `SECURITY_AND_AI_DECISIONS.md` (“Response caching vs regeneration”). |
| Explain how context length affects recommendation quality | `SECURITY_AND_AI_DECISIONS.md` (“Context length tradeoff”). |
| Recommendations reference stated fitness goals | Inspect latest insight from `GET /api/insights` or UI. Verify explicit mention / alignment with profile goal: Text in recommendations should name or clearly reflect the set goal. |
| AI insights exclude PII | Inspect stored insight JSON; prompts strip name/email. |
| Explain prompt engineering for consistent recommendation format | `SECURITY_AND_AI_DECISIONS.md`. |
| Response validation vs health restrictions | Set dietary restrictions on profile; `POST /api/insights/generate`; confirm filtering / safe output. Short Q&A tied to response validation row above. |
| Explain zero-shot vs few-shot tradeoffs | `SECURITY_AND_AI_DECISIONS.md` (“Zero-shot vs few-shot tradeoff”). |
| Cached recommendations when AI unavailable | Unset or break `OPENAI_API_KEY`, restart API; generate or open dashboard. UI shows most recent cached when AI disabled: Confirm fallback messaging + latest stored recommendations (`GET /api/insights`). |
| Weekly and monthly summaries with progress and key metrics | `GET /api/analytics/summaries/progress`. Summary includes week activity, wellness changes, progress to goals. Inspect `GET /api/analytics/summaries/progress` JSON + dashboard progress cards. **`OPERATIONS_SECURITY.md`** section 7 (weekly/monthly verification pointers). |
| Dashboard: BMI, wellness, goal progress, AI insights | Review Lab dashboard; cross-check `GET /api/analytics/summary` + `GET /api/insights`. |
| Progress chart: weight over time, wellness evolution, activity changes | UI combined chart; `GET /api/analytics/series/weight`, `GET /api/analytics/series/wellness` (BMI may appear in combined series / summary). |
| Goal progress includes milestone tracking | UI goal % / milestone hints; ask how 5% / activity / streak logic is implemented. Milestone example (header); Weight: every 5% toward goal, Activity: each additional day/week, Habits: streak achievements.
| Comparison view: current vs target, weekly/monthly comparison, trends, AI recs | Summary cards, `summaries/progress`, charts, and insights block together. |
| Explain how visualization choices affect understanding of progress | `SECURITY_AND_AI_DECISIONS.md` (“Data Visualization Rationale”). |
| AI insights with priority-based highlighting | UI: priority badges on recommendations. Verify high/medium/low + expandable details: Expand an insight row; see **`OPERATIONS_SECURITY.md`** section 7 (priority rendering). |
| Weight chart: goal weight as reference line | Set `targetWeightKg` in profile; confirm horizontal reference on weight chart. |
| Charts resize on mobile without data loss | Narrow browser / device mode; chart should remain readable (Recharts `ResponsiveContainer`). |
| Explain impact of missing health data on AI accuracy | `SECURITY_AND_AI_DECISIONS.md` (“Missing data impact”). |
| API errors without full page reload | Trigger `PATCH /api/profile` validation error; UI shows message inline. e.g. invalid BMI / `weightKg: -1` without refresh, `PATCH /api/profile` with `weightKg: -1` → **400**; web Review Lab shows error without navigation. |
| Explain approach to API abuse / rate limiting | `SECURITY_AND_AI_DECISIONS.md` (“Rate limiting / abuse prevention”); code: `ThrottlerModule` + `@Throttle` on `auth.controller.ts`. |
| System blocks rapid-fire requests | Repeat an endpoint until **429** (e.g. `POST /api/auth/forgot-password` **5**/60s, or global **120**/60s—see **`OPERATIONS_SECURITY.md`** section 4). Verify limit after [x] requests per minute:  Replace `[x]` with the limit you are testing (per-route vs global); document observed 429. |
| Export includes all historical metrics and timestamps | `GET /api/profile/export` (authorized) — includes metric history with `recordedAt`. |
| Explain tradeoffs of visualization library | `SECURITY_AND_AI_DECISIONS.md` (“Library tradeoffs (Recharts)”). |
| Dashboard placeholder while fetching | Hard-refresh dashboard; observe loading/placeholder state before data renders. |
| README: overview, setup, usage | Read `README.md`. |
| Code organized, commented, best practices | `pnpm verify`; spot-read `apps/api` and `apps/web`. |

---

## Extra testing criteria (`PROJECT_REQUIREMENTS_AND_TESTING_CRITERIA.md` → Testing → Extra)

| Criterion | How to verify |
|--------|----------------|
| Project runs entirely through Docker with one command | `pnpm compose:up` from repo root; no host `pnpm install` required for reviewers following README. Dockerfile/script; Docker only requirement, Inspect `Dockerfile` / `docker-compose.yml` + README “Docker (full stack)” section. |
| Quality of AI insights during testing | Subjective: demo `POST /api/insights/generate` / dashboard with real profile. Insights accurate, relevant, actionable. |
| Weekly/monthly summaries quality | Demo `GET /api/analytics/summaries/progress` + UI. |
| Handling AI limitations (rate limits, availability) | Demo throttling + cached recommendations when AI is unavailable (see mandatory table: those two criteria). |
| Additional tech / security / features beyond core | README “Implemented features” / bonus flags. |

---

## Suggested live demo flow (practical order; may differ from the mandatory table order)

### 1) Bring up stack

- `pnpm compose:up`
- Web `http://localhost:8080`, API docs `http://localhost:3000/docs`, Mailpit `http://localhost:8025`

### 2) Prepare demo account

- `cd apps/api && pnpm prisma:migrate` if needed  
- `pnpm demo:seed`  
- Sign in: `demo@numbers.local` / `DemoPassword123!`  
- In Swagger: **Authorize** with `accessToken` from `POST /api/auth/login`

### 3) Core account + security (Review Lab step 1)

- Register / login; refresh + `POST /api/auth/logout-all`  
- OAuth: `GET /api/auth/google`, `GET /api/auth/github`  
- Hardening: OAuth state, refresh cookie + `GET /api/auth/csrf` + `x-csrf-token`, optional `AUTH_REFRESH_COOKIE_ONLY=true`

### 4) Health profile + analytics (step 4)

- `GET/PATCH /api/profile`, consents, `GET /api/analytics/summary`  
- `GET /api/analytics/series/weight`, `GET /api/analytics/series/wellness`, `GET /api/analytics/series/activity`, `GET /api/analytics/summaries/progress`  
- `GET/POST/PATCH/DELETE /api/profile/metrics`  
- **Weight & activity tab:** `GET/POST/PATCH/DELETE /api/profile/activities`, history filters, edit flows (see `TEST_MATRIX.md` §5–6)

### 5) AI insights (step 5)

- `POST /api/insights/generate`, `GET /api/insights`  
- Fallback when AI unavailable (see mandatory table: cached recommendations + UI when AI disabled)

### 6) Privacy, export, deletion (step 6)

- `GET/PATCH /api/profile/privacy`, `GET/POST /api/profile/consents`  
- `GET /api/profile/export`, `GET /api/profile/export/events`  
- Deletion: `GET/POST /api/profile/deletion-request`, cancel, purge admin endpoint

### 7) Code quality

- `pnpm verify`
