# P215 — G02 Final Security Review Preflight

**Decision unchanged:** `G02 NO_GO` / `NO_GO_RELEASE` / `NO_GO_DEPLOY` / `KEEP_PUBLIC_SIGNUP_CLOSED`.

## Verified in repository/isolated CI
- P188 candidate SHA256 `c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b` and P189 exact six edits are reproducible **locally**. The existing November 7 deployed Staging revision predates the candidate; do not treat it as deployed.
- P211 real Auth/Firestore Emulator (23 test cases), P212 Firebase v2 onCall SDK + local Express HTTP with emulator Auth/Firestore (23 cases, historical G03 403/401 still unresolved for deployed environment), P213 20 emulator fixtures / 8 deliberately weakened mutations detected.
- P214 packet validates source/workflow markers. These do **not** authenticate remote provider logs or cryptographically attest reviewer identity.
- No P190 external requirement is independently verified by the tool. **5 external requirements remain; they are distinct from P172's 8 release gates.**

## G02 four closure prerequisites (explicitly not complete)
1. **STAGING_READ_ONLY_LEGACY_ACCOUNT_INVENTORY:** Approved operator's bounded and complete Auth/Firestore inventory; independent resolution of missing/foreign Owner and cross-tenant conflicts. Do not expose raw UID or customer data in GitHub.
2. **STAGING_RUNTIME_AUTHZ_WITH_DEPLOY_PIN:** Independently verify exact P188 source-to-build-to-revision provenance before running approved Staging positive and negative Owner/Admin/legacy/Auth checks. Do not assume an old Ready revision equals this candidate.
3. **LEGACY_OWNER_PROVENANCE_AND_CONFLICTS:** Security reviewer confirms legacy identities without auto-grants, backfills or migration. If production owner records need reading, that requires **separate explicit production READ authorization** outside this coding task.
4. **P188_EXACT_DIFF_INDEPENDENT_SIGNOFF:** Authenticated, independent reviewer inspects protected original records and attests the exact diff in a trusted audit system. A self-reported approval or CI summary is insufficient.

G06 requires separately verified real App Check token provenance (positive/negative), IAM/Secrets and revision lineage. G03's deployed callable invalid-token behavior is unresolved despite local P212 HTTP 401 observations. G04 production-signed token tests, G07 billing/monitoring/legal/privacy and G08 explicit Owner release approval also block public release.

## Execution constraints
P215 CI builds isolated candidate, re-runs P211/P212/P213 with demo-only Firebase Auth and Firestore emulators, validates source and gate consistency and emits deterministic reviewer checklist. No network Cloud access, production reads/writes, deployment, IAM, secrets, Omise, billing, migration, App Check policy, recovered-Owner import, merge, or signup enablement.

**No local evidence, CI PASS, or user-supplied self-attestation may promote G02 or any release gate to GO.**
