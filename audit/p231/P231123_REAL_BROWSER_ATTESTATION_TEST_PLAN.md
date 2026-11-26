# P231.123 — Isolated Browser Attestation Proof (without token disclosure)

P231.121 reported `DOMAIN_ALLOWLIST_GATE=PASS`: reCAPTCHA Enterprise allowed the staging host, allowAllDomains disabled, site key matched registered Firebase App Check config in P231.120. No real browser attestation or valid token had yet been demonstrated.

This file accompanies `audit/p231/isolated-test/p231123-browser-appcheck-attestation-console.js`. The operator can paste the JavaScript **only** in Chrome/Edge Developer Tools Console on `https://packtook-staging.web.app` during the originally approved `2026-11-26` Bangkok test window. If it is another date, script fails closed, and new explicit approval is required.

The script: checks exact origin/project, rejects an existing debug token setting, fetches the already public staged bridge and extracts the literal site key in memory, initializes a separately named temporary Firebase app using the hosted config and Enterprise provider, and calls `getToken(..., true)` **once** to force a real browser attestation exchange. It only prints whether the token was nonempty/unexpired and no token value, key value, Firebase app config, error body, HTTP headers or user identity. `deleteApp` is attempted afterwards; browser-side cached App Check state and billing-side attestation assessments may still occur.

**Scope limitation:** This validates whether a temporary browser instance can successfully obtain an App Check token using the public staging config/key. It does NOT prove the existing deployed Bridge actually initializes and uses App Check in its own app, that a callable backend received the token, verified Firebase Auth, or rejected missing/invalid tokens. Do not upgrade Runtime E2E gate based on this probe. Console output should be copied only as the `P231_...` lines, never as a screenshot containing sensitive Network details.

Do not open production pages or create test accounts through public signup. Do not send bearer credentials, replay tokens, use debug tokens, disable Cloud Run IAM, invoke `usageStatus` or billing/credit handlers, change IAM, deploy anything, or delete the isolated function. If script reports `TOKEN_ISSUANCE_OBSERVED`, follow up with authorized synthetic staging Firebase Auth and *isolated* Cloud Run invocation tests under a fresh approval if needed.

Firebase documentation: https://firebase.google.com/docs/reference/js/app-check and https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider .

P231_DOMAIN_ALLOWLIST=PASS_OPERATOR_REPORTED
P231_REAL_BROWSER_ATTESTATION=AWAITING_OPERATOR_RESULT
P231_FUNCTION_RUNTIME_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED