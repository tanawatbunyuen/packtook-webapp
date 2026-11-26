# P231.84 — Isolated staging deploy gate and operator-identity review

Date: 2026-11-26. Operator-supplied P231.83 Cloud Shell output:
- `P231_PROJECT_ACCESS=PASS`
- `P231_RUNTIME_IDENTITY=ENABLED`
- `P231_TOKEN_VERIFIER_DIRECT_BINDING=PASS`
- `P231_FUNCTION_NAME_COLLISION=NO`
- `P231_EXISTING_SERVICE_usagestatus=PRESENT`
- `P231_EXISTING_SERVICE_recordingstatus=PRESENT`
- `P231_EXISTING_SERVICE_accountrole=PRESENT`
- `P231_PREFLIGHT_EXIT_CODE=0`
- `P231_OPERATOR_INVOKER_IDENTITY=NOT_SELECTED`
- `P231_OPERATOR_INVOKER_GRANT=NOT_APPROVED`
- `P231_DEPLOYMENT_METHOD=NOT_APPROVED`
- `P231_DELETION_CLEANUP_PLAN=REVIEW_REQUIRED`
- No Cloud IAM writes, no deployment. Runtime App Check unverified.

## Remaining pre-deployment decisions

1. **Operator invoker principal:** use a named authorized principal scoped to only the new Cloud Run service, not `allUsers` or `allAuthenticatedUsers`. Operator's Google Cloud caller identity for obtaining an ID token must be distinguished from Firebase Auth test-user identity. No bearer or identity tokens should be printed or written to disk.
2. **Cloud Run IAM:** the new callable declares `invoker: 'private'`. Do not grant service-level `roles/run.invoker` until the service is created and its exact identity is confirmed. Avoid inherited invoker permissions. Test auth layer separately from App Check.
3. **Deployment method:** prefer isolated Firebase Functions codebase and `--only functions:<isolated-codebase>:p231AppCheckIsolatedProbe` with exact target syntax validated against installed Firebase CLI version and new `firebase.json` in a temporary deployment directory; do not use the root SaaS `functions` codebase, and do not run a broad `firebase deploy --only functions`. Do not run any deploy without separate authorization.
4. **Cleanup:** prepare removal limited to the newly created function and any service-level invoker grant after an authorized test, leaving the dedicated verifier account and project IAM unchanged until independently reviewed. Capture immutable revisions and redacted status evidence only. No existing functions, credits, users, or customer data touched.

## Cautions
- SDK's callable automatic Auth header and App Check header are not Cloud Run IAM identity headers. Operator-side requests may use `X-Serverless-Authorization` for Cloud Run IAM, plus Firebase Auth in `Authorization`, and App Check in `X-Firebase-AppCheck`, but this exact deployed path has not been exercised.
- Runtime account may require ancillary service-agent and deployment permissions that are distinct from App Check verifier, not yet tested; do not elevate broad roles to make deploy succeed.
- Cloud Run existing functions have service-level public invoker grants and should not be modified under P231.

`P231_STAGING_DEPLOY_PREFLIGHT=PASS_OPERATOR_REPORTED`
`P231_OPERATOR_IDENTITY=NOT_SELECTED`
`P231_STAGING_DEPLOY_APPROVAL=NOT_GIVEN`
`P231_ISOLATED_DEPLOY=NOT_PERFORMED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_PRODUCTION_DEPLOY=NOT_PERFORMED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
