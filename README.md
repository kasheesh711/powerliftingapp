# Powerlifting Dashboard Migration Monorepo

This repository now contains both:
- legacy Google Apps Script dashboard (`/app`) and clasp deployment wiring, and
- the Next.js migration target (`/apps/web`) with shared domain/data packages.

## Workspace Layout
- `apps/web`: Next.js App Router API + UI
- `packages/domain`: contracts, DTOs, stats logic
- `packages/data`: parsers, datastores, token vault, parity harness
- `packages/ui`: reusable UI components
- `packages/config`: shared lint/format/ts/test config
- `app`: legacy Apps Script implementation

## Quick Start (Migration Runtime)
1. Install dependencies: `npm install`
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and set values.
   - Set `DATA_BACKEND` to `excel` (local parity) or `google` (live Sheets).
   - Configure `GOOGLE_PICKER_API_KEY` and `GOOGLE_PICKER_APP_ID` to enable Drive Picker.
   - Keep `ALLOW_LOCAL_DEV_AUTH_BYPASS=true` for local development without mandatory sign-in.
3. Start Postgres: `docker compose up -d`
4. Generate Prisma client: `npm --workspace @powerlifting/web exec prisma generate`
5. Start dev stack: `npm run dev`

## Key Commands
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run parity`
- `npm run test:e2e`
- `npm run deploy:web:preview`
- `npm run deploy:web:production`

## MVP Demo Execution Docs
- Sprint tracker: [`docs/mvp-demo-sprint-checklist.md`](docs/mvp-demo-sprint-checklist.md)
- Demo runbook: [`docs/demo-runbook.md`](docs/demo-runbook.md)
- Vercel deploy guide: [`docs/vercel-deployment.md`](docs/vercel-deployment.md)
- Google OAuth/Picker setup: [`docs/google-oauth-picker-setup.md`](docs/google-oauth-picker-setup.md)
- Feedback template: [`docs/demo-feedback-template.md`](docs/demo-feedback-template.md)
- PM operating model: [`docs/pm-operating-model.md`](docs/pm-operating-model.md)

## Legacy Apps Script Deployment
- `npm run gas:watch`
- `npm run gas:deploy`

## Feature Freeze Policy
Legacy Apps Script is feature-frozen during migration. Any approved P0 drift must be logged in [`docs/migration-drift.md`](docs/migration-drift.md).
