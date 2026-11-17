# PACKTOOK P64 — Staging callable security remediation candidate

**Status: CODE REVIEW ONLY. STAGING DEPLOY BLOCKED. PRODUCTION NO_GO_RELEASE.**

## Evidence (operator read-only P63)
- Staging `recordingStatus` and `usageStatus`: `DEPLOYED_GUARDED_CALL: FALSE`.
- Review source for both: `REVIEW_GUARDED_CALL: TRUE`.
- Source generation stable; App Check backend enforcement NOT_PROVEN.
- Three credit/recovery handler token comparisons match; **this is not proof of runtime behavior**.

## Critical compatibility finding

`production/functions/index.js` currently has `uid(req)` checking
`PACKTOOK_PRODUCTION_PROJECT_ID === "packtook-prod-01"`; Pilot and QA
environment helpers are also production-bound. The production review file
must **not** be deployed as-is to Staging. Simply renaming the project string
would weaken environment boundaries, and simply changing
`onCall -> guardedCall` in old Staging may fail if its lease and UID helpers
are absent or behave differently.

## Patch candidate — design, not authorized deploy

For the two read-only Staging callables, the intended declaration is:
```js
exports.recordingStatus = guardedCall(options, async req => {
  // Preserve the currently verified handler body unchanged.
});
exports.usageStatus = guardedCall(options, async req => {
  // Preserve the currently verified handler body unchanged.
});
```

Guard prerequisites: a reviewed, Staging-specific invitation mechanism,
short-lived lease (with revocation), App ID binding, authenticated and verified
user, live claim consistency, and `uid(req)` requiring proof of prior
request-local lease validation. No production flags or permissions may
be used for Staging. Keep shared callable options unchanged until explicit
Firebase App Check design, deployment IAM and runtime config review.

## Before ANY Staging deploy
1. Identify the exact currently deployed immutable Staging source revision,
   documented deployment codebase, source archive and rollback generation
   without sharing raw ZIP contents publicly.
2. Create a Staging-specific **complete module** candidate rather than editing
   two exports in isolation; inspect transitive dependencies and module
   initialization side effects.
3. Implement the Staging-specific Auth/lease policy with explicit approval;
   run Auth denial matrix for unauthenticated, expired invite, revoked lease,
   wrong App ID, disabled account, mismatched claims, and Beta/QA users.
4. Obtain backend App Check enforcement evidence; do not infer it from source
   declaration, callback, or success response alone.
5. Run local/emulator tests for credits/reservations, idempotency, recovery,
   concurrent requests and rollback; do not use real customer data.
6. Request a separate **explicit owner approval** for a narrow Staging deploy
   with a rollback plan, monitoring and isolated testing.
7. Re-run P62/P63 attestation with review-branch commit pinning and archive
   generation stability. A staging match is still not Production release approval.

## What P64 does now
`production/ast-review/p64-staging-deploy-preflight.cjs` performs offline
static checks of all five guarded callable exports, helper references and
detects production-bound auth. It deliberately **always blocks deployment**
until a separate Staging policy and runtime approvals are reviewed.

No production code changes, no Cloud writes, no merge or deploy.
