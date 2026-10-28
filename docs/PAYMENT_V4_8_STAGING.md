# PACKTOOK V4.8 — Stripe Test Checkout

Status: integration code committed; NOT deployed or payment-tested.

## Setup (test mode only)

1. Create/activate a Stripe Thailand merchant account and select **Test mode**.
2. In Stripe Developers / API keys copy the **test secret key** (sk_test_...). Never put it in JavaScript, GitHub or chat.
3. In Google Cloud Shell, from the staging repository checkout, run:

    firebase functions:secrets:set STRIPE_SECRET_KEY --project packtook-staging

   Paste the test secret when prompted.
4. Deploy functions and hosting to staging:

    git pull origin feature/firebase-auth-credits-v4
    firebase deploy --only functions,hosting --project packtook-staging

   NOTE: deployment requires BOTH secrets. Configure webhook endpoint in the Stripe **test** dashboard and obtain the signing secret (whsec_...) before deploy:

    firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project packtook-staging

   For destination URL use the deployed HTTPS function endpoint of `stripePaymentWebhook` reported by Firebase CLI. Subscribe to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Ensure correct signing secret for THIS endpoint.
5. Open https://packtook-staging.web.app/ → Packages. Make a **new** test billing request, click Stripe checkout and pay with Stripe-provided test credentials. Verify Firestore `accounts/{uid}/billingRequests/{requestId}` has status `paid`, and `accounts/{uid}` has plan/planExpiresAt; refresh account page.

## Security and limitations

- Test mode must be used before any live credentials or payments.
- Stripe webhook HMAC verified from raw request body, including timestamp tolerance.
- Server checks session ID, paid status, THB currency, exact cents, request ownership and plan price.
- Payments are **one-time** for 30 days, not Stripe recurring subscriptions. PromptPay cannot be charged automatically.
- No automatic refunds, proration, receipts, taxes, cancellation, provider dispute reconciliation, cleanup of stale checkout sessions or webhook replay dashboard yet.
- Firestore Security Rules must prevent clients writing account plan, billing requests, approvals or quota directly.
- Avoid testing on accounts with a live paid subscription; use dedicated test users.
