# PACKTOOK P70 — Five Callable Staging Runtime Candidate

**Status: REVIEW ONLY. No deploy, no merge, production NO_GO_RELEASE.**

## Implementation

Five new-name Functions v2 callable exports in an isolated source package:
- p69UsageStatus and p69RecordingStatus: P69 read-only operations
- p70ReserveCredit: checks device, code, quotas, duplicate operation/barcode,
  audit and wallet/legacy reservation updates
- p70FinalizeCredit: success commit or single failed credit refund, with
  transaction idempotency and barcode-lock restoration
- p70RecoverStaleVideoReservation: explicit confirmation, 30-minute cutoff,
  one-time reserved credit refund and audit

The three new mutations enforce the P65 pilot lease again within their
Firestore transaction, in addition to the existing per-request P65 Auth
and live-user check in `protect`. The original deployed Staging Functions
are NOT touched.

## Validation design

The GitHub CI uses three local Firebase emulators against the
`demo-packtook-p69` fake project. HTTP tests must fail for anonymous,
invalid or missing App Check credentials. A separate Admin SDK unit
integration executes the genuine P70 credit implementation against local
Firestore, exercising idempotency, concurrency and credit accounting.

**This does not demonstrate a successful real callable invocation with a
cryptographically valid App Check token**. Negative response alone does not
prove rejection specifically at the App Check layer, especially if the
request would also fail P65 auth. Firebase SDK source options explicitly
contain `enforceAppCheck:true`, but Cloud backend enforcement stays
NOT_PROVEN.

## Security/compatibility review still required

- P70 credit callbacks were **rewritten** for isolated Staging, not proven
  token-for-token equivalent to production handlers. Review duplicate
  approval/request bookkeeping, Plan expiration rules, Pro unlimited,
  credit-wallet and legacy counters, month boundaries, concurrent commits,
  unavailable transaction retries and audit behavior before deployment.
- P65 lease revocation is rechecked within transaction, but Auth
  disable/claims can change between the live Auth read and transaction.
  Evaluate threat model and handling for those races.
- P69 read-only callables have no transactional lease check and must
  be assessed separately for revocation-race exposure.
- No verified end-to-end success through actual onCall/App Check transport
  on the Staging Cloud Functions backend.
- Existing `recordingStatus` and `usageStatus` remain on deployed
  Staging; P63 security drift remains open. None of these new names
  automatically replaces existing service APIs.

## Deployment manifest and rollback checklist (NOT authorization)

`production/staging-candidates/p70-deployment-manifest.json` records
`deployAllowed:false` and required approvals. In a future separately
approved Staging change:

1. Confirm active gcloud project is exactly `packtook-staging`, and confirm
   there are **no unrelated uncommitted local changes** included in artifact.
2. Require code/authorization/Payment/IAM/App Check independent security
   review, legal and owner approvals, agreed maintenance window and alerts.
3. Record Git commit, immutable build/source archive generation,
   function configuration, service account, secrets and rollback generation
   in a private change ticket. Avoid exposing secrets or raw source archives
   in chat or public CI logs.
4. Test positive/negative authenticated callable behavior in isolated
   Staging including revoked Auth and App Check credentials; measure latency.
5. Only with separately explicit authorization, publish limited new-name
   functions and verify with P62/P63 pinned-source attestation. Do not
   redirect customers or overwrite existing function names.
6. Roll back by restoring the recorded known-good immutable source revision
   and routing config via the approved release procedure. Do not delete
   Firestore credit records to roll back function code. Monitor credit
   invariants and check for in-flight transactions before any revert.
7. Keep the public pilot and Production rollout disabled pending sign-offs.

**CI tests are not release authorization.** No cloud operations, no
production source edits, and no deployment workflow is introduced.
