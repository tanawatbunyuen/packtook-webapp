# PACKTOOK P55 — Recovery Security & Integration Hardening
**DRAFT, DEMO ONLY, NO DEPLOY.** Stacked upon P54 PR #23. F0 HOLD / PUBLIC CLOSED / MIGRATION HOLD / NO_GO_RELEASE.

## Implemented
- Pure Node regression tests for required App Check consume, replay rejection, revoked Firebase Auth ID tokens, role revocation, disabled user, missing tokens and missing provider secret.
- No cloud calls, payment writes, refund, credit grants or runtime exports. P54 candidate runtime is unchanged.

## Outstanding security findings
1. Real Firebase App Check attestation NOT validated; P54 test double is synthetic. Future callable integration needs limited-use token verification and replay controls.
2. Revocation race / TOCTOU: live getUser checks occur before Firestore transaction; reviewer rechecks before owner transaction. A concurrent role revocation may race transaction completion. Requires governance/atomic policy and stress tests.
3. Omise verification remains synthetic; GET-only Test adapter not tested against an actual authorized Test Mode charge. Verify ownership, metadata, currency, amount, errors and timeout. No live charges, writes or refunds.
4. Concurrent review retries, owner decisions, transaction retries and provider outage resilience need dedicated emulator load tests.
5. Global role claims do not establish tenant-scoped privileges; MFA, provisioning, audit/PDPA retention and rate limits require human-approved policy.
6. Omise key prefix validation is not proof of credential authenticity. Do not expose secrets.
7. Production callable, Browser E2E, real App Check, Omise integration and entitlement executor are OUT OF SCOPE.

## Completion gates
- Document independent Security, Finance, Engineering, Legal/Ops and Owner approval.
- Demonstrate real staging App Check and authorized Omise Test Mode read-only verification.
- Demonstrate high-contention review and role-revocation races with reproducible evidence.
- Obtain explicit separate approval for any production endpoint and future grant/refund system.

Run: node --test production/scripts/test-p55-recovery-gates.mjs

**NO MERGE / NO DEPLOY / NO ENTITLEMENT / NO REFUND / PUBLIC CLOSED.**
