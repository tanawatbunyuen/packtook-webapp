# PACKTOOK P213 — G02 Authorization Mutation Coverage

**Mode: DEMO LOCAL EMULATOR ONLY. G02 NO_GO; 8/8 release gates still NO_GO.**

P213 checks whether the P188 candidate's authorization tests actually detect removal or weakening of security conditions. Unlike static string match or mocked databases, it executes the **real P188 handlers and deliberately mutated variants** against isolated localhost Firebase Auth and Firestore Emulators. Tokens originate from Firebase Auth Emulator and are verified through Firebase Admin against that local emulator. No Functions HTTP or App Check positive-token coverage is claimed for P213; the P212 local HTTP tests run as a regression check.

## Baseline negative tests
- Unverified email, legacy account without `ownerUid`, foreign Owner, missing account and unauthorized duplicate approvals are rejected.
- Explicit owner can approve duplicate and the audit belongs to that owner.
- No legacy account automatically becomes Owner.
- Firestore transaction writes are limited to synthetic demo test accounts.

## Eight adversarial mutations (all must be detected)
- `accountRole` guard removed for legacy and foreign Owner (2).
- `accountRole` truthy ownerUid check bypass for missing Owner (1).
- `authorizeDuplicate` ownerUid guard removed for legacy and foreign Owner (2).
- `authorizeDuplicate` truthy ownerUid guard bypass for missing Owner (1).
- Email verification required check removed (1).
- New-account creation `ownerUid` omitted (1).

A detected mutation is a **red test witness**: the weakened handler incorrectly succeeds or omits required owner state, while the unmodified pinned candidate rejects or provisions correctly. The mutations are compiled only in the ephemeral demo CI runner, never written to `functions/index.js`, never deployed, and never accepted as release candidates.

## Limits
P213 tests a selected security-critical subset, not every export. The Admin SDK bypasses client Firestore Rules. It is not a production-signed token test, deployed Staging/Cloud Run attestation, real App Check enforcement, or Independent Security signoff. G02 retains NO_GO pending actual source provenance, review and approved live staging auth evidence. G03 callable protocol still remains independently NO_GO. Production, staging, IAM, Omise, secrets, signup unchanged.
