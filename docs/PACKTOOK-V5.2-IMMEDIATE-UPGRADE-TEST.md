# PACKTOOK V5.2 — Immediate subscription upgrades (Staging)

## Goal
Allow an account with an **active paid tier and unused video credits** to upgrade to a strictly higher tier at any time, without waiting for credits to run out or the final 7 days.

### Business rules
- Tier order: Free < Starter < Basic < Growth < Business < Pro.
- **Upgrade while active**: allowed only for a **strictly higher tier**. Charges the **full price** of the selected tier in Omise **Test Mode** via PromptPay QR; no prorated price or credit refund.
- **Carry unused credits forward**: after payment is verified, old spendable credits + full credit allowance of new tier. Example Starter with 36 + Basic 300 = **336 usable videos**.
- **Carry time forward**: new expiration = existing expiration timestamp + 30 days. Example 30 Nov 2026 -> 30 Dec 2026 (time of day preserved).
- While active, selecting a lower tier remains blocked. Same-tier renewal remains limited to final 7 days or exhaustion of credits. Pro remains unlimited.
- A pending/unfinished video recording (reserved credit) blocks any purchase or upgrade until finalized.
- One open billing request at a time, with a cancel button only before charge creation.
- Checkout and settlement revalidate upgrade tier, current tier, expiry and billing revision. Payments that no longer qualify are **held for manual review**, not silently converted or automatically refunded.
- A verified paid billing request remains idempotent across repeated checks. Past paid orders remain unchanged.
- Card checkout and Operator role remain disabled; Firebase architecture is unchanged.

## Deployment

```bash
cd ~/packtook-webapp
git checkout feature/firebase-auth-credits-v4
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only functions,hosting --project packtook-staging
```

If a function update fails, retry that function alone and then deploy Hosting separately.

## Acceptance tests (recommended test account on staging)

1. Log in as active **Starter**, 36 credits remaining, expiry **30 Nov 2026**. Basic/Growth/Business/Pro must display **อัปเกรดแพ็กเกจ**; Starter button remains disabled unless near expiry.
2. Click Basic. Confirm full tier price 299 THB (Test Mode) and carryforward terms are shown. Before payment, balance/plan/expiry must be unchanged.
3. Click the QR button for **the open Basic upgrade request**. It must be enabled despite Starter having 36 credits left.
4. Simulate a successful Omise Test PromptPay payment. Account must become Basic, credits **36 + 300 = 336**, expiry **30 Dec 2026**.
5. Repeat payment-status checks 3 times; credits and expiry must remain unchanged.
6. Record one video; credits must decrease from 336 to 335. Failed recording restores reserved credit. Refresh browser and check persisted balance.
7. Attempt downgrade to Starter while Basic is active; UI button disabled and server request rejected.
8. Try a second request while first pending; server must reject. Cancel an uncharged request, then try again.
9. Start an unfinalized recording and attempt an upgrade; server must block until recording finishes.
10. Verify Payment Audit shows credits purchased, transferred, balance, prior expiry and new expiry; app remains PromptPay-only.

**Do not directly modify a real customer account's balance/expiry to force these tests.** Use the already available staging account and Omise Test Mode. Do not delete payment-related functions or overwrite past billing data.
