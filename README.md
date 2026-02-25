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

## Legacy Apps Script Deployment
- `npm run gas:watch`
- `npm run gas:deploy`

## Feature Freeze Policy
Legacy Apps Script is feature-frozen during migration. Any approved P0 drift must be logged in [`docs/migration-drift.md`](docs/migration-drift.md).

## Delivery Governance
- Source control conventions: [`docs/source-control-conventions.md`](docs/source-control-conventions.md)
- PR checklist template: [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)
- Rehearsal bug intake template: [`.github/ISSUE_TEMPLATE/rehearsal-bug.yml`](.github/ISSUE_TEMPLATE/rehearsal-bug.yml)

## Demo Workflow
- Google OAuth + Picker setup: [`docs/google-oauth-picker-setup.md`](docs/google-oauth-picker-setup.md)
- Demo rehearsal runbook: [`docs/demo-runbook.md`](docs/demo-runbook.md)
- Demo feedback template: [`docs/demo-feedback-template.md`](docs/demo-feedback-template.md)
