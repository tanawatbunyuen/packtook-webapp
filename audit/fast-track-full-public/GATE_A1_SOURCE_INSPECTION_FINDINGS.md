# Gate A1 — Source code inspection findings (not final sign-off)

2026-11-27. **Read-only code inspection** of exact GitHub files:
- `firebase-staging/firebase-packing-bridge.js`, Git blob `2fe8976da6a12a19cc7c04f48e3fbd8d653c3a33`
- `firebase-staging/firebase-v4-config.js`, Git blob `0639cda751c49baca8e85ff700305c39bff4b1d1`
- Review artifact ZIP `ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2`.
- Operator's A1 static hosted comparison: Index matches, 28 callable mappings match, 4 Bridge changed blocks and Config drift require review.

## Confirmed from inspected source
- 28 named async frontend callable mappings. **Two** named status handlers use the explicit `protectedApi` fail-closed wrapper: `usage -> usageStatus` and `recordingStatus -> recordingStatus`.
- Several higher-impact client operations use plain `api`: `registerDevice`, `requestDuplicate`, `reserveCredit`, `finalizeCredit`, `createOmisePayment`. This is not, by itself, a vulnerability: server-side Auth/App Check/authorization policy is the actual security boundary; **it remains unproven for the exact Candidate**.
- `initializeAppCheck` is conditional on presence of public Enterprise site key; the checked-in staging config intentionally exports an empty key. The review-only candidate has the staging public key injected at build time and passed a **mock-only** browser smoke.
- `login()` signs out an unverified email user; `onAuthStateChanged` exposes only verified users to the UI. Backend verification and tenancy checks must be proved separately; client checks do not establish those properties.
- Historical hosted comparison found four Bridge changed blocks. Their semantics **cannot be classified with the present repo source alone**: inspect actual hosted Bridge diff in the controlled operator environment, without printing public config keys into logs.

## A1 decisions and blocker
- **A1 status: OPEN — static source reviewed, cross-version hosted semantic diff requires code-review approval.**
- A reviewer must inspect exact four changed blocks, confirm expected App Check initialization and client Auth transitions, classify any behavior changes and sign with source/candidate SHAs. Avoid blanket assertions that all callables are protected because the frontend imports App Check.
- Gate B requires scoped staging-only negative tests for every sensitive server callable, cross-tenant denial, credit idempotency and Omise test-mode flows.
- The existing candidate and local Packaging/Browser evidence are retained; do not rerun them unless the tested candidate/config changes.

## Boundary
**No deploy, no public signup enablement, no live Auth/Functions, no IAM/Secrets, no customer/data writes.** No Gate A PASS or release approval is asserted.
