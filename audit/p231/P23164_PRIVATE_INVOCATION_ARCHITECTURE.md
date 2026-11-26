# P231.64 — Private callable test invocation design (NOT DEPLOYED)

Date: 2026-11-26. Staging only. No IAM or runtime changes authorized by this document.

Cloud Run supports `X-Serverless-Authorization: Bearer GOOGLE_ID_TOKEN` for IAM and `Authorization: Bearer FIREBASE_AUTH_ID_TOKEN` for the callable simultaneously. Cloud Run checks the former when both are present. Firebase callable also uses `X-Firebase-AppCheck`. Official documentation: https://docs.cloud.google.com/run/docs/authenticating/service-to-service

This is a candidate for **operator-side** private E2E invocation (not browser CORS). It has NOT been tested on the PACKTOOK function. Firebase Auth and Google Cloud Run IAM tokens are not interchangeable. The operator must obtain both securely without printing or logging token values.

Deployment gates requiring scoped review:
1. Create dedicated staging-only runtime identity `p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com` (no SA keys), rather than G02 account with datastore.viewer.
2. Grant `roles/firebaseappcheck.tokenVerifier` to dedicated runtime principal only; review inherited grants, permissions for deployment and use of runtime SA separately. No Firestore/Omise/credit access.
3. New Function `p231AppCheckIsolatedProbe` must remain non-public at Cloud Run Invoker IAM layer. Scope `roles/run.invoker` to a single authorized operator/test principal. Never grant invoker to `allUsers` or disable the IAM check without a separate decision.
4. Retain fixed synthetic output, `enforceAppCheck: true`, `maxInstances:1`, `concurrency:1`, `timeoutSeconds:10` from the existing offline candidate. No Firebase Admin.
5. Verify runtime SA, source SHA256, active revision and logs. Compare valid, missing, malformed App Check token with same POST `{"data":{}}`, same Firebase Auth user, same Cloud Run invocation identity, same revision. Errors must be attributed to App Check, not Cloud Run IAM/CORS/auth.
6. Keep invocations sequential, stop on unexpected responses, log no secrets. Cleanup plan must be approved before test-function deployment.

Caution: a cross-origin browser preflight may not traverse private Cloud Run IAM without its own identity token. Use approved operator-side HTTP client rather than turning on public invoker.

`P231_PRIVATE_INVOCATION_DESIGN=DOCUMENTED_ONLY`
`P231_DUAL_HEADER_RUNTIME_COMPATIBILITY=NOT_TESTED`
`P231_DEDICATED_SA=NOT_CREATED`
`P231_IAM_WRITES=0`
`P231_ISOLATED_DEPLOY=NOT_PERFORMED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
