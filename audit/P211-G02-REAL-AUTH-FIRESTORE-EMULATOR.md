# P211 — P188 Candidate vs Actual Firebase Auth + Firestore Emulators

**Security status: G02 NO_GO, Release NO_GO, Deploy NO_GO, Public Signup CLOSED.**

This test goes beyond the P210 in-memory Firestore stand-in. It uses **real local Firebase Auth and Firestore emulators** with the Firebase Admin SDK and the exact six-edit, pinned P188 release candidate. Auth Emulator issues local ID tokens, Firebase Admin verifies them against the configured local emulator, then the **actual isolated P188 handlers** `accountRole`, `authorizeDuplicate`, and `usageStatus` are invoked with the verified auth context. Firestore reads and transactions occur in the actual Firestore Emulator.

## Scope
- Local demo project `demo-packtook-p184`, loopback-only Auth (19099) and Firestore (18080). No production credentials, no Cloud APIs, no persistent database.
- `firebase-functions/v2/https` `onCall` wrapper is replaced locally to invoke the candidate handler directly; this does **not** test Firebase callable HTTP protocol, deployed runtime, App Check enforcement, production token cryptographic signature, or Cloud Run IAM.
- Synthetic test accounts only: authorization denial for unverified email, missing Auth, missing ownerUid, foreign ownerUid; no legacy backfill, no duplicate approvals for nonowners, correct new-account ownerUid on initial create.
- The repository root `functions/index.js`, `firebase.json`, and `firestore.rules` are **not changed**. Local emulator configuration under `audit/p211/` is isolated.

## Execution and limitations
GitHub Actions installs Firebase Functions SDK and Firebase CLI in CI, launches `firebase emulators:exec --only auth,firestore` using dedicated ports, runs the pinned candidate in Node VM with **real** Firebase Admin SDK, and exercises Firestore Emulator transactions. The Admin SDK bypasses client security rules, so passing this test **does not mean Firestore client rules are secure**.

## G02 remaining
Independent review of exact P188 diff and source-to-deployed lineage, real staging runtime auth negative/positive tests and deployment status, account provenance for legacy tenant records; G03 callable invalid token protocol discrepancy and G04 signed production token remain separately NO_GO. All eight release gates remain NO_GO.

No merge/deploy, no staging/production data reads/writes, no App Check policy, IAM, Secret, Omise, or signup changes.
