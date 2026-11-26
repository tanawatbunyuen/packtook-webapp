# P231.130 — Staging synthetic account owner attestation

The owner explicitly confirmed that the authenticated account used on `https://packtook-staging.web.app` is a **test account**. No email, UID, password, refresh token or ID token was requested or logged.

Supporting earlier browser read-only evidence:
- `P231_EXISTING_STAGING_FIREBASE_APPS=PRESENT`
- `P231_AUTH_USER_PRESENT=YES`
- `P231_AUTH_EMAIL_VERIFIED=YES`
- `P231_AUTH_ID_TOKEN=NOT_READ`
- `P231_RUNTIME_E2E=NOT_PERFORMED`

Assessment: browser Firebase Auth state verifies a logged-in and email-verified user; the owner's attestation identifies that user as a test account. This is not independent proof of no linkage to production data. Ensure the account is staging-only and synthetic prior to active test invocations.

Prior gates:
- P231.127 real-browser App Check token issuance observed from a **temporary independently initialized Firebase app**. It does not prove the regular deployed app auto-attaches tokens.
- P231.128 direct Cloud Run IAM: isolated function ACTIVE, operator direct invoker=1, direct public=0; P231.105 anonymous HTTP 403.
- Still no isolated callable E2E, no Firebase Auth ID token for E2E, and no verified Google Cloud IAM ID token for runtime invocation.

## Next: preflight then separate active runtime test

Read-only `p231130-runtime-gate-readonly.sh` audits deployed isolated function, private Cloud Run IAM and revision metadata. It never mints credentials or sends HTTP invocation.

After preflight, prepare a **controlled active E2E plan** requiring three distinct credentials and proven same-revision valid/missing/invalid App Check calls. Only the new isolated function may be called. Existing business functions, user credit, payment and production remain completely outside test scope.

**Authorization timebox:** P231.94 active staging testing was limited to 2026-11-26 Asia/Bangkok. Before making any new active calls after that period obtain a new explicit authorization. This read-only preflight is not authorization for E2E. Cleanup needs separate explicit approval.

P231_SYNTHETIC_STAGING_ACCOUNT=OWNER_CONFIRMED
P231_EMAIL_VERIFIED_STAGING_BROWSER=PASS_OPERATOR_REPORTED
P231_REAL_BROWSER_APPCHECK_TOKEN_ISSUANCE=PASS_OPERATOR_REPORTED
P231_RUNTIME_APPCHECK_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
