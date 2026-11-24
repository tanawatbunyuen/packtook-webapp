# P194 — G02 Browser + Real Firebase Emulator Integration

**Review only. All local endpoints are loopback and the Firebase project is demo-packtook-p184.**

The Chromium page uses the real legacy Owner account-panel HTML and the actual helper code extracted from production/app/app.js. Unlike P193, the `credit().accountRole`, `deviceStatus`, and `authorizeDuplicate` calls go through a restricted localhost-only Node bridge into the real Firebase Functions HTTP Callable Emulator, using Firebase Auth Emulator-issued signed-in IDs and Firestore Emulator records. No hosted app or production Firebase token is used.

Tests verify that a historical `ownerUid`-missing account is rejected by the real callable runtime, real deny creates no approval document or ownership backfill, an explicitly owned account returns Admin, a brand-new account is created with `ownerUid` on authenticated `deviceStatus`, and switching back to a legacy account never retains admin presentation. All browser requests are localhost-only; no production IAM/keys or privileged web requests.

This is **not** a hosted production browser E2E, real production-signature test, legitimate staging App Check token test, live customer inventory or independent security approval. All P190 external evidence requirements and P172 G01–G08 gates remain NO_GO.

Never merge/deploy, run owner migration, enable public signup or import recovered Owner functions based on these demo tests.
