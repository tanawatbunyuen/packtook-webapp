# Omise Mock Paid -> Wallet Integration (real PACKTOOK handler)

**Goal**: test actual `functions/index.js` `omisePaymentStatus` -> `reconcileCharge` using in-memory Firestore transactions and fake Omise `GET /charges/{id}`. No production or staging writes.

## Executable scenarios
- Successful synthetic test charge: Free plan with 20 unused wallet credits, Basic purchase at THB 299 adds 300, resulting balance 320, subscription expiry generated; repeat delivery must not add credits or increment billingVersion again
- Pending charge remains pending and no wallet grant
- Status successful but paid:false never grants wallet credits
- Amount, UID/request metadata or livemode mismatch fails prior to wallet writes
- Billing version changes while payment is pending => manual review, not credit
- Pending video reservation => manual review, not premature credit transfer

Run offline:
```bash
node --test production/tests/omise-payment-wallet-real-handler-offline.test.cjs
```
Tests use in-memory transaction spies with real handler code; do not simulate the full Firestore emulator's concurrency, indexing, transactions under contention, actual Cloud Functions auth/App Check or Omise provider behavior. Separate Firestore emulator and deployed staging tests remain required before release. **Never** force a synthetic paid result into Firestore or deploy sandbox to Production.

Real Omise Test API remained HTTP 404/not_found for historical charge; this PR does not repair that external provider behavior. NO_GO_RELEASE / PUBLIC CLOSED.
