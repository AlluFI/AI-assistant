# Operations and Security Verification

This file provides review-ready verification steps for security and reliability criteria.

## 1) Encryption in Transit

- **Local Docker demo**:
  - traffic is local-network development traffic
  - for production, terminate TLS at ingress/reverse proxy (Nginx/Traefik/cloud LB)
- **Review evidence**:
  - show production config with HTTPS enabled
  - verify secure cookies (`COOKIE_SECURE=true`) in non-local environments
  - verify OAuth callback/base URL uses `https://`.

## 2) Encryption at Rest

- **Application scope**:
  - database-backed persistence with access controls and least-privilege DB user.
- **Infrastructure scope (required for full at-rest assurance)**:
  - encrypted disk/volume for PostgreSQL data directory
  - encrypted backups/snapshots
  - documented key management policy (cloud KMS or platform equivalent)
- **Review evidence checklist**:
  - [ ] DB volume encryption enabled
  - [ ] backup encryption enabled
  - [ ] secrets not committed to VCS
  - [ ] environment secrets managed outside codebase for production.

## 3) API Reliability and Degradation

- AI insights degrade gracefully:
  - if AI is blocked/missing/fails, system stores fallback or cached recommendations.
- Clear user communication:
  - UI reports fallback mode and error messages without full page reload.

## 4) Rate Limiting and Abuse Controls

- Throttling is enabled in API module.
- Endpoint-level limits apply to auth-sensitive routes.
- Verification:
  - send burst requests in 1 minute window
  - confirm throttled responses are returned.

## 5) Data Governance and Consent

- Data collection consent exists and can be explicitly granted/revoked.
- Profile and metric writes require latest granted `data_collection` consent.
- AI processing can be disabled via privacy settings (`allowAiProcessing`).

## 6) Reproducible Review Runbook

1. Start stack with one command:
   - `pnpm compose:up`
2. Run migrations in API container:
   - `docker compose exec api sh -lc "cd /repo/apps/api && pnpm prisma:migrate"`
3. Seed demo user:
   - `docker compose exec api sh -lc "cd /repo/apps/api && pnpm demo:seed"`
4. Use:
   - Web: `http://localhost:8080`
   - API docs: `http://localhost:3000/docs`
   - Mailpit: `http://localhost:8025`

## 7) Mandatory Verification Pointers

- Duplicate metric timestamps:
  - verify same `recordedAt` for same user is rejected.
- Goal reference line:
  - verify target weight line is visible in weight chart.
- Priority rendering:
  - verify insight recommendations show high/medium/low badges and expandable details.
- Weekly/monthly summaries:
  - verify progress cards show weight and wellness deltas.
