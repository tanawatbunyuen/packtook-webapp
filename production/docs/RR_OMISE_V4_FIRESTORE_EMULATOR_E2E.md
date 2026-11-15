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
