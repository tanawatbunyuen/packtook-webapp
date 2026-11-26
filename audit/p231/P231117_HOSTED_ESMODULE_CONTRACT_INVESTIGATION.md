# P231.117 — Staging Hosting JavaScript module contract

Date 2026-11-26. Operator P231.116 (read-only GET to staging):
- Hosted config HTTP 200, JavaScript MIME, not HTML; exports Firebase config and targets `packtook-staging`.
- Hosted config does **not** contain `recaptchaEnterpriseSiteKey` symbol; site key not parseable.
- Hosted bridge HTTP 200 JavaScript, contains `initializeAppCheck` and `ReCaptchaEnterpriseProvider`.
- Hosted index HTTP 200 HTML references the bridge.
- All HTTP 200, P231116 exit code 0; no cloud writes or E2E.

This establishes a **hosted config/bridge version mismatch candidate**, NOT yet definite ES-module import failure: the prior script checked bridge symbol presence but did not inspect its exact import declaration. If the *hosted* bridge imports `recaptchaEnterpriseSiteKey` as a named binding from hosted `firebase-v4-config.js` which lacks that export, native browser ES module instantiation would fail before App Check runs.

P231.117 GETs only the two expected public scripts on the `packtook-staging.web.app` origin, refuses redirects, and reports sanitized Boolean indicators: whether hosted bridge imports `firebaseConfig` and `recaptchaEnterpriseSiteKey` from config, whether hosted config exports them, and whether the named-import/export contract is compatible. No script source/keys/app identifiers/customer information or network responses are printed or saved. No Firebase deploy, IAM changes, token minting or active client invocation.

Interpretation:
- `FAIL_MISSING_ENTERPRISE_EXPORT`: clear static module contract defect; root cause candidate for app startup failure. Actual browser console confirmation is still pending.
- `PASS_STATIC_IMPORT_EXPORT_ONLY`: no missing named binding found by this narrow check; actual runtime and attestation still unverified.
- `INDETERMINATE` or unexpected status: review source structure safely before concluding.
- A failed static module contract is a **security/reliability blocker**; never bypass App Check or open Cloud Run public access to make test pass.

Fix proposal requires separate scope: validate staging-only correct public reCAPTCHA Enterprise site key against registration and allowed domain, align hosted config/bridge as a matched build, then stage/verify and deploy **only after owner approval**. Do not touch production, existing protected Functions, Public Signup or live accounts. Original P231.94 timebox was 2026-11-26 Asia/Bangkok; renew before active E2E if expired. Cleanup requires separate explicit authorization.

P231_HOSTED_ESMODULE_CONTRACT=AWAITING_RESULT
P231_VALID_APP_CHECK_TOKEN=NOT_MINTED
P231_BROWSER_ATTESTATION=NOT_PERFORMED
P231_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
