# P185 G02 — Legacy Account Read-only Inventory and Release Gap

**Decision NO_GO_G02 / NO_GO_RELEASE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**

## Current task outcomes and boundaries
- P184 verified 14/14 real localhost Auth+Functions+Firestore callable scenarios, including an expected denial on an App Check-protected endpoint with no App Check token. It **did not verify a valid App Check token** or production App Check enforcement. The P184 candidate fixes the Firebase Admin `FieldValue` import in test isolation only.
- P185 implements a bounded, cursor-paginated, read-only inventory adapter and tests it against Auth + Firestore Emulators with synthetic fixture accounts. Reports only aggregates and classification fingerprint; does not print account identifiers. Classification counts ownerUid equal-to-account-id, missing ownerUid, mismatched/malformed owner, missing/disabled/unverified Auth, and lookup errors.
- The inventory is **NOT a production account inventory**; P185's CI refuses every non-demo project. P175/P176 migration preview must never be treated as real provenance or a write authorization.

## Actual remaining actions before G02 signoff
**A — Real read-only legacy inventory (cloud operator):** an authorized operator must separately run a least-privilege read-only accounts/Auth inspection against the *explicit* intended staging and production project, with a vetted adapter, no private UID export, logs redacted, and evidence archived in approved storage. Cannot be performed by GitHub CI without access. Verify missing ownerUid, identity, disabled/unverified, foreign/malformed owner. No automatic backfill. Sign off all exceptions by an independent Security reviewer.

**B — Provenance + remediation:** collect external account onboarding provenance for every missing/ambiguous ownerUid. For unresolved cases do not grant owner. Review a dry-run, immutable audit, backup, rollback and idempotent migration before any separately authorized write. Keep all real user data unchanged until approval.

**C — Valid App Check positive and negative tests:** currently only the missing-token denial was tested in P184. Firebase Functions expects an actual verified App Check token for a positive path; it must come from an authorized staging app/debug-provider flow, not a forged or insecurely bypassed token. Require the real user journey for legacy account status under valid token, and invalid/missing token denial. Official docs: https://firebase.google.com/docs/app-check/cloud-functions

**D — Security acceptance of release candidate:** review P183 four authorization changes and P184 FieldValue import fix; test accountRole and authorizeDuplicate on the exact release candidate with pinned SDK, verify entire payment/credit path for regressions, and independently approve G02. Keep original functions/index.js unchanged until separate controlled release authorization.

## Shortest critical path
Run A and C in parallel; complete B for affected accounts; run D once on the pinned candidate. G02 gate only changes to GO after all evidence, no automatic inference from green synthetic CI.

## Testing limitations
Firebase Auth Emulator tokens may be unsigned; local tests do not prove production JWT signature verification. Hash fingerprints alone are not tamper-proof without separately anchored evidence. This change includes no live access tool or key configuration, no production cloud reads or mutations, no migration writes, no Owner imports, no deploy and no signup change.
