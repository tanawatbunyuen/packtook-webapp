# P231.122 — Staging domain security gate passed; browser attestation remains unverified

2026-11-26, operator-reported P231.121:
- P231_RECAPTCHA_KEY_GET_HTTP=HTTP_200
- P231_ALLOW_ALL_DOMAINS=NO
- P231_STAGING_HOST_ALLOWED=YES
- P231_ALLOWED_DOMAIN_COUNT=1
- P231_DOMAIN_ALLOWLIST_GATE=PASS
- P231121_DOMAIN_EXIT_CODE=0
- P231_BROWSER_ATTESTATION=NOT_PERFORMED
- P231_VALID_APPCHECK_TOKEN=NOT_MINTED
- P231_E2E=NOT_PERFORMED
- No IAM, deploy, cleanup or provider mutations.

Site-key equality was confirmed in P231.120. This closes the server/client site-key and key-domain static gates for the observed staging hosting URL, but **does not** demonstrate browser execution, successful attestation, Firebase App Check token issuance, or protected callable runtime enforcement.

## Safe real-browser attestation investigation (no cloud modifications)

**Prerequisites**: Use a trusted, non-automated Chrome/Edge browser on the actual staging site `https://packtook-staging.web.app` in the agreed testing window. Do not use production, a copied page on localhost, Debug Token, a browser extension that intercepts credentials, or any production user/customer login. Browser may issue a real reCAPTCHA assessment: Google service quotas and billing are possible.

1. Open the staging site; press F12 > Network; enable Preserve log. Set filter to `firebaseappcheck.googleapis.com`, or `exchangeRecaptchaEnterpriseToken`. Keep Console and Network screenshots **redacted**. Do not export a HAR or display/copy response bodies, request headers, tokens, cookies, or site key.
2. Reload once, observe whether the browser makes an App Check exchange request and its HTTP status. Successful 200 **is evidence of a response to a real browser token exchange**, but a status alone is not proof that the Firebase SDK accepted the result; check SDK error state without revealing token values. A missing request remains `NOT_OBSERVED`, not `PASS`: token may be cached, App Check may initialize lazily, or browser code may fail.
3. Inspect only error **types** or SDK codes, not full error strings/stack traces with URLs or parameters. Record: `P231_BROWSER_MODULE_LOAD=PASS/FAIL/UNKNOWN`; `P231_APPCHECK_EXCHANGE_HTTP=200/4XX/5XX/NOT_OBSERVED`; `P231_BROWSER_APPCHECK_SDK_RESULT=SUCCESS/ERROR/NOT_VERIFIED`; `P231_DEBUG_TOKEN_USED=NO`. Console or Network traffic alone must never be called an E2E PASS.
4. Do not trigger any protected `usageStatus`, `recordingStatus`, `accountRole`, payment, credit, signup or video functions as part of this observation; these are out of the isolated probe's test scope.
5. A verified synthetic staging Auth user and an authorized isolated Cloud Run IAM invocation plan are separately required for valid/missing/invalid App Check runtime E2E. Do not expose credential material. The isolate remains private.

**Timebox:** P231.94 approval allowed active staging test only on 2026-11-26 Asia/Bangkok. After that date, obtain renewed explicit approval before browser attestation requests or callable E2E. These instructions are a plan, **not** authorization to extend the test window.

Firebase docs:
- https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- https://firebase.google.com/docs/reference/js/app-check

P231_KEY_DOMAIN_STATIC_GATE=PASS_OPERATOR_REPORTED
P231_BROWSER_MODULE_LOAD=NOT_VERIFIED
P231_APPCHECK_EXCHANGE_HTTP=NOT_OBSERVED
P231_VALID_APPCHECK_TOKEN=NOT_VERIFIED
P231_VERIFIED_STAGING_AUTH_USER=NOT_VERIFIED
P231_RUNTIME_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
