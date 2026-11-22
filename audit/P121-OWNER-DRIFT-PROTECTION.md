# P121 — Guard staging owner functions and preserve drift evidence

## Verified from operator-supplied read-only P120 output
- `packtook-staging` / `asia-southeast1`: 27 Cloud Functions versus 23 exported functions in reviewed source.
- Exact Cloud-only set of four: `ownerGetCustomerAdjustmentHistory`, `ownerGetCustomerManageState`, `ownerGrantVideoCredits`, `ownerUpdateCustomerExpiry`.
- `recordingStatus` and `usageStatus` are ACTIVE, Node.js 22, with unset Firebase codebase labels. Service revisions exist, but neither exact source commit nor deployment ownership has been verified.
- Build-source descriptor hashes are hashes of serialized metadata, **not hashes of source code or proof of Git revision parity**.

## Critical decision
**BLOCK STAGING DEPLOY** from this source branch. Protect four Owner Functions. Do not assume a scoped CLI deploy can never alter or delete drifted functions; require a full scoped deploy dry run/ownership verification and a rollback plan before any deployment. Never run unscoped `firebase deploy`.

## Automated offline gate
`node audit/p121-owner-drift-gate.cjs`

Green CI means the `BLOCK_STAGING_DEPLOY_FOUR_OWNER_FUNCTIONS_NOT_IN_SOURCE` gate activated, not Cloud runtime readiness.

## Next cloud evidence
Collect read-only metadata of these four owner functions, deployed status revision names for two Status Functions, and Firebase codebase/revision ownership. Do **not** download source, print secret/env values, use production permissions, or modify cloud resources. Project needs an authorized Google Cloud connector or an operator-run Cloud Shell to collect it.

All existing P117 NO_GO requirements remain in force, including site key and App Check E2E.
