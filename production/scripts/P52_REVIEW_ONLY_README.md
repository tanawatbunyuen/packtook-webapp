# PACKTOOK P52 — Review-only dual-control prototype

**Status: draft candidate, not a production payment recovery system.**

P52 adds a stand-alone pure module at production/payment-functions/payment-review-dual-control.cjs. It is **NOT imported, exported, or wired to** production/payment-functions/index.js or any Cloud Function. No live endpoint, no customer, credit, billing lock, or payment record writes are added.

The module models evidence verification and two distinct synthetic reviewer roles (finance and technical) before returning REVIEW_READY_ONLY. It never returns an executable settlement instruction. The caller MUST treat authorizedByTrustedServer and checks.* as **untrusted input outside tests**; these booleans alone DO NOT establish authentication, provider verification, or fraud resistance.

## Tests

- Pure Node regression: node --test production/scripts/test-p52-payment-review-gate.mjs
- Demo Firestore transaction suite (requires payment-functions dependencies and emulator):
  npm exec --yes --package=firebase-tools@15.22.1 -- firebase emulators:exec --project demo-packtook-v72 --only firestore --config production/scripts/v72-isolated-emulators.firebase.json 'node production/scripts/p52-demo-firestore-review.mjs'

The transaction test refuses to run unless GCLOUD_PROJECT, GOOGLE_CLOUD_PROJECT, and GCP_PROJECT all equal demo-packtook-v72, FIRESTORE_EMULATOR_HOST equals 127.0.0.1:18080, and production credential/project override variables are absent. The only database collection it writes is p52DemoDualReviewCases in the localhost emulator. Reviewer identities are **synthetic**. No production Auth claims are read. CI is pinned to that isolated emulator and has no deploy steps or credentials.

## Production prerequisites — NOT implemented

Before any production API development, an independent technical/finance/owner review must approve: live role and email verification, trusted Omise read-side verification, canonical account/bill snapshot in a transaction, immutable dual-party audit, proof of no prior entitlement/credit grant, safe adjustment/refund policy, rollback plan and staged tests. REVIEW_READY_ONLY **is not** authorization to unlock, credit, refund, activate, deploy, merge or publicly launch.

Release gates remain: F0=HOLD, F1/F2/F3=NOT_AUTHORIZED, PUBLIC=CLOSED, NO_GO_RELEASE.
