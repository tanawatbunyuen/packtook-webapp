# P231.59 — Token verifier IAM preflight

Date 2026-11-26. Operator-reported read-only Cloud Shell checks for service account `g02-probe-runtime@packtook-staging.iam.gserviceaccount.com`.

Results:
- Service account exists: YES; disabled: false.
- Direct **project-level** `roles/firebaseappcheck.tokenVerifier` grant: NOT FOUND.
- Effective permission from inherited IAM, group nesting and custom roles: NOT FULLY VERIFIED.
- Invoker design: REVIEW REQUIRED. Isolated callable not deployed; production unchanged.

Firebase's official App Check Cloud Functions guidance instructs operators to grant Firebase App Check Token Verifier to the runtime service account. Its relevant permission is `firebaseappcheck.appCheckTokens.verify`.
- https://firebase.google.com/docs/app-check/cloud-functions
- https://firebase.google.com/docs/projects/iam/roles-predefined-product

Important:
- Existing `g02-probe-runtime` identity originated for the restricted diagnostic and may have datastore.viewer access to a named database; it is **not automatically a least-privilege identity** for a no-Firestore test callable.
- Never add IAM bindings or enable public Cloud Run invoker as a preflight side effect.
- Prefer separate no-data runtime identity for a new isolated test; validate exact effective grants and public invocation risk in a separate deployment review.
- Callable Auth Bearer tokens (Firebase Auth) and Cloud Run IAM identity tokens are **not interchangeable**.
- Don't treat `roles/firebaseappcheck.tokenVerifier` grant as proof of actual enforcement. Three real app-check cases and revision pin still needed.

Next read-only gate: inventory all direct grants for candidate runtime identity with role names only, resolve relevant custom-role permissions without displaying other principals, and show `roles/firebaseappcheck.tokenVerifier` permission. Confirm no scope expansion or shared production role changes.

P231_SA_EXISTS=YES
P231_SA_DISABLED=false
P231_DIRECT_VERIFIER_ROLE=NOT_FOUND
P231_EFFECTIVE_VERIFIER_PERMISSION=NOT_VERIFIED
P231_ISOLATED_DEPLOY=NOT_PERFORMED
P231_PRODUCTION_DEPLOY=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
