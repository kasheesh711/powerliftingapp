# Source Control Conventions

Date: 2026-02-25

## Branch Naming
- Use `codex/<lane>-<short-task>`.
- Examples:
  - `codex/lane0-board-setup`
  - `codex/lane5-picker-auth-fix`

## PR Title Naming
- Use `[lane-x] <short action>`.
- Examples:
  - `[lane-0] add rehearsal bug template`
  - `[lane-4] enforce update allowlist validation`

## Required PR Checklist
- PR body must use the template in `.github/PULL_REQUEST_TEMPLATE.md`.
- Fill in all applicable items:
  - Scope
  - Validation commands and results
  - Security checklist

## Required Main Branch Gates
- Pull request required before merge.
- Required checks:
  - `ci-excel`
  - `ci-e2e`
- Force pushes blocked.
- Deletions blocked.

## Rehearsal Bug Intake
- Use `.github/ISSUE_TEMPLATE/rehearsal-bug.yml` for rehearsal defects.
- Use `.github/ISSUE_TEMPLATE/bug-report.yml` for non-rehearsal defects.
