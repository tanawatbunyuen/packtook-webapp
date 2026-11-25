# P223 — Real Runtime Firestore IAM Boundary Probe

## State and scope
This branch adds an **isolated Cloud Function v2, HTTP, private**, deployed only as a new test function `g02IamBoundaryProbe`. It does not change `usageStatus`, P188 source, payment, signup, customer data, service account bindings, or production. Authenticated Cloud Shell execution is NOT available in the GitHub connector; CI tests mocks only and MUST NOT deploy.

Observed from the operator: the named `g02-security-test` Firestore database exists in `packtook-staging`; a single project-level conditional `roles/datastore.viewer` binding exists for `g02-probe-runtime@packtook-staging.iam.gserviceaccount.com`, no other project-level bindings. Temporary directly bound Token Creator to the operator has been removed.

## Runtime verification design
Uses the same dedicated runtime identity to read two *nonexistent randomly named documents* from collection `__g02_iam_boundary_probe__` in **both**:
- named database `g02-security-test`: must return a snapshot with exists=false (allowed read, nonexistent document);
- `(default)`: must return explicit Firestore **PERMISSION_DENIED**.

Only on exact paired result does it return HTTP 200 with `result=PASS`; all other conditions (including default read success or unexpected errors) HTTP 503 `BLOCKED`. Returns only categorical status, never document fields, path, exception, access tokens or credentials. Runs without performing any Firestore writes. Rejects all but GET.

Private IAM invoker is enforced by Cloud Run before handler invocation. **An ordinary Firebase Auth ID token alone does not satisfy Cloud Run Invoker IAM**; the operator needs a separately authorized, narrowly scoped invoking identity and valid OIDC identity token with matching audience. Do not enable unauthenticated access or grant public invoker just for testing.

**This is a targeted runtime IAM diagnostic, NOT a positive App Check test, P188 deployment, or independent G02 authorization signoff.** Named database alone does not prove permissions on other resources and doesn't confer document-level data isolation beyond IAM condition.

## Local CI
`node audit/p188/build-rc.js && node audit/p189/verify.js && node audit/p223/predeploy.js && node audit/p223/fixtures.js`

## Operator preflight, no deployment
From a clean checkout of branch `review/p223-g02-runtime-iam-verification`, with Cloud Shell active project `packtook-staging`:
```bash
export GCLOUD_PROJECT=demo-packtook-p184
export GOOGLE_CLOUD_PROJECT=demo-packtook-p184
bash audit/p223/deploy-staging.sh --preflight
```
This reads the project IAM policy and database metadata, checks that no function with the target name already exists, and runs exact SHA-pinned local P188 checks and P223 mock fixtures. Fail-closed if unexpected policies or missing test database. This check is not equivalent to a real Cloud IAM effective-permissions test.

## Operator-only authorized deployment
After reviewing preflight and ensuring the Cloud Run invoker IAM is not broadened:
```bash
export G02_P223_DEPLOY_EXPLICIT=YES
bash audit/p223/deploy-staging.sh --deploy
```
This creates only `g02IamBoundaryProbe` in `packtook-staging`, private, using existing `g02-probe-runtime`. It does not change old function. Deploy may fail if operator lacks Cloud Build/Service Account User permissions; do not grant broad roles merely to bypass. **Do not claim deployment success without command output.**

After deployment, have an authorized operator with Cloud Run invocation permissions perform an authenticated private GET, check only result/status codes. Validate no anonymous invocation, and inspect the deployed source/revision provenance before recording runtime pass. NEVER enable public invoker, never expose tokens in chat, and never remove existing G02 NO_GO release gates.
