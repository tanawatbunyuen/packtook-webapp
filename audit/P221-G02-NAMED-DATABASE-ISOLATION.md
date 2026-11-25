# P221 — G02 Named Firestore Database Isolation (review only)

## Operator-observed starting point
- Staging project: packtook-staging
- Only listed Firestore DB: (default), Firestore Native, asia-southeast3.
- Dedicated runtime SA g02-probe-runtime@packtook-staging.iam.gserviceaccount.com exists, with zero directly bound project roles at observation time.
- Staging usageStatus revision remains unchanged; P188/P219 is an offline verified repair, not deployed.
- There is no authenticated GCP Cloud Shell execution available to this GitHub connector. This branch DOES NOT create the database, grant IAM or deploy.

## P221 correction
P220's original probe called admin.firestore(), implicitly connecting to (default). P221 **replaces it with explicit** getFirestore(admin.app(), "g02-security-test"), and fails if an accidental (default) configuration is introduced. Firebase Admin SDK supports named Firestore databases (Firebase reference: https://firebase.google.com/docs/reference/admin/node/firebase-admin.firestore).

P220 deploy-staging.sh now fails closed until **both**:
1) projects/packtook-staging/databases/g02-security-test exists; AND
2) exactly one project-level IAM role for the dedicated SA: roles/datastore.viewer with the database-scoped IAM Condition
resource.name=="projects/packtook-staging/databases/g02-security-test".

This is project-level conditional IAM; it is NOT a database IAM policy or document-level access control. Verify inherited IAM, resource-level IAM and IAM Conditions behavior independently before deployment. Do not give the service account roles/datastore.user.

## Operator commands (separate execution in authenticated Cloud Shell)
Use only if explicitly approved to create the new database and modify Project IAM:
```bash
gcloud firestore databases create \
  --project=packtook-staging \
  --database=g02-security-test \
  --location=asia-southeast3 \
  --type=firestore-native \
  --delete-protection

gcloud projects add-iam-policy-binding packtook-staging \
  --member=serviceAccount:g02-probe-runtime@packtook-staging.iam.gserviceaccount.com \
  --role=roles/datastore.viewer \
  --condition='expression=resource.name=="projects/packtook-staging/databases/g02-security-test",title=G02NamedDbViewerOnly,description=Read-only synthetic probe database'
```
Official reference for conditional access: https://firebase.google.com/docs/firestore/manage-databases#configure_per-database_access_permissions
These commands intentionally do NOT write test data, update (default), deploy, alter appcheck/IAM invoker, or touch production. They may incur Cloud costs and require applicable IAM permissions. New named databases do not share default database data. Be mindful of project quota and delete-protection lifecycle.

After verifying db existence and condition, from a checked-out copy of this exact branch:
```bash
gcloud config set project packtook-staging
export GCLOUD_PROJECT=demo-packtook-p184
export GOOGLE_CLOUD_PROJECT=demo-packtook-p184
export G02_PROBE_SERVICE_ACCOUNT=g02-probe-runtime@packtook-staging.iam.gserviceaccount.com
export G02_STAGING_DEPLOY_EXPLICIT=YES
bash audit/p220/deploy-staging.sh --deploy
```
This deploys ONLY g02AuthzProbe, never the full P188 exports. To actually perform real positive/negative tests, use test-only UID accounts in the named database and verified Firebase Auth + App Check tokens and an invocation authorization design that does not open the callable to the public. No automatic test user creation exists in this branch.

G02 remains NO_GO. Local-only mocks and the separate probe do NOT attest real deployed P188 handlers or close production release gates.
