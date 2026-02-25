You are a senior frontend + TypeScript engineer working in `/Users/kevinhsieh/Desktop/Powerlifting App`.

Goal:
Redesign the dashboard UX/UI for a deep black obsidian visual style with minimal color accents, reduce KPI card clutter, improve chart clarity, and reorganize workout rows by week then day. Add block-on-block progress analytics and meet-date projection (default meet date: 2026-11-07).

Hard requirements:
1. Replace the 11 KPI cards with one compact “Performance Snapshot” panel.
2. Add meet projection controls: meet date + current week/day override (manual with inference fallback).
3. Add block-on-block comparison visualization.
4. Add growth-rate based projection to meet date using weighted model:
   - overall slope (timeline regression)
   - recent slope (last 2 blocks average)
   - blended slope = 0.6 recent + 0.4 overall
5. Rebuild editable table ordering to week-grouped, day-ordered sections.
6. Keep write behavior unchanged (`actualLoad`, `rpe` only).
7. Keep dark obsidian style with minimal accents.

Primary files:
- apps/web/src/components/dashboard/dashboard-view.tsx
- apps/web/src/components/dashboard/view-models.ts
- apps/web/src/components/dashboard/types.ts
- apps/web/src/components/dashboard/dashboard-view.module.css
- apps/web/src/components/dashboard/charts/charts.module.css
- apps/web/src/components/dashboard/charts/overall-primary-progress-chart.tsx
- apps/web/src/components/dashboard/charts/block-primary-progress-chart.tsx
- replace apps/web/src/components/dashboard/charts/growth-delta-chart.tsx
- add new chart components for block comparison and meet projection

Table ordering spec:
weekIndex asc -> dayIndex asc -> dayRowIndex asc -> rowIndex asc -> exercise asc

Projection spec:
- valid load > 0
- weeksRemaining = ceil((meetDate - today)/7d), floor at 0
- projectedLift = max(0, currentLift + blendedRate * weeksRemaining)
- projectedTotal = squat + bench + deadlift

Testing:
- Update/add vitest tests for analytics builders and week/day grouping.
- Update Playwright dashboard e2e to assert:
  - performance snapshot visible
  - new chart panels visible
  - week/day dividers present
  - legend toggle still works
- Ensure lint, typecheck, tests pass.

Output:
- concise change summary
- list of modified files
- test results
- any assumptions made
