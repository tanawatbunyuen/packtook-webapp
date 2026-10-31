# PACKTOOK V5.2.1 — Reservation review when plan purchase is blocked

**Scope:** Firebase staging branch `feature/firebase-auth-credits-v4`; no automatic credit refund and no real payments (Omise Test Mode only).

## Root cause
The Packages page and server intentionally reject purchases when `reserved > 0`. A browser may close before finalizing a packing video, leaving an active `accounts/{uid}/recordings/{operationId}` record and corresponding reserved credit. The original Packing recovery button depends on local browser storage and may not see reservations from another browser/device.

## Fix
- Cloud Function `pendingVideoReservations` lists the logged-in account's reserved recording operations and timestamps (maximum 100 returned). It never changes credits or video files.
- Packages displays a reservation review section when `reserved > 0`.
- If a reservation is **at least 30 minutes old** and the user has verified that **no computer is currently recording it** and **no usable video was saved**, the user may confirm cancellation via the new Cloud Function `recoverStaleVideoReservation`.
- Server rechecks status, owner, creation timestamp and reservation count in a Firestore transaction, then marks the record failed, restores/removes its barcode lock, refunds one held wallet credit where applicable, and records an audit event.
- Multiple recovery requests are idempotent; the same reservation cannot return more than one credit.
- If the browser owns the pending operation and it is less than 30 minutes old, use the existing **Packing → ตรวจสอบเครดิตจองค้าง** flow after confirming no usable video was saved. This is intended only for local pending operations.
- If the account reserved counter is nonzero but no reserved recording exists in Firebase, do **not** blindly reset the counter; report for administrative review.
- Real REC sessions still block purchases. No Operator/credit-card modules enabled.

## Deploy
```bash
cd ~/packtook-webapp
git checkout feature/firebase-auth-credits-v4
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only functions,hosting --project packtook-staging
```
If partial deployment fails, retry the failed Function(s) by name, then Hosting.

## Checklist
1. Account with Starter and a reserved recording: Packages shows `ตรวจสอบเครดิตจองค้างด้านล่าง`, not a purchasable button.
2. Review section shows the correct barcode, reservation age and account-owned entry.
3. Reservation less than 30 min old cannot be canceled through the Packages recovery flow.
4. Reservation at least 30 min old is manually reviewed: no file, no active REC anywhere; confirm cancellation.
5. After recovery, `reserved` decreases by 1; wallet refunds exactly one credit if it was held.
6. Confirm the same recovery twice; no second credit refund; duplicate barcode protections still work.
7. After all pending reservations are resolved, Starter -> Basic upgrade button becomes available.
8. Complete Test PromptPay upgrade: old remaining + 300 Basic credits, previous expiry +30 days, unchanged on three repeated checks.
9. Complete an actual recording (not recovered): debit one credit, no accidental refund.
10. Verify other devices' active recordings cannot be incorrectly canceled through the UI without the 30-minute eligibility and explicit confirmation.

Do **not** manually change `reserved`, `used`, or `creditWalletRemaining` in Firestore. Do not cancel a reservation if a usable video file was saved.
