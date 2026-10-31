# PACKTOOK V4.8.7 — Remaining payment acceptance checks (Staging)

The user reported **5/8 passed** in V4.8.6: pending plan unchanged, test PromptPay QR, no premature quota change, confirmed test payment activation, and repeat status idempotency.

## Check A: Card / 3-D Secure
1. Use a **new billing request** in Packages; choose Credit Card (Test).
2. Use the **official Omise test card** from https://docs.omise.co/api-testing ; never enter a real customer's card.
3. If Omise account supports 3DS, complete test authentication and let it return to `/?payment=return`.
4. On re-login (if needed) the app should open Packages, query the backend status, and show paid only if Omise confirms successful+paid.
5. Test failing authentication as well: the plan **must not** change. If 3DS is not enabled on the Omise test account, this is **not tested**, not passed. Ask Omise support to enable test 3DS.

## Check B: Failed/expired payment
1. Create another separate billing request, run official failure test scenario or let the test payment expire.
2. Check the status in Packages: status should be `failed` or `expired`.
3. The UI should say that the plan remains unchanged. Compare Users package, expiry, quota before/after; if another successful payment changed the plan recently use an isolated test account.
4. Retry requires a **new billing request**. Do not silently re-charge a failed payment request.

## Check C: Users overview
1. Open Users and confirm package, expiry and video quota from Firebase.
2. Verify remaining = plan quota − used − reserved (for current period), or "unlimited" for Pro.
3. Confirm a valid active paid package reads active; expired reads expired even if the expiry date is displayed.
4. Reload page and confirm the same values.
5. If backend is unavailable, do not infer a successful payment from the redirect or old local data.

## Deployment
```bash
cd ~/packtook-webapp
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only hosting --project packtook-staging
```
Only web UI code changed for V4.8.7. Payment backend remains V4.8.6.
