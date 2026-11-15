# PACKTOOK V5 — Full Credit Lifecycle & Recovery Emulator

## Scope
Stacked on successful V4 Paid Business Charge audit in **packtook-staging**. The V4 real Test charge was fully read-only and already had one matching paid credit grant. Never reapply or recreate that charge.

This PR tests the real Firebase Functions handlers from `functions/index.js` against the actual Firestore Emulator transaction engine using **synthetic** account IDs and device IDs in `demo-packtook-v5-lifecycle`, not the real Staging or Production. It never contacts Omise or creates actual charges. It seeds a mock active Business subscription wallet, then invokes exported `reserveCredit`, `finalizeCredit`, and `recoverStaleVideoReservation` callbacks directly.

## Scenarios
- Start recording: reserve one credit and increase reservation count.
- Successful finalization: consume credit once and write recording file metadata; repeated finalize idempotent.
- Failed finalization: refund one credit exactly once; repeated finalize idempotent.
- Repeated reserve operation ID: no duplicate debit.
- Duplicate barcode after a completed recording: denied unless owner approval (approval flow not covered here).
- Zero credits: deny booking.
- Unknown operation finalization: deny.
- Manual stale recovery: explicit `confirmNoVideo` and age >=30 minutes; refund exactly once; prevent recovery of completed video.
- Racing success/failure finalize: one outcome wins, no double refund or credit loss.
- Concurrent recovery: exactly one audit trail and refund.
- Corrupted reservation count: fail closed without changing wallet.

## CI
```bash
export GCLOUD_PROJECT=demo-packtook-v5-lifecycle
export NODE_PATH="$PWD/functions/node_modules"
firebase emulators:exec --only firestore --project demo-packtook-v5-lifecycle \
  'node --test production/tests/omise-v5-credit-lifecycle-recovery-emulator.test.cjs'
```
Requires Node 22, Java 21, firebase-tools and npm dependencies in `functions`. GitHub CI runs on a disposable Ubuntu runner. FIRESTORE_EMULATOR_HOST must be loopback. Cloud credentials, real Omise key and non-demo project explicitly prohibited.

## What V5 does NOT prove
- Actual camera recording, filesystem integrity, upload or user interface end-to-end.
- Failed recorder recovery automatically detecting whether valid video exists: the handler intentionally requires an operator to confirm no usable video and no active device.
- Deploy to `packtook-staging`, deployed Cloud Functions IAM, real customer wallet, real Staging write path.
- Actual payment callback workflow in Staging; V4 separately confirmed real Omise Test charge read-only and historical audit integrity.

Maintain `NO_GO_RELEASE`, public signup closed and no Production modifications. Revisit separate Staging-only controlled test plan after owner approvals.
