# PACKTOOK V4.9 — Active-plan purchase protection & UI accessibility

## Policy (Staging)
- Users with an **active paid plan** may not submit new paid-plan purchase requests (including same-plan renewal and downgrade) until expiry. Renewal before expiry is deliberately deferred for a later release.
- The rule is enforced in Cloud Functions `requestPlanChange` and `createOmisePayment`, not only on the web UI.
- An unpaid QR payment that was issued earlier may still be completed through the payment provider. If an active paid plan already exists when it settles, **do not downgrade, overwrite, or extend the plan**. The record becomes `payment_review` for manual resolution/refund review. This requires merchant-side handling; there is no automatic refund.
- A previously successful `paid` record remains idempotent during subsequent checks.
- Existing Starter/Basic subscriptions already changed incorrectly before V4.9 are **not automatically restored**. Verify historical payment receipts and manually correct affected accounts only after verification.
- The app remains Omise **Test Mode**, PromptPay QR only; card checkout and Operator management remain disabled.

## Deployment
```bash
cd ~/packtook-webapp
git checkout feature/firebase-auth-credits-v4
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only functions,hosting --project packtook-staging
```

## Acceptance tests
1. With an active **Basic** plan, open Packages: Basic highlighted, all paid-plan purchase buttons disabled; Starter cannot be requested.
2. Try calling `requestPlanChange({plan:"Starter"})` from an authenticated test account with active Basic plan. Must reject with `failed-precondition`.
3. Attempt to start payment for a **pre-existing unpaid Starter billing request** on the same active Basic account. Server must reject new charge creation.
4. For a test account with Free or expired paid plan, purchasing Starter can proceed via Test PromptPay; **do not use live keys**.
5. Verify a previously-created charge whose provider payment succeeds after another plan becomes active is marked `payment_review` and the active plan/expiration do not change; arrange manual merchant review, do not assume refund.
6. Recheck a paid request three times; expiration must not extend again.
7. Check six unique package icons and readable labels/buttons on desktop and mobile.
8. Confirm Users, Packing, Dashboard, Help font sizes; confirm barcode start/stop, duplicate guard and local video still function.

## Accounting caveat
A Charge with `payment_review` means the provider has confirmed payment but no automatic entitlement change occurred; its receipt must be reconciled/refunded manually by an authorized operator in Omise Dashboard. Do not conceal or treat it as a failed payment.
