# PACKTOOK P76 — Synthetic End-to-End Payment and Credit Journey

Status: TEST CANDIDATE ONLY. No deployment or live provider calls.

The P76 test starts local Firebase Auth and Firestore emulators against the
fake `demo-packtook-p69` project, provisions a synthetic invited user,
and exercises an **isolated fake invoice/confirmation service** alongside
the P70 Credit, Finalization and Recovery callback implementations.

## Covered
- Missing pre-provisioning blocks invoice creation. The test creates a
  synthetic verified invited user and minimal account records.
- A pending test invoice never grants credits; false payment confirmation,
  amount mismatch or non-test-only provider configuration is rejected.
- Simultaneous verified **test-only** callbacks for the same invoice grant
  purchased credits once, not twice.
- Credit reserve, completed packing metadata finalization, failed video
  refund and stale reservation recovery are transacted by the P70 credit
  implementation in the local Firestore emulator.
- Revoked lease blocks subsequent reservations without mutating a wallet.

## Out of scope — BLOCKING real launch
- **Not a real Omise request, signed provider webhook, payment capture,
  refund or reconciliation.** A synthetic paid result means nothing about
  the real payment provider or settlement.
- **Not an actual camera or binary video recording.** The file fields are
  generated metadata only; media storage, black-screen/duration problems,
  browser permissions and device transfer are not tested.
- **Not the actual Firebase Callable onCall transport** with verified
  ID tokens/App Check or deployed IAM/Cloud Functions.
- Account provisioning here is a test fixture; cannot auto-enroll a real
  Staging/Production customer or confer entitlements.
- Historic P63 Staging guard drift and P74 IAM/App Check blockers remain open.

No CI credentials, no Google Cloud access, no Production code changes,
no service account edits, no merge or deploy.

Next planned phase can prepare independent Commercial Operations/Recovery
Readiness evidence and a Cloud Shell **read-only** inspection script
for the owner to run when actual Cloud access becomes necessary.
