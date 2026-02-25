# PM Operating Model (MVP Sprint)

Date: 2026-02-25

## Branch Strategy
- Long-lived: `main`
- Short-lived: `codex/<work-item>`
- One focused change set per branch.

## Pull Request Rules
1. Keep PR scope tied to one sprint checklist item.
2. Include evidence for:
   - test/quality commands
   - manual validation notes for changed behavior
3. Mark whether change touches:
   - API/contracts
   - data model
   - auth/token
   - UI behavior

## Sprint Board Structure
Create a board with columns:
1. `Backlog`
2. `In Progress`
3. `QA`
4. `Done`

## Merge Cadence
- Prefer two merge windows daily:
  - 1:00 PM local
  - 5:00 PM local
- Emergency hotfixes can merge outside windows with explicit note.

## Release Evidence
Each release candidate should record:
- commit hash
- quality gate run results
- deployed URL
- demo dry-run outcome

