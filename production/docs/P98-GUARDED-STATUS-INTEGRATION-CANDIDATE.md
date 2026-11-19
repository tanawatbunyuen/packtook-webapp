# PACKTOOK P98 — Guarded Status Handler Integration Candidate

## Implemented

`production/staging-candidates/p98/guarded-status-integration-candidate.cjs`
composes P81's isolated Staging Auth and Firebase Callable guard wrapper
with P97's existing-account `usageStatus` response projection. It
exposes exactly `recordingStatus` and `usageStatus` as **injected
candidate functions**, without exporting them in the Firebase entry
point or importing Firebase SDKs.

It enforces the P65 Staging-only control, invited UID, current live Auth
user, verified email, pilot session, lease, expected App Check App ID and
explicit `onCall({enforceAppCheck:true})` options in isolated mocks.

It returns existing-account usage fields from the P97 projection
including plan limit, used/reserved, remaining, wallet, billing and
subscription state. It retains P75's recording lookup behavior and
rejects client-supplied UID overrides.

The P98 hermetic tests assert missing App Check context, wrong App ID,
missing Auth, wrong session, revoked pilot, disabled/unverified live
Firebase user and wrong project fail before customer-account reads.
No Firestore write methods are implemented or invoked in the test.

## Hard limitations

- No real Firebase App Check attestation is exercised; mocking
  `onCall` options is not proof of backend enforcement.
- The candidate purposely does **not** auto-provision legacy Beta
  accounts. The original `ensureAccount` may create a Free account
  under restricted conditions; therefore full parity is NOT_VERIFIED.
- Selected P97 fixture parity is for checked-out repository code only,
  not deployed Staging byte-for-byte source equivalence or every edge.
- The P81 guarded candidate uses stricter pilot authorization than
  the original callable; rollout would alter eligible callers.
- `recordingStatus` account path equivalence remains bounded to
  local source assumptions, not live Firestore attestation.
- The new P98 entry point is NOT registered or deployed; no credit
  account or credit function source was changed.
- Deployment codebase `beta` includes three credit-critical callables.
  A safe isolated exact-function deployment selector is NOT_VERIFIED.
- P80 confirmed deployed guard drift remains UNREMEDIATED. P94
  registry lookup and rollback restorability are unresolved.

## Next review gate

P99 should address the account-provisioning / existing-account
behavior difference and the status-only rollout caller eligibility,
then isolate any environment-dependent behavior in the Firebase
Firestore Emulator. Do not perform live deployment or amend IAM
without separate change approval.

No Cloud calls, writes, merges, traffic changes or production actions.
`STAGING_DEPLOY=BLOCKED`, `RELEASE=NO_GO_RELEASE`.
