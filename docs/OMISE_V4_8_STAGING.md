# PACKTOOK V4.8 Omise payment — Staging (test only)

**Status:** code committed, not deployed or tested with Omise yet. Do not use live keys or collect real money.

## Credentials and dashboard
1. Set up an Omise account for Thailand; activate **PromptPay** with Omise support if not already enabled.
2. Obtain Test Mode API keys `skey_test_...`, `pkey_test_...` and the **test webhook signing secret** (base64 string, not the secret API key). Do not place secrets in GitHub or send via chat.
3. In Google Cloud Shell:
```sh
cd ~/packtook-webapp
git pull origin feature/firebase-auth-credits-v4
firebase functions:secrets:set OMISE_SECRET_KEY --project packtook-staging
firebase functions:secrets:set OMISE_PUBLIC_KEY --project packtook-staging
firebase functions:secrets:set OMISE_WEBHOOK_SECRET --project packtook-staging
firebase deploy --only functions,hosting --project packtook-staging
```
4. In Omise **Test** Dashboard > Webhooks, register the HTTPS URL for the deployed `omisePaymentWebhook` function, shown by Firebase CLI. Omise sends a `charge.complete` event on successful async payments. The server verifies signed raw body and retrieves the charge from Omise before activating.
5. Open https://packtook-staging.web.app/ and create a NEW paid-plan request. Use Omise Test Mode to test PromptPay and card. Check the charge in Omise Dashboard and click **ตรวจสอบสถานะจาก Omise** in PACKTOOK; validate billingRequests status and account expiration in Firestore.

## Security
- Test-only guard requires `skey_test_`, `pkey_test_`, and charge `livemode=false`.
- Card details go straight to Omise.js; PACKTOOK server receives only the disposable token.
- Only a signed webhook, or an authenticated owner query, can trigger a server-side Omise GET and reconciliation.
- Charge ID must match request record, uid, original plan, exact THB amount and provider metadata. Firestore transaction is idempotent.
- Never enable client-side Firestore writes to `accounts.plan`, `planExpiresAt`, `billingRequests`, `audit` or quota fields.
- One-time payments, 30-day access, no automatic recurring card charge or PromptPay subscription.
- **Known blocker to production:** a charge can be created at Omise but the Cloud Function may fail before saving its ID, leaving `creating_charge`. Implement operator reconciliation using Omise dashboard/event IDs plus a recovery job and test 3DS before production.
- **Known blocker to production:** refunds, disputes, expired payments, payments with older plan, renewal ordering, invoice and tax handling, repeated plan request prevention, security rules and App Check need end-to-end testing.
- `stripePaymentWebhook` and `createPaymentCheckout` were removed from code; when deploying Firebase CLI may prompt to delete old deployed functions. Confirm only after confirming they are no longer used.
