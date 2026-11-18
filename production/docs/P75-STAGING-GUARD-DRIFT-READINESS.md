# PACKTOOK P75 — Staging Guard Drift Remediation Readiness

**P75 is NOT the remediation deployment.** Historical P63 read-only checks
found the *deployed* Staging `recordingStatus` and `usageStatus` functions
using `onCall` rather than the guarded wrapper in the reviewed code.
This discrepancy is still open. P75 must not be described as a runtime fix.

## Work produced

- `production/staging-candidates/p75/legacy-status-guard-candidate.cjs`
  is a standalone dependency-injected **review-only implementation** for
  the two existing legacy callable names. Both status handlers are wrapped
  by a required `protect` callback before database access. There are
  intentionally no Firebase SDK imports, Cloud function registrations,
  default exports or live credentials.
- `production/ast-review/p75-staging-readiness.cjs` validates the
  immutable-blocked P70 deployment manifest, all 17 P74 evidence fields
  and scoped P69/P75 guard candidates. Any attempt to mark a deploy
  allowed, to register legacy aliases without review, to omit the wrapper
  or to use Production Beta authorization fails closed.
- `production/ast-review/test-p75-staging-readiness.cjs` and
  `production/staging-candidates/p75/test-legacy-status-guard-candidate.cjs`
  exercise the denial boundary, Source/manifest mutation cases and
  **no database read before authorization**.

## Required external evidence before a deployment discussion

1. A separately authorized, strictly read-only Staging inspection must
   establish which revisions currently serve the **five** target callables
   and whether the historic P63 drift persists. Verify before/after
   immutable metadata in the P63/P62 style, but do not claim that the
   latest live source was inspected by P75 CI.
2. For each callable, review backend Firebase App Check enforcement,
   invalid/missing App Check rejection, Auth ID token verification,
   runtime service account, least privilege IAM and secret bindings.
   Record only signed, redacted conclusions in the P74 evidence file.
3. Verify Staging public signup and pilot rollout flags are CLOSED,
   alerting and billing limits exist, and owner/compliance signoff is
   documented in a private change ticket.
4. Pin an immutable source archive **and rollback revision** for the
   current Staging deployment. Independently review the narrow proposed
   patch; do not copy Production-bound `uid` logic into Staging, and do
   not overwrite unrelated local working-tree edits.
5. Run authenticated positive/negative real callable end-to-end tests in
   an appropriately isolated/approved Staging session. Existing Firebase
   Emulator tests and literal `enforceAppCheck:true` are insufficient.
6. A **separate, explicit owner authorization** is required before any
   staging functions deployment. The P75 CI contains no deploy path,
   even if all evidence fields are subsequently marked VERIFIED.
7. If a later approved deployment fails validation, roll back to the
   pinned immutable revision using the approved process and preserve
   Firestore credit/account data. Re-attest source, IAM and App Check
   after rollback; do not trigger Public/Production release automatically.

## Current state

- P75 scoped code/test candidate: CREATED; **not registered or deployed**.
- P74 live evidence template: 17/17 NOT_VERIFIED.
- P63 deployed Staging guard drift: UNRESOLVED.
- Backend App Check: NOT_PROVEN.
- IAM runtime verification: NOT_VERIFIED.
- P70 manifest: `deployAllowed:false`.
- `RELEASE=NO_GO_RELEASE`.

The CI success criterion is that the safety checks behave correctly while
the deployment gate remains blocked, not that Staging has been remediated.
