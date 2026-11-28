# PACKTOOK Fast Track — Atomic Credit Transactions V1 (non-deployed candidate)

Date: 2026-11-28. Branch: `feature/fast-track-operator-workflow-candidate`.

## New source artifacts
- `functions/tenant-credit-atomic-v1.cjs`: injection-based `reserve()` and `finalize()` using **one Firestore `db.runTransaction` per action**. Uses account owner scope, active verified operator membership read inside each transaction, device registration tied to operator identity, recorder identity bound in stored reservation, byte/file validation, barcode lock, wallet/monthly credit counter and one-time request+approval consumption.
- `audit/fast-track-full-public/tenant-credit-atomic-v1-mock.cjs`: deterministic in-memory transaction model. Exercises reserve, retry with same operation, reserved barcode denial, invalid member email/revocation, successful finalize, idempotent success, cross-actor denial, failed recording refund, idempotent failure, depleted wallet, valid approval once, approval replay denial, failed override restores completed lock, consumed approval denial, legacy monthly counter accounting, and cross-tenant mismatch. 19 explicit assertions. **Not yet owner-run.**

## Safeguards
- Reads account, recording, barcode lock, membership, optional approval and linked request *before first write* in reserve.
- Reads account, recording, membership, barcode lock *before first write* in finalize.
- Binds `recordedBy` and `accountId`; finalization requires same authenticated actor, current membership and matching operation ID.
- Charges one wallet credit on first reservation, not idempotent replay; returns it only on first failed finalization.
- A completed barcode reuse requires live, same-tenant, same-operator approval and linked request; consumes both with reservation within the same transaction.
- Existing standalone `authorizeDuplicate` (owner manual approval) is NOT compatible with this operator-scoped approval path; it must be reviewed when unified workflow is designed.

## Important blockers (do not deploy)
1. **NOT imported/exported by `functions/index.js`**; existing production/staging functions remain unchanged. This file is a **candidate**, not a function replacement.
2. The `db.runTransaction` behavior has only an in-memory sequential mock, not Firestore Emulator concurrency/retry evidence. Real transaction conflicts, approval races and Firestore index/security behavior are unverified.
3. Device enrollment/ownership, status, stale-reservation recovery, operator bootstrap and historical owner-record compatibility still need a coordinated integration. Owner devices lacking `registeredBy` are accepted for owners only; operators require explicit device binding. A client must not be allowed to spoof this field.
4. The candidate's `finalize` rejects a finalization by another actor even if the original operator is revoked; owner-assisted recovery needs a distinct audited recovery flow (not bypass).
5. Review quota/account-period behavior across month boundaries, old wallet records, and exceptions before release. The candidate intentionally fails closed on invalid quota/membership/account state.
6. Ensure all existing 22 callables + 8 new operator handlers receive an explicit App Check & Auth policy in an eventual unified 30-handler release. Existing 22/22 check applies only to former candidate.
7. Emulator test must include genuinely **concurrent transactions**, not solely the in-memory sequential mock.

## Test commands (detached feature worktree)
```bash
node --check functions/tenant-credit-atomic-v1.cjs
node --check audit/fast-track-full-public/tenant-credit-atomic-v1-mock.cjs
node audit/fast-track-full-public/tenant-credit-atomic-v1-mock.cjs
```

Expected `PACKTOOK_ATOMIC_CREDIT_MOCK_CASES=19/19_PASS`; exit 0 means **mock-only** PASS. The user has not yet executed this new test. No cloud writes or deploy. `FULL_PUBLIC=NO_GO`.
