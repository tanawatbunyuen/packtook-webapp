# P231.124 — Correct App Check browser-test false-negative validator

Operator supplied console output after P231.123:
- `P231_TOKEN_RESPONSE=UNEXPECTED_RESPONSE`
- `P231_REAL_BROWSER_ATTESTATION=NOT_VERIFIED`
- `P231_APP_CHECK_TOKEN_VALUE=NOT_PRINTED`
- `P231_FIREBASE_AUTH_TEST_USER=NOT_VERIFIED`
- `P231_CLOUD_RUN_FUNCTION_INVOKE=NOT_PERFORMED`
- `P231_RUNTIME_APPCHECK_E2E=NOT_PERFORMED`
- `P231_RELEASE=NO_GO`

**Root cause in the test harness:** P231.123 checked both `result.token` and `result.expireTimeMillis` from `getToken(appCheck, true)`. Per Firebase JavaScript SDK `getToken` returns `AppCheckTokenResult` whose documented property is `token`, not `expireTimeMillis`. That latter property belongs to the provider-side `AppCheckToken` interface. The test's `UNEXPECTED_RESPONSE` is therefore potentially a false negative even when `getToken` returned a nonempty token; no actual token value was recorded so success cannot be asserted retroactively.

Official sources:
- https://firebase.google.com/docs/reference/js/app-check
- https://firebase.google.com/docs/reference/js/app-check.appchecktokenresult
- https://firebase.google.com/docs/reference/js/app-check.appchecktoken

**Fix:** Updated the existing P231.123 browser-console script to test `typeof result?.token === "string" && result.token.length > 0`, report `ISSUED_NONEMPTY` if true, and continue to never print token material. It does not claim expiration or server validation and has not been rerun by the operator. Do not use `ISSUED_NONEMPTY_NOT_EXPIRED` label.

**Safety / authorization:** The prior real-browser test was approved only for 2026-11-26 in Asia/Bangkok. The revised script preserves the same date gate. If that window has elapsed, a new explicit test-window approval is required; do not circumvent date guard. No IAM, Firebase, Hosting or Cloud Run configuration was changed; only a GitHub audit/test file was updated. Cleanup needs separate explicit approval. Public signup stays closed; production NO_GO.

P231_BROWSER_TEST_HARNESS=CORRECTED
P231_OPERATOR_BROWSER_RESULT=INCONCLUSIVE_POSSIBLE_FALSE_NEGATIVE
P231_VALID_APPCHECK_TOKEN=NOT_VERIFIED
P231_REAL_BROWSER_ATTESTATION=NOT_VERIFIED
P231_FIREBASE_AUTH_TEST_USER=NOT_VERIFIED
P231_RUNTIME_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
