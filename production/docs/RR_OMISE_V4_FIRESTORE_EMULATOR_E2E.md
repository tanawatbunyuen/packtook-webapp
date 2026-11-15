# PACKTOOK Payment Integration V4 — Firebase Firestore Emulator E2E

## Confirmed baseline
Cloud Run V3 executed `packtook-omise-test-probe-tnr9r` against **real Omise Test API** and returned `OMISE_TEST_READ_ONLY_VERIFIED: PASS` for Business test charge THB 1290. This validates *read-only retrieval and matching charge fields*, **not** the Firestore Billing Request. The old historical test charge remained 404; do not rewrite it.

## V4 isolated scope
Uses actual `functions/index.js` `omisePaymentStatus` and `reconcileCharge` handlers, with REAL Firestore emulator transactions on demo project `demo-packtook-v4-e2e` and strictly synthetic Omise GET responses. No external provider calls and no real Firestore/Staging/Production writes. No direct payment creation or webhook registration.

Tests include Business paid subscription purchase at THB 1290, Free credit transfer 20+5000=5020, repeat settlement, simultaneous settlement attempts, pending payment, wrong amount, metadata mismatch, changed billing version and pending reservation review. All test accounts have synthetic IDs, project checks fail closed and cloud credentials are disallowed.

## Runner
```bash
export GCLOUD_PROJECT=demo-packtook-v4-e2e
export NODE_PATH="$PWD/functions/node_modules"
firebase emulators:exec --only firestore --project demo-packtook-v4-e2e \
  'node --test production/tests/omise-v4-firestore-emulator-e2e.test.cjs'
```
Java, Node 22, Firebase CLI and `functions` npm dependencies required. Run using GitHub CI or isolated local shell, never with a production project.

**Next gate (not yet done):** confirm new Business charge's actual `uid`/`requestId` pair refers to a *matching Staging Firestore Billing Request*, with owner approval. Existence of metadata alone is insufficient. Use only read-only Staging validation before any controlled write test; keep Public signup closed and Production untouched.

**NO_GO_RELEASE** until full owner/monitoring/billing/legal review and safe controlled Staging E2E tests.

## V4 Staging read-only linkage preflight (operator Cloud Shell)

After Firebase Emulator tests PASS, validate the **real** paid Business charge from V3 against the **existing** Staging Firestore billing records. This is read-only; it does not run the real billing handler, grant credits, create a charge, or deploy.

```bash
gcloud config set project packtook-staging
export RR_STAGING_PROJECT_ID=packtook-staging
python3 production/scripts/rr-v4-staging-billing-linkage-readonly.py
```

The script re-reads the paid Omise TEST charge using the mounted Staging secret version 1 via an operator's Cloud Shell; then uses the operator's Google Cloud access token to issue two Firestore REST GETs in **packtook-staging**. It never prints credentials, UID/request metadata, account content, or raw API response. It checks paid and Test Mode, charge amount, metadata identity, existing billing request charged/owned by that UID, Business plan at THB 1290, outstanding billing lock and revision. All outputs are sanitized status codes.

Expected positive linkage result: `STAGING_BILLING_LINKAGE: STAGING_BILLING_LINKAGE_MATCH`. It only means the existing Staging documents are linked and expectations agree at a point in time; it does **not** authorize changing any billing record or credit balance. `NOT_FOUND` indicates the charge belongs to an account context without a corresponding Staging billing request and must not be reused for activation. All other mismatches require manual review and no write. If Cloud Shell lacks Staging Firestore read permissions, preflight prints BLOCKED.

**Always stop after read-only preflight unless a new, separately reviewed Staging write-path authorization and test plan are approved. No Production writes.**
