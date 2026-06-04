# Admin tab — moderation and account purge

Role-gated dashboard tab for operators. Not a separate login; access is determined by the signed-in user’s email in server env.

## Who sees the tab

| Env variable | Role | UI |
|--------------|------|-----|
| `RECIPE_MODERATOR_EMAILS` | Recipe moderator (comma-separated emails) | Approve/reject pending recipe reviews with text |
| `PURGE_ADMIN_EMAILS` | Purge admin | Pending deletion queue + **Purge due accounts** |

`GET /api/admin/status` returns `{ showAdminTab, isModerator, isPurgeAdmin }`. Demo default moderator: `demo@numbers.local` (see `RECIPE_MODERATOR_EMAILS` in `docker-compose.yml`).

## Account deletion purge

1. User requests deletion under **Profile** → `DeletionRequest` with `scheduledFor` = now + `DELETE_RETENTION_DAYS` (default 30).
2. Purge is **not automated** (no cron). Due accounts are removed only when:
   - **Admin tab:** purge admin taps **Purge due accounts** → `POST /api/admin/purge-due` (JWT + email allowlist), or
   - **Ops/script:** `POST /api/profile/deletion-request/purge-due` with body `{ "secret": "<PURGE_ADMIN_SECRET>" }`.

The purge secret is never sent to the browser.

## API

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/admin/status` | JWT |
| `GET` | `/admin/deletion-queue` | JWT + `PURGE_ADMIN_EMAILS` |
| `POST` | `/admin/purge-due` | JWT + `PURGE_ADMIN_EMAILS` |

Recipe moderation uses existing `/api/recipe-feedback/pending` and `PATCH .../moderate` (moderator email).

## Web

- **Admin** tab appears next to Profile when `showAdminTab` is true.
- Moderators see the queue on Admin; Nutrition **Community recipes** links to Admin instead of duplicating the queue.
- Deletion queue uses a **card layout on narrow screens** (≤640px); table on wider viewports.
- Wingman chat FAB is rendered outside the dashboard `.page` container so wide admin content does not clip it.

## Configure (repo root `.env`)

```env
RECIPE_MODERATOR_EMAILS=demo@numbers.local,moderator@example.com
PURGE_ADMIN_EMAILS=ops@example.com
PURGE_ADMIN_SECRET=replace_with_long_random_secret
DELETE_RETENTION_DAYS=30
```

Restart/rebuild the API after env changes.
