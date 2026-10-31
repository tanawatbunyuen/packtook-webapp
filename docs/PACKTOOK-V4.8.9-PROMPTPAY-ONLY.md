# PACKTOOK V4.8.9 — PromptPay QR only (Staging)

## Scope
- PACKTOOK remains on Firebase Hosting, Auth, Firestore and Functions.
- **New payments** allow only `method: "promptpay"` in the server callable `createOmisePayment`.
- Packages UI shows PromptPay QR only. Omise.js card form is no longer loaded.
- The browser bridge also rejects any payment method other than `promptpay`.
- All payment reconciliation, existing charge history, and idempotent subscription activation are retained. Previously created card transactions can still be inspected/reconciled.
- Omise card support may be reintroduced later from Git history after security and acceptance tests.
- Staging remains **Omise Test Mode**, not live collection.

## Deploy
```bash
cd ~/packtook-webapp
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only functions,hosting --project packtook-staging
```

## Acceptance tests
1. Log in as Admin. Open Packages; confirm **only PromptPay QR (Test)** button appears on unpaid requests; no credit-card button.
2. Create a Starter request; Free/Basic plan must remain unchanged until Omise verifies payment.
3. Generate QR and verify status remains pending before test payment confirmation.
4. Confirm payment in Omise Test Mode and check that plan, quota and expiration update only once.
5. Recheck status three times; expiration date must remain unchanged.
6. Verify direct callable request `createOmisePayment({requestId,method:"card"})` is rejected with `invalid-argument` (only in a controlled developer test).
7. Check an older previously-created card payment if available; read-only payment audit still works.
8. On Users, verify plan, expiry and quota match Firestore.

No real-money payment is enabled. Never commit keys to GitHub.
