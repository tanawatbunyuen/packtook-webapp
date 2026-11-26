# P231.63 — Dedicated runtime identity and invocation architecture gate

2026-11-26. Operator reports `P231_TOTAL_SERVICE_ACCOUNTS=6`, `P231_MATCH_COUNT=0`, `P231_DEDICATED_IDENTITY=NOT_FOUND`, no IAM writes and no isolated deployment.

## Decision
- Create a **new dedicated runtime service account** only with explicit scoped authorization; do not reuse `g02-probe-runtime` (it has conditional `roles/datastore.viewer`).
- Intended email subject to availability: `p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com`; no service-account keys.
- No Firestore Admin, Datastore Viewer, Secret Accessor, Editor, or project Owner grant. Assign only necessary Firebase App Check verification permission through `roles/firebaseappcheck.tokenVerifier`, with an explicit justification and review of deployment service identity restrictions.
- Do not grant `roles/run.invoker` to `allUsers` or disable Invoker IAM check as a preflight workaround.

## Invocation architecture decision required
Firebase HTTPS callable client invocations attach Firebase Auth and App Check headers. Cloud Run Invoker IAM is a **different** authorization layer that normally requires Google-issued invocation identity tokens. The Firebase Auth ID token is not a Cloud Run IAM identity token.

For a private isolated test, prefer an authorized operator-controlled client/relay with Cloud Run IAM authorization, while forwarding Firebase Auth/App Check in the callable request and no token logging. Requires careful header and identity design to preserve both sets of authentication contexts; the existing proxy diagnostic used for G02 Firestore was not an App Check test.

For a browser-direct callable E2E, public HTTP invocation may be needed while App Check + Firebase Auth are enforced inside the Callable. This is a distinct, higher-exposure option that must be approved and tightly scoped; the word “public invoker” is not equivalent to allowing access to the handler without valid tokens.

Both paths require a deployment/revision pin, correct CORS and callable protocol, test isolation with synthetic accounts, rate limits, no storage/credit changes, evidence redaction, cleanup and cost limits. No production or existing staging function updates.

Official references:
- https://firebase.google.com/docs/app-check/cloud-functions
- https://firebase.google.com/docs/functions/callable
- https://docs.cloud.google.com/functions/docs/securing/managing-access-iam

## Gate status
`P231_DEDICATED_IDENTITY=NOT_FOUND`
`P231_IAM_CHANGE_PLAN=DOCUMENTED_ONLY`
`P231_INVOKER_ARCHITECTURE=NOT_APPROVED`
`P231_ISOLATED_DEPLOY=NOT_PERFORMED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
