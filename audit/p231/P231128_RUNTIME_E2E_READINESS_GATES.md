# P231.128 — Staging runtime E2E prerequisites, read-only

## Confirmed evidence from P231.127
The browser script version P231126_TOKEN_ONLY_VALIDATOR_V2 returned `ISSUED_NONEMPTY` and `TOKEN_ISSUANCE_OBSERVED` for App Check on staging. No token value was printed, no backend invocation occurred. This is proof of observed browser-side App Check token issuance only.

## New read-only gates
- `p231128-private-invoker-preflight-readonly.sh` checks only the dedicated staging Gen2 Function/Cloud Run service, its dedicated runtime service account and direct IAM policy. Reports only counts of direct public invokers and active operator Invoker bindings. Does not mint tokens, invoke functions, or change IAM. Inherited/effective IAM remains outside this narrow direct-policy test; previously anonymous HTTP 403 was independently observed.
- `p231128-browser-auth-state-readonly.js` runs in browser console on the exact staging origin. Checks existing initialized Firebase staging app, current user presence and `emailVerified`, without calling `getIdToken`, printing user identities or logging in. A verified user in this check is **not** proof the account is synthetic; do not use production or customer data for subsequent tests.

## E2E still gated
Full E2E requires a clearly designated **synthetic staging account** with verified email, legitimate Firebase Auth ID token, valid Firebase App Check token obtained through browser attestation, and Google Cloud identity token for the private invoker with correct service audience. Tokens must remain inside a secured test environment and must never enter chat, GitHub, logs or screenshots. Test on same deployed revision valid/missing/malformed App Check after correctly authenticating IAM and Firebase Auth; corroborate errors with redacted Cloud Logging. Calling the private function requires explicit approved testing window; the former P231.94 active-test timebox was only 2026-11-26 Bangkok time. Read-only preflights do not extend that approval.

No changes to staging Functions, existing business services, IAM, hosting, public signup or production. Isolated function cleanup still requires separate authorization.

P231_REAL_BROWSER_ATTESTATION=TOKEN_ISSUANCE_OBSERVED_OPERATOR_REPORTED
P231_PRIVATE_INVOKER_CHECK=AWAITING_RESULT
P231_BROWSER_AUTH_STATE=AWAITING_RESULT
P231_SYNTHETIC_STAGING_TEST_USER=NOT_VERIFIED
P231_RUNTIME_APP_CHECK_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
