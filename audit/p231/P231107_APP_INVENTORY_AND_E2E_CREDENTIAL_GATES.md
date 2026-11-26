# P231.107 — Infrastructure preflight PASS, credential gate pending

2026-11-26 operator-reported:
- P231_FUNCTION_ACTIVE_AND_SA=PASS
- P231_CLOUD_RUN_AUDIENCE=PROVIDER_URL_AVAILABLE_NOT_PRINTED
- P231_DIRECT_PUBLIC_IAM=ZERO
- P231_GOOGLE_ID_TOKEN=NOT_MINTED
- P231_FIREBASE_AUTH_TEST_ID_TOKEN=NOT_VERIFIED
- P231_VALID_STAGING_APPCHECK_TOKEN=NOT_VERIFIED
- P231_APP_CHECK_E2E=NOT_PERFORMED
- P231106_PREFLIGHT_EXIT_CODE=0
- no IAM writes, deploy or cleanup.

The deployed source uses v2 `onCall` with `enforceAppCheck:true`, checks `request.app.appId`, requires a Firebase Auth user with `email_verified === true`, and accepts an empty data object. Source is not runtime proof.

Read-only next action: enumerate Firebase apps registered in the staging project (report WEB count, no IDs or personal data). A registered web app does not prove App Check provider configuration, attestation or that a valid token can be obtained.

## Pending secure E2E prerequisites
1. Confirm known staging-only Firebase Web App and its App Check attestation configuration without publishing debug tokens or secrets.
2. Confirm synthetic email-verified Firebase Authentication staging user; never use production users.
3. During any approved E2E, Google ID token audience is the exact Cloud Run service, in `X-Serverless-Authorization`; Firebase Auth ID token in `Authorization`; Firebase App Check token in `X-Firebase-AppCheck`. Never print these tokens, write them to repository or expose them in logs.
4. Run all valid/missing/invalid App Check cases against the same revision with identical IAM and Firebase Auth contexts. Attribute denials from response AND Cloud Logging; do not assume any 401/403 is an App Check rejection.
5. The P231.94 staging test authorization was same-day, 2026-11-26 in Asia/Bangkok; outside the date do not silently extend the test. Cleanup execution still needs separate approval.

P231_INFRA_PREFLIGHT=PASS_OPERATOR_REPORTED
P231_FIREBASE_STAGING_APP_INVENTORY=AWAITING_RESULT
P231_VALID_APPCHECK_TOKEN=NOT_VERIFIED
P231_AUTH_TEST_USER=NOT_VERIFIED
P231_APP_CHECK_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
