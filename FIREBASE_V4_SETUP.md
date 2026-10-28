# PACKTOOK V4 Firebase Architecture — Phase 1 & 2 (staging)

**Status: code prepared in feature branch. Firebase project, deployment and end-to-end tests NOT completed.** Existing GitHub Pages demo stays unchanged.

## Architecture
- Web: current HTML/CSS/JS app; Firebase staging auth page is `firebase-v4.html`.
- Identity: Firebase Authentication (email/password + email verification + password reset).
- Database: Firestore `accounts/{uid}`, nested `recordings/{operationId}` and `audit/{eventId}`.
- Authorization: Firestore Security Rules allow owner READ only; all writes are forbidden from web SDK and are performed by privileged Cloud Functions.
- Server: Firebase Cloud Functions v2 callable HTTPS APIs: `usageStatus`, `reserveCredit`, `finalizeCredit`.
- Video: WebM files remain local. No video upload.

## Setup
1. Create separate Firebase staging project in https://console.firebase.google.com, optionally upgrade to Blaze as required for deploying functions.
2. Turn on Authentication > Email/Password and configure authorized domains and email template URLs. Add your staging and future production domains.
3. Create Cloud Firestore in the closest appropriate supported region. Choose its location before data is stored.
4. Register Web App in Project settings and copy its PUBLIC web config into `firebase-v4-config.js` based on `firebase-v4-config.example.js`. DO NOT commit service account JSON or private keys.
5. In project root, install Firebase CLI (`npm install -g firebase-tools`), `firebase login`, `firebase use --add`; deploy using `firebase deploy --only firestore:rules,functions`.
6. Serve branch staging assets over HTTPS and open `firebase-v4.html`. GitHub Pages currently publishes main only; a feature branch HTML path is NOT a deployed working URL.
7. Perform negative, concurrency and security tests (below) before integrating with PACKTOOK Packing or opening paid access.
8. Enable Firebase App Check for Web (reCAPTCHA Enterprise) then turn on `enforceAppCheck:true` in Cloud Functions. Rate-limit abusive endpoints, set Cloud budget alerts, activate monitoring/alerts.
9. Implement secure billing webhooks, device binding, usage periods, reservation recovery and admin audit tooling before commercial release.

## Credit lifecycle
- `usageStatus`: returns plan, used, reserved, remaining.
- `reserveCredit({operationId,barcode})`: atomic Firestore transaction; one active reservation per operation ID; simultaneous requests cannot overdraw.
- `finalizeCredit({operationId,success,filename,bytes})`: idempotent finalization; success consumes credit, failure releases pending reservation. Client-provided file metadata is NOT cryptographic proof of a valid file.
- Completed usage is not refunded on local video deletion.
- Current quota: Free 20, Starter 50, Basic 300, Growth 1500, Business 5000, Pro unlimited. Plans must be modified only by trusted server-side billing/admin logic.
- Current monthly period rolls over by UTC calendar month; **commercial deployment must replace this with subscription billing-anchor based periods**.
- Pending reservations currently do NOT automatically expire. Add safe timeout/reconciliation with heartbeat before production.
- Current sample is owner-only. Staff accounts and device limits are NOT implemented.

## Testing
1. New verified user can obtain Free account.
2. Unverified user cannot call quota functions.
3. Changing Browser localStorage has no effect on credit counts.
4. Clients cannot write to account, recordings or audit collections directly.
5. Account A cannot read account B.
6. Repeating same operationId does not reserve twice.
7. Two parallel requests for last free credit accept only one.
8. Finalize twice does not double-charge; fail after completion is rejected.
9. Video file deletion does not refund a consumed credit.
10. AppCheck, stolen/expired token, network disconnect and concurrent operator cases require additional testing.
11. Test 30+ minutes of camera recording, corrupted local WebM and interruption during finalize.

## Migration note
Previous experimental Supabase work remains in `feature/secure-auth-credits-v4` for reference. New feature branch `feature/firebase-auth-credits-v4` is the chosen Firebase implementation. Avoid merging both server implementations.

**Caution:** Browser-side WebM recording can be modified by a user, so server credits protect entitlement and accounting, not local recording code integrity.
