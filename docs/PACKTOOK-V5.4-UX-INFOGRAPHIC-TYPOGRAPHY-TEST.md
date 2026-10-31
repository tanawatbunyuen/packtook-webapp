# PACKTOOK V5.4 — UI usability improvements

## Scope (Hosting changes only)
This release reorganizes Packages, illustrates the Help instructions using inline vector graphics, and enlarges signed-in tab typography for better distance readability during packing. **No Firebase Cloud Functions, Firestore Rules, payments, subscriptions, reservations or database schema were changed.** Changes are on `feature/firebase-auth-credits-v4`, not the default demo branch.

### 1. Packages order
The top of the Packages tab is now:
1. Current membership and credit status dashboard
2. Pending requests and recent billing history, with full-history modal
3. PromptPay QR payment result (only displayed when populated)
4. Any outstanding video-credit reservations that need review
5. Available packages and upgrade cards below a separated **PLANS & PRICING** heading

IDs and handlers for `subscriptionRequests`, `paymentQrResult`, `planGrid`, `subscriptionHistoryDialog`, and `pendingReservationReview` are preserved. The "ดูแพ็กเกจทั้งหมด" link now scrolls to the new pricing section.

### 2. Help
The six-step guide now uses original **inline SVG infographic illustrations** (browser, camera, local folder, scan-to-record, scan-to-stop, and Dashboard history), a visual three-phase overview, an order flowchart, and three usage reminders. The icons and layouts are rendered as native HTML/SVG, so they remain responsive and crisp at different screen sizes. No external images or third-party resources are needed.

### 3. Typography
All signed-in tab labels, instructions, form fields, buttons, status badges, metrics, and tables use increased text sizes. Packing has an extra-large barcode input, recording state, REC timer, and primary scan button. Responsive styles preserve narrow-screen layouts.

## Deployment — Hosting only

```bash
cd ~/packtook-webapp
git checkout feature/firebase-auth-credits-v4
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only hosting --project packtook-staging
```

Open `https://packtook-staging.web.app/` and hard refresh with Ctrl+Shift+R.

## Acceptance checklist
1. Packages: membership summary, action-required transactions, and recent history appear above the available package cards.
2. Packages: "ดูแพ็กเกจทั้งหมด" scrolls to the lower plan list.
3. Packages: PromptPay QR appears after creating a test checkout and is fully visible.
4. Packages: a pending recording's credit-review controls appear above the plan purchase cards.
5. Packages: "ดูประวัติทั้งหมด", paginated history, status recovery, and Payment Audit buttons still work.
6. Help: six **illustrated** steps, complete flow diagram, and local-storage / recording warnings appear.
7. Help: SVG graphics are crisp and cards/flow stack responsively on phone-size viewport.
8. Packing: barcode field, packer name, camera actions, status, REC time, and credit counts are readable from several feet away.
9. Dashboard: search, date filter, history table, and video-open controls are readable and remain interactive.
10. Users and Packages: plan data, expiry, device management, and purchase buttons remain readable and usable on desktop and mobile.
11. Core regression: scanning the same barcode starts and stops recording, saved video is accessible, and wallet credits are accurate.

## Source checks
16/16 static checks passed (HTML tag structure, required IDs, tab retention, six SVGs, source JS syntax, CSS brace balance, layout order and asset versions).

**Status:** GitHub changes committed. Firebase hosting deployment and live browser tests have not been performed by the assistant.
