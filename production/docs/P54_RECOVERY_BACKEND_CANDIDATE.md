# PACKTOOK P54 — Recovery Backend Implementation Candidate

**DEMO EMULATOR ONLY. NO PRODUCTION ENDPOINT.** P54 is a stacked Draft candidate on PR #22. The P54 module is NOT imported or exported by the deployed payment-functions/index.js.

## Implemented review-only backend

- buildDemoRecoveryBackend({db,auth,appCheck,provider,env,now}) performs a strict environment guard: all demo project variables must equal demo-packtook-v72; Firestore Emulator must be localhost port 18080; Auth Emulator must be localhost port 19099; no production credential override is permitted.
- openCase validates the maker, fetches Omise-shaped TEST charge evidence before the Firestore transaction, validates immutable billing/account state, and creates a deterministic account-scoped review case and an audit event. Does not grant credits.
- reviewFinance and reviewTechnical validate Firebase Auth ID tokens and refreshed getUser role claims, require two distinct actors, check hashed evidence, reject replay and stale state, and record review audit events transactionally.
- ownerDecision requires a different Owner, refreshes both reviewers' live Auth roles, checks the ledger for prior grant, and records only OWNER_DECISION_RECORDED with action NONE. It never applies a resolution.
- status is an Owner-restricted masked read.
- createOmiseTestAdapter implements only authenticated GET /charges/{id} with a skey_test_ key supplied by the server. It never creates/voids/refunds a payment; all HTTP responses in the test harness are synthetic.

## Security boundaries and limitations

- Auth integration test uses real Firebase Auth Emulator, verified test emails and synthetic custom-claim roles. Real production role provisioning and MFA have NOT been validated.
- App Check is verified by a SYNTHETIC TEST DOUBLE, not real App Check. Actual callable integration must enforce App Check and consider consumed-token rejection; browser E2E and IAM remain open.
- Omise integration uses a MOCKED Test charge response; no real Omise API or real payment is contacted.
- Firestore integration tests use REAL Firestore Emulator transactions against local synthetic records, with candidate writes restricted to p54DemoRecoveryCases and its audit events. The harness seeds synthetic account and billingRequests test data. No production document changes occur.
- Pro/null wallet or legacy provider evidence omissions are deliberately fail-closed and require a separate reviewed recovery pathway.
- App Check limited-use token refresh, live role revocation race controls, evidence retention, operational timeout/retry policy and PDPA have not been approved.
- PromptPay refunds are not supported through Omise API. A separate out-of-band manual Finance refund workflow remains a proposal; no refund executor exists.
- NO endpoint, grant, lock release, subscription update, wallet modification, refund, deployment or public signup change exists in P54.

## Local test instructions

1. Pure Node test: node --test production/scripts/test-p54-recovery-security.mjs

2. Install locked Firebase Admin dependencies:
   npm ci --prefix production/payment-functions --ignore-scripts --no-audit --no-fund

3. Run real DEMO emulators:
   npm exec --yes --package=firebase-tools@15.22.1 -- firebase emulators:exec --project demo-packtook-v72 --only auth,firestore --config production/scripts/v72-isolated-emulators.firebase.json 'node production/scripts/p54-recovery-backend-emulator.mjs'

4. Expected marker: P54_BACKEND_EMULATOR: 16/16 PASS, P54_ACTUAL_OMISE_REQUESTS: 0 and P54_CLOUD_ENDPOINTS_EXPORTED: 0.

GitHub Actions tests the exact PR candidate with demo-only environmental guards, pinned actions and NO deploy credentials.

## Mandatory future approvals

Security: real server token / App Check checks, role governance and IAM, Firestore Rules, abuse tests.
Finance: verified charge, refund outside Omise, double-entry policy and fraud escalation.
Engineering: separate deterministic ledger / idempotent entitlement executor in a new reviewed PR, NOT P54.
Legal: PDPA and evidence retention.
Operations: alerts, source provenance, LKG image, rollback.
Owner: scoped authorization and final human approval before any production release.

F0 HOLD / F1-F3 NOT AUTHORIZED / PUBLIC CLOSED / MIGRATION HOLD / NO_GO_RELEASE.

References:
https://docs.omise.co/promptpay
https://docs.omise.co/charges-api/thailand
https://firebase.google.com/docs/auth/admin/verify-id-tokens
https://firebase.google.com/docs/app-check/cloud-functions
https://firebase.google.com/docs/firestore/manage-data/transactions
