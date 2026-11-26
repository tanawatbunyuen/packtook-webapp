# P231.109 — App Check provider read authorization denied; diagnostics read-only

2026-11-26 operator evidence:
- P231_REGISTERED_WEB_APP_COUNT=1
- P231_RECAPTCHA_ENTERPRISE_CONFIG=NOT_AUTHORIZED
- P231_RECAPTCHA_V3_CONFIG=NOT_AUTHORIZED
- P231_PROVIDER_READINESS=INCOMPLETE
- P231108_PROVIDER_EXIT_CODE=2
- No token minted, no E2E performed, zero IAM/Cloud writes.

**Interpretation:** API access was denied (P231.108 pooled 401 and 403 together). This does not mean the provider is unconfigured. Must distinguish actual HTTP code, evaluated IAM permission, and possible OAuth credential-scope issue before considering any access changes. Under existing user scope: **no new IAM grants**, no App Check configuration changes, no function deploy/invocation/cleanup, no Production or public signup changes.

Google documentation for GET resources uses:
- `GET /v1/projects/{project_number}/apps/{app_id}/recaptchaEnterpriseConfig`
- `GET /v1/projects/{project_number}/apps/{app_id}/recaptchaV3Config`
- OAuth scope `cloud-platform` or `firebase`.
See https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.recaptchaEnterpriseConfig/get and https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.recaptchaV3Config/get . Firebase IAM docs list the corresponding get permissions: https://firebase.google.com/docs/projects/iam/permissions/ .

Read-only diagnostic `p231109-appcheck-access-diagnostic-readonly.py` uses `:testIamPermissions` on `packtook-staging` for `firebaseappcheck.recaptchaEnterpriseConfig.get` and `firebaseappcheck.recaptchaV3Config.get`, then GETs each App Check endpoint to report HTTP status only. It does not print access tokens, Firebase App IDs, error bodies, project number, site secrets, or personal identifiers.

An ALLOWED project test is not complete proof of access to the nested app resource. 401 may indicate credentials/scopes; 403 may indicate permission, policy or API conditions; 404 can indicate missing config or other nondisclosure behavior. Do not conclude cause from HTTP code alone. A verifier-specific runtime SA role is not a general App Check config viewer role.

STOP after diagnostics and review any failed status without changing IAM automatically. The original testing window is 2026-11-26 Asia/Bangkok; any continuation beyond requires reapproval.

P231_PROVIDER_CONFIGURATION=NOT_VERIFIED
P231_APP_CHECK_E2E=NOT_PERFORMED
P231_CLOUD_WRITES=0
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
