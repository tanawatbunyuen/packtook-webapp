# P231.129 — Browser Firebase Auth State PASS; synthetic identity still unverified

Operator-reported browser output from staging:
- `P231_CHECK=STAGING_BROWSER_AUTH_STATE_READONLY`
- `P231_EXISTING_STAGING_FIREBASE_APPS=PRESENT`
- `P231_AUTH_USER_PRESENT=YES`
- `P231_AUTH_EMAIL_VERIFIED=YES`
- `P231_SYNTHETIC_TEST_IDENTITY=NOT_ATTESTED_BY_THIS_PROBE`
- `P231_AUTH_ID_TOKEN=NOT_READ`
- `P231_APP_CHECK_TOKEN_VALUE=NOT_READ`
- `P231_CLOUD_RUN_FUNCTION_INVOKE=NOT_PERFORMED`
- `P231_RUNTIME_E2E=NOT_PERFORMED`
- `P231_IAM_WRITES=0`, `P231_DEPLOY=NOT_PERFORMED`, `P231_CLEANUP=NOT_PERFORMED`, `P231_RELEASE=NO_GO`.

Combined with P231.127/P231.128:
- Browser **App Check Token Issuance** `ISSUED_NONEMPTY` / `TOKEN_ISSUANCE_OBSERVED`.
- Dedicated Gen2 staging function ACTIVE, runtime SA matches.
- Cloud Run direct public Invoker count 0; direct active operator invoker count 1. Previous P231.105 anonymous HTTP 403.
- Browser Firebase Auth current user present and email verified, but the test **did not verify synthetic-only identity** and never read Firebase ID token.
- No isolated callable E2E has occurred.

## Important boundary
The current logged-in staging browser account must NOT be automatically assumed to be synthetic. Without owner evidence that it is an explicitly designated non-customer test account, do not reuse it to make active test calls, and do not collect/print user IDs, email addresses, credentials, bearer tokens or screenshots containing secrets.

## P231.130 controlled E2E gate plan (no invocation yet)
1. Owner/operator identifies a synthetic staging Firebase Auth user that is already email-verified. If one does not exist, stop and separately authorize creation using a staging-only administrative pathway; **do not open public signup**.
2. Confirm live staging client App Check is active on the chosen test browser; the previous temporary distinct Firebase app success is not proof that the normal frontend attaches tokens to callable requests.
3. Verify Cloud Run IAM identity token audience matches the new **private isolated** service URL. Google IAM identity token is not interchangeable with Firebase Auth ID token.
4. Securely provide **three distinct credentials in-memory only** at time of E2E: Google IAM token to `X-Serverless-Authorization`; Firebase Auth ID token to `Authorization`; App Check token to `X-Firebase-AppCheck`. No tokens in git, chat, logs, command line history, browser console output, or shared files. Test no mutation of customer data.
5. Call only `p231AppCheckIsolatedProbe` with `{"data":{}}` using identical authenticated context across VALID / MISSING / MALFORMED App Check cases. Record HTTP status + sanitized callable error code and corroborate with redacted Cloud Logging; do not ascribe 403 to App Check solely from HTTP code.
6. The originally authorized active staging test window was **2026-11-26 Asia/Bangkok**. For later active tests, renew explicit operator approval. Do not unilaterally alter date guards or deploy. Cloud Run IAM remains private.
7. Cleanup the isolated function/service and temporary security resources **only after separate explicit approval**. No production access, public signup activation, Omise/credit, or existing function changes.

P231_BROWSER_FIREBASE_AUTH_STATE=PASS_OPERATOR_REPORTED
P231_SYNTHETIC_AUTH_TEST_ACCOUNT=NOT_VERIFIED
P231_BROWSER_APPCHECK_TOKEN_ISSUANCE=PASS_OPERATOR_REPORTED
P231_PRIVATE_IAM=PASS_OPERATOR_REPORTED
P231_RUNTIME_APP_CHECK_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
