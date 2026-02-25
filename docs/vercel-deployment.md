# Vercel Deployment Guide (Excel Demo Path)

Date: 2026-02-25

## Purpose
Deploy the Next.js web app to Vercel for MVP demo usage on the Excel backend.

## Required Environment Variables
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `TOKEN_ENCRYPTION_KEY_BASE64`
- `EXCEL_PROXY_PATH`
- `WORKBOOK_PATH`
- `DATA_BACKEND=excel`
- `ALLOW_LOCAL_DEV_AUTH_BYPASS=false`

Optional for next cycle:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_PICKER_API_KEY`
- `GOOGLE_PICKER_APP_ID`

## One-Time Setup
1. Create/import the project in Vercel.
2. Link repository branch strategy:
   - `main` -> Production
   - feature branches -> Preview
3. Add environment variables for both Preview and Production.
4. Confirm team permissions:
   - who can edit environment variables
   - who can promote to production

## Deployment Workflow
### Preview
1. Push feature branch.
2. Confirm Vercel preview build completes.
3. Run smoke checks against preview URL.

### Production
1. Merge approved branch into `main`.
2. Confirm production deployment completes.
3. Run smoke checks against production URL.

## Smoke Checks
Replace `$BASE_URL` and `$BLOCK_NAME`:

```bash
curl -sf "$BASE_URL/api/dashboard/initial" >/dev/null
curl -sf "$BASE_URL/api/dashboard/blocks" >/dev/null
curl -sf "$BASE_URL/api/dashboard/block/$BLOCK_NAME" >/dev/null
```

## Prisma Checklist (if backing database changes)
Run in CI/CD environment before deployment:

```bash
npm run prisma:generate --workspace @powerlifting/web
npm run prisma:push --workspace @powerlifting/web
```

## Rollback Procedure
1. Redeploy previous known-good Vercel deployment.
2. Confirm `DATA_BACKEND=excel` remains set.
3. Re-run smoke checks.
4. Record rollback reason in migration notes.

