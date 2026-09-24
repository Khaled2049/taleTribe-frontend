## Summary

<!-- What changed, and why? -->

## Validation

- [ ] Tests added or updated where appropriate
- [ ] Relevant local checks pass
- [ ] I manually verified the affected flow

## Risk and rollout

- [ ] No migration, deploy, security, or compatibility impact
- [ ] Impact/risk described below

## Checklist

- [ ] PR is focused and ready for review
- [ ] Documentation/configuration was updated if needed
- [ ] No secrets or personal data were added

## Service checks

- [ ] `yarn lint`, `yarn test`, and `yarn build` pass
- [ ] `cd functions && npm run build && npm test` passes if Functions changed
- [ ] Firebase rules and secret declarations reviewed if affected
