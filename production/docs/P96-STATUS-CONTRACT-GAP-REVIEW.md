# PACKTOOK P96 — Original Status Handler API Contract Review

## Material findings from source, NOT just Metadata
Inspected the actual `production/functions/index.js` in the P95
review chain and the unregistered P81 / P75 isolated candidates.
This is a local **repository** inspection; original deployed Staging
source byte-for-byte parity and effective runtime policy remain unproven.

`usageStatus` original:
- invokes `ensureAccount(id)` and gets the existing account,
- derives current billing period, `pendingReservations(a)`,
  `creditAvailable(a)`, `walletEnabled(a)`,
  `subscriptionState(a)` and additional subscription/wallet fields;
- P81 delegates results to an externally injected
  `usageResponse(snap.data())`; its example tests use identity pass-through.
- Therefore **usageStatus response parity is NOT_VERIFIED** and the P81
  candidate is not a drop-in replacement of the original public API.

`recordingStatus` original:
- authenticates through the current guardedCall/uid helpers and
  accesses `ownerRef(id).collection("recordings")`;
- P75 isolated implementation accesses
  `db.collection("accounts").doc(uid).collection("recordings")`
  directly after a different staging authorization gate;
- The two address paths may be identical for this repository
  implementation, but the equivalence is NOT proven for the running
  Staging code. The isolated guard also introduces additional
  Staging pilot requirements compared with the original handler.

The original repo Firebase config places the `functions` folder in
the `beta` codebase alongside `reserveCredit`,
`finalizeCredit` and `recoverStaleVideoReservation`.
The three credit handler source fingerprints are recorded in CI for
local comparison only. No source file with credit handlers is changed
and none is registered/deployed by P96.

## P96 implemented controls

- Fail-closed audit against actual original and candidate source.
- Positive checks of current status contract construction.
- Negative mutation tests for missing credit export,
  changed status semantics, missing App Check literal, unexpected
  candidate registration, mis-scoped Firebase codebase and missing
  owner account path.
- Re-run P81 dependency-injected Staging Auth negative tests.
- NO source patch is integrated into live `functions/index.js`.
- NO direct claim of source-to-deployed equivalence, API parity,
  known-good rollback, safe deploy selector or backend App Check.

## Next technical work, before any Cloud change

1. Build an isolated read-only **reference implementation** for the
   original usageStatus output with realistic Free, Wallet, expired,
   reserved, and subscription account fixtures. Compare it to a P81
   candidate adapter in CI; fail on field set or value drift.
2. Prove the original owner account path and candidate account
   path are equivalent in a strictly isolated emulator.
3. Test App Check and Auth as **negative cases**, not merely
   presence of `enforceAppCheck:true` source literals.
4. Establish a status-only deployment change boundary that cannot
   affect the other three credit functions; prove against the actual
   CLI version before any approved staging deployment.

P80 Staging guard drift remains UNREMEDIATED and the P81 patch
remains UNREGISTERED. No Cloud calls, IAM actions, live data tests,
deployments, merges or traffic changes. NO_GO_RELEASE.
