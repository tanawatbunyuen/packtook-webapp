# PACKTOOK Omise TEST — Artifact Registry staging handoff

**2026-11-14 — Candidate only, NO actual GCP build/push or Cloud Run Job deployment by this PR.** Owner has created `PACKTOOK_OMISE_TEST_SECRET_KEY:1` and granted secret-scoped Secret Accessor to `packtook-omise-test@packtook-staging.iam.gserviceaccount.com`. That does **not** automatically grant Artifact Registry read/Cloud Run runtime execution.

## Build/publish only after operator verifies review and access
1. In Google Cloud console **project `packtook-staging`**, create Docker repository `packtook-staging-probes` in **`asia-southeast1`**. Cloud Build API / Artifact Registry API and a staging-only Cloud Build service account may need activation and minimal repository writer privileges; do **not** elevate the Omise runtime service account for building or pushing.
2. Clone the reviewed PR commit into an authenticated **isolated Staging Cloud Shell**. Review exact Git SHA before running. Make sure no local edits.
3. Run the following *preview-only* command from repository root (replace placeholder with exact current approved commit SHA):
```bash
export RR_STAGING_PROJECT_ID=packtook-staging
export RR_REVIEWED_COMMIT_SHA=<exact-reviewed-40-hex-commit-sha>
python3 production/scripts/rr-publish-omise-staging-image.py
```
4. After reviewing output, if explicitly approved to **publish image to staging**, select the right project in gcloud and run:
```bash
gcloud config set project packtook-staging
export RR_CONFIRM_STAGING_PUBLISH=PUBLISH_TO_PACKTOOK_STAGING_ONLY
python3 production/scripts/rr-publish-omise-staging-image.py --publish
```
This publishes the reviewed container image to Artifact Registry. It **does not** create or execute a Cloud Run Job. No Omise Test Secret value should be present in Cloud Shell environment; the image contains none.

## Artifact Registry image
`asia-southeast1-docker.pkg.dev/packtook-staging/packtook-staging-probes/packtook-omise-test-probe:<reviewed-sha>`

After a successful build/push, obtain its **immutable sha256 digest** from Artifact Registry UI; use the form:
`asia-southeast1-docker.pkg.dev/packtook-staging/packtook-staging-probes/packtook-omise-test-probe@sha256:<DIGEST>`

**Do not create the Job with a fake image URL or a mutable tag until a genuine image digest exists.**

## Cloud Run Job creation prerequisites (separate, not executed)
- Project: `packtook-staging`; Region: `asia-southeast1`; Name: `packtook-omise-test-probe`.
- Number of tasks 1; parallelism 1; max retries **0**; do not tick `Execute job immediately` and do not enable scheduler.
- Runtime identity: `packtook-omise-test@packtook-staging.iam.gserviceaccount.com`; verify this service account can pull the Artifact Registry image. Grant only repository-scoped Artifact Registry Reader **if required**; do not grant Editor or Project Owner.
- Mount Secret Manager secret `PACKTOOK_OMISE_TEST_SECRET_KEY`, version `1`, as file path `/run/secrets/omise-test-secret`; not an environment variable.
- Nonsecret environment variables: `RR_STAGING_PROJECT_ID=packtook-staging`, `RR_NO_PRODUCTION_WRITES=true`, `RR_PUBLIC_SIGNUP_CLOSED=true`, `RR_ENABLE_OMISE_TEST_READ=I_AUTHORIZE_TEST_ONLY_READS`, `RR_OMISE_TEST_SECRET_FILE=/run/secrets/omise-test-secret`, `RR_OMISE_TEST_CHARGE_ID=chrg_test_<APPROVED_ID>`, `RR_EXPECTED_AMOUNT_SATANG=<SATANG_INTEGER>`, `RR_EXPECTED_ACCOUNT_ID=<uid>`, `RR_EXPECTED_REQUEST_ID=<requestId>`.
- Check allowed network outbound to `api.omise.co` and TLS validation. This is a **single Omise Test Mode charge read**, not a real payment/refund/entitlement flow.
- The runner requires Omise test charge metadata `uid` and `requestId` matching configured expectations. A preexisting unrelated test charge lacking these fields will be **rejected**, not accepted.
- Before execution, verify limits, IAM, actual image digest, logging retention, and billing. Share only sanitized results, never keys or raw token.
- Owner will need to inspect Cloud Build and Job separately: this assistant currently has **GitHub access only**, no direct authenticated Google Cloud control surface. Never claim push/execution success from PR CI.

## Status
PR CI is always dry-run and offline, test-only. Production IAM, actual Omise API, real App Check token/replay, independent release approval and production merge/deploy remain blocked.
**NO_GO_RELEASE / PUBLIC CLOSED / NO DEPLOY.**
