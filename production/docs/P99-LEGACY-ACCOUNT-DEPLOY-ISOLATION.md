# PACKTOOK P99 — Legacy Account Compatibility and Deployment Isolation

## Verified from checked-out original source
The original `production/functions/index.js` uses `ensureAccount(id)`
inside `usageStatus`. On a missing account, that helper fetches the
live Firebase Auth user and can auto-provision a Free account ONLY when
the live user is not disabled and has `packtookProductionBeta===true`.
A non-Beta missing account fails with `failed-precondition`. Existing
accounts return without an Auth recheck. A create conflict with code
`6` or `already-exists` is treated as idempotent, while unexpected
Firestore errors propagate. P99 executes the **actual original helper**
under hermetic dependency injection, not a reimplemented expected
logic.

## Intentional behavior difference and security tradeoff
P98 composes P81/P65 *Staging-only invited pilot* authorization and
P97 read-only response projection. It DOES NOT auto-create Free
accounts, even if an eligible legacy Beta user is missing an account.
This intentional no-write behavior avoids silently provisioning credits
while reviewing a security patch, but means P98 is **not API/eligibility
equivalent** to the checked-out original for those users.

Do NOT solve this difference by enabling unrestricted automatic Free
credit grants in the P98 status endpoint. First choose and independently
review a one-time account migration/activation path, with owner consent,
duplicate-safe quotas, legal/policy check and staged rollout constraints.
No account writes were authorized or made by P99.

## Deployment isolation findings
The checked-out Firebase configuration has a `beta` codebase whose
`functions` directory contains `recordingStatus`, `usageStatus`
and the three credit-critical functions `reserveCredit`,
`finalizeCredit`, `recoverStaleVideoReservation`.

A *potential* exact-function Firebase CLI filter is not proof that the
deployed Gen2 Cloud Run Service ownership, source mappings or rollback
semantics match the candidate. P99 deliberately does not compose or
run any deploy command. Status-only selector is `NOT_TESTED`;
codebase mapping `NOT_VERIFIED`; safe deploy isolation `NOT_VERIFIED`.

Before any approved Staging deploy:
1. Establish source-to-deployed and function-to-codebase mappings.
2. Use an isolated offline CLI-version-locked dry-run or emulator
   verification of exact export targets; confirm all credit functions
   are excluded and no deletion of untargeted functions is requested.
3. Validate actual App Check and callable Auth negative cases.
4. Resolve status caller eligibility and missing-account behavior.
5. Establish source-backed known-good restore and operator approval.
6. Only then consider a tightly scoped change in Staging.

## What P99 tests
Hermetic tests execute original `ensureAccount` cases: existing,
legacy Beta missing, regular missing, disabled Beta, concurrent
idempotent create conflict, unexpected Firestore failure, and
alternate mapped account id; it explicitly detects the mismatch
with P98. The P98/P97/P96 offline regressions run again.

No deployed security fix is claimed. No Cloud Shell command required;
no Cloud calls, Cloud writes, IAM changes, real-user access, deploy,
traffic changes or merges. P80 Guard Drift remains UNREMEDIATED.
`RELEASE=NO_GO_RELEASE`.
