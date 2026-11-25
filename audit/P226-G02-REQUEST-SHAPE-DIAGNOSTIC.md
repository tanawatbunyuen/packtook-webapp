# P226 — Firestore Invalid Argument Request Shape Diagnosis

## Observed live evidence
P225 runtime returned 503 BLOCKED: namedSdk=INVALID_ARGUMENT, defaultSdk=PERMISSION_DENIED, namedRest=INVALID_ARGUMENT, defaultRest=INVALID_ARGUMENT. Therefore current runtime evidence is insufficient to establish why the named database fails; do not modify IAM. The test document path and database IDs were assembled in code, not supplied by user requests.

## Safe added diagnostic
New private Cloud Function `g02RequestShapeProbe` (does not overwrite P223/P224/P225) with exactly one GET handler. Uses same runtime SA, random nonexistent document IDs, only `__g02_iam_boundary_probe__`. Compares SDK and REST for named and default databases. For SDK errors and HTTP 4xx/5xx structured REST Status errors, categorizes the message **internally** into finite allowlisted reason flags: INVALID_DATABASE_ID, INVALID_DATABASE_NAME, DATABASE_NOT_FOUND, INVALID_DOCUMENT_PATH, INVALID_RESOURCE_NAME, PERMISSION_TEXT, UNCLASSIFIED. Raw messages, fields, tokens, paths, full error JSON, stack traces are never returned or logged. REST error response processed under a 4 KB size bound, and only for errors other than 404/200. No write calls.

Note HTTP 404 for randomly absent document does not independently prove read authorization. PASS requires named SDK `ALLOWED_NOT_FOUND`, named REST `DOCUMENT_NOT_FOUND`, default SDK and REST `PERMISSION_DENIED`, and release remains NO_GO regardless.

Related official reference: https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/get and https://firebase.google.com/docs/firestore/manage-databases.

## Operator Cloud Shell
```bash
git clone --branch review/p226-g02-firestore-request-shape \
 https://github.com/tanawatbunyuen/packtook-webapp.git packtook-p226
cd packtook-p226
gcloud config set project packtook-staging
export GCLOUD_PROJECT=demo-packtook-p184
export GOOGLE_CLOUD_PROJECT=demo-packtook-p184
bash audit/p226/deploy-staging.sh --preflight
```
Only after examining preflight and retaining existing private IAM boundaries, separate isolated Staging deployment:
```bash
export G02_P226_DEPLOY_EXPLICIT=YES
bash audit/p226/deploy-staging.sh --deploy
```
This script cannot overwrite an existing `g02RequestShapeProbe`, does not change any bindings, and only deploys new PRIVATE Staging diagnostic. CI cannot deploy. After deploy, verify service state, invoker IAM enforcement, absence of allUsers/allAuthenticatedUsers. Only invoke via authorized IAM-aware Cloud Run proxy, then Ctrl+C. Do not grant public invoker/extra rights just to run a diagnostic.

## Safety / status
P188 pinned candidate generated solely for offline checks. `usageStatus`, payments, signup, production, customer documents, and IAM policies unchanged. All G02 release gates NO_GO. P226 runtime tests are NOT satisfied by mock fixtures.
