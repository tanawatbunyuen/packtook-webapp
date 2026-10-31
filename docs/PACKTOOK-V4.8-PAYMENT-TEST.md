# PACKTOOK V4.8.6 — Omise TEST payment verification

Environment: Firebase project `packtook-staging`, branch `feature/firebase-auth-credits-v4`.

## Security boundary
- Omise **Test Mode only**. Cloud Functions reject non-`skey_test_` credentials; the browser accepts only `pkey_test_`.
- Never commit secrets or paste credentials into chat/GitHub.
- Only Cloud Functions may update the Firestore account plan and expiry.
- Every success notification triggers a server-side GET /charges/{id}. The transaction checks charge ID, account, billing request, THB amount, provider payment status, and test-mode flag before activating.
- The webhook verifies HMAC-SHA256 and timestamp before reconciliation. It accepts charge.complete, charge.update and charge.create, and independently checks the live provider state. Do not infer payment success merely from a webhook arrival or redirect.
- `paid` requests are idempotent; verification again must not extend expiry.
- Plans are 30-day **manual purchases**, not automatic recurring subscriptions.

## One-time setup in Cloud Shell
From `~/packtook-webapp`, on the staging branch:

```bash
git pull origin feature/firebase-auth-credits-v4
firebase use packtook-staging
firebase functions:secrets:set OMISE_SECRET_KEY --project packtook-staging
firebase functions:secrets:set OMISE_PUBLIC_KEY --project packtook-staging
firebase functions:secrets:set OMISE_WEBHOOK_SECRET --project packtook-staging
firebase deploy --only functions,hosting --project packtook-staging
```

Set the secret values only at the secure CLI prompts. Use the **Omise Test Mode** secret/public key and the **Test Mode webhook signing secret**, not the live keys. Configure the HTTPS endpoint URL shown by Firebase for `omisePaymentWebhook` in Omise Test Dashboard Webhooks settings. The Firebase project must have billing enabled for secret-backed functions.

## Test scenarios
1. Log in as the Admin, check Free plan and current quota on Users and Packages.
2. Submit a Starter request. Confirm the account's plan and quota **do not change** merely by submitting.
3. Start PromptPay Test Mode and verify charge created and QR shown; before payment, confirm request remains pending and plan unchanged.
4. Complete the provider's test payment workflow; use **Check Omise status**; only a confirmed successful charge should change the plan, expiry, quota and device entitlement.
5. Repeat status verification three times and check Payment Audit: expiry should not extend again.
6. Test Omise card tokenization + 3-D Secure as supported by the test account; after redirect, log back in and check Omise status. Return URI is not evidence of payment success.
7. Simulate unsuccessful/expired payment; plan remains unchanged.
8. Retry a webhook event; ensure no duplicate 30-day activation.
9. While a charge is `creating_charge` after an uncertain API result, use **Recover Omise Charge** / manual investigation rather than creating a new charge against the same request.
10. Test with two browsers or sessions for plan consistency, with no unintentional extra device registration.

## Deployment acceptance
Never deploy live payment keys to staging, treat staging test subscriptions as non-production billing, and do not call this launch-ready until Omise merchant configuration, refunds/disputes, reconciliation and production monitoring have been reviewed.
