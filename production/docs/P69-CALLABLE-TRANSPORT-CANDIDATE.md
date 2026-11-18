# P69 — Real Firebase Callable Transport Candidate (Staging Review Only)

## Implemented
- An independent Firebase Functions SDK source package at
  `production/staging-candidates/p69/functions`.
- Real `onCall` transport with `enforceAppCheck:true` and P65
  authorization/lease validation on **read-only** `p69UsageStatus` and
  `p69RecordingStatus`.
- No Production Beta shim in this module. A demo-project override for
  P65 configuration is permitted ONLY within a local Firebase Functions
  emulator with exact local-only Auth/Firestore addresses.
- Fail-closed when the real Staging Pilot flags are missing or closed.
- Local Functions/Auth/Firestore emulators test anonymous, invalid
  credentials and missing App Check token requests over HTTP.

## Important: NOT deployable yet
P69 is not registered in `production/firebase.json`; it is a separate
review candidate and there is no deploy workflow. The functions use
**new names**, so neither replaces the deployed `recordingStatus` nor
`usageStatus` and P63 drift remains open. The remaining three credit
callables are intentionally NOT exposed here; P67/P68 tested them with a
mock callable transport, and safely migrating their complete functions
requires independent review.

The Firebase emulator can demonstrate protocol rejection but it is NOT
cryptographic proof of backend App Check enforcement on Cloud Functions.
This candidate is not production code, and successful local requests do
not establish real Staging IAM, real ID-token revocation, lease concurrent
revocation, rollout readiness, or deployed source equivalence.

## Remaining security gates
1. Review the full Staging-specific five-handler implementation including
   reservation lock semantics, retry/idempotency and recovery concurrency.
2. Require explicit App Check enforcement backend evidence from a separately
   approved Staging deployment and negative runtime tests. Do not assume
   a code flag itself proves enforcement.
3. Review permissions/service identity, rollback archive/generation, owner
   consent, monitoring and change window. Never replace existing function
   names until authorized.
4. Re-run P62/P63 static/deployed attestation and prove revision stability
   after any authorized Staging deployment.
5. No merge to production, no Firebase deploy from CI.

**STAGING_DEPLOY = BLOCKED. PRODUCTION_RELEASE = NO_GO_RELEASE.**
