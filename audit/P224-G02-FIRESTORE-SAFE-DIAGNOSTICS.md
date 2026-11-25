# P224 — G02 Firestore safe error-code diagnostics

## Root observation
The operator deployed private P223 `g02IamBoundaryProbe` on Staging, revision `g02iamboundaryprobe-00001-yol`. Private invocation checks passed; actual runtime returned **HTTP 503** with `namedDatabase=UNDETERMINED` and `defaultDatabase=PERMISSION_DENIED`. Cloud Logging had an ERROR not classified from the previous filter. The named database exists, and the function uses dedicated `g02-probe-runtime`. The root cause remains **unknown**; changing IAM without a precise error would be premature.

## Repair path
P224 adds a **new** tiny private `g02IamDiagnosticProbe` (does not overwrite P223) that reads only nonexistent random documents in test-only `__g02_iam_boundary_probe__` from named `g02-security-test` and `(default)`. It maps numeric/string SDK errors to fixed *allowlisted* categories: PERMISSION_DENIED, NOT_FOUND_ERROR, FAILED_PRECONDITION, UNAVAILABLE, DEADLINE_EXCEEDED, UNAUTHENTICATED, INVALID_ARGUMENT, UNKNOWN_ERROR. It returns no raw exceptions, stack traces, token, user data, or document IDs.

**PASS requires** namedDatabase ALLOWED_NOT_FOUND **and** defaultDatabase PERMISSION_DENIED. Every other case returns BLOCKED/HTTP 503. The probe uses no Cloud Secret Manager, Firestore writes, payment, public signup, or production resources. Only project `packtook-staging`, region `asia-southeast1`, and private IAM invocation are allowed.

This code categorizes errors but does not itself prove Cloud IAM isolation until executed on real Staging. P188 and G02 remain NO_GO.

## Operator Cloud Shell commands
From a fresh checkout of `review/p224-g02-firestore-safe-diagnostics`:
```bash
gcloud config set project packtook-staging
export GCLOUD_PROJECT=demo-packtook-p184
export GOOGLE_CLOUD_PROJECT=demo-packtook-p184
bash audit/p224/deploy-staging.sh --preflight
```
If preflight passes and separate Staging-only deployment has been authorized:
```bash
export G02_P224_DEPLOY_EXPLICIT=YES
bash audit/p224/deploy-staging.sh --deploy
```
The deploy script requires the prior conditional IAM binding, checks source hashes, refuses to overwrite any existing `g02IamDiagnosticProbe`, and does not change IAM. Do **not** grant public Invoker, Token Creator, or extra Datastore roles.

Because Cloud Run IAM is private, use only an already authorized invocation identity to run GET. Do not request public access to work around 403. Stop the local Cloud Run proxy with Ctrl+C when finished. If no authorized identity can invoke the probe, preserve NO_GO and analyze source/logs privately rather than expanding privileges.

## Limitations
This probe does not deploy/attest P188. Cloud Build uses its own build identity distinct from runtime SA. Do not promote G02 on this evidence alone. Keep public signup closed and all release gates NO_GO.
