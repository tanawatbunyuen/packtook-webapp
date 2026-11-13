# PACKTOOK P57 — Authorization Epoch Race Prototype and Staging Gates

**DRAFT / DEMO ONLY / NOT WIRED TO P54 RUNTIME / NO DEPLOY / NO_GO_RELEASE**

## Scope
This is a narrowly scoped policy-epoch prototype, **not** a production authorization fix.
- Explicit account+actor+role scoped policy document with monotonic epoch.
- Decision transaction reads this policy doc and writes only a separate p57DemoPolicyDecisions audit document.
- Revocation transaction mutates the *same* policy document, forcing any concurrent decision to retry; if revoked, stale decision fails closed.
- Test synchronizes in-flight decision and revocation using real local Firestore Emulator.
- No payment/credit/lock/refund/subscription modification; P54 candidate code is untouched and its callable is not exported.

## What the tests DO NOT prove
- Firebase Auth custom claims and a Firestore policy doc are **different authorities**. Existing P54 uses Auth getUser before a transaction and does not read this new epoch doc. There is **no production protection** from this PR.
- A revocation that occurs *after* a decision commits cannot retrospectively cancel it. Required linearization and workflow semantics must be documented.
- Real IAM, custom claim provisioning, suspended/disabled users, Firebase Security Rules, multi-tenant roles, rate limits, MFA, offline token invalidation and availability are not validated.
- App Check attestation is not implemented; no real Test or Live Omise request has been executed. Firebase emulator tests cannot substitute for genuine App Check/browser/staging proof.
- Unauthorized writes to policy docs must be prevented by a dedicated trusted admin governance workflow. Uncontrolled writers defeat this prototype.

## Mandatory genuine staging gates (not run by P57)
1. Security/Owner approve a single canonical policy authority, document who may revoke/grant roles, and scope by tenant/account.
2. Integrate transaction-bound policy reads into a separately reviewed recovery backend, with Auth/disabled-user checks as a complementary gate; add bounded contention/retry behavior and audit.
3. In explicitly authorized non-production staging, use actual App Check limited-use tokens through a non-public callable and demonstrate replay denial, expiry and browser E2E.
4. Finance approves real read-only Omise TEST GET using skey_test credential in Secret Manager, fake/sanitized metadata, timeout and unavailable-provider fail-closed tests; never use production payment data, create charges, refund or grant.
5. Legal/Ops/Finance/Owner approve audit retention, incident response, refunds outside Omise, monitoring, IAM, and rollback.

## Reproduce locally
    npm ci --prefix production/payment-functions --ignore-scripts --no-audit --no-fund
    npm exec --yes --package=firebase-tools@15.22.1 -- firebase emulators:exec --project demo-packtook-v72 --only auth,firestore --config production/scripts/v72-isolated-emulators.firebase.json 'node production/scripts/p57-policy-epoch-race-emulator.mjs'

Expected marker: P57_POLICY_EPOCH_EMULATOR: 9/9 PASS.
F0 HOLD / F1-F3 NOT AUTHORIZED / PUBLIC CLOSED / MIGRATION HOLD / NO_GO_RELEASE.
