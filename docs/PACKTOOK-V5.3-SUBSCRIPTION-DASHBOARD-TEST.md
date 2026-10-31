# PACKTOOK V5.3 — Compact Subscription Dashboard & Complete Billing History

**Scope:** Firebase staging UI/UX only. Existing PromptPay, subscription renewal/upgrade, video-wallet carryover, payment audit, account permissions, and credit reservation rules remain unchanged.

## UX
- Current plan shown in one summary card: name, activity, video credits, expiry, current-month usage, reserved videos.
- Only actionable billing states appear in the **ต้องดำเนินการ** card: `pending_payment_setup`, `creating_charge`, `payment_pending`, `payment_review`. Hide card if none.
- Recent history shows **at most three paid transactions**. Tap **ดูรายละเอียด** to reveal Payment Audit and the existing three-check idempotency test.
- **ดูประวัติทั้งหมด** opens a dismissible, scrollable `<dialog>`, with genuine server-side pagination, **12 billing requests per page** via callable Cloud Function `billingHistory`.
- Full history includes paid, cancelled, failed, expired and pending requests, with relevant payment actions where appropriate. No fabricated "Audit" actions or inert buttons.
- PromptPay QR created from a dialog closes the dialog before showing the QR.
- Existing pending video reservation review remains on Packages underneath the dashboard; no changes to its refund logic.
- Responsive layout: two information cards on wide screens, one column on mobile; status badges and finance details have readable font sizes.

## Deploy

```bash
cd ~/packtook-webapp
git checkout feature/firebase-auth-credits-v4
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only functions,hosting --project packtook-staging
```

If only the new `billingHistory` function fails to deploy:

```bash
firebase deploy --only functions:billingHistory --project packtook-staging
firebase deploy --only hosting --project packtook-staging
```

## Acceptance checklist

1. Active Growth/Basic membership: current plan, expiry and accumulated video credits match Users and Packing.
2. No pending requests: action-required section is hidden; only latest three paid transactions appear beneath the summary.
3. Expand one recent transaction: **Payment Audit** and **ตรวจซ้ำ 3 ครั้ง** buttons still execute their actual Firebase operations.
4. Open **ดูประวัติทั้งหมด**: modal displays all available statuses, not just paid; use **โหลดประวัติเพิ่ม** to fetch more than twelve, and close with X or Escape.
5. Test an account with a pending request: it appears under **ต้องดำเนินการ**, PromptPay QR button creates a test charge, and QR remains visible after modal is dismissed.
6. Cancel a pending uncharged request: it disappears from actionable card and appears as cancelled in full history.
7. Test `creating_charge` and `payment_pending`: recover Charge and Omise status check continue to work; an unsafe charge remains under manual review.
8. With `reserved>0`, reservation review stays visible and is not hidden behind the new UI.
9. Browser desktop and mobile: cards are responsive, no horizontal overflow, modal scrolls independently.
10. Video Packing, Dashboard, account permissions, subscription upgrades, credit transfer, and expiry carryover work as before.

## Safety
- Test payments are Omise **Test Mode only**. Never use live payment keys in staging.
- Modal and list use DOM text nodes for payment-record fields to prevent injection.
- Server only reads billing history of the authenticated user's own account; cursor documents are also checked for ownership.
- Never reset account credits or release pending video reservations simply to test appearance.

**Source-only checks pass; real browser / Firebase deployment and acceptance testing remain to be completed by the user.**
