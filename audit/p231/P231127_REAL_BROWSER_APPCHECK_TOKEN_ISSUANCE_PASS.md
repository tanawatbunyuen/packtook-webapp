# P231.127 — Real staging browser App Check token issuance observed

Date: 2026-11-26 (operator-supplied Browser Console outcome).
Tested using `audit/p231/isolated-test/p231123-browser-appcheck-attestation-console.js` with marker `P231126_TOKEN_ONLY_VALIDATOR_V2`.

Evidence:
- `P231_SCRIPT_VERSION=P231126_TOKEN_ONLY_VALIDATOR_V2`
- `P231_CHECK=REAL_BROWSER_ISOLATED_APPCHECK_ATTESTATION`
- `P231_TOKEN_RESPONSE=ISSUED_NONEMPTY`
- `P231_REAL_BROWSER_ATTESTATION=TOKEN_ISSUANCE_OBSERVED`
- `P231_APP_CHECK_TOKEN_VALUE=NOT_PRINTED`
- `P231_FIREBASE_AUTH_TEST_USER=NOT_VERIFIED`
- `P231_CLOUD_RUN_FUNCTION_INVOKE=NOT_PERFORMED`
- `P231_RUNTIME_APPCHECK_E2E=NOT_PERFORMED`
- `P231_IAM_WRITES=0`
- `P231_DEPLOY=NOT_PERFORMED`
- `P231_CLEANUP=NOT_PERFORMED`
- `P231_RELEASE=NO_GO`

Interpretation: The temporary isolated Firebase Web App instance on the staging origin obtained a **nonempty token** from `getToken(appCheck, true)` using the registered staging Enterprise site key. This is successful browser-side issuance observation. The temporary app was separate from the pre-existing frontend app.

Not yet established:
1. The deployed PACKTOOK frontend actually attaches App Check tokens to its normal callable requests.
2. A verified synthetic staging Firebase Auth user and usable Firebase ID token are available.
3. Cloud Run IAM invocation can be authenticated with an ID token whose audience is the isolated service.
4. The deployed isolated callable accepts all valid credentials and rejects missing/invalid App Check tokens. HTTP 401/403 alone cannot attribute cause without corroboration.
5. Production readiness, release approval, or cleanup approval.

## P231.128 proposal — E2E gated plan, no new cloud permissions
- Verify *only* the staging test-user email-verified claim without outputting UID, email, or bearer token. Do not create or enable public signup.
- Confirm the operator's existing private invoker grant remains scoped to the isolated service; do not make it public.
- Prepare controlled same-revision valid/missing/malformed App Check test cases using real staging tokens and distinct Cloud Run IAM/Firebase Auth credential headers in a secure operator environment, with response classification and redacted logs.
- Active requests must be within a renewed explicit approval window if after 2026-11-26 Asia/Bangkok. No production changes; no unapproved cleanup or IAM mutations.

P231_REAL_BROWSER_ATTESTATION=TOKEN_ISSUANCE_OBSERVED_OPERATOR_REPORTED
P231_APP_CHECK_BROWSER_TOKEN=NONEMPTY_NOT_RETAINED
P231_STAGING_AUTH_TEST_USER=NOT_VERIFIED
P231_RUNTIME_APPCHECK_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
