# PACKTOOK P67 — Original Handler Execution in Local Firebase Emulator

**Status: DRAFT REVIEW ONLY; emulator integration, not a deploy-ready patch.**

## Scope and evidence

P67 executes the original, unchanged `production/functions/index.js` through
a Node.js VM sandbox with controlled substitutes for `firebase-functions`
callable registration and Firebase Admin SDK initialization. The five *real*
exported callback bodies execute transactions against the **Auth + Firestore
emulators** for the isolated `demo-packtook-p67` project.

- `reserveCredit`: device gate, balance debit, duplicate operation/barcode,
  idempotency, ownership
- `finalizeCredit`: file metadata gate, success, failure refund,
  idempotency and no retroactive success-to-failure transition
- `recordingStatus`: owner-specific records and not-found for another user
- `recoverStaleVideoReservation`: 30-minute cutoff, explicit confirmation,
  refund exactly once and finalized reservation rejection
- `usageStatus`: wallet balances, counters, unknown plan fail-closed

## Critical limitations

- **Mock transport:** The onCall registration boundary is intercepted. This
  does not prove Firebase callable transport verifies Auth ID tokens, revocation,
  App Check or function IAM.
- **Test-only Beta shim:** The Production source `uid(req)` is project-bound.
  The sandbox injects the fixed Production Beta environment value and a synthetic
  Beta claim solely so existing callbacks can execute against the separate
  **demo-packtook-p67** emulator database. The real process/CI does not receive
  that Production variable. This cannot validate real Staging Authorization,
  P65 lease integration or approved Staging deployment compatibility.
- Firestore emulators and an Admin SDK do not prove client rules behavior.
- No actual Staging or Production services are called. Public signup,
  payment and device provisioning are not invoked.
- Unmodified real handler execution is more substantial than P66's synthetic
  transactions, but the exact deployed Staging source and runtime behavior are
  **still not proven equivalent**.

P67 does not modify `production/functions/index.js`, does not register
staging callables, and does not authorize any deployment.

## Run in CI

GitHub Actions workflow `.github/workflows/p67-real-handler-emulator.yml`
runs with Node 22, Java 21, pinned Firebase CLI and a demo project only.
Use that isolated runner instead of a credentialed production Cloud Shell.

## Release gates

- P63 existing Staging Callable Guard drift: STILL OPEN
- P65 Staging Auth and Lease integration into live runtime: NOT IMPLEMENTED
- Backend App Check: NOT PROVEN
- Production deploy or Public pilot: NO_GO_RELEASE
