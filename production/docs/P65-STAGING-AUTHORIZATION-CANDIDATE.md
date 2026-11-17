# P65 — Staging-only Authorization and Pilot Lease Candidate

Status: **ISOLATED IMPLEMENTATION; NOT INTEGRATED INTO FIREBASE; NOT DEPLOYABLE**.
No production files changed, no Cloud/Firestore writes. P64's deployment block remains in force.

## Purpose and boundaries

`staging-authorization.cjs` is a dependency-injected, offline-testable
security policy module under `production/staging-candidates/p65/`. It does not
import Firebase, register Cloud Functions or connect to live resources.

It requires a request-level `req.auth` with verified email, a valid
`req.app.appId`, explicit Staging invitation and session claims, and
read-only revalidation of both an approved lease control document and
Firebase Auth live user state on *each invocation*. The per-request
WeakSet prevents using its `uid(req)` method before successful checks.
It blocks Production Beta, QA, Public and V7.2 Pilot token claims.

Operator-dependent reads have not been implemented yet. Do not use mock
reads against live resources. Pilot enablement requires explicit project
identity, public flags closed and the exact Staging Firebase App ID.

## Negative test cases

Unauthenticated, missing/wrong App ID, email not verified, absent/mismatched
Staging claim, revoked/expired lease, invalid control approval, user not
invited, disabled user, live claim revocation, conflicting Production/QA/Public
claims, project mismatch, and handler invoked after a denied auth check.
Synthetic local tests also check anti-replay revalidation and lease limits.

## Remaining gates (all BLOCKING)

1. **Project-specific cloud bindings**: propose least-privilege reads for a
   dedicated Staging service account, and a named non-production Pilot control
   document with an approved schema and retention.
2. **Real Emulator integration**: test Firebase callable request adapters,
   Firestore transaction/isolation rules, Auth emulator revoked claims,
   Cloud Functions environment, and actual Credit/Recovery handlers.
3. **App Check**: prove deployment-level backend enforcement; seeing req.app in
   static code is not proof. Denied invalid/missing App Check requests must be
   tested in an authorized isolated environment.
4. **Staging deployment**: explicitly approved deployment scope, backup source
   revision, rollback, monitoring and QA/owner sign-off.
5. **Re-attestation**: compare pinned deployed source and callable guard
   dependencies after any authorized deployment. No production release from
   this candidate.

**Do not copy this file into production/functions or deploy directly.**
Run locally:
```bash
node --test production/staging-candidates/p65/test-staging-authorization.cjs
```

Deploy: BLOCKED. Runtime equivalence: NOT_PROVEN.
Production: NO_GO_RELEASE.
