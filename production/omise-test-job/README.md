# PACKTOOK isolated Omise TEST Cloud Run Job — container candidate
Owner approved isolated Staging test only. This PR creates an isolated **local build** of a nonroot Node 22 container. The image is **not pushed** to Artifact Registry, and no Cloud Run Job is created or executed from this PR.

## Image
- Source: `production/omise-test-job/probe.cjs`
- Docker build context: `production/omise-test-job`
- `node:22-alpine` nonroot `USER node`, single `ENTRYPOINT`; no Firebase Admin SDK, no credentials inside image.
- Network request only after all fail-closed checks, one `GET https://api.omise.co/charges/chrg_test_...` with basic test secret, no redirect, 4-second timeout, no body.
- Verifies `livemode:false`, THB amount, metadata uid and requestId; logs sanitized PASS/FAIL only, no token, key, ID or customer data.

## Inputs (operator to configure AFTER approved image has been published to staging Artifact Registry)
| Name | Value |
| --- | --- |
| RR_STAGING_PROJECT_ID | packtook-staging |
| RR_ENABLE_OMISE_TEST_READ | I_AUTHORIZE_TEST_ONLY_READS |
| RR_NO_PRODUCTION_WRITES | true |
| RR_PUBLIC_SIGNUP_CLOSED | true |
| RR_OMISE_TEST_SECRET_FILE | /run/secrets/omise-test-secret |
| RR_OMISE_TEST_CHARGE_ID | Approved `chrg_test_...` ID (non-secret but avoid unnecessary log disclosure) |
| RR_EXPECTED_AMOUNT_SATANG | Approved positive integer THB satang amount |
| RR_EXPECTED_ACCOUNT_ID | Expected account metadata.uid |
| RR_EXPECTED_REQUEST_ID | Expected metadata.requestId |

Mounted Secret: `PACKTOOK_OMISE_TEST_SECRET_KEY:1` -> read-only `/run/secrets/omise-test-secret`. Project: `packtook-staging`. Service Account: `packtook-omise-test@packtook-staging.iam.gserviceaccount.com`. Job: `packtook-omise-test-probe`. Region: `asia-southeast1`. Tasks: 1. Parallelism: 1. Retries: 0. No schedule. Execute job immediately: **OFF** at creation. Run only after verifying exact image digest and IAM.

## Important: how to publish approved image, not yet performed
A separate Owner-authorized Cloud Build/Artifact Registry action is needed. In Staging:
1. Create dedicated Artifact Registry **Docker** repository in `asia-southeast1` if none exists, e.g. `packtook-staging-probes`.
2. Check out this exact reviewed PR commit in a controlled staging development environment.
3. Build and push image with `gcloud builds submit production/omise-test-job --project=packtook-staging --tag=asia-southeast1-docker.pkg.dev/packtook-staging/packtook-staging-probes/packtook-omise-test-probe:<reviewed-commit>`.
4. Set Cloud Run Job's image to the **immutable digest**; allow only dedicated staging runtime SA to read the image and Secret Accessor scoped to one Secret. No image or execution was performed on the cloud by this review.
5. Verify the execution result in Cloud Logging with sensitive logs disabled; `OMISE_TEST_READ_ONLY_VERIFIED: PASS` only if all expected test-charge fields match.
6. This verifies only one Omise read-only Test Mode charge. It does not verify actual App Check replay, Owner auth custom claims, Finance approval or production release.

## CI scope
GitHub Actions builds image locally, runs 20 mocked tests (no network provider requests), and asserts container exits nonzero without actual Staging secrets. No GCP credentials, production writes or provider charge creation.

**NO_GO_RELEASE / PUBLIC CLOSED / NO MERGE / NO DEPLOY.**
