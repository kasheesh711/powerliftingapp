# Migration Signoff Checklist

Date: 2026-02-24

## Daily checkpoints
- [ ] Midday checkpoint completed (target 1:00 PM local)
- [ ] End-of-day checkpoint completed (target 5:00 PM local)

## MVP sprint dates
- [ ] 2026-02-26 checkpoint completed
- [ ] 2026-02-27 checkpoint completed
- [ ] 2026-02-28 checkpoint completed
- [ ] 2026-03-01 checkpoint completed
- [ ] 2026-03-02 checkpoint completed
- [ ] 2026-03-03 checkpoint completed
- [ ] 2026-03-04 checkpoint completed

## Contract safety
- [ ] No unapproved changes to `IDataStore` signatures
- [ ] No unapproved changes to frozen HTTP routes
- [ ] Any contract change includes migration notes and owner approval

## Parity evidence
- [ ] Golden fixture comparison reviewed for target blocks
- [ ] Update conflict behavior verified (`status: conflict`)
- [ ] `actualLoad`/`rpe` write allowlist enforced

## Security and auth
- [ ] Token vault encryption key configured in runtime
- [ ] Refresh-token retention behavior validated when refresh response omits token
- [ ] Picker-token route guarded by authenticated user context
- [ ] No logs/telemetry include access or refresh tokens

## CI gates
- [ ] Lint
- [ ] Typecheck
- [ ] Unit/Integration tests
- [ ] Build
- [ ] Parity command

## Demo gate
- [ ] Load/edit/save row flow demonstrated end-to-end
- [ ] Save-all flow demonstrated end-to-end
- [ ] Conflict modal behavior explained and validated
- [ ] Deployed environment URL recorded
- [ ] Demo release commit hash recorded
