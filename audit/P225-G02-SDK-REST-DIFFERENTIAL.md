# P225 — G02 Firestore SDK vs REST private differential

## Live evidence (Staging)
- P223 private Cloud Function on `packtook-staging`: HTTP 503, named `UNDETERMINED`, default `PERMISSION_DENIED`.
- P224 private Cloud Function: HTTP 503, named `INVALID_ARGUMENT`, default `PERMISSION_DENIED`.
- Cloud Run IAM enforcement active, anonymous access denied; dedicated runtime identity `g02-probe-runtime@packtook-staging.iam.gserviceaccount.com`. Named Firestore database `g02-security-test` exists and has conditionally scoped viewer binding. These facts do **not** prove root cause.

## Proposed diagnostic
New private function `g02SdkRestDiagnosticProbe`, without overwriting P223/P224. On each GET:
1. Generate a random missing-document ID; use only `__g02_iam_boundary_probe__`.
2. With Firebase Admin SDK, GET missing test document in named and default databases.
3. With Application Default Credentials from **same runtime service account**, obtain short-lived OAuth access token internally via `google-auth-library` with datastore scope. Never print or return it.
4. GET the same missing document from `https://firestore.googleapis.com/v1/projects/packtook-staging/databases/{database}/documents/__g02_iam_boundary_probe__/{randomId}` using REST and token. URL is hard-pinned to this project; no request input can affect target, no response/error bodies read. In REST a 404 for this randomly missing document is classified `ALLOWED_NOT_FOUND` (does not independently prove authorization).
5. Return only four categorical statuses `namedSdk`, `defaultSdk`, `namedRest`, `defaultRest`. PASS/HTTP200 requires named allowed/nonexistent **both ways**, and default permission denied **both ways**; otherwise BLOCKED/503.

The REST API documents.get endpoint accepts a Google OAuth access token and is `GET`-only. No Firestore writes, no customer data, no Cloud Secret Manager, no IAM changes, no payment/signup, no production. Google documentation:
- https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/get
- https://firebase.google.com/docs/firestore/use-rest-api
- https://firebase.google.com/docs/firestore/manage-databases

## Preflight / Deploy (Cloud Shell operator)
On branch `review/p225-g02-sdk-rest-differential`:
```bash
gcloud config set project packtook-staging
export GCLOUD_PROJECT=demo-packtook-p184
export GOOGLE_CLOUD_PROJECT=demo-packtook-p184
bash audit/p225/deploy-staging.sh --preflight
```
If preflight passes and isolated Staging-only test function deployment is authorized:
```bash
export G02_P225_DEPLOY_EXPLICIT=YES
bash audit/p225/deploy-staging.sh --deploy
```
The script refuses production/wrong project, changed IAM binding, temporary direct Token Creator, CI deployment, and replacement of any existing `g02SdkRestDiagnosticProbe`. This is a **new**, private test function; deploy may incur Staging Cloud Build/Run costs.

After successful deploy, verify `state=ACTIVE`, runtime SA, and private Invoker enforcement and anonymous HTTP403; use an **already-authorized** identity via Cloud Run proxy to GET the service. Do NOT grant public access to bypass an invoker error. Record HTTP status and four categorical fields only. Close proxy with Ctrl+C. Do not expose credentials.

## Interpreting differential
- SDK named `INVALID_ARGUMENT`, REST named `ALLOWED_NOT_FOUND`: investigate SDK configuration/transport separately.
- Both named `INVALID_ARGUMENT`: investigate request shape or backend data/permission evaluation, no assumed fix.
- Named REST `PERMISSION_DENIED`: investigate effective permissions and IAM condition **before** changing IAM.
- Default REST `ALLOWED_NOT_FOUND`: isolation violated; stop, NO_GO.
- Both named `ALLOWED_NOT_FOUND` and both default `PERMISSION_DENIED`: isolated runtime evidence PASS, **not** an independent P188 review or product release clearance.

P188 source candidate pinned and original 8/8 gates remain NO_GO. No production deploy or public signup authorization.
