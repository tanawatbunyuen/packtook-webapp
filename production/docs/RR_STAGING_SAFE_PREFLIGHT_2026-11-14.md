# PACKTOOK — Staging safe preflight after Owner's 4/5 checklist
2026-11-14 / Project `packtook-staging` only / NO_GO_RELEASE / PUBLIC CLOSED / NO MERGE / NO DEPLOY.

## Information supplied by Owner
Owner reports **completed**: (1) App Check Registration/Provider, (2) reCAPTCHA Site Key/Allowed Domains, (3) rotated password and Owner login via Staging, (4) Omise Test Mode has a Test Charge.
Owner reports **NOT completed**: (5) Omise Test Secret in staging Secret Manager.

Treat Owner's checklist as **self-reported**, not independently authenticated review evidence. The previously observed `appCheck/initial-throttle` on the GitHub headless runner was not re-tested here, deliberately avoiding repeated throttled requests.

## This PR actually tests
- Live unauthenticated HTTPS GET of `https://packtook-staging.web.app/`, `firebase-v4-config.js`, and `firebase-packing-bridge.js` verifying the Firebase `projectId`, `authDomain`, callable functions region and source-level App Check initialization.
- Local fail-closed contracts with **mock Omise API only**, including strict test-only GET, invalid key/charge, livemode false, mismatch, timeout.
- No tokens, no secrets, no authentication attempts, no App Check forced token generation, no real Omise API requests, no Firebase writes. A public web-app apiKey is not an Admin secret; never put a server Omise secret in the browser app.

## Safest next operator action: staging Secret Manager
Use Google Cloud Console **project `packtook-staging`**:
https://console.cloud.google.com/security/secret-manager?project=packtook-staging

1. Confirm top project selector says `packtook-staging` not `packtook-prod-01`.
2. Create a dedicated *staging-only* secret, e.g. `PACKTOOK_OMISE_TEST_SECRET_KEY`. Enter `skey_test_` **in Cloud Console directly**; never share it through this chat or GitHub, screenshots, Actions logs or the browser.
3. Grant **Secret Manager Secret Accessor** to the exact Staging runtime **service account only on that secret**. Never grant Owner test account or generic GitHub runners production secret access. Keep IAM changes in Staging with named Owner approval, logging and minimal scope.
4. Configure a separately authorized isolated staging runner (e.g. staging Cloud Run Job) to mount that secret read-only at `/run/secrets/omise-test-secret`; use workload identity / runtime service account, no JSON service account key file.
5. Set non-secret expected charge mapping in the staging runner: approved `chrg_test_...`, THB satang amount, accountId and requestId. The runner `rr-execute-authorized-isolated-staging.mjs` also requires a **separate** real limited-use App Check token mounted at `/run/secrets/appcheck-token`; therefore secret setup alone does not trigger this combined proof.
6. Test read-only `GET /charges/{chrg_test_id}` after mounting, verify livemode false, amount/ownership, status and redacted logs; never create/refund charges or grant credits.

## Human and external blockers
- App Check real token & replay: BLOCKED by `appCheck/initial-throttle` on GitHub headless runner; verify in supported Owner-controlled browser in isolated Staging. A returned token alone is not server validation/replay proof.
- Actual Omise TEST read: NOT EXECUTED until test Secret is mounted on an authorized runner.
- Actual Owner role: reported successful login, but Owner claims not observed by these read-only GitHub jobs.
- Reviewed base integration, independent Security/Finance/Legal/Owner signoffs and controlled pilot remain BLOCKED.

**Decision: safe preflight only, never a production release approval.**
