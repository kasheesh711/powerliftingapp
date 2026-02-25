# Migration Drift Log

Date established: 2026-02-24

## Freeze policy
- Legacy Apps Script dashboard is under hard feature freeze.
- Only P0 bug fixes are allowed in legacy code during migration.
- Every approved legacy change must include:
  - reason,
  - parity impact,
  - rollback path,
  - owner approval.

## Approval rule
- Required approvals: Lane 0 owner + affected lane owner.
- Contract-affecting legacy changes are blocked unless signoff checklist is updated in the same PR.

## Drift entries
- 2026-02-24: Freeze policy established. No approved drift entries yet.

## Entry template
- Date:
- File(s):
- Severity:
- Summary:
- Why unavoidable:
- Parity impact:
- Validation evidence:
- Approved by:
