## Summary
-

## Scope
- [ ] API changes
- [ ] Data model / Prisma changes
- [ ] Auth/OAuth/token handling
- [ ] UI behavior changes
- [ ] Docs / ADR updates

## Validation
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] `npm run parity` (if applicable)
- [ ] Manual check for load/edit/save/conflict flow (if UI/data path touched)

## MVP Demo Checklist
- [ ] No change to frozen contract surface (`IDataStore`, routes, update allowlist)
- [ ] Excel runtime path remains stable
- [ ] User-facing error/success states are clear for this change
- [ ] Deployment or runbook docs updated (if operational behavior changed)

## Security Checklist
- [ ] No refresh/access tokens logged
- [ ] Refresh token preservation logic unchanged or improved
- [ ] Token encryption at rest maintained
- [ ] OAuth scopes still least-privilege

## Notes
-
