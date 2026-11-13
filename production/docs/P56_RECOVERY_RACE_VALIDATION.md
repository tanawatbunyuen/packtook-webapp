# PACKTOOK P56 — Recovery Race Condition and Fault Integration Validation

**DRAFT / DEMO EMULATOR ONLY / NO DEPLOY / PUBLIC CLOSED / NO_GO_RELEASE.**

Stacked on P55 PR #24. P54 runtime remains dormant and unexported.

## Actual automated scope
- Firebase Auth Emulator: real emulator-created users, ID tokens, role revocation and restored claims.
- Firestore Emulator: real transactions and contention against local synthetic account/bill/case docs.
- 12 simultaneous openCase requests, 8 simultaneous Finance approvals, 8 simultaneous Technical approvals and 8 simultaneous Owner decisions.
- Synthetic Omise provider outage; verify no review transition.
- Synthetic App Check consume/replay prevention; not real Firebase attestation.
- Verify exactly four deterministic audit events and no backend account/billing/grant/wallet mutations.
- Credentials-free pinned GitHub Actions, demo IDs, localhost-only Firebase emulators.

## Important interpretation and residual risks
1. These tests validate transaction idempotency and rejection under bounded concurrency, NOT full production load capacity.
2. Even if all tests pass, Auth getUser checks execute before transaction. Race between permission revocation and commit remains **unresolved**; do not infer atomic revocation safety.
3. Real App Check attestation, browser callable integration, provider rate limits, Test Mode Omise GET and charge timeout handling are **NOT tested**. Never claim live/test-network integration or payment completion.
4. No independent finance/security/legal/owner approval or production IAM review was obtained.
5. Sensitive financial recovery must remain manual; do not merge, deploy, export, refund, grant or activate accounts.

## Reproduce
From project root, install locked dependency set and run local emulators:

    npm ci --prefix production/payment-functions --ignore-scripts --no-audit --no-fund
    npm exec --yes --package=firebase-tools@15.22.1 -- firebase emulators:exec --project demo-packtook-v72 --only auth,firestore --config production/scripts/v72-isolated-emulators.firebase.json 'node production/scripts/p56-recovery-race-emulator.mjs'

Expected output when passing: P56_RACE_EMULATOR: 8/8 PASS.

## Proposed P57 blockers
- Resolve reviewer role revocation / transaction TOCTOU through an approved, correctly scoped authorization governance mechanism and red-team tests.
- Use authorized isolated staging for genuine App Check limited-use token verification and replay, with production disabled.
- Omise real Test Mode GET with authorized credentials and synthetic outage/network timeouts. Never use live key or charge.
- Review automatic concurrency tests plus PDPA, Finance reconciliation and human Owner signoff before considering production runtime design.

**F0 HOLD / F1-F3 NOT AUTHORIZED / PUBLIC CLOSED / MIGRATION HOLD / NO_GO_RELEASE.**
