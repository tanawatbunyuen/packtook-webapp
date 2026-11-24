# P182 — G02 Customer Owner Authorization Runtime Candidate

**NO_GO_RELEASE / NO_GO_DEPLOY / NO_GO_OWNER_IMPORT.**

## Critical findings verified in original pinned `functions/index.js`
- `accountIdFor(uidValue)` returns the same uid; consequently `assertAdmin` comparison does not establish an independent admin role.
- `accountRole` returns `role:"admin"` for any verified user account, not a persisted owner authorization check.
- `authorizeDuplicate` writes missing `ownerUid:accountId` in its transaction, silently granting legacy accounts explicit owner state.
- Platform Owner custom claim is separate; do not conflate it with customer admin.

## Candidate and emulator
P182 creates a disconnected implementation of accountRole and duplicate approval with verified Firebase callable identity and **persisted** account.ownerUid strict equality. No client role/owner/accountId claims are used; no automatic bootstrap. The harness executes a real Firestore Admin SDK transaction in localhost demo project `demo-packtook-g02-p182` and covers 14 positive/negative runtime cases. Test harness is NOT an importable production module and its synthetic request identity is not Firebase Auth token verification.

Production `functions/index.js` stays byte-for-byte pinned. G02 remains NO_GO, because enabling strict ownerUid checks would lock out existing accounts lacking that field. Do not deploy the candidate directly.

## Shortest safe release path
1. Inventory legacy accounts under separately approved read-only operator process and establish ownerUid provenance; do not infer ownership merely from client claims.
2. Decide if single-user legacy accounts can be verified and backfilled via separately approved audited and rollback-tested migration; otherwise manual review.
3. Integrate authorized customer-owner guard into a **new** release candidate branch, with the original code's errors, Firebase Callable authentication and real transaction semantics preserved.
4. Run Auth + Firestore + Functions emulator negative tests for signed-out, invalid token, unverified email, foreign owner, legacy missing owner, completed barcode, repeated approval. Avoid retroactive authorization.
5. Obtain security reviewer sign-off before clearing G02; no merge/deploy until all release gates clear.

CI green means G02 transaction behavior only in demo emulator; not production readiness.
