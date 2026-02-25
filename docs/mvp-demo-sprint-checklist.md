# MVP Demo Sprint Checklist (Feb 26, 2026 to Mar 4, 2026)

## Scope Lock
- [ ] Must-win flow only: load block -> edit `actualLoad`/`rpe` -> save -> conflict resolution
- [ ] Excel backend remains default (`DATA_BACKEND=excel`) for demo-critical execution
- [ ] No changes to frozen contracts (`IDataStore`, route surface, update field allowlist)
- [ ] Out-of-scope requests are deferred to post-demo backlog

## Day-by-Day Execution
| Day | Date | Theme | Owner | Status | Evidence |
|---|---|---|---|---|---|
| Day 1 | 2026-02-26 | Control plane setup |  | Not Started | git baseline + command logs |
| Day 2 | 2026-02-27 | Demo UX hardening |  | Not Started | PR + walkthrough clip |
| Day 3 | 2026-02-28 | Critical test expansion |  | Not Started | test results |
| Day 4 | 2026-03-01 | Vercel deploy (Excel path) |  | Not Started | deployment URL + smoke logs |
| Day 5 | 2026-03-02 | Reliability sprint |  | Not Started | bug bash list resolved |
| Day 6 | 2026-03-03 | Dress rehearsal + contingency |  | Not Started | two successful rehearsals |
| Day 7 | 2026-03-04 | Demo release day |  | Not Started | final gate log + feedback notes |

## Daily Quality Gates
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`

## Manual Demo Flow Gate
- [ ] Fresh session loads dashboard
- [ ] Block switch updates table and metrics
- [ ] Row edit/save returns row to `Clean`
- [ ] Save-all clears dirty state for multiple rows
- [ ] Conflict modal behavior is understandable (`Dismiss`, `Reload Data`, `Overwrite Anyway`)
- [ ] Force refresh reflects persisted values

## Parallel Non-Code Tracks
### Track A: Source control and PM operations
- [ ] Repo linked to remote
- [ ] Branch naming policy enforced (`main` + short-lived branches)
- [ ] Sprint board created (`Backlog`, `In Progress`, `QA`, `Done`)
- [ ] Rehearsal bug issue path documented

### Track B: Vercel and runtime accounts
- [ ] Vercel project created and ownership confirmed
- [ ] Preview and Production environments configured
- [ ] Environment variable owners audited

### Track C: Database operations
- [ ] Managed Postgres provisioned
- [ ] Least-privilege credentials created
- [ ] Prisma generate/push run in deployment environment
- [ ] Rollback basics documented

### Track D: Google OAuth/Picker setup (non-blocking this sprint)
- [ ] Google Cloud project created
- [ ] Sheets API + Drive API enabled
- [ ] OAuth consent screen configured
- [ ] OAuth client credentials created
- [ ] Local and deployed callback URLs added
- [ ] Picker API key and app ID created
- [ ] Secrets stored in vault/password manager

### Track E: Demo ops and narrative
- [ ] 5-7 minute demo script drafted
- [ ] Scripted demo data values prepared
- [ ] 2-3 trial viewers scheduled
- [ ] Structured feedback captured

### Track F: Documentation hygiene
- [ ] `docs/signoff-checklist.md` updated daily
- [ ] Demo runbook updated with current URL/commit
- [ ] Final demo commit hash captured before demo

