# P119 — Cloud Shell staging-only read-only inventory collector

This operator script makes **read-only** `gcloud functions list` and `gcloud functions describe` calls for `packtook-staging`, region `asia-southeast1`, and exactly two named functions.

It requires an authenticated Cloud Shell with read privileges to the staging project. It never fetches secret values, prints environment variables, deploys, or accesses production. Output is selected fields only and is **not a deployment authorization**.

## Command in Cloud Shell

```bash
git clone https://github.com/tanawatbunyuen/packtook-webapp.git
cd packtook-webapp
git fetch origin review/p119-staging-cloud-inventory-operator
git checkout review/p119-staging-cloud-inventory-operator
bash audit/p119-staging-cloud-inventory-readonly.sh
```

The user must run this in their authorized Google Cloud Shell because this assistant's connector has GitHub access but no Google Cloud IAM/Cloud Shell runtime.

## Audit rule
Any missing function, unexpected fully-qualified ID or CLI error blocks further steps. Inspect `P119_FIREBASE_CODEBASE_LABEL` and revision provenance before staging deployment. Labels may be absent or inconclusive; do not silently adopt the source `default` codebase as deployed truth. Site key registration and real App Check requests still require independent checks.
