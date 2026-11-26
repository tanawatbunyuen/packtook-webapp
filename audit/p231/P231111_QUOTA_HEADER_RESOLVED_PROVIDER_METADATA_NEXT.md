# P231.111 — App Check API GET now responds 200 with quota header

Date 2026-11-26. Operator reported P231.110:
- P231_APPCHECK_API_ENABLED=YES
- P231_QUOTA_PROJECT_USE_PERMISSION=ALLOWED
- P231_ENTERPRISE_WITH_QUOTA_HEADER=HTTP_200
- P231_V3_WITH_QUOTA_HEADER=HTTP_200
- P231110_DIAGNOSTIC_EXIT_CODE=0
- No IAM grant, provider update, deployment, cleanup or E2E.

Interpretation: these results strongly implicate missing quota project attribution in the prior 403s. They establish GET accessibility, not validated attestation or valid Firebase App Check tokens. Do not add more permissions just because the original GET failed.

Read-only P231.111 script uses the same quota header and checks only if Enterprise config GET response has a nonempty `siteKey`; never outputs its value. It also reports presence of the `tokenTtl` metadata field. **Important:** Firebase App Check REST v1 deliberately never returns `recaptchaV3Config.siteSecret`, so a 200 GET cannot confirm whether the v3 secret is configured. The script reports that explicitly instead of assuming both providers are configured.

Documentation:
- https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.recaptchaEnterpriseConfig
- https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.recaptchaV3Config

Remaining E2E gates: verified synthetic staging Auth user, successful attestation from the staging Web app with a registered provider, legitimate App Check token, exact IAM identity token and controlled same-revision valid/missing/invalid cases. The user's P231.94 authorization was for one day (2026-11-26 Asia/Bangkok); if it expires, get renewed approval. No cleanup without separate explicit consent.

P231_PROVIDER_GET_ACCESS=PASS_OPERATOR_REPORTED
P231_ENTERPRISE_SITE_KEY_PRESENCE=AWAITING_READ_ONLY_RESULT
P231_V3_SECRET_CONFIGURED=NOT_DETERMINABLE_FROM_GET
P231_VALID_APPCHECK_TOKEN=NOT_VERIFIED
P231_APP_CHECK_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
