# P231.108 — App Check provider configuration read-only discovery

2026-11-26 operator reported P231.107:
- P231_FIREBASE_APP_INVENTORY=READABLE
- P231_REGISTERED_WEB_APP_COUNT=1
- P231_VALID_APP_ID=NOT_SELECTED
- P231_APPCHECK_PROVIDER=NOT_VERIFIED
- P231_VERIFIED_STAGING_AUTH_USER=NOT_VERIFIED
- P231_STAGING_APPCHECK_TOKEN=NOT_MINTED
- P231_E2E=NOT_PERFORMED
- P231107_APP_INVENTORY_EXIT_CODE=0
- P231_IAM_WRITES=0; P231_DEPLOY=NOT_PERFORMED; P231_CLEANUP=NOT_PERFORMED

The new P231.108 Python audit obtains the ONE staging Web App ID and project number in memory via Firebase CLI and gcloud, then issues GET only to official Firebase App Check REST API v1 resources:
- `projects/{project_number}/apps/{app_id}/recaptchaEnterpriseConfig`
- `projects/{project_number}/apps/{app_id}/recaptchaV3Config`

Reference:
- https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.recaptchaEnterpriseConfig/get
- https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.recaptchaV3Config/get

A 200 config response is reported as `CONFIG_RECORD_PRESENT`; 404 as `NOT_REGISTERED_OR_NOT_FOUND`. 401/403 and API/network failures are blockers or unknown rather than treated as absent. No App ID, site key, OAuth access token, raw API response, or secret is printed. The script does not call token exchange endpoints.

**Gate limitations:** A provider config record does not prove the reCAPTCHA key is active, configured for the correct website domain, able to attest, or that Firebase App Check will successfully issue a valid token. A verified synthetic staging Firebase Auth ID token is also required. No App Check E2E has occurred. Deployment and cleanup changes are prohibited. This read-only review still follows the original 2026-11-26 Asia/Bangkok same-day test window.

P231_STAGING_REGISTERED_WEB_APPS=1_OPERATOR_REPORTED
P231_PROVIDER_CONFIG=AWAITING_READ_ONLY_RESULT
P231_VALID_APPCHECK_TOKEN=NOT_VERIFIED
P231_AUTH_TEST_USER=NOT_VERIFIED
P231_APP_CHECK_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
