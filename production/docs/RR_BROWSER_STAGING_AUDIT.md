# RR Browser Staging E2E / Live App Check Source Audit
2026-11-13. The owner's supplied screenshot showed the real PACKTOOK staging login form, but also exposed a plaintext password: rotate it privately, invalidate sessions and NEVER put it into CI, repository or chat.

## This PR
- Runs headless Chromium against **https://packtook-staging.web.app** unauthenticated, checking rendered login layout, masked password control and Login route.
- Loads public Firebase bridge and reports whether the deployed browser bridge contains App Check source integration. This is a source-level diagnostic only, NOT real attestation.
- Tries to detect SDK `window.PACKTOOK_FIREBASE.ready`. It reports `NOT_CONFIRMED` if blocked by external browser/CDN conditions, not a false pass.
- **Never submits a login form, uses owner credentials, signs up users, writes Firestore, calls Omise, starts App Check consumption or deploys.**

## Follow-up blocking checks
Actual Owner login/claims requires safe authenticated browser tool/owner-side session. Actual App Check needs registered staging app, valid real token, enforcement and consumed/replay check. Actual Omise read-only TEST GET needs trusted staging runner with scoped test key and approved test charge. Authenticated browser E2E cannot be claimed based on unauthenticated page layout.

No merge/deploy/public opening. NO_GO_RELEASE.