# P231.110 — App Check config GET returns 403 with project permissions allowed

Date: 2026-11-26. Staging Cloud Shell operator-reported:
- P231_APP_CHECK_IAM_PROBE=READABLE
- P231_ENTERPRISE_GET_PERMISSION=ALLOWED
- P231_V3_GET_PERMISSION=ALLOWED
- P231_ENTERPRISE_CONFIG_HTTP=HTTP_403
- P231_V3_CONFIG_HTTP=HTTP_403
- P231109_DIAGNOSTIC_EXIT_CODE=0
- No App Check token, cloud resource mutation or E2E.

These permissions are necessary but do not prove a specific API GET is authorized. Distinct possibilities include quota project requirements, `serviceusage.services.use`, restricted OAuth scopes, API enablement, resource policies, or other constraints. Do not grant additional IAM until the blocker is evidenced.

Google's `gcloud auth print-access-token` documentation specifically recommends `X-Goog-User-Project` if a REST API request fails from an unspecified quota project: https://docs.cloud.google.com/sdk/gcloud/reference/auth/print-access-token . The App Check config GET resource is https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.recaptchaEnterpriseConfig/get .

`p231110-quota-header-diagnostic-readonly.py` verifies staging identity, one registered web app and enabled service (read-only), tests `serviceusage.services.use` on the staging project, then makes two **GET-only** calls with `X-Goog-User-Project: packtook-staging`. It prints HTTP status only and does not print/access response bodies, IDs, site keys or tokens. No Firebase changes, IAM writes, invoke, deploy or cleanup.

Interpretation:
- 200: a config record is readable with explicit quota project; this does not prove attestation/token issuance.
- 404: not found or resource mismatch; cannot automatically conclude app has no provider.
- 403: still blocked; next review access-token scopes and sanitized error reason, do not elevate role automatically.
- `serviceusage.services.use` not granted: quota header can also return 403; any IAM change needs scoped user approval.

P231_AUTHORIZATION_ROOT_CAUSE=UNRESOLVED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
