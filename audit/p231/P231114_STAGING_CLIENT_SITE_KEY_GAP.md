# P231.114 — Staging frontend client source is fail-closed with a blank App Check Enterprise site key

Date: 2026-11-26. P231.113 operator reported 10 tracked JS/HTML paths with Firebase Auth/App Check markers. Direct GitHub source inspection of branch review/p231-appcheck-runtime-readiness establishes:

1. `firebase-staging/firebase-v4-config.js` contains `projectId: "packtook-staging"` and `export const recaptchaEnterpriseSiteKey = "";` with a comment that the intentionally blank key fails closed pending owner-validated staging domain and key.
2. `firebase-staging/firebase-packing-bridge.js` imports `initializeAppCheck`, `ReCaptchaEnterpriseProvider`, and `recaptchaEnterpriseSiteKey`, and sets `appCheckReady = typeof recaptchaEnterpriseSiteKey === "string" && recaptchaEnterpriseSiteKey.trim().length > 0`. It calls `initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(recaptchaEnterpriseSiteKey.trim()),isTokenAutoRefreshEnabled:true})` **only if** `appCheckReady` is true.
3. `firebase-staging/index.html` includes module `firebase-packing-bridge.js?v=5.3.1`.
4. Root repo `firebase.json` declares hosting public directory `firebase-staging`. This is **configuration in git**, not proof of the currently deployed hosting version.
5. P231.111 REST GET returned Enterprise provider config 200 with a siteKey field present; it did not output the value. Site key presence on App Check server is distinct from the blank client key in git.

**Impact:** this tracked staging client version cannot initialize its App Check provider without configuring the client Site Key. Valid App Check token E2E via the tracked client is therefore blocked. This is not proof that actual deployed browser code is the same revision, or that a real browser would pass attestation if the site key were filled.

## Security-sensitive follow-up — no modifications authorized here
- Determine actual deployed staging Hosting JS/config revision without outputting the Site Key or app ID.
- Verify the **correct staging** reCAPTCHA Enterprise key and allowlisted domains in the owner-controlled console/attestation setup. The site key is a public client configuration field; **never** use a secret key or debug token as a stand-in.
- If the owner approves a change, update **staging client configuration only**, verify App Check initialization/attestation in a real browser, and deploy hosting **only under separate explicit approval**. Do not update production/app, production site key or any existing Functions.
- Obtain a verified synthetic staging Firebase Auth user separately. Keep private Cloud Run IAM intact and never grant allUsers to facilitate token tests.
- The original staging test period was 2026-11-26 Asia/Bangkok. If it expires, renew authorization before active E2E. Cleanup of new probe requires separate consent.

P231_STAGING_CLIENT_SOURCE_SITE_KEY=BLANK
P231_STAGING_CLIENT_APPCHECK_INIT=CONDITIONALLY_DISABLED_IN_TRACKED_SOURCE
P231_SERVER_ENTERPRISE_CONFIG_SITE_KEY=PRESENT_OPERATOR_REPORTED
P231_DEPLOYED_STAGING_FRONTEND_REVISION=NOT_VERIFIED
P231_REAL_BROWSER_ATTESTATION=NOT_PERFORMED
P231_AUTH_TEST_USER=NOT_VERIFIED
P231_E2E=NOT_PERFORMED
P231_IAM_WRITES=0
P231_DEPLOY=NOT_PERFORMED
P231_CLEANUP=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
