# PACKTOOK P62 — Controlled Staging Source Attestation

**Status: NOT EXECUTED against Staging. NO_GO_RELEASE.**

Run only on a trusted operator workstation or Cloud Shell with a read-only
identity authorized for Cloud Functions metadata and the pinned source
archive objects in **packtook-staging**. Do not add service-account keys,
tokens, secrets or bucket paths to GitHub or CI.

The working tree must be checked out at
`review/p62-controlled-staging-attestation-operator`. This is a
manual operator-only procedure (not a GitHub Actions job):

```bash
git checkout review/p62-controlled-staging-attestation-operator
gcloud config get-value project
# Verify that it is exactly packtook-staging before proceeding.
export RR_STAGING_PROJECT_ID=packtook-staging
export P62_ALLOW_STAGING_READ=YES
python3 production/scripts/p62-controlled-staging-readonly.py --execute
```

The script refuses execution without both explicit opt-in values, the correct
Git branch and an installed gcloud CLI. The underlying P61 attestor reads
5 pinned Source ZIP object generations, then checks all five function
generations and update timestamps again. It emits no source, credentials,
bucket names, or object identifiers. It requires a source match and stable
revision before exit code 0.

**Exit code 0 is source-byte/revision attestation only**, not proof of
Firebase App Check enforcement, behavior equivalence, or release approval.
A code or version mismatch must be investigated; do not work around the
guard or switch to Production. Record only the allowlisted summary outcome,
commit SHA, and inspection date in the review; do not upload raw logs or
archive contents.

If exit code 2 occurs, preserve NO_GO_RELEASE. Do not deploy.
