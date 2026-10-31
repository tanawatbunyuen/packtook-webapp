# PACKTOOK V5.0 — Subscription renewal and exhausted video quota

## Business rules (Omise Test Mode, Admin-only)

- Active paid membership + **quota exhausted (remaining 0, reserved 0)**: buy **same plan or a higher tier**, never downgrade. After verified successful test payment, reset the current month's used/reserved quota to 0 and add **30 days from the existing subscription expiry**.
- Active paid membership + **<= 7 days before expiry** + quota remaining: renew **same plan only**. After successful payment, add **30 days from existing expiry**; **do not reset quota early**.
- Active paid plan with >7 days and remaining quota: no new purchase allowed.
- Free or expired plan: buy any paid tier; successful purchase starts a 30-day subscription and a fresh quota.
- Pro (unlimited quota) supports early renewal <=7 days but never exhaustion top-ups.
- Server validates plan eligibility at request creation, charge creation, and confirmation. The Firestore account has a single open billing request lock to prevent multiple simultaneous purchases.
- Only cancel requests in `pending_payment_setup` with no charge. Started QR charges must be verified with Omise; paid but ineligible charges go to **payment_review** for manual resolution, not automatic activation or refund.
- A paid billing request is idempotent. `billingVersion` prevents a second pending request from reactivating an older entitlement.
- The existing **calendar-month quota** remains in use; the early renewal without exhaustion does not reset the usage counter. Top-up and new subscriptions reset usage only after provider-confirmed payment and when no reserved recording is in progress.
- This is a **full new plan payment**, not a smaller credit add-on and not automatic recurring billing. Refund handling still requires manual review.
- Existing previously paid subscriptions/transactions are not retroactively rewritten.

## Deploy
```bash
cd ~/packtook-webapp
git checkout feature/firebase-auth-credits-v4
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only functions,hosting --project packtook-staging
```
If one function update fails while others succeed, deploy it by name and deploy Hosting separately. Never delete production functions to fix partial deploys.

## 10 acceptance cases
1. Active Basic, 100 remaining, >7 days left: **no purchase**.
2. Active Basic, 0 remaining, >7 days left: **Basic and higher tiers selectable**, Starter disabled.
3. With zero remaining and zero reserved, buy Basic by Test PromptPay: before payment old plan/expiry/remaining unchanged.
4. Confirm Test payment: Basic retained, current usage reset to zero, remaining now 300, expiry extended **from old expiry** by 30 days.
5. Verify 3x: plan, quota and expiry **do not change a second time**.
6. Active Basic, <=7 days and remaining >0: renew Basic only; expiry +30 days, usage **does not reset**.
7. Try to create another billing request while one is pending: rejected. Cancel an uncharged request and confirm new request becomes possible.
8. A started QR that is later paid after entitlement changes must move to `payment_review`, not downgrade or overwrite account, and requires **manual merchant review/refund**.
9. Free or expired account can buy any paid plan; new paid activation receives full new tier quota.
10. Check Users warnings, Packages icons/buttons, and Packing barcode start/stop and Dashboard history regression.

## Important edge cases
- Do not use an account with real customer records to simulate depletion or edit counters in the production environment.
- Calendar rollover can change eligibility between QR creation and payment; paid charges not matching policy enter manual review.
- Outstanding video credit reservations must be finalized before quota-reset purchases.
- Test-mode only. No real money is collected and card checkout remains disabled.
