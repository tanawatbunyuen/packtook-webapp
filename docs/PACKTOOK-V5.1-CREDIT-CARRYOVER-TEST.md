# PACKTOOK V5.1 — Credit carryover + remaining subscription days

**Status:** committed to Firebase staging branch only. Not yet deployed or verified on real Firebase / Omise Test Mode.

## Customer rule

When a user makes a qualifying new paid purchase:
1. Preserve **all remaining usable video credits** from a still-valid prior subscription, and add the full credits of the newly purchased tier.
2. Preserve the current valid subscription's **expiry date/time** and add **30 calendar days** to that timestamp.
3. Update plan, credit balance and expiry **once only after confirmed Omise Test payment**, under Firestore transaction.
4. Existing purchase restrictions remain: while paid subscription is active, user may renew the same tier during last 7 days, or repurchase the same/higher tier if credits are 0; no active downgrade.
5. Unused Free-plan credits also carry into the first paid purchase. Unused credits of an **already expired** paid subscription do **not** carry into a new paid term.
6. Pro is unlimited. An unlimited balance is not converted into an arbitrary numeric count.
7. One open payment request per account; only cancel an uncharged pending request. A charge that cannot safely apply is flagged for manual review, never silently applied/refunded.
8. **No automatic refunds, auto-renewal, credit-card payments, or Operator role.**

### Examples

| Old status | Bought | New video credits | New expiry |
|---|---|---|---|
| Active Basic, 80 credits left, 5 days remaining | Basic (300) | **380** | Old expiry + 30 days (35 days from now) |
| Active Basic, 0 credits left, 15 days remaining | Growth (1,500) | **1,500** | Old expiry + 30 days (45 days from now) |
| Free, 12 credits left | Starter (50) | **62** | Payment confirmation + 30 days |
| Expired Basic, 80 credits left in history | Basic (300) | **300** | Payment confirmation + 30 days |
| Active Pro, near expiry | Pro | **Unlimited** | Old expiry + 30 days |

## Implementation

New account fields after first successful V5.1 paid activation:
- `creditWalletV1: true`
- `creditWalletRemaining: number | null` — spendable credits, **already excludes credits reserved by in-progress recordings**.
- `walletStartingCredits: number | null` — balance immediately after the latest paid purchase for display.
- `reserved` — global outstanding reservations after the wallet migration, including across calendar month changes.
- `used` and `period` — monthly usage reporting; **do not reset the persistent wallet when the month changes**.

Payment record snapshots: `creditsPurchased`, `transferredCredits`, `balanceAfter`, `expiryBefore`, `activationExpiresAt`.

`reserveCredit`: wallet decremented by one when a new video starts.
`finalizeCredit(success)`: release reservation; completed video retains the deduction.
`finalizeCredit(failure)`: release reservation **and return one credit** to wallet.
All of these are Firestore transactional/idempotent existing operations.

For **legacy accounts that have not yet made a successful V5.1 payment**, existing calendar-month counting remains as-is. First successful qualifying V5.1 payment converts remaining active legacy credits into a persistent wallet. Earlier payments are not retrospectively rewritten.

## Deploy

```bash
cd ~/packtook-webapp
git checkout feature/firebase-auth-credits-v4
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only functions,hosting --project packtook-staging
```

If one Function fails:
```bash
firebase deploy --only functions:omisePaymentStatus --project packtook-staging
firebase deploy --only hosting --project packtook-staging
```
Do not delete Functions as a deployment workaround.

## Acceptance test checklist

1. Active Basic 80 remaining, 5 days to expiry -> renewal Basic request allowed.
2. Before Omise test payment: unchanged Basic, 80 credits, same expiry.
3. After successful test payment: Basic, **380** usable credits, original expiry + 30 days.
4. Recheck payment status 3 times: still 380 credits and same expiry (no double grant).
5. Record/finish one new barcode successfully -> remaining 379; restart app, still 379.
6. Start a test recording, fail/cancel and finalize with `success=false` -> 1 credit returned to wallet, no negative reservations.
7. Exhausted Basic 0 remaining, 15 days left -> pay Growth test -> 1500 credits, expiry old +30, **not reset to payment date**.
8. Cross over to another calendar month (in an isolated test account) -> credit wallet remains unchanged.
9. While an unfinished recording has a reserved credit, prevent purchase until it is finalized.
10. Payment verification 3 times does not double-add credits or expiry; audit shows transferred, purchased and final balance.
11. Free account with 12 remaining -> Starter paid -> 62 remaining.
12. Expired Basic with historical leftovers -> new Basic -> only new 300 credits.
13. Pro renewal within 7 days -> unlimited remains unlimited.
14. Users/Packages/Packing/Dashboard credit balance and video counts render clearly; PromptPay only, no credit-card button.

**Do not change real account credits or dates directly in Firestore to simulate tests.** Use isolated staging users and server-verified test payments. Complete existing REC sessions before testing checkout.
